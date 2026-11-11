// Herramientas compartidas por las pruebas: servir la app, prender PocketBase y manejar la app
// en un navegador como lo haría una persona.
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, execFileSync } = require("node:child_process");
const { chromium } = require("playwright");

const RAIZ = path.resolve(__dirname, "..");
const CAPTURAS = path.join(__dirname, "capturas");
const TIPOS = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".json":"application/json",
  ".webmanifest":"application/manifest+json", ".svg":"image/svg+xml", ".png":"image/png", ".css":"text/css" };

// Sirve la carpeta del repo como sitio, sin servidor de sincronización (como GitHub Pages)
function servirApp(){
  const srv = http.createServer((req, res) => {
    const ruta = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const archivo = path.join(RAIZ, ruta.endsWith("/") ? ruta + "index.html" : ruta);
    if (!archivo.startsWith(RAIZ) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()){ res.writeHead(404); return res.end("no"); }
    res.writeHead(200, { "Content-Type": TIPOS[path.extname(archivo)] || "application/octet-stream" });
    fs.createReadStream(archivo).pipe(res);
  });
  return new Promise(ok => srv.listen(0, "127.0.0.1", () => ok({ url:`http://127.0.0.1:${srv.address().port}`, cerrar:() => new Promise(r => srv.close(r)) })));
}

// PocketBase: el programa lo indica PB_BIN. En la acción de GitHub es obligatorio (PB_OBLIGATORIO=1);
// en un computador sin PocketBase, las pruebas que lo necesitan se saltan y lo dicen.
function faltaPocketBase(){
  const bin = process.env.PB_BIN;
  if (bin && fs.existsSync(bin)) return "";
  const msg = "Falta PocketBase: define PB_BIN con la ruta al programa (versión 0.40.5)";
  if (process.env.PB_OBLIGATORIO) throw new Error(msg);
  return msg;
}

async function prenderServidor(){
  const bin = process.env.PB_BIN;
  const datos = fs.mkdtempSync(path.join(os.tmpdir(), "mi-almacen-datos-"));
  const dir = ["--dir", datos];
  // Un administrador creado de antemano evita que PocketBase quede esperando la instalación
  execFileSync(bin, ["superuser", "upsert", "admin@prueba.local", "clave-de-prueba-123", ...dir, "--migrationsDir", path.join(RAIZ, "servidor/pb_migrations")], { stdio:"pipe" });
  const puerto = 18000 + Math.floor(Math.random() * 2000);
  const proc = spawn(bin, ["serve", `--http=127.0.0.1:${puerto}`, ...dir, `--publicDir=${RAIZ}`,
    `--hooksDir=${path.join(RAIZ, "servidor/pb_hooks")}`, `--migrationsDir=${path.join(RAIZ, "servidor/pb_migrations")}`], { stdio:["ignore", "pipe", "pipe"] });
  let log = ""; proc.stdout.on("data", d => log += d); proc.stderr.on("data", d => log += d);
  const url = `http://127.0.0.1:${puerto}`;
  for (let i = 0; i < 100; i++){
    try { const r = await fetch(url + "/api/sync/estado"); if (r.ok) break; } catch(e){}
    if (proc.exitCode != null) throw new Error("PocketBase se cerró al partir:\n" + log);
    await esperar(200);
    if (i === 99) throw new Error("PocketBase no respondió:\n" + log);
  }
  return { url, log:() => log, apagar:async () => { proc.kill(); await new Promise(r => proc.once("exit", r)); fs.rmSync(datos, { recursive:true, force:true }); } };
}

const esperar = ms => new Promise(r => setTimeout(r, ms));

// Repite fn dentro de la página hasta que devuelva algo verdadero. page.waitForFunction no sirve
// para esto: toma una promesa como verdadera sin esperarla, y la base de datos local es asíncrona.
async function esperarQue(page, fn, arg, { ms = 20000, que = "la condición" } = {}){
  const hasta = Date.now() + ms;
  for (;;){
    if (await page.evaluate(fn, arg)) return;
    if (Date.now() > hasta) throw new Error(`Pasaron ${ms / 1000} s esperando ${que}`);
    await esperar(200);
  }
}
// Espera a que el dispositivo tenga exactamente n ventas guardadas
const esperarVentas = (page, n, ms) => esperarQue(page, n => LocalDB.loadAll().then(t => t.movs.filter(m => m.type === "venta").length === n), n, { ms, que:`${n} ventas` });

async function navegador(){ return chromium.launch(); }

// Un "dispositivo": su propio navegador aislado, con tamaño de celular
async function dispositivo(browser, opciones = {}){
  const ctx = await browser.newContext(Object.assign({ viewport:{ width:360, height:740 }, deviceScaleFactor:1, acceptDownloads:true }, opciones));
  const page = await ctx.newPage();
  page.errores = [];
  page.on("pageerror", e => page.errores.push(e.message));
  return { ctx, page };
}

// Crea una tienda desde la pantalla inicial, con los productos típicos de almacén
async function crearTienda(page, url, nombre = "Almacén de Prueba"){
  await page.goto(url + "/");
  await page.fill("#sn", nombre);
  await page.fill("#sp", "Rosa");
  await page.click("#screate");
  await page.waitForSelector("#tabs [data-view]");
  await esperarQue(page, async () => !!(await LocalDB.getMeta("tienda")), undefined, { que:"que se cree la tienda" });
}

// Abre una pantalla: con su pestaña de abajo, o desde Más
async function irA(page, vista){
  const tab = page.locator(`#tabs [data-view="${vista}"]`);
  if (await tab.count()) await tab.click();
  else { await page.click('#tabs [data-view="mas"]'); await page.click(`[data-go="${vista}"]`); }
  // La app guarda la pantalla abierta en el historial (para el botón atrás del celular)
  await page.waitForFunction(v => history.state?.v === v, vista);
}

// Vende una unidad del primer producto que encuentra. Si no tiene precio, se lo pone.
async function venderUno(page, buscar, precio = 1000){
  await irA(page, "vender");
  await page.fill("#q", buscar);
  await page.click("#res [data-pick]");
  if (await page.locator("#ppr").count()){ await page.fill("#ppr", String(precio)); await page.click("#pprok"); }
  await page.waitForSelector("#confirm:not([disabled])");
  const antes = (await ventas(page)).length;
  await page.click("#confirm");
  await esperarVentas(page, antes + 1);
}

// Lo que tiene guardado el dispositivo (IndexedDB), leído con la misma base de la app
const ventas = page => page.evaluate(async () => (await LocalDB.loadAll()).movs.filter(m => m.type === "venta"));
const pendientes = page => page.evaluate(() => LocalDB.pendingCount());

// Espera a que el dispositivo no tenga nada por enviar y diga "Sincronizado"
async function esperarSincronizado(page, ms = 20000){
  await esperarQue(page, async () => Sync.state.status === "ok" && await LocalDB.pendingCount() === 0, undefined, { ms, que:"que diga Sincronizado" });
}

// Pedido directo al servidor, como lo hace la app (la sesión va tal cual en Authorization)
async function api(url, ruta, cuerpo, token){
  const headers = { "Content-Type":"application/json" }; if (token) headers.Authorization = token;
  const r = await fetch(url + ruta, cuerpo === undefined ? { headers } : { method:"POST", headers, body:JSON.stringify(cuerpo) });
  return { status:r.status, json:await r.json().catch(() => ({})) };
}

// Sello de un cambio con el mismo formato que local-db.js
let contador = 0;
const sello = (dispositivo = "prueba") => `${Date.now()}-${String(contador++ % 10000).padStart(4, "0")}-${dispositivo}`;

// El último valor de cada registro según una lista de cambios del servidor
function ultimos(cambios, store){
  const out = {};
  for (const c of cambios) if (c.store === store){ if (c.del) delete out[c.del]; else out[c.value.id] = c.value; }
  return out;
}

function captura(page, nombre){
  fs.mkdirSync(CAPTURAS, { recursive:true });
  return page.screenshot({ path:path.join(CAPTURAS, nombre + ".png"), fullPage:true });
}

module.exports = { RAIZ, servirApp, faltaPocketBase, prenderServidor, esperar, esperarQue, esperarVentas, navegador, dispositivo, crearTienda,
  irA, venderUno, ventas, pendientes, esperarSincronizado, api, sello, ultimos, captura };

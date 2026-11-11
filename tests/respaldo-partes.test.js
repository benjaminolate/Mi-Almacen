// Respaldo por correo grande: el servidor lo divide en partes que caben en un correo, y la app
// restaura todas las partes juntas. La división se prueba con la misma función del servidor.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const h = require("./ayuda");
const { partes } = require("../servidor/pb_hooks/respaldo.js");

// Un respaldo como el que arma el servidor, a partir de lo que tiene un dispositivo
async function respaldoDelServidor(page){
  const r = await page.evaluate(async () => ({ file:await LocalDB.exportAll(), tienda:await LocalDB.getMeta("tienda") }));
  const { meta, ...tablas } = r.file.tablas;
  return Object.assign({}, r.file, { origen:"servidor", tienda:{ id:r.tienda.id, nombre:r.tienda.nombre }, tablas:Object.assign(tablas, { outbox:[] }) });
}

test("un respaldo grande se divide en partes que caben en un correo, sin perder nada", () => {
  const filas = n => Array.from({ length:n }, (_, i) => ({ id:"r" + i, name:"Producto " + "x".repeat(50), price:i }));
  const file = { app:"mi-almacen", version:1, creado:"2026-11-11T04:30:00.000Z", origen:"servidor", tienda:{ id:"t", nombre:"T" },
    tablas:{ outbox:[], products:filas(300), movs:filas(900), clients:filas(20), ajustes:[{ clave:"tienda_nombre", valor:"T" }] } };
  const lista = partes(file, 10000);
  assert.ok(lista.length > 5, "no se dividió");
  for (const p of lista){
    assert.ok(JSON.stringify(p).length <= 10000, "una parte pasa el límite");
    assert.deepEqual(p.parte, { n:lista.indexOf(p) + 1, de:lista.length });
    assert.equal(p.creado, file.creado);
  }
  for (const s of ["products", "movs", "clients", "ajustes"])
    assert.deepEqual(lista.flatMap(p => p.tablas[s]), file.tablas[s], "se perdió algo de " + s);
  // Lo que cabe en un correo va tal cual, sin partes
  assert.equal(partes(file)[0], file);
});

test("la app restaura todas las partes juntas, y avisa si falta una", async () => {
  const app = await h.servirApp(), browser = await h.navegador();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mi-almacen-partes-"));
  try {
    const a = await h.dispositivo(browser);
    await h.crearTienda(a.page, app.url, "Almacén Partes");
    await h.venderUno(a.page, "arroz", 1500);
    await h.venderUno(a.page, "azucar", 1200);
    const lista = partes(await respaldoDelServidor(a.page), 20000);
    assert.ok(lista.length >= 3, "el respaldo de prueba no se dividió");
    const rutas = lista.map(p => { const f = path.join(dir, `respaldo-parte-${p.parte.n}.json`); fs.writeFileSync(f, JSON.stringify(p)); return f; });

    // Falta una parte: se avisa y no se restaura nada
    const b = await h.dispositivo(browser);
    await b.page.goto(app.url + "/");
    await b.page.setInputFiles("#srestore", rutas.slice(1));
    await b.page.waitForSelector(".toast");
    assert.match(await b.page.textContent(".toast"), new RegExp(`elige los ${lista.length} archivos`));
    assert.equal(await b.page.locator("#tabs [data-view]").count(), 0);

    // Todas las partes juntas, en cualquier orden
    await b.page.setInputFiles("#srestore", [...rutas].reverse());
    await b.page.click("#dorestore");
    await b.page.waitForSelector("#tabs [data-view]");
    assert.match(await b.page.textContent("header"), /Almacén Partes/);
    const ids = page => page.evaluate(async () => { const t = await LocalDB.loadAll(); return { p:t.products.map(x => x.id).sort(), m:t.movs.map(x => x.id).sort() }; });
    assert.deepEqual(await ids(b.page), await ids(a.page));
    assert.deepEqual([...a.page.errores, ...b.page.errores], []);
  } finally { await browser.close(); await app.cerrar(); fs.rmSync(dir, { recursive:true, force:true }); }
});

test("el servidor carga el respaldo por correo y explica que falta configurar el correo", { skip:h.faltaPocketBase() || false }, async () => {
  const pb = await h.prenderServidor(), browser = await h.navegador();
  try {
    const { page } = await h.dispositivo(browser);
    await h.crearTienda(page, pb.url);
    await h.esperarSincronizado(page);
    const tienda = (await page.evaluate(() => LocalDB.getMeta("tienda"))).id;
    const r = await h.api(pb.url, "/api/respaldo/correo", { tienda });
    assert.equal(r.status, 400);
    assert.match(r.json.message, /configurado el correo/);
  } finally { await browser.close(); await pb.apagar(); }
});

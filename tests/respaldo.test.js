// Respaldo y restauración: el archivo que se descarga trae todo y se puede restaurar en otro
// dispositivo. Un archivo dañado se rechaza con un mensaje, sin tocar los datos.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const h = require("./ayuda");

async function descargarRespaldo(page){
  await h.irA(page, "datos");
  const [descarga] = await Promise.all([page.waitForEvent("download"), page.click("#backup")]);
  return { nombre:descarga.suggestedFilename(), ruta:await descarga.path() };
}

test("un respaldo se descarga y se restaura en otro dispositivo", async () => {
  const app = await h.servirApp(), browser = await h.navegador();
  try {
    const a = await h.dispositivo(browser);
    await h.crearTienda(a.page, app.url, "Almacén Ñandú");
    await h.venderUno(a.page, "arroz", 1500);
    await h.venderUno(a.page, "azucar", 1200);
    const r = await descargarRespaldo(a.page);
    // El nombre del archivo va sin tildes ni eñes, para que se pueda adjuntar en cualquier parte
    assert.match(r.nombre, /^respaldo-[a-z0-9-]+-\d{4}-\d{2}-\d{2}\.json$/);
    const archivo = JSON.parse(fs.readFileSync(r.ruta, "utf8"));
    assert.equal(archivo.app, "mi-almacen");
    assert.equal(archivo.tablas.movs.filter(m => m.type === "venta").length, 2);

    // Dispositivo nuevo: restaura desde la pantalla inicial
    const b = await h.dispositivo(browser);
    await b.page.goto(app.url + "/");
    await b.page.setInputFiles("#srestore", r.ruta);
    await b.page.click("#dorestore");
    await b.page.waitForSelector("#tabs [data-view]");
    assert.match(await b.page.textContent("header"), /Almacén Ñandú/);
    const ventasA = (await h.ventas(a.page)).map(m => m.id).sort(), ventasB = (await h.ventas(b.page)).map(m => m.id).sort();
    assert.deepEqual(ventasB, ventasA);
    assert.deepEqual([...a.page.errores, ...b.page.errores], []);
  } finally { await browser.close(); await app.cerrar(); }
});

test("un respaldo dañado se rechaza con un mensaje y no borra nada", async () => {
  const app = await h.servirApp(), browser = await h.navegador();
  try {
    const { page } = await h.dispositivo(browser);
    await h.crearTienda(page, app.url);
    await h.venderUno(page, "arroz", 1500);
    const r = await descargarRespaldo(page);
    const danado = r.ruta + "-danado.json";
    fs.writeFileSync(danado, fs.readFileSync(r.ruta, "utf8").slice(0, 200));

    await page.setInputFiles("#restore", danado);
    await page.waitForSelector(".toast");
    assert.match(await page.textContent(".toast"), /respaldo|archivo/i);
    assert.equal((await h.ventas(page)).length, 1);
    assert.deepEqual(page.errores, []);
  } finally { await browser.close(); await app.cerrar(); }
});

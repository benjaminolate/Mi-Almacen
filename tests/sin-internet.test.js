// Regla 1: la app abre y vende sin internet, y lo vendido sin internet no se pierde.
const test = require("node:test");
const assert = require("node:assert/strict");
const h = require("./ayuda");

test("la app abre y vende sin internet", async () => {
  const app = await h.servirApp(), browser = await h.navegador();
  try {
    const { ctx, page } = await h.dispositivo(browser);
    await h.crearTienda(page, app.url, "Almacén Sin Red");
    // El service worker tiene que quedar a cargo y con la copia de la app guardada
    await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout:15000 });
    const version = await page.evaluate(async () => (await caches.keys()).find(k => k.startsWith("app-")));
    assert.ok(version, "no se guardó la copia de la app");
    await h.venderUno(page, "arroz", 1500);

    await ctx.setOffline(true);
    await page.reload();
    await page.waitForSelector("#tabs [data-view]");
    assert.match(await page.textContent("header"), /Almacén Sin Red/);
    await h.venderUno(page, "azucar", 1200);
    assert.equal((await h.ventas(page)).length, 2, "no quedaron las dos ventas");

    // Al volver a abrir sin internet, la venta hecha sin internet sigue ahí
    await page.reload();
    await page.waitForSelector("#tabs [data-view]");
    assert.equal((await h.ventas(page)).length, 2);
    assert.deepEqual(page.errores, []);
  } finally { await browser.close(); await app.cerrar(); }
});

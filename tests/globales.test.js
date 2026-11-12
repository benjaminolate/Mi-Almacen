// El código de la app comparte sus nombres entre archivos (no vive en una función cerrada). Ninguno
// puede pisar algo del navegador: una función llamada "print" o "open" reemplazaría la del navegador.
const test = require("node:test");
const assert = require("node:assert/strict");
const h = require("./ayuda");

test("la app no pisa nada del navegador", async () => {
  const app = await h.servirApp(), browser = await h.navegador();
  try {
    const { page } = await h.dispositivo(browser);
    // Lo que trae el navegador antes de cargar la app
    await page.goto(app.url + "/manifest.webmanifest");
    const antes = await page.evaluate(() => Object.getOwnPropertyNames(window).filter(n => {
      try { return typeof window[n] === "function" && /\[native code\]/.test(Function.prototype.toString.call(window[n])); }
      catch(e){ return false; }
    }));
    await h.crearTienda(page, app.url);
    const pisados = await page.evaluate(nombres => nombres.filter(n => {
      try { return !/\[native code\]/.test(Function.prototype.toString.call(window[n])); }
      catch(e){ return true; }
    }), antes);
    assert.deepEqual(pisados, []);
    // Y lo que exponen los otros archivos sigue ahí
    assert.deepEqual(await page.evaluate(() => [typeof LocalDB, typeof Sync, typeof PAGINA, typeof CATALOGOS]), ["object", "object", "object", "object"]);
    assert.deepEqual(page.errores, []);
  } finally { await browser.close(); await app.cerrar(); }
});

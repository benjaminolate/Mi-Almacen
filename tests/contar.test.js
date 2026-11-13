// Pantalla Contar, lista de sectores: dice qué hacer cuando no hay productos, y el aviso de ventas
// cuenta ventas, no kilos (el pan por kilo mostraba "53.5 ventas").
const test = require("node:test");
const assert = require("node:assert/strict");
const h = require("./ayuda");

test("Contar sin productos dice qué hacer y lleva a Productos", async () => {
  const app = await h.servirApp(), browser = await h.navegador();
  try {
    const { page } = await h.dispositivo(browser);
    await page.goto(app.url + "/");
    await page.fill("#sn", "Almacén Vacío");
    await page.fill("#sp", "Rosa");
    await page.click('[data-ini="vacio"]');
    await page.click("#screate");
    await page.waitForSelector("#tabs [data-view]");
    await h.irA(page, "contar");
    assert.match(await page.locator("#app").innerText(), /Todavía no hay productos para contar/i);
    await h.captura(page, "contar-sin-productos");
    await page.click('#app [data-go="productos"]');
    await page.waitForFunction(() => history.state?.v === "productos");
    assert.deepEqual(page.errores, []);
  } finally { await browser.close(); await app.cerrar(); }
});

test("el aviso de un sector sin contar cuenta las ventas, no los kilos", async () => {
  const app = await h.servirApp(), browser = await h.navegador();
  try {
    const { page } = await h.dispositivo(browser);
    await h.crearTienda(page, app.url);
    const cat = await page.evaluate(async () => {
      const ps = (await LocalDB.loadAll()).products.filter(x => !x.eliminado);
      const p = ps[0], venta = qty => ({ store:"movs", value:{ id:crypto.randomUUID(), pid:p.id, type:"venta", qty, price:1000, at:Date.now() } });
      await LocalDB.apply([venta(0.75), venta(1.5)]);
      return p.cat;
    });
    await page.reload();
    await page.waitForSelector("#tabs [data-view]");
    await h.irA(page, "contar");
    const sub = await page.locator(`[data-sector="${cat}"] .sub`).innerText();
    assert.match(sub, /· 2 ventas registradas mientras tanto$/);
    assert.deepEqual(page.errores, []);
  } finally { await browser.close(); await app.cerrar(); }
});

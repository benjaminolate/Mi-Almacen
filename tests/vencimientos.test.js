// "Revisado" en vencimientos: deja de avisar en el inicio hasta que el producto vence, y vuelve a
// avisar si vence después de revisarlo.
const test = require("node:test");
const assert = require("node:assert/strict");
const h = require("./ayuda");

const DIA = 864e5;
const fecha = t => new Date(t).toISOString().slice(0, 10);
const avisoInicio = page => page.locator('#app [data-go="vencimientos"]:has-text("Vencen pronto")').count();

test("un vencimiento revisado deja de avisar hasta que vence", async () => {
  const app = await h.servirApp(), browser = await h.navegador();
  try {
    const { ctx, page } = await h.dispositivo(browser);
    const hoy = Date.now();
    await page.clock.setSystemTime(hoy);
    await h.crearTienda(page, app.url);
    await h.irA(page, "extensiones");
    await page.locator('[data-ext="vencimientos"]').check({ force:true });
    await h.esperarQue(page, () => !!document.querySelector('[data-ext="vencimientos"]:checked'));

    // Anotar arroz que vence en 3 días
    await h.irA(page, "vencimientos");
    await page.fill("#q", "arroz");
    await page.click("#res [data-pick]");
    await page.fill("#vf", fecha(hoy + 3 * DIA));
    await page.click("#vsave");
    await h.esperarQue(page, () => LocalDB.loadAll().then(t => t.vencimientos.length === 1), undefined, { que:"el vencimiento" });

    await h.irA(page, "inicio");
    assert.equal(await avisoInicio(page), 1, "el inicio no avisa lo que vence pronto");

    await h.irA(page, "vencimientos");
    await h.captura(page, "vencimientos-antes");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "la pantalla se sale del ancho");
    await page.click("[data-vrev]");
    await h.esperarQue(page, () => LocalDB.loadAll().then(t => !!t.vencimientos[0].revisado), undefined, { que:"que quede revisado" });
    assert.match(await page.textContent("#app"), /revisado/);
    assert.equal(await page.locator("[data-vrev]").count(), 0);
    await h.captura(page, "vencimientos-revisado");
    const v = (await page.evaluate(() => LocalDB.loadAll())).vencimientos[0];
    assert.equal(v.done, false, "revisado no lo saca de la lista");

    await h.irA(page, "inicio");
    assert.equal(await avisoInicio(page), 0, "sigue avisando después de revisarlo");

    // Cinco días después ya venció: vuelve a avisar
    await page.clock.setSystemTime(hoy + 5 * DIA);
    await page.reload();
    await page.waitForSelector("#tabs [data-view]");
    assert.equal(await avisoInicio(page), 1, "no avisa que ya venció");
    assert.deepEqual(page.errores, []);
  } finally { await browser.close(); await app.cerrar(); }
});

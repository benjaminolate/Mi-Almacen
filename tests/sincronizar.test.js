// Dos dispositivos de la misma tienda: lo que se vende en uno aparece en el otro, y lo vendido
// sin internet se envía al volver la conexión. Necesita PocketBase (PB_BIN).
const test = require("node:test");
const assert = require("node:assert/strict");
const h = require("./ayuda");

const falta = h.faltaPocketBase();

test("dos dispositivos se mantienen al día", { skip:falta || false }, async () => {
  const pb = await h.prenderServidor(), browser = await h.navegador();
  try {
    const a = await h.dispositivo(browser), b = await h.dispositivo(browser);
    await h.crearTienda(a.page, pb.url, "Almacén Sincronizado");
    await h.venderUno(a.page, "arroz", 1500);
    await h.esperarSincronizado(a.page);

    // B se une con el link de invitación
    const tienda = (await a.page.evaluate(() => LocalDB.getMeta("tienda"))).id;
    await b.page.goto(`${pb.url}/?unirse=${tienda}&servidor=${encodeURIComponent(pb.url)}`);
    await b.page.click("#jgo");
    await b.page.waitForSelector("#tabs [data-view]");
    assert.match(await b.page.textContent("header"), /Almacén Sincronizado/);
    assert.equal((await h.ventas(b.page)).length, 1);

    // Lo que vende A le llega solo a B
    await h.venderUno(a.page, "azucar", 1200);
    await h.esperarVentas(b.page, 2);

    // B vende sin internet: queda guardado y se envía al volver la conexión
    await b.ctx.setOffline(true);
    await h.venderUno(b.page, "aceite", 2500);
    assert.equal(await h.pendientes(b.page), 1);
    await b.ctx.setOffline(false);
    await b.page.evaluate(() => window.dispatchEvent(new Event("online")));
    await h.esperarSincronizado(b.page);
    await h.esperarVentas(a.page, 3);

    const idsA = (await h.ventas(a.page)).map(m => m.id).sort(), idsB = (await h.ventas(b.page)).map(m => m.id).sort();
    assert.deepEqual(idsA, idsB);
    assert.deepEqual([...a.page.errores, ...b.page.errores], []);
  } finally { await browser.close(); await pb.apagar(); }
});

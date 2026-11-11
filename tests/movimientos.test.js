// Los movimientos no se editan: el servidor rechaza cambiar una venta ya guardada (precio,
// cantidad o tipo), aunque la tienda no tenga cuentas. Necesita PocketBase (PB_BIN).
const test = require("node:test");
const assert = require("node:assert/strict");
const h = require("./ayuda");

const falta = h.faltaPocketBase();

test("el servidor no deja editar una venta ya guardada", { skip:falta || false }, async () => {
  const pb = await h.prenderServidor(), browser = await h.navegador();
  try {
    const { page } = await h.dispositivo(browser);
    await h.crearTienda(page, pb.url, "Almacén Ventas");
    await h.venderUno(page, "arroz", 1500);
    await h.esperarSincronizado(page);
    const tienda = (await page.evaluate(() => LocalDB.getMeta("tienda"))).id;
    const envia = cambios => h.api(pb.url, "/api/sync", { tienda, device:"otro", desde:0, cambios });

    const venta = Object.values(h.ultimos((await envia([])).json.cambios, "movs")).find(m => m.type === "venta");
    assert.ok(venta, "no llegó la venta");
    const cambio = v => ({ hlc:h.sello("otro"), store:"movs", value:Object.assign({}, venta, v) });

    // Bajar el precio, cambiar la cantidad o convertirla en compra: se rechaza
    assert.equal((await envia([cambio({ price:0 })])).json.rechazados, 1);
    assert.equal((await envia([cambio({ qty:5 })])).json.rechazados, 1);
    assert.equal((await envia([cambio({ type:"compra" })])).json.rechazados, 1);
    // Volver a mandarla igual (por ejemplo, al restaurar un respaldo) no es un error
    assert.equal((await envia([cambio({})])).json.rechazados, 0);

    const final = h.ultimos((await envia([])).json.cambios, "movs")[venta.id];
    assert.equal(final.price, venta.price);
    assert.equal(final.qty, venta.qty);
    assert.equal(final.type, "venta");
    // El dispositivo de la tienda sigue con la venta original
    await h.esperarSincronizado(page);
    const local = (await h.ventas(page)).find(m => m.id === venta.id);
    assert.equal(local.price, venta.price);
    assert.deepEqual(page.errores, []);
  } finally { await browser.close(); await pb.apagar(); }
});

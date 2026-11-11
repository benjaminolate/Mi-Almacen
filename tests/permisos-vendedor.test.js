// Permisos: el servidor revisa cada cambio contra el rol. Un vendedor sin permisos extra vende,
// pero no puede cambiar precios, anotar compras ni administrar cuentas. Necesita PocketBase (PB_BIN).
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const h = require("./ayuda");

const falta = h.faltaPocketBase();

test("un vendedor no puede hacer lo que no le toca", { skip:falta || false }, async () => {
  const pb = await h.prenderServidor(), browser = await h.navegador();
  try {
    const { page } = await h.dispositivo(browser);
    await h.crearTienda(page, pb.url, "Almacén con Cuentas");
    await h.venderUno(page, "arroz", 1500);
    await h.esperarSincronizado(page);
    const tienda = (await page.evaluate(() => LocalDB.getMeta("tienda"))).id;

    const dueno = await h.api(pb.url, "/api/cuentas/activar", { tienda, usuario:"rosa", nombre:"Rosa", password:"clave123" });
    assert.equal(dueno.status, 200, JSON.stringify(dueno.json));
    const alta = await h.api(pb.url, "/api/cuentas/miembros", { tienda, usuario:"vale", nombre:"Vale", password:"clave456", rol:"vendedor", permisos:{} }, dueno.json.token);
    assert.equal(alta.status, 200, JSON.stringify(alta.json));
    const vende = await h.api(pb.url, "/api/cuentas/entrar", { usuario:"vale", password:"clave456" });
    assert.equal(vende.status, 200);
    const permisos = vende.json.tiendas.find(t => t.tienda === tienda).permisos;
    assert.deepEqual(permisos, { cuentas:false, precios:false, costos:false, inventario:false, reportes:false, config:false });
    const V = vende.json.token, D = dueno.json.token;

    // Con cuentas activas, sin usuario no se sincroniza
    const anon = await h.api(pb.url, "/api/sync", { tienda, desde:0, cambios:[] });
    assert.equal(anon.status, 401);
    assert.equal(anon.json.code, "cuenta");

    // Solo el dueño ve y crea cuentas
    assert.equal((await h.api(pb.url, `/api/cuentas/miembros?tienda=${tienda}`, undefined, V)).status, 403);
    assert.equal((await h.api(pb.url, "/api/cuentas/miembros", { tienda, usuario:"otro", nombre:"Otro", password:"clave789", rol:"dueno" }, V)).status, 403);

    const todo = await h.api(pb.url, "/api/sync", { tienda, desde:0, cambios:[] }, V);
    const producto = Object.values(h.ultimos(todo.json.cambios, "products")).find(p => p.price > 0);
    assert.ok(producto, "no llegó el producto vendido");
    const envia = cambios => h.api(pb.url, "/api/sync", { tienda, device:"vendedor", desde:0, cambios }, V);

    // Cambiar un precio: se rechaza y el servidor deja el precio de antes
    const precio = await envia([{ hlc:h.sello("vendedor"), store:"products", value:Object.assign({}, producto, { price:1 }) }]);
    assert.equal(precio.status, 200);
    assert.equal(precio.json.rechazados, 1);
    // Anotar una compra (inventario): se rechaza
    const compra = await envia([{ hlc:h.sello("vendedor"), store:"movs", value:{ id:crypto.randomUUID(), pid:producto.id, type:"compra", qty:10, cost:500, at:Date.now() } }]);
    assert.equal(compra.json.rechazados, 1);
    // Vender: se acepta
    const venta = { id:crypto.randomUUID(), pid:producto.id, type:"venta", qty:1, price:producto.price, at:Date.now() };
    const vendio = await envia([{ hlc:h.sello("vendedor"), store:"movs", value:venta }]);
    assert.equal(vendio.json.rechazados, 0);

    // Lo que ve el dueño: el precio no cambió, la compra no está y la venta sí
    const final = await h.api(pb.url, "/api/sync", { tienda, desde:0, cambios:[] }, D);
    assert.equal(h.ultimos(final.json.cambios, "products")[producto.id].price, producto.price);
    const movs = Object.values(h.ultimos(final.json.cambios, "movs"));
    assert.equal(movs.filter(m => m.type === "compra" && m.pid === producto.id && m.qty === 10).length, 0);
    assert.ok(movs.some(m => m.id === venta.id));
  } finally { await browser.close(); await pb.apagar(); }
});

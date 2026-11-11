// Un cambio que el servidor rechaza nunca borra datos del dispositivo: lo nuevo queda en el
// dispositivo que lo hizo, y de todo lo rechazado se guarda una copia antes de corregirlo.
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const h = require("./ayuda");

const falta = h.faltaPocketBase();

test("lo que el servidor rechaza no se borra del dispositivo", { skip:falta || false }, async () => {
  const pb = await h.prenderServidor(), browser = await h.navegador();
  try {
    const a = await h.dispositivo(browser);
    await h.crearTienda(a.page, pb.url, "Almacén Rechazos");
    const tienda = (await a.page.evaluate(() => LocalDB.getMeta("tienda"))).id;
    const D = await h.activarCuentas(a.page);
    await h.api(pb.url, "/api/cuentas/miembros", { tienda, usuario:"vale", nombre:"Vale", password:"clave456", rol:"vendedor", permisos:{} }, D);

    // Una vendedora sin permisos extra entra en otro celular
    const b = await h.dispositivo(browser);
    await b.page.goto(pb.url + "/");
    await b.page.click("#slogin");
    await b.page.fill("#juser", "vale");
    await b.page.fill("#jpass", "clave456");
    await b.page.click("#jgo");
    await b.page.waitForSelector("#tabs [data-view]");
    await h.esperarSincronizado(b.page);

    // Anota una compra (necesita el permiso de inventario) y cambia un precio (necesita el de precios)
    const compra = { id:crypto.randomUUID(), type:"compra", qty:10, cost:500, at:Date.now() };
    const { producto } = await b.page.evaluate(async compra => {
      const t = await LocalDB.loadAll(), producto = t.products.find(p => !p.eliminado);
      await LocalDB.apply([{ store:"movs", value:Object.assign(compra, { pid:producto.id }) },
        { store:"products", value:Object.assign({}, producto, { price:1 }) }]);
      await Sync.syncNow();
      return { producto };
    }, compra);
    await h.esperarSincronizado(b.page);

    const local = await b.page.evaluate(() => LocalDB.loadAll());
    // La compra sigue en el celular de la vendedora
    assert.ok(local.movs.some(m => m.id === compra.id), "la compra rechazada se borró del dispositivo");
    // El precio vuelve al de la tienda
    assert.equal(local.products.find(p => p.id === producto.id).price, producto.price);
    // Y queda una copia de los dos cambios rechazados
    const rechazados = await b.page.evaluate(() => LocalDB.getMeta("rechazados"));
    assert.ok(rechazados.some(r => r.store === "movs" && r.value.id === compra.id));
    assert.ok(rechazados.some(r => r.store === "products" && r.key === producto.id && r.value.price === 1));

    // El servidor no guardó la compra ni mandó a borrarla
    const todo = (await h.api(pb.url, "/api/sync", { tienda, desde:0, cambios:[] }, D)).json.cambios;
    assert.equal(todo.some(c => c.value?.id === compra.id || c.del === compra.id), false);
    assert.deepEqual([...a.page.errores, ...b.page.errores], []);
  } finally { await browser.close(); await pb.apagar(); }
});

test("la copia de lo rechazado queda en el dispositivo y en su respaldo", async () => {
  const app = await h.servirApp(), browser = await h.navegador();
  try {
    const { page } = await h.dispositivo(browser);
    await h.crearTienda(page, app.url);
    const r = await page.evaluate(async () => {
      const p = (await LocalDB.loadAll()).products[0];
      // Solo se copian registros que existen, de tablas de la tienda
      const n = await LocalDB.guardarRechazados([{ store:"products", key:p.id }, { store:"meta", key:"tienda" },
        { store:"products", key:"no-existe" }, { store:"otra", key:"x" }, { store:"constructor", key:"x" }, { store:"products", key:"" }]);
      return { id:p.id, n, rechazados:await LocalDB.getMeta("rechazados"), respaldo:(await LocalDB.exportAll()).tablas.meta };
    });
    assert.equal(r.n, 1);
    assert.equal(r.rechazados.length, 1);
    assert.equal(r.rechazados[0].value.id, r.id);
    assert.ok(r.respaldo.some(m => m.key === "rechazados"), "la copia no va en el respaldo");
    assert.deepEqual(page.errores, []);
  } finally { await browser.close(); await app.cerrar(); }
});

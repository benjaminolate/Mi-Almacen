// Costos privados: a quien no tiene el permiso de costos, el servidor le manda productos y
// movimientos sin costo, y si edita un producto, el costo que había no se pierde. Al recibir el
// permiso, el dispositivo vuelve a pedir todo y le llegan los costos.
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const h = require("./ayuda");

const falta = h.faltaPocketBase();
const conCosto = cambios => cambios.filter(c => (c.store === "products" || c.store === "movs") && c.value && "cost" in c.value);

test("quien no tiene el permiso de costos no los recibe, y no los borra al editar", { skip:falta || false }, async () => {
  const pb = await h.prenderServidor(), browser = await h.navegador();
  try {
    // El dueño anota el costo de un producto y una compra
    const a = await h.dispositivo(browser);
    await h.crearTienda(a.page, pb.url, "Almacén Costos");
    const pid = await a.page.evaluate(async compra => {
      const p = (await LocalDB.loadAll()).products.find(x => !x.eliminado);
      await LocalDB.apply([{ store:"products", value:Object.assign({}, p, { price:1000, cost:700 }) },
        { store:"movs", value:Object.assign(compra, { pid:p.id }) }]);
      return p.id;
    }, { id:crypto.randomUUID(), type:"compra", qty:6, cost:650, at:Date.now() });
    const tienda = (await a.page.evaluate(() => LocalDB.getMeta("tienda"))).id;
    const D = await h.activarCuentas(a.page);
    await h.api(pb.url, "/api/cuentas/miembros", { tienda, usuario:"vale", nombre:"Vale", password:"clave456", rol:"vendedor", permisos:{ precios:true, inventario:true } }, D);

    // La vendedora entra: no le llega ningún costo
    const b = await h.dispositivo(browser);
    await b.page.goto(pb.url + "/");
    await b.page.click("#slogin");
    await b.page.fill("#juser", "vale");
    await b.page.fill("#jpass", "clave456");
    await b.page.click("#jgo");
    await b.page.waitForSelector("#tabs [data-view]");
    await h.esperarSincronizado(b.page);
    const local = await b.page.evaluate(() => LocalDB.loadAll());
    assert.ok(local.products.length > 0 && local.movs.length > 0);
    assert.equal([...local.products, ...local.movs].filter(x => "cost" in x).length, 0, "le llegaron costos");
    const V = (await b.page.evaluate(() => LocalDB.getMeta("cuenta"))).token;
    assert.deepEqual(conCosto((await h.api(pb.url, "/api/sync", { tienda, desde:0, cambios:[] }, V)).json.cambios), []);

    // Cambia el precio desde la app (no ve el campo de costo)
    await h.irA(b.page, "productos");
    await b.page.click(`[data-open="${pid}"]`);
    assert.equal(await b.page.locator("#ec").count(), 0);
    await b.page.fill("#ep", "1200");
    await b.page.click("#esave");
    await h.esperarQue(b.page, pid => LocalDB.loadAll().then(t => t.products.find(p => p.id === pid).price === 1200), pid, { que:"el precio nuevo" });
    await h.esperarSincronizado(b.page);

    // El dueño ve el precio nuevo y el costo de antes
    const final = h.ultimos((await h.api(pb.url, "/api/sync", { tienda, desde:0, cambios:[] }, D)).json.cambios, "products")[pid];
    assert.equal(final.price, 1200);
    assert.equal(final.cost, 700);

    // Le dan el permiso de costos: al abrir la app de nuevo le llegan
    const yo = (await h.api(pb.url, `/api/cuentas/miembros?tienda=${tienda}`, undefined, D)).json.miembros.find(m => m.usuario === "vale");
    assert.equal((await h.api(pb.url, `/api/cuentas/miembros/${yo.id}`, { tienda, rol:"vendedor", permisos:{ precios:true, inventario:true, costos:true } }, D)).status, 200);
    await b.page.reload();
    await b.page.waitForSelector("#tabs [data-view]");
    await h.esperarQue(b.page, pid => LocalDB.loadAll().then(t => t.products.find(p => p.id === pid).cost === 700 && t.movs.some(m => m.cost === 650)), pid, { que:"que lleguen los costos" });
    assert.deepEqual([...a.page.errores, ...b.page.errores], []);
  } finally { await browser.close(); await pb.apagar(); }
});

test("reglas de costos del servidor", () => {
  const { conCosto, sinCostos } = require("../servidor/pb_hooks/comun.js");
  const prev = { value:{ id:"p", price:1000, cost:700 } }, sin = { costos:false }, con = { costos:true };
  // Sin permiso: lo que llega sin costo recupera el de antes; un costo anotado se respeta
  assert.equal(conCosto(sin, "products", { id:"p", price:1200 }, prev).cost, 700);
  assert.equal(conCosto(sin, "products", { id:"p", price:1200, cost:800 }, prev).cost, 800);
  // Con permiso, sin cuentas o en otras tablas, no se toca
  assert.equal(conCosto(con, "products", { id:"p" }, prev).cost, undefined);
  assert.equal(conCosto(null, "products", { id:"p" }, prev).cost, undefined);
  assert.equal(conCosto(sin, "movs", { id:"m" }, prev).cost, undefined);
  // Al mandar: sin permiso se quita el costo de productos y movimientos
  assert.equal("cost" in sinCostos(sin, { store:"products", value:{ cost:1 } }).value, false);
  assert.equal("cost" in sinCostos(sin, { store:"movs", value:{ cost:1 } }).value, false);
  assert.equal(sinCostos(con, { store:"products", value:{ cost:1 } }).value.cost, 1);
  assert.equal(sinCostos(null, { store:"products", value:{ cost:1 } }).value.cost, 1);
  assert.equal(sinCostos(sin, { store:"products", del:"p" }).del, "p");
});

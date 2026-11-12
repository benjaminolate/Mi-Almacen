// Quien no tiene el permiso de costos no los recibe del servidor. Las pantallas no deben decirle
// "sin costo" donde el dueño sí anotó uno, ni mostrarle la ganancia.
const test = require("node:test");
const assert = require("node:assert/strict");
const h = require("./ayuda");

// Deja el dispositivo como el de alguien que entró con su usuario y tiene estos permisos
async function entrarCon(page, permisos){
  await page.evaluate(async permisos => {
    const tienda = (await LocalDB.getMeta("tienda")).id;
    await LocalDB.setMeta("cuenta", { token:"prueba", usuario:{ id:"u1", usuario:"vale", nombre:"Vale" },
      tiendas:[{ tienda, rol:"vendedor", permisos }] });
  }, permisos);
  await page.reload();
  await page.waitForSelector("#tabs [data-view]");
}

test("sin el permiso de costos, las pantallas no hablan de costos que no ve", async () => {
  const app = await h.servirApp(), browser = await h.navegador();
  try {
    const { page } = await h.dispositivo(browser);
    await h.crearTienda(page, app.url, "Almacén Sin Costos");
    // Un producto como lo manda el servidor a quien no ve costos (sin el campo cost) y una venta de hoy
    const nombre = await page.evaluate(async () => {
      const t = await LocalDB.loadAll(), p = t.products.find(x => !x.eliminado), ext = t.ajustes.find(a => a.clave === "extensiones")?.valor || {};
      const prod = Object.assign({}, p, { price:1000 }); delete prod.cost;
      await LocalDB.apply([{ store:"products", value:prod },
        { store:"movs", value:{ id:crypto.randomUUID(), pid:p.id, type:"venta", qty:1, price:1000, at:Date.now() } },
        { store:"ajustes", value:{ clave:"cuentas", valor:true } },
        { store:"ajustes", value:{ clave:"extensiones", valor:Object.assign({}, ext, { proveedores:true, recibir:true }) } }]);
      return p.name;
    });
    await entrarCon(page, { inventario:true, reportes:true });

    // Resumen: sin ganancia ni aviso de productos sin costo
    await h.irA(page, "resumen");
    const resumen = await page.locator("#app").innerText();
    assert.doesNotMatch(resumen, /ganancia|costo/i);

    // Recibir: puede anotar el costo de la factura, sin el aviso "Sin costo"
    await h.irA(page, "recibir");
    await page.fill("#q", nombre);
    await page.click("#res [data-pick]");
    await page.waitForSelector("[data-rc]");
    assert.equal(await page.locator(".pill.warn", { hasText:"Sin costo" }).count(), 0);
    assert.equal(await page.inputValue("[data-rc]"), "");
    await h.captura(page, "recibir-sin-costos");

    // Proveedores es solo para quien tiene el permiso de costos
    await h.irA(page, "mas");
    assert.equal(await page.locator('[data-go="proveedores"]').count(), 0);
    assert.deepEqual(page.errores, []);
  } finally { await browser.close(); await app.cerrar(); }
});

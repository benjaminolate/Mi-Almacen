// Ids de registros con caracteres de código: la app los muestra sin ejecutar nada y sigue
// funcionando con ellos, y el servidor no los acepta. Los registros llegan como si los mandara
// otro dispositivo de la tienda.
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const h = require("./ayuda");

const falta = h.faltaPocketBase();
const MALO = `x"><img src=x onerror="window.__xss=1">'`;
const hoy = () => new Date().toISOString().slice(0, 10);

function registrosMaliciosos(){
  const at = Date.now(), id = s => MALO + s;
  return [
    ["products", { id:id("p"), name:"Producto raro", cat:"Raro", price:1000, cost:0, barcode:"", min:3, has:true }],
    ["clients", { id:id("c"), name:"Cliente raro", phone:"" }],
    ["fiados", { id:id("f"), cid:id("c"), type:"fiado", amount:1000, note:"", at }],
    ["vencimientos", { id:id("v"), pid:id("p"), fecha:hoy(), qty:1, done:false, at }],
    ["personas", { id:id("pe"), nombre:"Persona rara" }],
    ["ofertas", { id:id("o"), nombre:"Oferta rara", tipo:"pack", n:2, precio:1500, pids:[id("p")], dias:[], desde:"", hasta:"", activa:true }],
    ["proveedores", { id:id("pr"), nombre:"Proveedor raro", telefono:"", dias:[1], nota:"" }],
    ["encargos", { id:id("e"), cliente:"Encargo raro", telefono:"", detalle:"algo", para:hoy(), hora:"", total:0, abono:0, estado:"pendiente", at }],
    ["reservas", { id:id("r"), name:"Reserva rara", detail:"algo", at, done:false }]
  ].map(([store, value], i) => ({ hlc:`${at}-${String(i).padStart(4, "0")}-otro`, store, value }));
}

test("la app muestra registros con ids maliciosos sin ejecutar código, y los puede usar", async () => {
  const app = await h.servirApp(), browser = await h.navegador();
  try {
    const { page } = await h.dispositivo(browser);
    const dialogos = [];
    page.on("dialog", d => { dialogos.push(d.message()); d.dismiss(); });
    await h.crearTienda(page, app.url);
    // Todas las extensiones, para que se vean todas las pantallas
    await h.irA(page, "extensiones");
    // Cada cambio vuelve a dibujar la pantalla: se marca una a la vez
    // y se espera a que quede guardada antes de la siguiente
    for (let id; (id = await page.evaluate(() => document.querySelector("[data-ext]:not(:checked)")?.dataset.ext));){
      // Con un clic directo: el aviso de la extensión anterior puede tapar la siguiente
      await page.evaluate(id => document.querySelector(`[data-ext="${id}"]`).click(), id);
      await h.esperarQue(page, id => LocalDB.loadAll().then(t => t.ajustes.some(a => a.clave === "extensiones" && a.valor[id])), id, { que:"la extensión " + id });
    }

    await page.evaluate(c => LocalDB.applyRemote(c), registrosMaliciosos());
    await page.reload();
    await page.waitForSelector("#tabs [data-view]");
    for (const vista of ["inicio", "vender", "productos", "fiados", "vencimientos", "ofertas", "proveedores", "personas", "encargos", "reservas", "compras", "caja", "historial"]){
      await h.irA(page, vista);
      assert.equal(await page.locator("#app img[src='x'], #modalroot img[src='x']").count(), 0, "se metió una imagen en " + vista);
    }
    // El producto se puede vender: el id llega intacto a la venta
    await h.venderUno(page, "Producto raro");
    assert.equal((await h.ventas(page))[0].pid, MALO + "p");
    // El cliente se abre
    await h.irA(page, "fiados");
    await page.click('[data-client]:has-text("Cliente raro")');
    await page.waitForSelector("#addFiado");

    assert.equal(await page.evaluate(() => window.__xss), undefined, "se ejecutó código de un id");
    assert.deepEqual(dialogos, []);
    assert.deepEqual(page.errores, []);
  } finally { await browser.close(); await app.cerrar(); }
});

test("el servidor rechaza ids con caracteres de código y no guarda nada de ellos", { skip:falta || false }, async () => {
  const pb = await h.prenderServidor(), browser = await h.navegador();
  try {
    const { page } = await h.dispositivo(browser);
    await h.crearTienda(page, pb.url);
    await h.esperarSincronizado(page);
    const tienda = (await page.evaluate(() => LocalDB.getMeta("tienda"))).id;
    const envia = cambios => h.api(pb.url, "/api/sync", { tienda, device:"prueba", desde:0, cambios });

    const malos = registrosMaliciosos().map(c => Object.assign(c, { hlc:h.sello("otro") }));
    malos.push({ hlc:h.sello("otro"), store:"products", del:MALO });
    assert.equal((await envia(malos)).json.rechazados, malos.length);
    // Un id normal sigue entrando
    const bueno = { hlc:h.sello("otro"), store:"products", value:{ id:crypto.randomUUID(), name:"Producto bueno", cat:"x", price:1, cost:0, min:1, has:true } };
    assert.equal((await envia([bueno])).json.rechazados, 0);

    const todo = (await envia([])).json.cambios;
    assert.equal(JSON.stringify(todo).includes("onerror"), false, "el servidor guardó un id malicioso");
    assert.ok(todo.some(c => c.value?.name === "Producto bueno"));
  } finally { await browser.close(); await pb.apagar(); }
});

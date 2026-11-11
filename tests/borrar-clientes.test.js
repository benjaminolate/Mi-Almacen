// Clientes que todavía deben: solo quien tiene el permiso de ajustes los puede eliminar.
// El servidor lo revisa; la app lo explica. Decisión de Benjamin (noviembre de 2026).
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const h = require("./ayuda");

const falta = h.faltaPocketBase();

// Crea un cliente con una deuda desde la pantalla de Fiados (deuda 0: sin fiado)
async function clienteConDeuda(page, nombre, deuda){
  await h.irA(page, "fiados");
  await page.click("#addc");
  await page.fill("#cn", nombre);
  await page.click("#csave");
  await page.waitForSelector("#addFiado");
  if (deuda){ await page.fill("#fm", String(deuda)); await page.click("#addFiado"); }
  await h.esperarQue(page, ([n, d]) => LocalDB.loadAll().then(t => { const c = t.clients.find(x => x.name === n);
    return c && t.fiados.filter(f => f.cid === c.id).reduce((a, f) => a + (f.type === "fiado" ? f.amount : -f.amount), 0) === d; }), [nombre, deuda], { que:`la deuda de ${nombre}` });
  await page.click("#modalroot [data-close]");
  await page.waitForSelector("#addFiado", { state:"detached" });
}

async function abrirCliente(page, nombre){
  await h.irA(page, "fiados");
  await page.click(`[data-client]:has-text("${nombre}")`);
  await page.waitForSelector("#addFiado");
}

test("sin cuentas, quien atiende puede eliminar a un cliente con deuda, con aviso", async () => {
  const app = await h.servirApp(), browser = await h.navegador();
  try {
    const { page } = await h.dispositivo(browser);
    await h.crearTienda(page, app.url);
    await clienteConDeuda(page, "Ana Debe", 5000);
    await abrirCliente(page, "Ana Debe");
    await page.click("#cdel");
    assert.match(await page.textContent("#modalroot .pill.warn"), /Todavía debe \$5\.000/);
    await page.click("#cdok");
    await h.esperarQue(page, () => LocalDB.loadAll().then(t => t.clients.some(c => c.name === "Ana Debe" && c.eliminado)), undefined, { que:"que se elimine" });
    // Los fiados no se borran: siguen guardados
    assert.equal((await page.evaluate(() => LocalDB.loadAll())).fiados.length, 1);
    assert.deepEqual(page.errores, []);
  } finally { await browser.close(); await app.cerrar(); }
});

test("el servidor solo deja eliminar clientes con deuda a quien tiene permiso de ajustes", { skip:falta || false }, async () => {
  const pb = await h.prenderServidor(), browser = await h.navegador();
  try {
    const { page } = await h.dispositivo(browser);
    await h.crearTienda(page, pb.url, "Almacén Fiados");
    await clienteConDeuda(page, "Ana Debe", 5000);
    await clienteConDeuda(page, "Beto Al Dia", 0);
    await clienteConDeuda(page, "Carla Paga", 3000);
    await h.esperarSincronizado(page);
    const tienda = (await page.evaluate(() => LocalDB.getMeta("tienda"))).id;

    const D = (await h.api(pb.url, "/api/cuentas/activar", { tienda, usuario:"rosa", nombre:"Rosa", password:"clave123" })).json.token;
    assert.equal((await h.api(pb.url, "/api/cuentas/miembros", { tienda, usuario:"vale", nombre:"Vale", password:"clave456", rol:"vendedor", permisos:{} }, D)).status, 200);
    const V = (await h.api(pb.url, "/api/cuentas/entrar", { usuario:"vale", password:"clave456" })).json.token;

    const todo = await h.api(pb.url, "/api/sync", { tienda, desde:0, cambios:[] }, V);
    const clientes = Object.values(h.ultimos(todo.json.cambios, "clients"));
    const cli = n => clientes.find(c => c.name === n);
    const eliminar = c => ({ hlc:h.sello("vendedor"), store:"clients", value:Object.assign({}, c, { eliminado:true }) });
    const envia = (token, cambios) => h.api(pb.url, "/api/sync", { tienda, device:"prueba", desde:0, cambios }, token);

    // Vendedor: no puede eliminar a quien debe, sí a quien está al día
    assert.equal((await envia(V, [eliminar(cli("Ana Debe"))])).json.rechazados, 1);
    assert.equal((await envia(V, [eliminar(cli("Beto Al Dia"))])).json.rechazados, 0);
    // Si en el mismo envío registra el pago completo y después lo elimina, se acepta
    const pago = { hlc:h.sello("vendedor"), store:"fiados", value:{ id:crypto.randomUUID(), cid:cli("Carla Paga").id, type:"abono", amount:3000, note:"", at:Date.now() } };
    assert.equal((await envia(V, [pago, eliminar(cli("Carla Paga"))])).json.rechazados, 0);
    // El dueño sí puede eliminar a quien debe
    assert.equal((await envia(D, [eliminar(cli("Ana Debe"))])).json.rechazados, 0);

    const final = h.ultimos((await h.api(pb.url, "/api/sync", { tienda, desde:0, cambios:[] }, D)).json.cambios, "clients");
    for (const n of ["Ana Debe", "Beto Al Dia", "Carla Paga"]) assert.equal(final[cli(n).id].eliminado, true, n);
  } finally { await browser.close(); await pb.apagar(); }
});

test("la app de un vendedor explica que no puede eliminar a quien debe", { skip:falta || false }, async () => {
  const pb = await h.prenderServidor(), browser = await h.navegador();
  try {
    const a = await h.dispositivo(browser);
    await h.crearTienda(a.page, pb.url, "Almacén Fiados");
    await clienteConDeuda(a.page, "Ana Debe", 5000);
    await h.esperarSincronizado(a.page);
    const tienda = (await a.page.evaluate(() => LocalDB.getMeta("tienda"))).id;
    // Desde la app, para que la tienda quede marcada con cuentas activas en todos los dispositivos
    const D = await h.activarCuentas(a.page);
    await h.api(pb.url, "/api/cuentas/miembros", { tienda, usuario:"vale", nombre:"Vale", password:"clave456", rol:"vendedor", permisos:{} }, D);

    const b = await h.dispositivo(browser);
    await b.page.goto(pb.url + "/");
    await b.page.click("#slogin");
    await b.page.fill("#juser", "vale");
    await b.page.fill("#jpass", "clave456");
    await b.page.click("#jgo");
    await b.page.waitForSelector("#tabs [data-view]");
    await abrirCliente(b.page, "Ana Debe");
    assert.equal(await b.page.locator("#cdel").count(), 0);
    assert.match(await b.page.textContent("#modalroot"), /pídeselo a quien puede cambiar los ajustes/);
    assert.deepEqual([...a.page.errores, ...b.page.errores], []);
  } finally { await browser.close(); await pb.apagar(); }
});

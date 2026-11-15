// Invitaciones: el dueño crea un link para una persona, y esa persona elige su propio usuario y
// contraseña. El link sirve una sola vez, vence, y solo el dueño puede crearlo.
const test = require("node:test");
const assert = require("node:assert/strict");
const nodeCrypto = require("node:crypto");
const h = require("./ayuda");

const falta = h.faltaPocketBase();

test("el dueño invita desde la app y la persona entra con su propio usuario", { skip:falta || false }, async () => {
  const pb = await h.prenderServidor(), browser = await h.navegador();
  try {
    const a = await h.dispositivo(browser), b = await h.dispositivo(browser);
    await h.crearTienda(a.page, pb.url, "Almacén Invitaciones");
    await h.venderUno(a.page, "arroz", 1500);
    await h.esperarSincronizado(a.page);

    await h.irA(a.page, "cuentas");
    await a.page.click("#cadd");
    await a.page.fill("#inom", "Pedro");
    await a.page.check('[data-mp="inventario"]');
    await a.page.click("#iok");
    const link = (await a.page.locator("#ilink").innerText()).trim();
    assert.match(link, /\?invitacion=[a-z0-9]{32}$/);
    await h.captura(a.page, "invitacion-creada");

    await b.page.goto(link);
    await b.page.fill("#auser", "pedro");
    await b.page.fill("#apass", "clave456");
    await b.page.fill("#apass2", "clave456");
    await h.captura(b.page, "invitacion-aceptar");
    await b.page.click("#ago");
    await b.page.waitForSelector("#tabs [data-view]");
    assert.match(await b.page.textContent("header"), /Almacén Invitaciones/);
    assert.equal((await h.ventas(b.page)).length, 1);
    const cuenta = await b.page.evaluate(() => LocalDB.getMeta("cuenta"));
    const t = cuenta.tiendas[0];
    assert.equal(t.rol, "vendedor");
    assert.equal(t.permisos.inventario, true);
    assert.equal(t.permisos.precios, false);
    // El dueño ve a Pedro en la lista de quienes atienden
    await h.esperarQue(a.page, () => LocalDB.loadAll().then(x => x.personas.some(p => p.nombre === "Pedro")), undefined, { que:"que llegue Pedro a la lista" });

    // El mismo link no sirve una segunda vez
    const otro = await h.dispositivo(browser);
    await otro.page.goto(link);
    await otro.page.fill("#auser", "intruso");
    await otro.page.fill("#apass", "clave789");
    await otro.page.fill("#apass2", "clave789");
    await otro.page.click("#ago");
    await otro.page.waitForSelector(".toast");
    assert.match(await otro.page.locator(".toast").innerText(), /ya se usó o venció/);
    assert.equal(await otro.page.evaluate(() => LocalDB.getMeta("tienda")), undefined);
    for (const p of [a.page, b.page, otro.page]) assert.deepEqual(p.errores, []);
  } finally { await browser.close(); await pb.apagar(); }
});

test("solo el dueño invita, y un código que no existe no sirve", { skip:falta || false }, async () => {
  const pb = await h.prenderServidor(), browser = await h.navegador();
  try {
    const { page } = await h.dispositivo(browser);
    await h.crearTienda(page, pb.url, "Almacén Reglas");
    await h.esperarSincronizado(page);
    const tienda = (await page.evaluate(() => LocalDB.getMeta("tienda"))).id, D = await h.tokenDueno(page);
    const invitar = (cuerpo, token) => h.api(pb.url, "/api/cuentas/invitar", Object.assign({ tienda, nombre:"Vale", rol:"vendedor", permisos:{} }, cuerpo), token);

    assert.equal((await invitar({})).status, 401);
    assert.equal((await invitar({ rol:"dueno" }, D)).status, 400);
    const inv = await invitar({}, D);
    assert.equal(inv.status, 200);
    assert.ok(inv.json.vence > Date.now() + 47 * 3600e3 && inv.json.vence <= Date.now() + 48 * 3600e3);
    const vale = await h.api(pb.url, "/api/cuentas/aceptar", { codigo:inv.json.codigo, usuario:"vale", password:"clave456" });
    assert.equal(vale.status, 200);
    assert.equal(vale.json.tienda, tienda);
    // Una vendedora no puede invitar
    assert.equal((await invitar({ nombre:"Otro" }, vale.json.token)).status, 403);
    // Un código inventado o vacío no sirve
    for (const codigo of ["", "a".repeat(32), inv.json.codigo.slice(0, -1) + "x"])
      assert.equal((await h.api(pb.url, "/api/cuentas/aceptar", { codigo, usuario:"intruso", password:"clave789" })).status, 400);
  } finally { await browser.close(); await pb.apagar(); }
});

// La tabla guarda solo el resumen del código y una invitación vencida no sirve. Se revisa con la
// cuenta de administrador del servidor, que solo responde desde el wifi.
test("el servidor no guarda el código de la invitación, y una vencida no sirve", { skip:falta || false }, async t => {
  const ip = h.ipPrivada();
  if (!ip) return t.skip("este equipo no tiene una IP de red privada para simular el wifi");
  const pb = await h.prenderServidor({ host:ip });
  try {
    const tienda = crypto.randomUUID();
    const D = (await h.api(pb.url, "/api/cuentas/activar", { tienda, usuario:"rosa", nombre:"Rosa", password:"clave123" })).json.token;
    const inv = (await h.api(pb.url, "/api/cuentas/invitar", { tienda, nombre:"Vale", rol:"vendedor", permisos:{} }, D)).json;
    const admin = (await h.api(pb.url, "/api/collections/_superusers/auth-with-password", { identity:"admin@prueba.local", password:"clave-de-prueba-123" })).json.token;
    const filas = (await h.api(pb.url, "/api/collections/invitaciones/records", undefined, admin)).json.items;
    assert.equal(filas.length, 1);
    assert.equal(filas[0].hash, nodeCrypto.createHash("sha256").update(inv.codigo).digest("hex"));
    assert.ok(!JSON.stringify(filas).includes(inv.codigo), "el código quedó guardado tal cual");

    const r = await fetch(`${pb.url}/api/collections/invitaciones/records/${filas[0].id}`, { method:"PATCH", headers:{ "Content-Type":"application/json", Authorization:admin }, body:JSON.stringify({ vence:Date.now() - 1000 }) });
    assert.equal(r.status, 200);
    const tarde = await h.api(pb.url, "/api/cuentas/aceptar", { codigo:inv.codigo, usuario:"vale", password:"clave456" });
    assert.equal(tarde.status, 400);
    assert.match(tarde.json.message, /venció/);
  } finally { await pb.apagar(); }
});

// Toda tienda en el servidor tiene un dueño con usuario. El código de la tienda solo ya no abre nada:
// el servidor no guarda ni entrega datos de una tienda sin dueño, y nadie puede quedarse con una
// tienda que ya tiene datos creando el primer usuario desde internet.
const test = require("node:test");
const assert = require("node:assert/strict");
const h = require("./ayuda");

const falta = h.faltaPocketBase();
const producto = () => ({ hlc:h.sello("intruso"), store:"products", value:{ id:crypto.randomUUID(), name:"Producto", cat:"x", price:1, cost:0, min:1, has:true } });

test("el servidor no guarda una tienda sin dueño, y con solo el código no se entra", { skip:falta || false }, async () => {
  const pb = await h.prenderServidor(), browser = await h.navegador();
  try {
    // Una tienda que el servidor no conoce: no se guarda ni se publica nada
    const nueva = crypto.randomUUID();
    const r = await h.api(pb.url, "/api/sync", { tienda:nueva, device:"intruso", desde:0, cambios:[producto()] });
    assert.equal(r.status, 401);
    assert.equal(r.json.code, "sin-dueno");
    assert.notEqual((await h.api(pb.url, "/api/publico/publicar", { tienda:nueva, pid:"abcdefghij12", activo:true, data:{} })).status, 200);

    // Una tienda creada desde la app ya tiene dueño
    const { page } = await h.dispositivo(browser);
    await h.crearTienda(page, pb.url, "Almacén con Dueño");
    await h.esperarSincronizado(page);
    const tienda = (await page.evaluate(() => LocalDB.getMeta("tienda"))).id;
    const cuenta = await page.evaluate(() => LocalDB.getMeta("cuenta"));
    assert.equal(cuenta.tiendas.find(t => t.tienda === tienda)?.rol, "dueno");
    assert.equal(await page.evaluate(() => S.ajustes.cuentas), true);

    // Quien solo sabe el código no lee, no escribe y no puede hacerse dueño
    const anon = await h.api(pb.url, "/api/sync", { tienda, device:"intruso", desde:0, cambios:[producto()] });
    assert.equal(anon.status, 401);
    assert.equal(anon.json.code, "cuenta");
    assert.equal((await h.api(pb.url, "/api/cuentas/activar", { tienda, usuario:"intruso", nombre:"Intruso", password:"clave999" })).status, 403);
    assert.equal((await h.api(pb.url, "/api/publico/publicar", { tienda, pid:"abcdefghij12", activo:true, data:{} })).status, 401);
    // El dueño sí ve sus datos
    const D = await h.tokenDueno(page);
    assert.ok((await h.api(pb.url, "/api/sync", { tienda, desde:0, cambios:[] }, D)).json.cambios.length > 0);
    await h.captura(page, "dueno-tienda-creada");
    assert.deepEqual(page.errores, []);
  } finally { await browser.close(); await pb.apagar(); }
});

test("sin conexión la tienda se crea igual, y el dueño crea su usuario después en Cuentas", { skip:falta || false }, async () => {
  const pb = await h.prenderServidor(), browser = await h.navegador();
  try {
    const { page } = await h.dispositivo(browser);
    // El servidor se encontró al abrir, pero se corta justo al crear el usuario
    await page.route("**/api/cuentas/activar", r => r.abort());
    await page.goto(pb.url + "/");
    await page.fill("#sn", "Almacén Sin Señal");
    await page.fill("#sp", "Rosa");
    await page.waitForSelector("#su:visible");
    await page.fill("#su", "rosa");
    await page.fill("#spw", "clave123");
    await page.fill("#spw2", "clave123");
    await h.captura(page, "crear-tienda-con-dueno");
    await page.click("#screate");
    await page.waitForSelector("#tabs [data-view]");
    // Sin dueño, el servidor no la guarda: lo dice, y todo queda en el dispositivo
    await h.esperarQue(page, () => Sync.state.status === "error" && /usuario de dueño/.test(Sync.state.error), undefined, { que:"que el servidor pida el usuario del dueño" });
    assert.ok(await h.pendientes(page) > 0);
    const tienda = (await page.evaluate(() => LocalDB.getMeta("tienda"))).id;

    await page.unroute("**/api/cuentas/activar");
    await h.irA(page, "cuentas");
    await page.fill("#cusr", "rosa");
    await page.fill("#cpw", "clave123");
    await page.fill("#cpw2", "clave123");
    await page.click("#cact");
    await h.esperarQue(page, () => LocalDB.getMeta("cuenta").then(c => !!c?.token), undefined, { que:"que se cree el usuario del dueño" });
    await h.esperarSincronizado(page);
    const D = await h.tokenDueno(page);
    const cambios = (await h.api(pb.url, "/api/sync", { tienda, desde:0, cambios:[] }, D)).json.cambios;
    assert.ok(cambios.some(c => c.store === "ajustes" && c.value.clave === "tienda_nombre" && c.value.valor === "Almacén Sin Señal"), "el servidor no tiene la tienda");
    assert.deepEqual(page.errores, []);
  } finally { await browser.close(); await pb.apagar(); }
});

// Una tienda de antes de las cuentas: tiene datos en el servidor y ningún usuario. Se arma con la
// cuenta de administrador del servidor, que solo responde desde el wifi.
test("una tienda de antes de las cuentas solo crea su dueño desde el wifi", { skip:falta || false }, async t => {
  const ip = h.ipPrivada();
  if (!ip) return t.skip("este equipo no tiene una IP de red privada para simular el wifi");
  const pb = await h.prenderServidor({ host:ip });
  try {
    const admin = (await h.api(pb.url, "/api/collections/_superusers/auth-with-password", { identity:"admin@prueba.local", password:"clave-de-prueba-123" })).json.token;
    assert.ok(admin, "no se pudo entrar como administrador");
    const tienda = crypto.randomUUID();
    const fila = await h.api(pb.url, "/api/collections/cambios/records", { tienda, hlc:h.sello("antiguo"), device:"antiguo", store:"ajustes", value:{ clave:"tienda_nombre", valor:"Almacén Antiguo" }, seq:1 }, admin);
    assert.equal(fila.status, 200, JSON.stringify(fila.json));

    const activar = encabezados => fetch(pb.url + "/api/cuentas/activar", { method:"POST", headers:Object.assign({ "Content-Type":"application/json" }, encabezados),
      body:JSON.stringify({ tienda, usuario:"rosa", nombre:"Rosa", password:"clave123" }) });
    const porInternet = await activar({ "X-Forwarded-For":"203.0.113.7" });
    assert.equal(porInternet.status, 403);
    assert.match((await porInternet.json()).message, /wifi/);
    assert.equal((await activar({})).status, 200);
  } finally { await pb.apagar(); }
});

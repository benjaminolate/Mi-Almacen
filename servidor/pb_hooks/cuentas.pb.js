/// <reference path="../pb_data/types.d.ts" />
// Cuentas y permisos (Fase 4).
//
// POST /api/cuentas/activar         el dueño crea su usuario: al crear la tienda, o en una tienda de antes de las cuentas
// POST /api/cuentas/entrar          entrar con usuario y contraseña
// GET  /api/cuentas/yo              renueva la sesión y dice a qué tiendas tiene acceso
// POST /api/cuentas/clave           cambiar la propia contraseña
// GET  /api/cuentas/miembros        quiénes tienen acceso a una tienda (solo el dueño)
// POST /api/cuentas/miembros        crear el usuario de alguien que atiende (solo el dueño)
// POST /api/cuentas/miembros/{id}   cambiar rol, permisos o contraseña, o quitar el acceso
// POST /api/cuentas/invitar         el dueño crea una invitación para una persona (sirve una vez y vence)
// POST /api/cuentas/aceptar         la persona invitada elige su usuario y contraseña y entra
//
// Las respuestas con sesión traen { token, usuario, tiendas }. La sesión dura 30 días y la
// app la renueva sola cuando tiene conexión.

routerAdd("POST", "/api/cuentas/activar", (e) => {
  const c = require(`${__hooks}/comun.js`), k = require(`${__hooks}/cuentas.js`);
  if (!c.limite("alta:" + c.ipCliente(e), 10, 3600e3)) throw new TooManyRequestsError("Demasiados intentos. Espera un rato.");
  const b = e.requestInfo().body || {};
  const tienda = String(b.tienda || "");
  if (!c.UUID.test(tienda)) throw new BadRequestError("Código de tienda no válido");
  if (c.tieneMiembros(tienda)) throw new ForbiddenError("Esta tienda ya tiene cuentas. Entra con tu usuario o pídele uno al dueño.");
  // Una tienda nueva para el servidor la crea quien la crea. Una que ya tiene datos y no tiene dueño es de
  // antes de las cuentas: solo se activa desde el wifi, porque desde internet cualquiera que supiera su
  // código habría podido quedarse con ella.
  if ($app.countRecords("cambios", $dbx.hashExp({ tienda: tienda })) > 0 && c.desdeInternet(e))
    throw new ForbiddenError("Esta tienda se creó antes de las cuentas. Para crear el usuario del dueño, conéctate al wifi de la tienda y abre la app con la IP del computador del servidor, no con localhost.");
  const usuario = k.usuarioValido(b.usuario), password = k.claveValida(b.password);
  let u = k.buscarUsuario(usuario);
  if (u && !u.validatePassword(password)) throw new BadRequestError("Ese usuario ya existe. Si es tuyo, escribe su contraseña; si no, elige otro.");
  if (!u) u = k.crearUsuario(usuario, b.nombre, password);
  k.crearMiembro(u, tienda, "dueno", {});
  return e.json(200, k.sesion(u));
});

routerAdd("POST", "/api/cuentas/entrar", (e) => {
  const c = require(`${__hooks}/comun.js`), k = require(`${__hooks}/cuentas.js`);
  const b = e.requestInfo().body || {};
  const usuario = String(b.usuario || "").trim().toLowerCase();
  if (!c.limite("entrar:" + c.ipCliente(e), 30, 900e3) || !c.limite("entrar:" + usuario, 10, 900e3)) throw new TooManyRequestsError("Demasiados intentos. Espera 15 minutos y vuelve a intentar.");
  const u = k.buscarUsuario(usuario);
  if (!u || !u.validatePassword(String(b.password || ""))) throw new BadRequestError("Usuario o contraseña incorrectos.");
  return e.json(200, k.sesion(u));
});

routerAdd("GET", "/api/cuentas/yo", (e) => {
  const k = require(`${__hooks}/cuentas.js`);
  if (!e.auth || e.auth.collection().name !== "usuarios") throw new UnauthorizedError("Entra con tu usuario.");
  return e.json(200, k.sesion(e.auth));
});

routerAdd("POST", "/api/cuentas/clave", (e) => {
  const k = require(`${__hooks}/cuentas.js`);
  if (!e.auth || e.auth.collection().name !== "usuarios") throw new UnauthorizedError("Entra con tu usuario.");
  const b = e.requestInfo().body || {};
  const u = $app.findRecordById("usuarios", e.auth.id);
  if (!u.validatePassword(String(b.actual || ""))) throw new BadRequestError("La contraseña actual no es correcta.");
  u.setPassword(k.claveValida(b.nueva));
  $app.save(u);
  return e.json(200, k.sesion(u));
});

routerAdd("GET", "/api/cuentas/miembros", (e) => {
  const k = require(`${__hooks}/cuentas.js`);
  const tienda = String(e.request.url.query().get("tienda") || "");
  k.soloDueno(e, tienda);
  return e.json(200, { miembros: $app.findRecordsByFilter("miembros", "tienda = {:t}", "created", 200, 0, { t: tienda }).map(k.miembroJson) });
});

routerAdd("POST", "/api/cuentas/miembros", (e) => {
  const k = require(`${__hooks}/cuentas.js`);
  const b = e.requestInfo().body || {};
  const tienda = String(b.tienda || "");
  k.soloDueno(e, tienda);
  const usuario = k.usuarioValido(b.usuario), password = k.claveValida(b.password);
  let u = k.buscarUsuario(usuario);
  if (u) {
    // Alguien que ya tiene usuario (por ejemplo, en otra tienda): se suma con su misma contraseña
    if (!u.validatePassword(password)) throw new BadRequestError("Ese usuario ya existe. Elige otro, o escribe la contraseña que ya usa esa persona.");
    try { $app.findFirstRecordByFilter("miembros", "usuario = {:u} && tienda = {:t}", { u: u.id, t: tienda }); throw new BadRequestError("Esa persona ya tiene acceso a la tienda."); } catch (err) { if (err instanceof BadRequestError) throw err; }
  } else u = k.crearUsuario(usuario, b.nombre, password);
  const m = k.crearMiembro(u, tienda, k.rolValido(b.rol), b.permisos);
  return e.json(200, k.miembroJson(m));
});

routerAdd("POST", "/api/cuentas/miembros/{id}", (e) => {
  const k = require(`${__hooks}/cuentas.js`);
  const b = e.requestInfo().body || {};
  const tienda = String(b.tienda || "");
  k.soloDueno(e, tienda);
  let m = null;
  try { m = $app.findRecordById("miembros", e.request.pathValue("id")); } catch (err) { m = null; }
  if (!m || m.getString("tienda") !== tienda) throw new NotFoundError("No encontramos a esa persona.");
  const rol = b.rol != null ? k.rolValido(b.rol) : m.getString("rol");
  const activo = b.activo != null ? !!b.activo : m.getBool("activo");
  // Siempre tiene que quedar al menos un dueño con acceso
  if (m.getString("rol") === "dueno" && (rol !== "dueno" || !activo)) {
    const otros = $app.findRecordsByFilter("miembros", "tienda = {:t} && rol = 'dueno' && activo = true && id != {:id}", "", 1, 0, { t: tienda, id: m.id });
    if (!otros.length) throw new BadRequestError("La tienda tiene que tener al menos un dueño.");
  }
  m.set("rol", rol);
  m.set("activo", activo);
  if (b.permisos != null) m.set("permisos", k.permisosValidos(b.permisos));
  $app.save(m);
  if (b.password || b.nombre) {
    const u = $app.findRecordById("usuarios", m.getString("usuario"));
    if (b.password) u.setPassword(k.claveValida(b.password));
    if (b.nombre) u.set("nombre", String(b.nombre).trim().slice(0, 60));
    $app.save(u);
  }
  return e.json(200, k.miembroJson(m));
});

routerAdd("POST", "/api/cuentas/invitar", (e) => {
  const k = require(`${__hooks}/cuentas.js`);
  const b = e.requestInfo().body || {};
  const tienda = String(b.tienda || "");
  k.soloDueno(e, tienda);
  const nombre = String(b.nombre || "").replace(/\s+/g, " ").trim().slice(0, 60);
  if (!nombre) throw new BadRequestError("Escribe el nombre.");
  const rol = k.rolValido(b.rol);
  if (rol === "dueno") throw new BadRequestError("Una invitación es para encargado o vendedor. Después puedes cambiarle el rol.");
  // El código va solo en el link: aquí se guarda su resumen
  const codigo = $security.randomStringWithAlphabet(32, "abcdefghijklmnopqrstuvwxyz0123456789");
  const r = new Record($app.findCollectionByNameOrId("invitaciones"));
  r.set("tienda", tienda);
  r.set("hash", $security.sha256(codigo));
  r.set("nombre", nombre);
  r.set("rol", rol);
  r.set("permisos", k.permisosValidos(b.permisos));
  r.set("vence", Date.now() + k.VIGENCIA_INVITACION);
  r.set("usada", false);
  $app.save(r);
  return e.json(200, { codigo: codigo, vence: r.getInt("vence") });
});

routerAdd("POST", "/api/cuentas/aceptar", (e) => {
  const c = require(`${__hooks}/comun.js`), k = require(`${__hooks}/cuentas.js`);
  if (!c.limite("aceptar:" + c.ipCliente(e), 20, 3600e3)) throw new TooManyRequestsError("Demasiados intentos. Espera un rato.");
  const b = e.requestInfo().body || {};
  const usuario = k.usuarioValido(b.usuario), password = k.claveValida(b.password);
  let u = null, tienda = "";
  // En una transacción, para que dos personas no usen el mismo link al mismo tiempo
  $app.runInTransaction((tx) => {
    let inv = null;
    try { inv = tx.findFirstRecordByData("invitaciones", "hash", $security.sha256(String(b.codigo || ""))); } catch (err) { inv = null; }
    if (!inv || inv.getBool("usada") || inv.getInt("vence") < Date.now()) throw new BadRequestError("Esta invitación ya se usó o venció. Pídele al dueño una nueva.");
    tienda = inv.getString("tienda");
    try { u = tx.findFirstRecordByData("usuarios", "usuario", usuario); } catch (err) { u = null; }
    if (u) {
      // Alguien que ya tiene usuario (por ejemplo, en otra tienda) se suma con su misma contraseña
      if (!u.validatePassword(password)) throw new BadRequestError("Ese usuario ya existe. Elige otro, o escribe la contraseña que ya usas con él.");
      try { tx.findFirstRecordByFilter("miembros", "usuario = {:u} && tienda = {:t}", { u: u.id, t: tienda }); throw new BadRequestError("Ya tienes acceso a esta tienda. Entra con tu usuario."); } catch (err) { if (err instanceof BadRequestError) throw err; }
    } else u = k.crearUsuario(usuario, inv.getString("nombre"), password, tx);
    k.crearMiembro(u, tienda, inv.getString("rol"), JSON.parse(inv.getString("permisos") || "{}"), tx);
    inv.set("usada", true);
    tx.save(inv);
  });
  // Su nombre queda en la lista de quienes atienden (el historial dice quién vendió). Lo anota el
  // servidor porque un vendedor no puede cambiar esa lista.
  c.guardarCambio(tienda, "personas", { id: u.id, nombre: u.getString("nombre"), activo: true });
  return e.json(200, Object.assign(k.sesion(u), { tienda: tienda }));
});

/// <reference path="../pb_data/types.d.ts" />
// Cuentas y permisos (Fase 4).
//
// POST /api/cuentas/activar         el dueño activa las cuentas de su tienda y crea su usuario
// POST /api/cuentas/entrar          entrar con usuario y contraseña
// GET  /api/cuentas/yo              renueva la sesión y dice a qué tiendas tiene acceso
// POST /api/cuentas/clave           cambiar la propia contraseña
// GET  /api/cuentas/miembros        quiénes tienen acceso a una tienda (solo el dueño)
// POST /api/cuentas/miembros        crear el usuario de alguien que atiende (solo el dueño)
// POST /api/cuentas/miembros/{id}   cambiar rol, permisos o contraseña, o quitar el acceso
//
// Las respuestas con sesión traen { token, usuario, tiendas }. La sesión dura 30 días y la
// app la renueva sola cuando tiene conexión.

routerAdd("POST", "/api/cuentas/activar", (e) => {
  const c = require(`${__hooks}/comun.js`), k = require(`${__hooks}/cuentas.js`);
  if (!c.limite("alta:" + c.ipCliente(e), 10, 3600e3)) throw new TooManyRequestsError("Demasiados intentos. Espera un rato.");
  const b = e.requestInfo().body || {};
  const tienda = String(b.tienda || "");
  if (!c.UUID.test(tienda)) throw new BadRequestError("Código de tienda no válido");
  if ($app.countRecords("cambios", $dbx.hashExp({ tienda: tienda })) === 0) throw new BadRequestError("El servidor todavía no tiene los datos de esta tienda. Espera a que diga Sincronizado.");
  if (c.tieneMiembros(tienda)) throw new ForbiddenError("Esta tienda ya tiene cuentas. Entra con tu usuario o pídele uno al dueño.");
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

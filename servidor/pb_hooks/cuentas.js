// Funciones de cuentas.pb.js (se cargan con require, como comun.js).

function usuarioValido(v) {
  const u = String(v || "").trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(u)) throw new BadRequestError("El usuario debe tener entre 3 y 30 letras o números, sin espacios ni tildes (puede llevar . - _).");
  return u;
}
function claveValida(v) {
  const p = String(v || "");
  if (p.length < 6) throw new BadRequestError("La contraseña debe tener al menos 6 caracteres.");
  if (p.length > 72) throw new BadRequestError("La contraseña es demasiado larga.");
  return p;
}
function rolValido(v) {
  if (["dueno", "encargado", "vendedor"].indexOf(v) < 0) throw new BadRequestError("Rol no válido");
  return v;
}
function permisosValidos(p) {
  const c = require(`${__hooks}/comun.js`), out = {};
  for (const k of c.PERMISOS) if (p && p[k]) out[k] = true;
  return out;
}
function buscarUsuario(usuario) {
  try { return $app.findFirstRecordByData("usuarios", "usuario", usuario); } catch (err) { return null; }
}
function crearUsuario(usuario, nombre, password) {
  const n = String(nombre || "").replace(/\s+/g, " ").trim().slice(0, 60);
  if (!n) throw new BadRequestError("Escribe el nombre.");
  const u = new Record($app.findCollectionByNameOrId("usuarios"));
  u.set("usuario", usuario);
  u.set("nombre", n);
  u.setPassword(password);
  $app.save(u);
  return u;
}
function crearMiembro(u, tienda, rol, permisos) {
  const m = new Record($app.findCollectionByNameOrId("miembros"));
  m.set("usuario", u.id);
  m.set("tienda", tienda);
  m.set("rol", rol);
  m.set("permisos", permisosValidos(permisos));
  m.set("activo", true);
  $app.save(m);
  return m;
}
// Lo que la app necesita para trabajar: la sesión y sus tiendas con sus permisos
function sesion(u) {
  const c = require(`${__hooks}/comun.js`);
  const tiendas = $app.findRecordsByFilter("miembros", "usuario = {:u} && activo = true", "created", 100, 0, { u: u.id })
    .map((m) => { const n = c.ultimo(m.getString("tienda"), "ajustes", "tienda_nombre");
      return { tienda: m.getString("tienda"), nombre: n && n.value ? String(n.value.valor || "") : "", rol: m.getString("rol"), permisos: c.permisosMiembro(m) }; });
  return { token: u.newAuthToken(), usuario: { id: u.id, usuario: u.getString("usuario"), nombre: u.getString("nombre") }, tiendas: tiendas };
}
function miembroJson(m) {
  const c = require(`${__hooks}/comun.js`);
  let u = null;
  try { u = $app.findRecordById("usuarios", m.getString("usuario")); } catch (err) { u = null; }
  return { id: m.id, usuarioId: m.getString("usuario"), usuario: u ? u.getString("usuario") : "", nombre: u ? u.getString("nombre") : "",
    rol: m.getString("rol"), permisos: c.permisosMiembro(m), extra: JSON.parse(m.getString("permisos") || "{}"), activo: m.getBool("activo") };
}
// Solo el dueño administra las cuentas de su tienda
function soloDueno(e, tienda) {
  const c = require(`${__hooks}/comun.js`);
  if (!c.UUID.test(tienda)) throw new BadRequestError("Código de tienda no válido");
  const m = c.miembroDe(e, tienda);
  if (!m) throw new UnauthorizedError("Entra con tu usuario.");
  if (m.getString("rol") !== "dueno") throw new ForbiddenError("Solo el dueño puede administrar las cuentas.");
  return m;
}

module.exports = { usuarioValido, claveValida, rolValido, permisosValidos, buscarUsuario, crearUsuario, crearMiembro, sesion, miembroJson, soloDueno };

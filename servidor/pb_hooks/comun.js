// Funciones que usan sync.pb.js y publico.pb.js. Cada punto del servidor las carga con
// require(`${__hooks}/comun.js`), porque en PocketBase cada pedido corre por separado.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PID = /^[a-z0-9]{10,24}$/;

// Último número de orden (seq) de los cambios de una tienda
function maxSeq(db, tienda) {
  const row = new DynamicModel({ m: 0 });
  db.newQuery("SELECT COALESCE(MAX(seq), 0) AS m FROM cambios WHERE tienda = {:t}").bind({ t: tienda }).one(row);
  return row.m;
}

// Avisa en tiempo real a los dispositivos de la tienda que hay cambios nuevos
function avisar(tienda) {
  const topic = "tienda/" + tienda;
  const msg = new SubscriptionMessage({ name: topic, data: JSON.stringify({ hasta: maxSeq($app.db(), tienda) }) });
  const clients = $app.subscriptionsBroker().clients();
  for (const id in clients) {
    if (clients[id].hasSubscription(topic)) clients[id].send(msg);
  }
}

// Guarda un registro como si lo hubiera mandado un dispositivo más (el "dispositivo" web).
// Con del, guarda un borrado. desdeMs: el sello queda después de esa hora (para ganarle a otro cambio).
function guardarCambio(tienda, store, value, del, desdeMs) {
  const alfabeto = "0123456789abcdefghijklmnopqrstuvwxyz";
  for (let intento = 0; intento < 3; intento++) {
    try {
      $app.runInTransaction((tx) => {
        const r = new Record(tx.findCollectionByNameOrId("cambios"));
        r.set("tienda", tienda);
        r.set("hlc", Math.max(Date.now(), (desdeMs || 0) + 1) + "-0000-web" + $security.randomStringWithAlphabet(8, alfabeto));
        r.set("device", "web");
        r.set("store", store);
        if (del != null) r.set("del", String(del));
        else r.set("value", value);
        r.set("seq", maxSeq(tx.db(), tienda) + 1);
        tx.save(r);
      });
      avisar(tienda);
      return;
    } catch (err) {
      // Otro dispositivo guardó al mismo tiempo y tomó el mismo seq: se intenta de nuevo
      if (intento === 2) throw err;
    }
  }
}

// ¿El pedido viene desde internet (por el túnel) o desde el mismo computador o el wifi?
// Se mira la dirección que escribió el navegador: en el wifi es localhost o una IP privada.
function desdeInternet(e) {
  const host = String(e.request.host || "").toLowerCase().replace(/:\d+$/, "");
  return !/^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|\[::1\]|[a-z0-9-]+\.local)$/.test(host);
}

// IP del cliente: el túnel la manda en un encabezado; si no hay, la conexión directa
function ipCliente(e) {
  const h = (k) => String(e.request.header.get(k) || "").trim();
  const cf = h("Cf-Connecting-Ip");
  if (cf) return cf;
  const xff = h("X-Forwarded-For");
  if (xff) { const partes = xff.split(","); return partes[partes.length - 1].trim(); }
  return String(e.request.remoteAddr || "").replace(/:\d+$/, "");
}

// Límite de intentos: no más de "max" en "ms" milisegundos para una misma llave
function limite(llave, max, ms) {
  const st = $app.store(), ahora = Date.now();
  let lista = [];
  try { lista = JSON.parse(st.get("rl:" + llave) || "[]").filter((t) => ahora - t < ms); } catch (err) { lista = []; }
  if (lista.length >= max) return false;
  lista.push(ahora);
  st.set("rl:" + llave, JSON.stringify(lista));
  return true;
}

// ---------- Cuentas y permisos (Fase 4) ----------
// Permisos: precios (productos, precios y ofertas), costos (ver costos y proveedores), inventario
// (contar, recibir y vencimientos), reportes (resumen e historial), config (ajustes de la tienda)
// y cuentas (crear usuarios; solo el dueño). Vender, fiados, reservas, encargos y caja: todos.
const PERMISOS = ["precios", "costos", "inventario", "reportes", "config"];
function permisosDe(rol, extra) {
  const p = { cuentas: rol === "dueno" };
  for (const k of PERMISOS) p[k] = rol === "dueno" || (rol === "encargado") || !!(extra && extra[k]);
  return p;
}
const tieneMiembros = (tienda) => $app.countRecords("miembros", $dbx.hashExp({ tienda: tienda })) > 0;
// La membresía activa de quien hace el pedido en esa tienda, o null
function miembroDe(e, tienda) {
  const u = e.auth;
  if (!u || u.collection().name !== "usuarios") return null;
  try {
    const m = $app.findFirstRecordByFilter("miembros", "usuario = {:u} && tienda = {:t} && activo = true", { u: u.id, t: tienda });
    return m;
  } catch (err) { return null; }
}
function permisosMiembro(m) { return permisosDe(m.getString("rol"), JSON.parse(m.getString("permisos") || "{}")); }

// Último valor que tiene el servidor de un registro: { value, hlc }, { del: true, hlc } o null
function ultimo(tienda, store, key) {
  const campo = store === "ajustes" ? "value.clave" : "value.id";
  const rows = $app.findRecordsByFilter("cambios", "tienda = {:t} && store = {:s} && (" + campo + " = {:k} || del = {:k})", "-seq", 1, 0, { t: tienda, s: store, k: key });
  if (!rows.length) return null;
  const hlc = rows[0].getString("hlc");
  if (rows[0].getString("del")) return { del: true, hlc: hlc };
  return { value: JSON.parse(rows[0].getString("value") || "{}"), hlc: hlc };
}

// ¿Puede alguien con permisos P guardar este cambio? prev: lo que había (de ultimo())
const INVENTARIO_PRODUCTO = ["countQty", "countAt", "estimated", "has", "cost", "porCaja", "prov", "_v"];
function permite(P, store, value, del, prev) {
  const borra = del != null;
  switch (store) {
    case "movs":
      if (borra) return P.config;
      return value.type === "venta" || P.inventario;
    case "products": {
      if (borra || !prev || !prev.value) return P.precios;
      if (P.precios) return true;
      const antes = prev.value, cambios = [];
      const claves = {};
      for (const k in antes) claves[k] = 1;
      for (const k in value) claves[k] = 1;
      for (const k in claves) if (JSON.stringify(antes[k]) !== JSON.stringify(value[k])) cambios.push(k);
      return P.inventario && cambios.every((k) => INVENTARIO_PRODUCTO.indexOf(k) >= 0);
    }
    case "ajustes": return (value && value.clave === "mensaje_pan") || P.config;
    case "vencimientos": return P.inventario;
    case "proveedores": case "provmovs": return P.inventario || P.costos;
    case "ofertas": return P.precios;
    case "personas": return P.config || P.cuentas;
    case "reservas": return true;
    default: return borra ? P.config : true;   // clients, fiados, cajas, encargos
  }
}

module.exports = { UUID, PID, maxSeq, avisar, guardarCambio, desdeInternet, ipCliente, limite,
  PERMISOS, permisosDe, tieneMiembros, miembroDe, permisosMiembro, ultimo, permite };

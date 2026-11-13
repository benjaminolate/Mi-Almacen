// Funciones que usan sync.pb.js y publico.pb.js. Cada punto del servidor las carga con
// require(`${__hooks}/comun.js`), porque en PocketBase cada pedido corre por separado.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PID = /^[a-z0-9]{10,24}$/;
// Ids de registros: la app los pone en el HTML, así que no pueden traer caracteres de código.
// No se exige el formato UUID porque respaldos antiguos pueden traer ids de otra forma.
const ID = /^[^<>"'`&\u0000-\u001f]{0,200}$/;

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

// ¿El pedido viene de internet? Solo cuenta como "de la casa" lo que llega directo desde otro
// equipo del wifi. No se mira el encabezado Host: lo escribe quien pide, y bastaba con poner
// "localhost" para abrir el panel desde internet. Los túneles (Tailscale, Cloudflare) y Caddy en un
// VPS entregan todo desde este mismo computador (127.0.0.1), así que eso también cuenta como internet.
function desdeInternet(e) {
  const h = (k) => String(e.request.header.get(k) || "");
  if (h("X-Forwarded-For") || h("Forwarded") || h("X-Real-Ip") || h("Cf-Connecting-Ip") || h("Tailscale-Funnel-Request")) return true;
  const ip = String(e.request.remoteAddr || "").replace(/:\d+$/, "").replace(/^\[|\]$/g, "").toLowerCase();
  return !/^(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+|f[cd][0-9a-f]{2}:[0-9a-f:]*|fe80:[0-9a-f:%a-z]*)$/.test(ip);
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

// Lo que debe un cliente: fiados menos pagos, con el último valor de cada anotación.
// db: la del pedido en curso, para contar también lo que llega en el mismo envío.
function saldoCliente(db, tienda, cid) {
  const filas = arrayOf(new DynamicModel({ value: "", del: "" }));
  db.newQuery("SELECT COALESCE(value, '') AS value, COALESCE(del, '') AS del FROM cambios WHERE tienda = {:t} AND store = 'fiados' AND (json_extract(value, '$.cid') = {:c}"
    + " OR del IN (SELECT json_extract(value, '$.id') FROM cambios WHERE tienda = {:t} AND store = 'fiados' AND json_extract(value, '$.cid') = {:c})) ORDER BY seq")
    .bind({ t: tienda, c: cid }).all(filas);
  const ultimos = {};
  for (const f of filas) {
    if (f.del) { delete ultimos[f.del]; continue; }
    try { const v = JSON.parse(f.value); ultimos[v.id] = v; } catch (err) {}
  }
  let saldo = 0;
  for (const id in ultimos) { const v = ultimos[id]; if (v.cid === cid) saldo += (v.type === "fiado" ? 1 : -1) * (+v.amount || 0); }
  return saldo;
}

// ¿Puede alguien con permisos P guardar este cambio? prev: lo que había (de ultimo())
// ctx: { db, tienda } del pedido, para las reglas que miran otros registros
const INVENTARIO_PRODUCTO = ["countQty", "countAt", "estimated", "has", "cost", "porCaja", "prov", "_v"];
function permite(P, store, value, del, prev, ctx) {
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
    case "clients":
      if (borra) return P.config;
      // Eliminar a un cliente que todavía debe: solo quien puede cambiar los ajustes (decisión de Benjamin, nov 2026)
      if (value.eliminado && !(prev && prev.value && prev.value.eliminado)) return P.config || saldoCliente(ctx.db, ctx.tienda, value.id) <= 0;
      return true;
    default: return borra ? P.config : true;   // fiados, cajas, encargos
  }
}

// Costos: solo los ve quien tiene el permiso. A los demás el servidor les manda productos y
// movimientos sin "cost" (sinCostos), y cuando devuelven un producto así, se le pone el costo que
// tenía (conCosto) para que no se pierda. Pueden anotar un costo (al recibir), pero no leerlo.
const CON_COSTO = ["products", "movs"];
function conCosto(P, store, value, prev) {
  if (!P || P.costos || store !== "products" || !value || value.cost !== undefined) return value;
  if (!prev || !prev.value || prev.value.cost === undefined) return value;
  return Object.assign({}, value, { cost: prev.value.cost });
}
function sinCostos(P, cambio) {
  if (P && !P.costos && cambio.value && CON_COSTO.indexOf(cambio.store) >= 0) delete cambio.value.cost;
  return cambio;
}

// ¿Los valores están dentro de lo que la app deja escribir? (lo mismo que revisan sus pantallas)
// Solo se revisan los campos que cambian, para no trabar registros guardados antes de estas reglas.
// prev: lo que había (de ultimo())
const MAX_FIADO = 1000000;
// ¿Dos versiones de un registro difieren en algo más que su sello (_v)?
function distinto(a, b) {
  const claves = {};
  for (const k in a) claves[k] = 1;
  for (const k in b) claves[k] = 1;
  for (const k in claves) if (k !== "_v" && JSON.stringify(a[k]) !== JSON.stringify(b[k])) return true;
  return false;
}
function valido(store, value, prev) {
  const v = value || {}, antes = (prev && prev.value) || {};
  const cambia = (k) => JSON.stringify(v[k]) !== JSON.stringify(antes[k]);
  const ok = (claves, regla) => claves.every((k) => !cambia(k) || regla(k));
  const vacio = (k) => v[k] == null || v[k] === "";
  const positivo = (k) => vacio(k) || (isFinite(+v[k]) && +v[k] >= 0);
  switch (store) {
    case "products":
      return ok(["price", "cost", "min", "countQty"], positivo)
        && ok(["porCaja"], (k) => !v[k] || (Number.isInteger(+v[k]) && +v[k] >= 2 && +v[k] <= 1000))
        && ok(["countQty"], (k) => v.kg || vacio(k) || Number.isInteger(+v[k]));
    // Los movimientos no se editan: una venta o compra ya guardada no cambia (volver a mandarla igual, sí)
    case "movs": return ok(["qty", "price", "cost"], positivo) && !(prev && prev.value && distinto(prev.value, v));
    case "fiados": return ok(["amount"], (k) => isFinite(+v[k]) && +v[k] > 0 && +v[k] <= MAX_FIADO);
    case "provmovs": return ok(["amount"], (k) => isFinite(+v[k]) && +v[k] > 0);
    case "ofertas":
      if (v.tipo === "pack") return ok(["n", "precio"], () => Number.isInteger(+v.n) && +v.n >= 2 && +v.n <= 100 && +v.precio > 0);
      return ok(["pct"], (k) => +v[k] > 0 && +v[k] <= 100);
    // Los celulares se revisan solo en la app: si el servidor rechaza un cliente, proveedor o encargo
    // nuevo, queda solo en el dispositivo que lo anotó y los demás no lo ven.
  }
  return true;
}

module.exports = { UUID, PID, ID, maxSeq, avisar, guardarCambio, desdeInternet, ipCliente, limite,
  PERMISOS, permisosDe, tieneMiembros, miembroDe, permisosMiembro, ultimo, saldoCliente, permite, valido, conCosto, sinCostos };

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

// Guarda un registro como si lo hubiera mandado un dispositivo más (el "dispositivo" web)
function guardarCambio(tienda, store, value) {
  const alfabeto = "0123456789abcdefghijklmnopqrstuvwxyz";
  for (let intento = 0; intento < 3; intento++) {
    try {
      $app.runInTransaction((tx) => {
        const r = new Record(tx.findCollectionByNameOrId("cambios"));
        r.set("tienda", tienda);
        r.set("hlc", Date.now() + "-0000-web" + $security.randomStringWithAlphabet(8, alfabeto));
        r.set("device", "web");
        r.set("store", store);
        r.set("value", value);
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

module.exports = { UUID, PID, maxSeq, avisar, guardarCambio, desdeInternet, ipCliente, limite };

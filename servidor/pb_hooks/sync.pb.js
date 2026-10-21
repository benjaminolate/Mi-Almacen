/// <reference path="../pb_data/types.d.ts" />
// Punto de sincronización de la app Mi Almacén.
//
// POST /api/sync  { tienda, device, desde, cambios: [{ hlc, store, value } | { hlc, store, del }] }
//   1. Guarda los cambios que manda el dispositivo (los repetidos se ignoran por su hlc).
//   2. Devuelve los cambios de esa tienda con seq mayor que "desde", y la hora del servidor.
//   3. Avisa en tiempo real a los otros dispositivos de la tienda (canal "tienda/<id>").
//
// Por ahora el código de la tienda (un UUID imposible de adivinar) es lo que da acceso.
// Las cuentas de usuario llegan en la Fase 4.

routerAdd("GET", "/api/sync/estado", (e) => {
  return e.json(200, { app: "mi-almacen", version: 1, hora: Date.now() });
});

routerAdd("POST", "/api/sync", (e) => {
  const STORES = ["products", "movs", "clients", "fiados", "reservas", "ajustes", "vencimientos", "cajas", "proveedores", "provmovs", "ofertas", "personas", "encargos"];
  const LIMIT = 1000;
  const body = e.requestInfo().body || {};
  const tienda = String(body.tienda || "");
  let desde = Math.max(0, parseInt(body.desde, 10) || 0);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(tienda)) throw new BadRequestError("Código de tienda no válido");
  const cambios = Array.isArray(body.cambios) ? body.cambios : [];
  if (cambios.length > 500) throw new BadRequestError("Demasiados cambios en un solo envío");

  const maxSeq = (db) => {
    const row = new DynamicModel({ m: 0 });
    db.newQuery("SELECT COALESCE(MAX(seq), 0) AS m FROM cambios WHERE tienda = {:t}").bind({ t: tienda }).one(row);
    return row.m;
  };

  let nuevos = 0;
  if (cambios.length) {
    $app.runInTransaction((tx) => {
      const col = tx.findCollectionByNameOrId("cambios");
      let seq = maxSeq(tx.db());
      for (const c of cambios) {
        const hlc = String(c.hlc || "");
        if (!/^\d{13}-\d{4}-[0-9a-z]{1,16}$/.test(hlc) || STORES.indexOf(c.store) < 0) throw new BadRequestError("Cambio no válido: " + hlc);
        if (tx.countRecords("cambios", $dbx.hashExp({ hlc: hlc })) > 0) continue;
        const r = new Record(col);
        r.set("tienda", tienda);
        r.set("hlc", hlc);
        r.set("device", String(c.device || "").slice(0, 40));
        r.set("store", c.store);
        if (c.del != null) r.set("del", String(c.del));
        else r.set("value", c.value);
        r.set("seq", ++seq);
        tx.save(r);
        nuevos++;
      }
    });
  }

  // Si el dispositivo trae un cursor más adelante que el servidor (por ejemplo, se
  // restauró el servidor desde un respaldo), se le manda todo de nuevo
  if (desde > maxSeq($app.db())) desde = 0;

  const rows = $app.findRecordsByFilter("cambios", "tienda = {:t} && seq > {:s}", "seq", LIMIT, 0, { t: tienda, s: desde });
  const out = rows.map((r) => {
    const c = { hlc: r.getString("hlc"), store: r.getString("store"), seq: r.getInt("seq") };
    const del = r.getString("del");
    if (del) c.del = del;
    else c.value = JSON.parse(r.getString("value"));
    return c;
  });
  const hasta = out.length ? out[out.length - 1].seq : desde;

  if (nuevos) {
    const topic = "tienda/" + tienda;
    const msg = new SubscriptionMessage({ name: topic, data: JSON.stringify({ hasta: maxSeq($app.db()) }) });
    const clients = $app.subscriptionsBroker().clients();
    for (const id in clients) {
      if (clients[id].hasSubscription(topic)) clients[id].send(msg);
    }
  }

  return e.json(200, { hora: Date.now(), hasta: hasta, mas: out.length === LIMIT, cambios: out });
});

/// <reference path="../pb_data/types.d.ts" />
// Punto de sincronización de la app Mi Almacén.
//
// POST /api/sync  { tienda, device, desde, cambios: [{ hlc, store, value } | { hlc, store, del }] }
//   1. Guarda los cambios que manda el dispositivo (los repetidos se ignoran por su hlc).
//   2. Devuelve los cambios de esa tienda con seq mayor que "desde", y la hora del servidor.
//   3. Avisa en tiempo real a los otros dispositivos de la tienda (canal "tienda/<id>").
//
// Valores: un cambio con números fuera de rango (precios negativos, fiados de más de un
// millón, celulares mal escritos...) tampoco se guarda, aunque la tienda no tenga cuentas.
//
// Acceso: una tienda sin cuentas se abre con su código (un UUID imposible de adivinar).
// Cuando el dueño activa las cuentas (Fase 4), además hay que entrar con un usuario que
// sea miembro de la tienda, y cada cambio se revisa contra sus permisos. Un cambio sin
// permiso no se guarda: el servidor vuelve a mandar lo que había, para que el dispositivo
// que lo hizo quede igual que los demás.

routerAdd("GET", "/api/sync/estado", (e) => {
  return e.json(200, { app: "mi-almacen", version: 2, cuentas: true, hora: Date.now() });
});

routerAdd("POST", "/api/sync", (e) => {
  const c = require(`${__hooks}/comun.js`);
  const STORES = ["products", "movs", "clients", "fiados", "reservas", "ajustes", "vencimientos", "cajas", "proveedores", "provmovs", "ofertas", "personas", "encargos"];
  const LIMIT = 1000;
  const body = e.requestInfo().body || {};
  const tienda = String(body.tienda || "");
  let desde = Math.max(0, parseInt(body.desde, 10) || 0);
  if (!c.UUID.test(tienda)) throw new BadRequestError("Código de tienda no válido");
  const cambios = Array.isArray(body.cambios) ? body.cambios : [];
  if (cambios.length > 500) throw new BadRequestError("Demasiados cambios en un solo envío");

  // ¿Quién es y qué puede hacer?
  let P = null;
  if (c.tieneMiembros(tienda)) {
    const m = c.miembroDe(e, tienda);
    if (!m) return e.json(401, { code: "cuenta", message: e.auth ? "Tu usuario no tiene acceso a esta tienda." : "Esta tienda usa cuentas: entra con tu usuario." });
    P = c.permisosMiembro(m);
  }

  let nuevos = 0;
  const rechazados = [];
  if (cambios.length) {
    $app.runInTransaction((tx) => {
      const col = tx.findCollectionByNameOrId("cambios");
      let seq = c.maxSeq(tx.db(), tienda);
      for (const ch of cambios) {
        const hlc = String(ch.hlc || "");
        if (!/^\d{13}-\d{4}-[0-9a-z]{1,16}$/.test(hlc) || STORES.indexOf(ch.store) < 0) throw new BadRequestError("Cambio no válido: " + hlc);
        if (tx.countRecords("cambios", $dbx.hashExp({ hlc: hlc })) > 0) continue;
        const borra = ch.del != null;
        const key = borra ? String(ch.del) : String((ch.store === "ajustes" ? (ch.value || {}).clave : (ch.value || {}).id) || "");
        // Lo que había solo se busca si hace falta: con cuentas, o si el valor nuevo no pasa la revisión
        // (puede ser un campo antiguo que no cambió)
        const prev = P || (!borra && !c.valido(ch.store, ch.value, null)) ? c.ultimo(tienda, ch.store, key) : null;
        if ((!borra && !c.valido(ch.store, ch.value, prev)) || (P && !c.permite(P, ch.store, ch.value || {}, ch.del, prev))) {
          rechazados.push({ store: ch.store, key: key, hlc: hlc });
          continue;
        }
        const r = new Record(col);
        r.set("tienda", tienda);
        r.set("hlc", hlc);
        r.set("device", String(ch.device || "").slice(0, 40));
        r.set("store", ch.store);
        if (ch.del != null) r.set("del", String(ch.del));
        else r.set("value", ch.value);
        r.set("seq", ++seq);
        tx.save(r);
        nuevos++;
      }
    });
  }
  // Lo rechazado se corrige con lo que tiene el servidor (o se borra si no existía), salvo
  // que el servidor ya tenga algo más nuevo de ese registro, que igual le gana en el dispositivo
  for (const x of rechazados) {
    if (!x.key) continue;
    const ahora = c.ultimo(tienda, x.store, x.key);
    if (ahora && ahora.hlc > x.hlc) continue;
    if (ahora && ahora.value) c.guardarCambio(tienda, x.store, ahora.value, null, parseInt(x.hlc, 10));
    else c.guardarCambio(tienda, x.store, null, x.key, parseInt(x.hlc, 10));
  }

  // Si el dispositivo trae un cursor más adelante que el servidor (por ejemplo, se
  // restauró el servidor desde un respaldo), se le manda todo de nuevo
  if (desde > c.maxSeq($app.db(), tienda)) desde = 0;

  const rows = $app.findRecordsByFilter("cambios", "tienda = {:t} && seq > {:s}", "seq", LIMIT, 0, { t: tienda, s: desde });
  const out = rows.map((r) => {
    const o = { hlc: r.getString("hlc"), store: r.getString("store"), seq: r.getInt("seq") };
    const del = r.getString("del");
    if (del) o.del = del;
    else o.value = JSON.parse(r.getString("value"));
    return o;
  });
  const hasta = out.length ? out[out.length - 1].seq : desde;

  if (nuevos) c.avisar(tienda);

  return e.json(200, { hora: Date.now(), hasta: hasta, mas: out.length === LIMIT, cambios: out, rechazados: rechazados.length });
});

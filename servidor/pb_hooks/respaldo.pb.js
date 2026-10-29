/// <reference path="../pb_data/types.d.ts" />
// Respaldo diario por correo, para que una copia quede fuera de este computador.
//
// Cada tienda elige el correo en la app (Más > Tienda y datos > Respaldo por correo, ajuste
// "respaldo_correo"). Todas las noches el servidor le manda un archivo con todo lo que tiene
// de esa tienda, el mismo que se restaura desde la app. El correo sale por el SMTP que se
// configura en el panel de PocketBase (ver INSTRUCCIONES.md).
//
// POST /api/respaldo/correo  { tienda }  manda el respaldo ahora (para probar)

// 04:30 UTC = 01:30 en Chile en verano (00:30 en invierno)
cronAdd("respaldo-correo", "30 4 * * *", () => {
  const r = require(`${__hooks}/respaldo.js`);
  if (!r.hayCorreo()) return;
  const rows = arrayOf(new DynamicModel({ tienda: "" }));
  $app.db().newQuery("SELECT DISTINCT tienda FROM cambios WHERE store = 'ajustes' AND json_extract(value, '$.clave') = 'respaldo_correo'").all(rows);
  for (const row of rows) {
    const para = r.correoDe(row.tienda);
    if (!para) continue;
    try { r.enviar(row.tienda, para); } catch (err) { $app.logger().error("No se pudo mandar el respaldo", "tienda", row.tienda, "error", String(err)); }
  }
});

routerAdd("POST", "/api/respaldo/correo", (e) => {
  const c = require(`${__hooks}/comun.js`), r = require(`${__hooks}/respaldo.js`);
  const tienda = String((e.requestInfo().body || {}).tienda || "");
  if (!c.UUID.test(tienda)) throw new BadRequestError("Código de tienda no válido");
  if ($app.countRecords("cambios", $dbx.hashExp({ tienda: tienda })) === 0) throw new BadRequestError("El servidor todavía no tiene los datos de esta tienda. Espera a que diga Sincronizado.");
  if (c.tieneMiembros(tienda)) {
    const m = c.miembroDe(e, tienda);
    if (!m) throw new UnauthorizedError("Entra con tu usuario.");
    if (!c.permisosMiembro(m).config) throw new ForbiddenError("Tu usuario no puede cambiar los ajustes de la tienda.");
  }
  if (!c.limite("respaldo:" + tienda, 5, 3600e3)) throw new TooManyRequestsError("Ya se mandaron varios respaldos en la última hora. Espera un rato.");
  if (!r.hayCorreo()) throw new BadRequestError("El servidor todavía no tiene configurado el correo. Mira la sección \"Respaldo por correo\" de servidor/INSTRUCCIONES.md.");
  const para = r.correoDe(tienda);
  if (!para) throw new BadRequestError("Primero guarda el correo y espera a que diga Sincronizado.");
  const bytes = r.enviar(tienda, para);
  return e.json(200, { ok: true, para: para, bytes: bytes });
});

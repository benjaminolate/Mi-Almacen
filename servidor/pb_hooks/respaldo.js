// Funciones de respaldo.pb.js (se cargan con require, como comun.js).

const LLAVE = { ajustes: "clave" };
const TABLAS = ["products", "movs", "clients", "fiados", "reservas", "ajustes", "vencimientos", "cajas", "proveedores", "provmovs", "ofertas", "personas", "encargos"];

// Todo lo que el servidor tiene de una tienda, en el formato de "Descargar respaldo" de la app.
// No trae los datos de un dispositivo (meta): la app los mantiene o los crea al restaurar.
function armar(tienda) {
  const idx = {};
  TABLAS.forEach((s) => (idx[s] = {}));
  let desde = 0;
  for (;;) {
    const rows = $app.findRecordsByFilter("cambios", "tienda = {:t} && seq > {:s}", "seq", 5000, 0, { t: tienda, s: desde });
    for (const r of rows) {
      const store = r.getString("store"), del = r.getString("del");
      if (!idx[store]) continue;
      if (del) { delete idx[store][del]; continue; }
      const v = JSON.parse(r.getString("value") || "{}");
      const k = v[LLAVE[store] || "id"];
      if (k == null) continue;
      v._v = r.getString("hlc");
      idx[store][k] = v;
    }
    if (rows.length < 5000) break;
    desde = rows[rows.length - 1].getInt("seq");
  }
  const tablas = { outbox: [] };
  TABLAS.forEach((s) => (tablas[s] = Object.keys(idx[s]).map((k) => idx[s][k])));
  const nombre = idx.ajustes.tienda_nombre ? String(idx.ajustes.tienda_nombre.valor || "") : "";
  return { app: "mi-almacen", version: 1, creado: new Date().toISOString(), origen: "servidor", tienda: { id: tienda, nombre: nombre || "Tienda" }, tablas: tablas };
}

// Correo al que la tienda pidió el respaldo diario (Más > Tienda y datos), o ""
function correoDe(tienda) {
  const c = require(`${__hooks}/comun.js`);
  const u = c.ultimo(tienda, "ajustes", "respaldo_correo");
  const v = u && u.value ? String(u.value.valor || "").trim() : "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : "";
}

function hayCorreo() {
  const s = $app.settings();
  return !!(s.smtp && s.smtp.enabled && s.smtp.host);
}

// Manda el respaldo como archivo adjunto. Devuelve el tamaño en bytes.
function enviar(tienda, para) {
  if (!hayCorreo()) throw new BadRequestError("El servidor todavía no tiene configurado el correo. Mira la sección \"Respaldo por correo\" de servidor/INSTRUCCIONES.md.");
  const file = armar(tienda);
  const json = JSON.stringify(file);
  const dia = file.creado.slice(0, 10);
  const slug = file.tienda.nombre.toLowerCase().replace(/[^a-z0-9ñáéíóú]+/g, "-").replace(/^-|-$/g, "") || "tienda";
  const nombre = `respaldo-${slug}-${dia}.json`;
  const adj = $filesystem.fileFromBytes(toBytes(json), nombre);
  const rd = adj.reader.open();
  try {
    const s = $app.settings();
    const n = (k) => file.tablas[k].length;
    $app.newMailClient().send(new MailerMessage({
      from: { address: s.meta.senderAddress, name: s.meta.senderName || "Mi Almacén" },
      to: [{ address: para }],
      subject: `Respaldo ${file.tienda.nombre} ${dia}`,
      html: `<p>Respaldo diario de <b>${file.tienda.nombre.replace(/[<>&]/g, "")}</b>: ${n("products")} productos, ${n("movs")} ventas, compras y conteos, y ${n("clients")} clientes.</p>`
        + "<p>Si algún día se pierden los datos, abre Mi Almacén, ve a Más &gt; Tienda y datos &gt; Restaurar desde un respaldo y elige el archivo adjunto. Guarda este correo.</p>",
      attachments: { [nombre]: rd },
    }));
  } finally {
    rd.close();
  }
  return json.length;
}

module.exports = { armar, correoDe, hayCorreo, enviar };

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

// Gmail acepta correos de hasta 25 MB, y el adjunto crece un tercio al mandarse. Si el respaldo
// pasa este tamaño, se divide en partes, cada una en su correo; la app las restaura juntas.
const LIMITE = 14000000;
// Primero lo chico (ajustes, productos, clientes) y al final lo que más crece (movimientos)
const ORDEN = ["ajustes", "products", "clients", "proveedores", "personas", "ofertas", "vencimientos", "encargos", "reservas", "cajas", "provmovs", "fiados", "movs"];

function partes(file, limite) {
  const max = limite || LIMITE, vacia = () => { const t = { outbox: [] }; TABLAS.forEach((s) => (t[s] = [])); return t; };
  const lista = [vacia()];
  let tam = JSON.stringify(Object.assign({}, file, { tablas: lista[0] })).length + 100;
  const base = tam;
  for (const s of ORDEN.concat(TABLAS.filter((t) => ORDEN.indexOf(t) < 0))) {
    for (const v of file.tablas[s] || []) {
      const n = JSON.stringify(v).length + 1;
      if (tam + n > max && tam > base) { lista.push(vacia()); tam = base; }
      lista[lista.length - 1][s].push(v);
      tam += n;
    }
  }
  if (lista.length === 1) return [file];
  return lista.map((t, i) => Object.assign({}, file, { parte: { n: i + 1, de: lista.length }, tablas: t }));
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

// Manda el respaldo como archivo adjunto (en varios correos si es muy grande). Devuelve el tamaño en bytes.
function enviar(tienda, para) {
  if (!hayCorreo()) throw new BadRequestError("El servidor todavía no tiene configurado el correo. Mira la sección \"Respaldo por correo\" de servidor/INSTRUCCIONES.md.");
  const file = armar(tienda);
  const dia = file.creado.slice(0, 10);
  const slug = file.tienda.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tienda";
  const n = (k) => file.tablas[k].length;
  const lista = partes(file);
  let bytes = 0;
  for (const p of lista) {
    const json = JSON.stringify(p);
    bytes += json.length;
    const cual = p.parte ? ` (parte ${p.parte.n} de ${p.parte.de})` : "";
    const nombre = `respaldo-${slug}-${dia}${p.parte ? `-parte-${p.parte.n}-de-${p.parte.de}` : ""}.json`;
    const adj = $filesystem.fileFromBytes(toBytes(json), nombre);
    const rd = adj.reader.open();
    try {
      const s = $app.settings();
      $app.newMailClient().send(new MailerMessage({
        from: { address: s.meta.senderAddress, name: s.meta.senderName || "Mi Almacén" },
        to: [{ address: para }],
        subject: `Respaldo ${file.tienda.nombre} ${dia}${cual}`,
        html: `<p>Respaldo diario de <b>${file.tienda.nombre.replace(/[<>&]/g, "")}</b>: ${n("products")} productos, ${n("movs")} ventas, compras y conteos, y ${n("clients")} clientes.</p>`
          + (p.parte ? `<p>Es tan grande que llega en ${p.parte.de} correos. Para restaurarlo hay que elegir los ${p.parte.de} archivos juntos.</p>` : "")
          + "<p>Si algún día se pierden los datos, abre Mi Almacén, ve a Más &gt; Tienda y datos &gt; Restaurar desde un respaldo y elige el archivo adjunto. Guarda este correo.</p>",
        attachments: { [nombre]: rd },
      }));
    } finally {
      rd.close();
    }
  }
  return bytes;
}

module.exports = { armar, partes, correoDe, hayCorreo, enviar };

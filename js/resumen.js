"use strict";
// Resumen de ventas y descarga en Excel.
// ---------- Resumen de ventas ----------
const PERIODOS = { hoy:"Hoy", d7:"7 días", mes:"Este mes", mesp:"Mes pasado", anio:"Este año", aniop:"Año pasado" };
const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
function rango(k){
  const n = new Date(), y = n.getFullYear(), m = n.getMonth(), d0 = new Date(y, m, n.getDate()).getTime();
  return { hoy:[d0, Infinity], d7:[d0 - 6*D, Infinity], mes:[new Date(y, m, 1).getTime(), Infinity], mesp:[new Date(y, m - 1, 1).getTime(), new Date(y, m, 1).getTime()],
    anio:[new Date(y, 0, 1).getTime(), Infinity], aniop:[new Date(y - 1, 0, 1).getTime(), new Date(y, 0, 1).getTime()] }[k];
}
function resumen(k){
  const [a, b] = rango(k), ms = S.movs.filter(m => m.type === "venta" && m.at >= a && m.at < b);
  const grupos = new Set(ms.map(m => m.grupo || m.id)), total = ms.reduce((t, m) => t + m.qty * m.price, 0);
  let gan = 0, sinCosto = new Set();
  ms.forEach(m => { const p = P(m.pid); if (p?.cost > 0) gan += m.qty * (m.price - p.cost); else sinCosto.add(m.pid); });
  const pago = {}; ms.forEach(m => { const k2 = m.pago || "sin"; pago[k2] = (pago[k2] || 0) + m.qty * m.price; });
  const porMes = k === "anio" || k === "aniop", tramos = {};
  ms.forEach(m => { const d = new Date(m.at), key = porMes ? d.getMonth() : ymd(m.at); tramos[key] = (tramos[key] || 0) + m.qty * m.price; });
  const prods = {}; ms.forEach(m => { const x = (prods[m.pid] ||= { q:0, t:0 }); x.q += m.qty; x.t += m.qty * m.price; });
  return { ms, ventas:grupos.size, total, gan, sinCosto:sinCosto.size, pago, porMes, tramos, top:Object.entries(prods).filter(([id]) => P(id)).sort((x, y) => y[1].t - x[1].t).slice(0, 10) };
}
function viewResumen(){
  const k = ui.resPer || (ui.resPer = "hoy"), r = resumen(k);
  const keys = r.porMes ? Object.keys(r.tramos).map(Number).sort((x, y) => x - y) : Object.keys(r.tramos).sort();
  const max = Math.max(1, ...Object.values(r.tramos)), maxPago = Math.max(1, ...Object.values(r.pago));
  const bar = (lbl, v, mx) => `<div class="barra"><span class="muted">${lbl}</span><i style="width:${Math.max(1, v / mx * 100)}%"></i><b>${clp(v)}</b></div>`;
  return `${header("Resumen de ventas", PERIODOS[k])}
  <div class="stack">
    <div class="chips">${Object.entries(PERIODOS).map(([key, v]) => `<button class="chip" data-per="${esc(key)}" aria-pressed="${key === k}">${v}</button>`).join("")}</div>
    <div class="kpis">
      <div class="card kpi"><div class="num">${clp(r.total)}</div><div class="lbl">vendido · ${r.ventas} ${r.ventas === 1 ? "venta" : "ventas"}</div></div>
      ${puede("costos") ? `<div class="card kpi"><div class="num">${clp(r.gan)}</div><div class="lbl">ganancia estimada</div></div>` : ""}
      <div class="card kpi"><div class="num">${clp(r.ventas ? r.total / r.ventas : 0)}</div><div class="lbl">promedio por venta</div></div>
      <div class="card kpi"><div class="num">${r.top.length ? esc(fq(P(r.top[0][0]), r.top[0][1].q)) : "—"}</div><div class="lbl">${r.top.length ? esc(P(r.top[0][0]).name) : "lo más vendido"}</div></div>
    </div>
    ${r.sinCosto && puede("costos") ? `<p class="small muted" style="margin:0">La ganancia usa el costo actual de cada producto. ${r.sinCosto} ${r.sinCosto === 1 ? "producto vendido no tiene" : "productos vendidos no tienen"} costo y no ${r.sinCosto === 1 ? "entra" : "entran"} en la cuenta.</p>` : ""}
    ${r.ms.length ? `
    ${Object.keys(r.pago).some(x => x !== "sin") ? `<div class="card"><h3>Por medio de pago</h3>${Object.entries(r.pago).sort((x, y) => y[1] - x[1]).map(([x, v]) => bar(x === "sin" ? "Sin anotar" : PAGOS_CORTO[x], v, maxPago)).join("")}</div>` : ""}
    ${keys.length > 1 ? `<div class="card"><h3>${r.porMes ? "Por mes" : "Por día"}</h3>${keys.map(x => bar(r.porMes ? MESES[x] : new Date(x + "T12:00").toLocaleDateString("es-CL", { weekday:"short", day:"numeric" }), r.tramos[x], max)).join("")}</div>` : ""}
    <div class="card"><h3>Lo más vendido</h3><div class="list">${r.top.map(([id, x]) => `<div class="item"><div class="main"><div class="name">${esc(P(id).name)}</div><div class="sub">${fq(P(id), x.q)}${P(id).kg ? "" : x.q === 1 ? " vendido" : " vendidos"}</div></div><b>${clp(x.t)}</b></div>`).join("")}</div></div>
    <button class="btn block" id="xlsx">Descargar en Excel</button>` : `<div class="card empty">No hay ventas en este período.</div>`}
  </div>`;
}
function bindResumen(app){
  app.querySelectorAll("[data-per]").forEach(b => b.onclick = () => { ui.resPer = b.dataset.per; rerender(); });
  const x = $("#xlsx"); if (x) x.onclick = () => run(descargarExcel);
}
function descargarExcel(){
  const k = ui.resPer, r = resumen(k), nombre = S.ajustes.tienda_nombre || "Mi Almacén";
  const res = [[nombre + " · Resumen de ventas"], ["Período", PERIODOS[k]], ["Descargado", new Date().toLocaleString("es-CL")], [],
    ["Total vendido", Math.round(r.total)], ["Ventas", r.ventas], ["Promedio por venta", Math.round(r.ventas ? r.total / r.ventas : 0)], ...(puede("costos") ? [["Ganancia estimada", Math.round(r.gan)]] : []), [],
    ["Medio de pago", "Total"], ...Object.entries(r.pago).map(([x, v]) => [x === "sin" ? "Sin anotar" : PAGOS[x], Math.round(v)]), [],
    ["Producto", "Cantidad", "Total"], ...r.top.map(([id, x]) => [P(id).name, r3(x.q), Math.round(x.t)])];
  const ventas = [["Fecha", "Hora", "Producto", "Sector", "Cantidad", "Precio", "Descuento", "Total", "Medio de pago", "Atendió"],
    ...r.ms.slice().sort((a, b) => a.at - b.at).map(m => { const p = P(m.pid), d = new Date(m.at);
      return [d.toLocaleDateString("es-CL"), d.toLocaleTimeString("es-CL", { hour:"2-digit", minute:"2-digit", hourCycle:"h23" }), p?.name || "", p?.cat || "", r3(m.qty), Math.round(m.lista ?? m.price), Math.round(m.desc || 0), Math.round(m.qty * m.price), m.pago ? PAGOS[m.pago] : "", nombrePersona(m.quien)]; })];
  const blob = xlsx([{ name:"Resumen", rows:res }, { name:"Ventas", rows:ventas }]);
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = `ventas-${PERIODOS[k].toLowerCase().replace(/\s+/g, "-").normalize("NFD").replace(/[̀-ͯ]/g, "")}-${hoy()}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000); toast("Excel descargado");
}
// Archivo .xlsx armado a mano (un .zip sin comprimir con hojas en XML), sin librerías
function xlsx(sheets){
  const xe = v => String(v).replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c])).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
  const col = i => { let s = ""; i++; while (i){ const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  const sheet = rows => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((r, i) => `<row r="${i + 1}">${r.map((v, j) => {
    const ref = col(j) + (i + 1); if (v === "" || v == null) return ""; return typeof v === "number" && isFinite(v) ? `<c r="${ref}"><v>${v}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xe(v)}</t></is></c>`; }).join("")}</row>`).join("")}</sheetData></worksheet>`;
  const files = [
    ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`],
    ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xe(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`],
    ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ["xl/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>`],
    ...sheets.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheet(s.rows)])
  ];
  return zipStore(files);
}
// .zip sin compresión (método "store")
function zipStore(files){
  const enc = new TextEncoder(), crcT = zipStore.t || (zipStore.t = Array.from({ length:256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; }));
  const crc = b => { let c = 0xFFFFFFFF; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const parts = [], central = []; let off = 0;
  const u16 = n => [n & 255, (n >>> 8) & 255], u32 = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  for (const [name, text] of files){
    const nb = enc.encode(name), data = enc.encode(text), c = crc(data);
    const head = [...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(c), ...u32(data.length), ...u32(data.length), ...u16(nb.length), ...u16(0)];
    parts.push(new Uint8Array(head), nb, data);
    central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(c), ...u32(data.length), ...u32(data.length), ...u16(nb.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), nb);
    off += head.length + nb.length + data.length;
  }
  const csize = central.reduce((t, x) => t + x.length, 0);
  const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(csize), ...u32(off), ...u16(0)]);
  return new Blob([...parts, ...central, end], { type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}


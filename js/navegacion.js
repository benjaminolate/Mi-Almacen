"use strict";
// Ventanas, pestañas, historial del botón atrás, encabezado y pantalla de inicio.
// ---------- Modal ----------
function openModal(html){
  stopLive();
  $("#modalroot").innerHTML = `<div class="overlay" id="ov"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;
  $("#ov").addEventListener("click", e => { if (e.target.id === "ov" || e.target.hasAttribute("data-close")) closeModal(); });
}
function closeModal(){ stopLive(); $("#modalroot").innerHTML = ""; }

// ---------- Vistas ----------
const ICONS = {
  inicio:'<svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>',
  vender:'<svg viewBox="0 0 24 24"><path d="M3 4h2l2.4 11h11.2L21 7H6.2"/><circle cx="9" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/></svg>',
  recibir:'<svg viewBox="0 0 24 24"><path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/></svg>',
  contar:'<svg viewBox="0 0 24 24"><path d="M9 4h6v3H9z"/><path d="M7 5H5v16h14V5h-2"/><path d="M8.5 13l2.5 2.5 4.5-5"/></svg>',
  productos:'<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
  historial:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  fiados:'<svg viewBox="0 0 24 24"><path d="M6 3h11a1 1 0 0 1 1 1v16l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1z"/><path d="M9 8h6M9 12h4"/></svg>',
  mas:'<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></svg>',
  extensiones:'<svg viewBox="0 0 24 24"><path d="M9 4h4v3a2 2 0 1 0 4 0V4h3v6h-3a2 2 0 1 0 0 4h3v6h-6v-3a2 2 0 1 0-4 0v3H4v-6h3a2 2 0 1 0 0-4H4V4h5z"/></svg>',
  apariencia:'<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.9 1.2-1.8-.5-1-.1-2.2 1.1-2.2H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/></svg>',
  datos:'<svg viewBox="0 0 24 24"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></svg>',
  equipo:'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 4.6a3.2 3.2 0 0 1 0 6.3M18 14.4c1.8.9 3 3 3 5.6"/></svg>',
  reservas:'<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
  pan:'<svg viewBox="0 0 24 24"><path d="M4 11a8 5 0 0 1 16 0v1.5a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 12.5z"/><path d="M9 8.5l-1 3M13 8l-.5 3.5M16.5 9l.5 2.5"/></svg>',
  resumen:'<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  ayuda:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17.2v.1"/></svg>',
  compras:'<svg viewBox="0 0 24 24"><path d="M8 4h8M8 4a2 2 0 0 0-2 2v14h12V6a2 2 0 0 0-2-2"/><path d="M9 10h6M9 14h6M9 18h3"/></svg>',
  vencimientos:'<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4M12 13v3M12 18.2v.1"/></svg>',
  proveedores:'<svg viewBox="0 0 24 24"><path d="M2 6h11v10H2zM13 9h4l3 3v4h-7"/><circle cx="6" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/></svg>',
  caja:'<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="11" rx="2"/><circle cx="12" cy="12.5" r="2.5"/><path d="M6 10v5M18 10v5"/></svg>',
  ofertas:'<svg viewBox="0 0 24 24"><path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.4"/></svg>',
  personas:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/></svg>',
  encargos:'<svg viewBox="0 0 24 24"><path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8M8 6l8 4"/></svg>',
  pagina:'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM21 14v.01M14 21h.01M17.5 21H21v-3.5"/></svg>'
};
const LABELS = { inicio:"Inicio", vender:"Vender", contar:"Contar", productos:"Productos", fiados:"Fiados", mas:"Más" };
const IN_MAS = ["mas","recibir","historial","resumen","reservas","tipospan","datos","extensiones","apariencia","compras","vencimientos","proveedores","caja","ofertas","personas","encargos","pagina","cuentas"];
// Pantallas que dependen de una extensión
// Pantallas que necesitan un permiso cuando la tienda usa cuentas
const VIEW_PERM = { contar:"inventario", recibir:"inventario", compras:"inventario", vencimientos:"inventario", proveedores:"costos", ofertas:"precios",
  resumen:"reportes", historial:"reportes", extensiones:"config", apariencia:"config", pagina:"config", tipospan:"precios", personas:"config" };
const VIEW_EXT = { contar:"contar", fiados:"fiados", recibir:"recibir", reservas:["pan","pagina"], tipospan:"pan", pagina:"pagina", compras:"compras", vencimientos:"vencimientos", proveedores:"proveedores",
  caja:"caja", ofertas:"ofertas", personas:"personas", encargos:"encargos" };
function renderTabs(){
  const tabs = Object.keys(LABELS).filter(k => (!VIEW_EXT[k] || ext(VIEW_EXT[k])) && (!VIEW_PERM[k] || puede(VIEW_PERM[k])));
  $("#tabs").style.setProperty("--tabs", tabs.length);
  $("#tabs").innerHTML = tabs.map(k => `<button data-view="${esc(k)}" ${ui.view===k || (k==="mas" && IN_MAS.includes(ui.view))?'aria-current="page"':''}>${ICONS[k]}<span>${LABELS[k]}</span></button>`).join("");
  document.querySelectorAll("#tabs [data-view]").forEach(b => b.onclick = () => go(b.dataset.view));
}
// Cada pantalla queda en el historial del navegador: el botón atrás del celular vuelve a la anterior
function go(v){ ui.view = v; if (v !== "contar") ui.sector = null; pushNav(); render(); window.scrollTo(0,0); }
const pushNav = () => { if (MODE) history.pushState({ v:ui.view, sector:ui.sector, n:(history.state?.n || 0) + 1 }, ""); };
function back(){ if (history.state?.n > 0) history.back(); else go(IN_MAS.includes(ui.view) ? "mas" : "inicio"); }
window.addEventListener("popstate", e => {
  if (!MODE) return;
  // Si hay una ventana abierta, atrás la cierra y se queda en la misma pantalla
  if (document.querySelector(".overlay")){ closeModal(); history.pushState({ v:ui.view, sector:ui.sector, n:(e.state?.n || 0) + 1 }, ""); return; }
  ui.view = e.state?.v || "inicio"; ui.sector = e.state?.sector || null; render(); window.scrollTo(0,0);
});
function header(title, sub){ return `${IN_MAS.includes(ui.view) && ui.view !== "mas" ? backBtn() : ""}<header class="top"><h1 class="brandname">${esc(title)}<small>${esc(sub)}</small></h1><div class="hdr-r">${AYUDA[ui.view] ? `<button class="btn sm ghost" data-ayuda aria-label="Cómo se usa esta pantalla" title="Cómo se usa">?</button>` : ""}${whoChip()}${netPill()}</div></header>`; }
// Botón con el nombre de quien atiende (extensión "Quién atiende")
const backBtn = () => `<div style="padding-top:12px"><button class="btn sm" data-back>← Regresar</button></div>`;
const whoChip = () => cuentasOn() && meta.cuenta ? `<button class="chip" data-go="cuentas" title="Tu cuenta">${esc(meta.cuenta.usuario.nombre)}</button>` : ext("personas") && personasActivas().length ? `<button class="chip" data-go="personas" title="Cambiar quién atiende">${esc(nombrePersona(quien()) || "¿Quién atiende?")}</button>` : "";
function netPill(){
  const st = Sync.state.status, pend = meta.pending;
  if (st === "ok" || (st === "syncing" && !pend)) return `<span class="net" title="Todo está guardado aquí y en el servidor"><i></i>Sincronizado</span>`;
  if (st === "syncing") return `<span class="net" title="Enviando cambios al servidor"><i></i>Sincronizando…</span>`;
  if (st === "error") return `<span class="net off" title="${esc(Sync.state.error)}. Se sigue guardando aquí y se enviará después."><i></i>${navigator.onLine ? "Sin servidor" : "Sin internet"} · ${pend} por enviar</span>`;
  return navigator.onLine ? `<span class="net" title="Todo se guarda en este dispositivo"><i></i>Guardado aquí</span>` : `<span class="net off" title="Se sigue guardando en este dispositivo"><i></i>Sin internet · guardando aquí</span>`;
}
const updateNet = () => document.querySelectorAll("header.top .net").forEach(el => el.outerHTML = netPill());

function viewInicio(){
  const avail = S.products.filter(disp);
  const counted = avail.filter(p => p.countAt != null);
  const pct = Math.round(counted.length / avail.length * 100);
  const d0 = new Date(); d0.setHours(0,0,0,0);
  const today = S.movs.filter(m => m.type === "venta" && m.at >= d0.getTime());
  const units = today.reduce((a,m)=>a+(P(m.pid)?.kg ? 1 : m.qty),0), money = today.reduce((a,m)=>a+m.qty*(m.price||P(m.pid).price),0);
  const low = counted.map(p => [p, stockOf(p)]).filter(([p,s]) => s <= p.min).sort((a,b)=>a[1]-b[1]);
  const week = {}; S.movs.filter(m => m.type==="venta" && m.at > Date.now()-7*D).forEach(m => week[m.pid] = (week[m.pid]||0) + m.qty);
  const top = Object.entries(week).filter(([id]) => P(id)).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const sectorState = sectores().filter(c => avail.some(p => p.cat === c)).map(c => { const ps = avail.filter(p => p.cat===c); const done = ps.length && ps.every(p => p.countAt!=null); return `<span class="pill ${done?"ok":"none"}">${done?"✓ ":""}${esc(c)}</span>`; }).join(" ");
  const resPend = S.reservas.filter(r => !r.done && r.estado !== "rechazada" && resDia(r) === ymd()), resWeb = webNuevas();
  const pct0 = avail.length ? pct : 0;
  return `${header(S.ajustes.tienda_nombre || "Mi Almacén", meta.demo ? "Datos de ejemplo" : "Inventario y ventas")}
  <div class="stack">
    ${!prefs().tourVisto ? `<div class="card spread"><div><b>¿Primera vez?</b><div class="small muted">Un recorrido de un minuto por lo principal.</div></div><div class="row" style="flex-wrap:nowrap"><button class="btn sm ghost" id="tourno">No, gracias</button><button class="btn sm primary" id="toursi">Ver tutorial</button></div></div>` : ""}
    ${meta.demo ? `<div class="demo-banner"><span>Estás probando con datos ficticios de ejemplo.</span><button class="btn sm" id="reset">Empezar mi tienda</button></div>` : ""}
    ${!avail.length ? `<div class="card stack"><h3>Primer paso: agrega tus productos</h3><p class="small muted" style="margin:0">Agrégalos uno por uno o escaneando su código de barras. Después cuenta un sector para que el sistema sepa cuánto tienes.</p><button class="btn primary block" data-go="productos">Agregar productos</button></div>` : ""}
    ${ext("pan") ? `<button class="panbtn" id="panbtn">${ICONS.pan}<span><b>Avisar que llegó el pan</b><small>Envía el mensaje al grupo de WhatsApp de clientes</small></span></button>` : ""}
    ${extOn(["pan","pagina"]) && (resPend.length || resWeb.length) ? `<button class="sector" data-go="reservas"><span class="name">${resWeb.length ? "Reservas nuevas por internet" : "Reservas de hoy"}</span><span class="pill warn">${resWeb.length ? resWeb.length + (resWeb.length === 1 ? " nueva" : " nuevas") : resPend.length + " por entregar"}</span><span class="sub">Toca para ver quién reservó y marcar lo entregado</span></button>` : ""}
    ${avisosInicio()}
    <div class="kpis">
      ${ext("contar") ? `<div class="card kpi"><div class="num">${pct0}%</div><div class="lbl">del inventario contado</div><div class="bar"><i style="width:${pct0}%"></i></div></div>`
        : `<div class="card kpi"><div class="num">${new Set(today.map(m => m.grupo || m.at)).size}</div><div class="lbl">ventas hoy</div></div>`}
      <div class="card kpi"><div class="num">${clp(money)}</div><div class="lbl">vendido hoy · ${units} productos</div></div>
    </div>
    ${ext("contar") ? `<div class="card stack">
      <div class="spread"><h3>Avance del conteo por sector</h3><button class="btn sm" data-go="contar">Contar</button></div>
      <div class="row">${sectorState}</div>
      <p class="small muted" style="margin:0">Cada sector queda al día desde su propio conteo. Mientras tanto, las ventas de todo se registran igual.</p>
    </div>` : ""}
    <div class="card">
      <div class="spread"><h3>Por acabarse</h3>${ext("compras") && low.length ? `<button class="btn sm" data-go="compras">Lista de compras</button>` : `<span class="small muted">${low.length} productos</span>`}</div>
      <div class="list">${low.slice(0,6).map(([p,s]) => `<div class="item"><div class="main"><div class="name">${esc(p.name)}</div><div class="sub">Mínimo: ${fq(p, p.min)}</div></div>${stockPill(p)}</div>`).join("") || `<div class="empty">Nada bajo el mínimo.</div>`}</div>
    </div>
    <div class="card">
      <h3>Lo más vendido en 7 días</h3>
      <div class="list">${top.map(([id,q]) => `<div class="item"><div class="main"><div class="name">${esc(P(id).name)}</div><div class="sub">${esc(P(id).cat)}</div></div><div class="qty">${fq(P(id), q)}</div></div>`).join("")}</div>
    </div>
    ${ext("contar") ? `<div class="card stack">
      <h3>Cómo calcula el stock</h3>
      <div class="formula">Stock = último conteo + compras − ventas desde ese conteo</div>
      <p class="small muted" style="margin:0">Por eso se puede contar un sector por día sin que nada quede desfasado: lo vendido antes del conteo no se descuenta, porque ya no estaba en la estantería.</p>
    </div>` : ""}
  </div>`;
}


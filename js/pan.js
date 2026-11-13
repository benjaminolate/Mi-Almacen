"use strict";
// Aviso del pan y reservas.
// ---------- Aviso del pan ----------
const panDefault = () => `🍞 ¡Llegó el pan calentito! Los esperamos en ${S.ajustes.tienda_nombre || "el almacén"}.`;
function openPan(){
  // Si el mensaje quedó vacío vuelve el de siempre
  if (!String(S.panMsg || "").trim()) S.panMsg = panDefault();
  openModal(`<div class="stack">
    <div class="spread"><h2>Avisar que llegó el pan</h2><button class="btn ghost sm" data-close>Cerrar</button></div>
    <div class="field"><label for="pm">Mensaje</label><textarea class="input" id="pm" rows="3">${esc(S.panMsg)}</textarea></div>
    <a class="btn primary block" id="pango" style="text-align:center;text-decoration:none" href="${esc(waLink("", S.panMsg))}" ${WA_TARGET}>Abrir WhatsApp</a>
    ${waWebNote("panweb", "", S.panMsg)}
    <button class="btn block" id="pancopy">Copiar mensaje</button>
    <ol class="small muted" style="margin:0;padding-left:18px">
      <li>Se abre WhatsApp con el mensaje ya escrito.</li>
      <li>Eliges el grupo de clientes y tocas enviar.</li>
    </ol>
    <p class="small muted" style="margin:0">El mensaje queda guardado para la próxima vez.</p>
    <button class="btn ghost block" id="pandef">Volver al mensaje de siempre</button>
  </div>`);
  $("#pandef").onclick = () => { const pm = $("#pm"); pm.value = panDefault(); pm.oninput({ target:pm }); toast("Mensaje de siempre"); };
  $("#pm").oninput = e => { act.panMsg(e.target.value.trim() ? e.target.value : panDefault()); $("#pango").href = waLink("", S.panMsg); const w = $("#panweb"); if (w) w.href = waWeb("", S.panMsg); };
  $("#pancopy").onclick = () => { const t = $("#pm").value;
    const ok = () => toast("Mensaje copiado");
    try { navigator.clipboard.writeText(t).then(ok, () => { $("#pm").select(); toast("Selecciona y copia el texto"); }); } catch(e){ $("#pm").select(); } };
}

// ---------- Reservas (vista previa) ----------
// Los panes que se pueden reservar son los productos del sector Pan marcados así en Tipos de pan
const panesReserva = () => S.products.filter(p => p.cat === "Pan" && disp(p) && p.reserva !== false).sort((a, b) => a.name.localeCompare(b.name, "es"));
function resCutoff(){ const d = new Date(); d.setHours(RES_CUT_HOUR,0,0,0); if (d.getTime() > Date.now()) d.setDate(d.getDate()-1); return d.getTime(); }
// Las reservas viejas se sacan de la vista y de este dispositivo (sin enviarlo como cambio)
// Las reservas para otro día (las de internet) se guardan hasta ese día
const resVigente = (r, cut = resCutoff()) => r.para ? r.para >= ymd() : r.at >= cut;
const resDia = r => r.para || ymd(r.at);
const webNuevas = () => S.reservas.filter(r => r.origen === "web" && r.estado === "nueva" && !r.done);
function purgeReservas(){ const cut = resCutoff(), old = S.reservas.filter(r => !r.at || !resVigente(r, cut)); if (!old.length) return;
  S.reservas = S.reservas.filter(r => r.at && resVigente(r, cut)); LocalDB.apply(old.map(r => ({ store:"reservas", del:r.id, local:true }))).catch(() => {}); }
const resDetail = q => panesReserva().filter(p => q[p.id] > 0).map(p => `${fq(p, q[p.id])} ${p.name.toLowerCase()}`).join(", ");
const RES_ESTADO = { nueva:["warn","Nueva"], confirmada:["ok","Confirmada"], rechazada:["bad","Rechazada"] };
function resPill(r){ if (r.done) return `<span class="pill ok">Entregado</span>`; const e = r.origen === "web" && RES_ESTADO[r.estado]; return e ? `<span class="pill ${e[0]}">${e[1]}</span>` : `<span class="pill warn">Pendiente</span>`; }
function viewReservas(){
  const rs = S.reservas.slice().sort((a,b) => resDia(a).localeCompare(resDia(b)) || (a.at||0) - (b.at||0));
  const q = ui.resQty || (ui.resQty = {});
  const pend = rs.filter(r => !r.done && r.estado !== "rechazada").length, nuevas = webNuevas().length;
  const dias = [...new Set(rs.map(resDia))];
  const fila = r => `<button class="item tap" data-res="${esc(r.id)}"><div class="main"><div class="name">${esc(r.name)}${r.origen === "web" ? ` <span class="small muted">· por internet</span>` : ""}</div><div class="sub">${esc(r.detail)}${r.hora ? " · " + esc(r.hora) : ""}${r.at ? " · reservó " + ago(r.at) : ""}</div></div>${resPill(r)}</button>`;
  return `<header class="top"><button class="btn sm" data-back>← Regresar</button>${netPill()}</header>
  <div class="stack">
    <div><h2>${ext("pan") && !ext("pagina") ? "Reservas de pan" : "Reservas"}</h2><p class="small muted" style="margin:4px 0 0">${pend} por entregar${nuevas ? `, ${nuevas} por confirmar` : ""}. ${ext("pagina") ? "Toca una reserva por internet para confirmarla o rechazarla; las demás se marcan como entregadas con un toque." : "Toca una reserva para marcarla como entregada."} Las reservas se borran solas pasado su día.</p></div>
    ${rs.length ? dias.map(d => `<div class="stack" style="gap:6px"><h3>Para ${esc(enDias(daysTo(d)))}${d === ymd() ? "" : " · " + esc(fdate(d))}</h3><div class="card" style="padding-block:0"><div class="list">${rs.filter(r => resDia(r) === d).map(fila).join("")}</div></div></div>`).join("")
      : `<div class="card"><div class="empty">Todavía no hay reservas.</div></div>`}
    ${ext("pan") ? `<div class="card stack">
      <h3>Anotar una reserva</h3>
      <p class="small muted" style="margin:0">Para cuando un cliente pide pan por teléfono o WhatsApp.</p>
      <div class="field"><label for="rn">Nombre del cliente</label><input class="input" id="rn" placeholder="Ej: Ana Torres"></div>
      <div class="field"><label>¿Qué pan quieres?</label>
        <div class="list">${panesReserva().map(p => `<div class="item"><div class="main"><div class="name">${esc(p.name)}</div><div class="sub">${p.kg ? "por kilo, de a ½" : "por unidad"}</div></div>
          <div class="stepper"><button data-bdec="${esc(p.id)}" aria-label="Quitar ${esc(p.name)}">−</button><span style="min-width:3.5ch">${p.kg ? fq(p, q[p.id] || 0) : q[p.id] || 0}</span><button data-binc="${esc(p.id)}" aria-label="Agregar ${esc(p.name)}">+</button></div></div>`).join("") || `<div class="empty">No hay panes para reservar. Agrégalos en Más &gt; Tipos de pan.</div>`}</div></div>
      <button class="btn accent block" id="rsave" ${Object.values(q).some(n => n > 0) ? "" : "disabled"}>Anotar reserva${Object.values(q).some(n => n > 0) ? " (" + resDetail(q) + ")" : ""}</button>
      <p class="small muted" style="margin:0">${ext("pagina") ? "Los clientes también pueden reservar solos desde la página de la tienda." : "Con la extensión Página de la tienda, los clientes pueden reservar solos desde un link o un código QR."}</p>
    </div>` : ""}
  </div>`;
}
// Una reserva hecha desde la página de la tienda: confirmar, rechazar, avisar y bloquear
function openReservaWeb(r){
  const tienda = S.ajustes.tienda_nombre || "la tienda", dia = enDias(daysTo(resDia(r)));
  const msg = r.estado === "rechazada" ? `Hola ${r.name}, te escribimos de ${tienda}. Lo sentimos, no podemos atender tu reserva de ${r.detail} para ${dia}.`
    : `Hola ${r.name}, te escribimos de ${tienda}. Tu reserva de ${r.detail} para ${dia}${r.hora ? " (" + r.hora + ")" : ""} está confirmada. ¡Te esperamos!`;
  const bloqueado = (pub().bloqueados || []).includes(r.tel);
  openModal(`<div class="stack">
    <div class="spread"><h2>${esc(r.name)}</h2><button class="btn ghost sm" data-close>Cerrar</button></div>
    <div class="row">${resPill(r)}<span class="small muted">Por internet · reservó ${esc(ago(r.at))}</span></div>
    <div class="card stack" style="gap:6px"><div style="font-weight:600">${esc(r.detail)}</div>
      <div class="small muted">Para ${esc(dia)}${resDia(r) === ymd() ? "" : " · " + esc(fdate(resDia(r)))}${r.hora ? " · " + esc(r.hora) : ""}</div>
      ${r.nota ? `<div class="small">“${esc(r.nota)}”</div>` : ""}
      <div class="small muted">Celular: +${esc(r.tel)}</div></div>
    ${r.done ? `<button class="btn block" id="rwundo">Marcar como no entregada</button>`
      : r.estado === "nueva" ? `<div class="grid2"><button class="btn primary" id="rwok">Confirmar</button><button class="btn" id="rwno" style="color:var(--bad)">Rechazar</button></div>`
      : `${r.estado === "confirmada" ? `<button class="btn primary block" id="rwdone">Marcar como entregada</button>` : ""}
         <a class="btn block" style="text-align:center" href="${esc(waLink(r.tel, msg))}" ${WA_TARGET}>Avisarle por WhatsApp</a>${waWebNote("rwweb", r.tel, msg)}`}
    ${!puede("config") ? "" : bloqueado ? `<button class="btn ghost block" id="rwunblock">Desbloquear este número</button>` : `<button class="btn ghost block" id="rwblock">Bloquear este número</button>`}
    <p class="small muted" style="margin:0" data-perm="config">Un número bloqueado ya no puede reservar desde la página. Úsalo si alguien reserva y no viene, o manda reservas falsas.</p>
  </div>`);
  const set = cambios => run(async () => { await act.put("reservas", [Object.assign({}, r, cambios)]); render(); openReservaWeb(S.reservas.find(x => x.id === r.id)); });
  const b = id => $(id) || {};
  b("#rwok").onclick = () => set({ estado:"confirmada" });
  b("#rwno").onclick = () => set({ estado:"rechazada" });
  b("#rwdone").onclick = () => run(async () => { await act.reserva(r, true); closeModal(); render(); toast(`Reserva de ${r.name} entregada`); });
  b("#rwundo").onclick = () => set({ done:false });
  b("#rwblock").onclick = () => run(async () => { await setPub({ bloqueados:[...(pub().bloqueados || []), r.tel] }); if (r.estado === "nueva") await act.put("reservas", [Object.assign({}, r, { estado:"rechazada" })]);
    toast("Número bloqueado"); render(); openReservaWeb(S.reservas.find(x => x.id === r.id)); });
  b("#rwunblock").onclick = () => run(async () => { await setPub({ bloqueados:(pub().bloqueados || []).filter(t => t !== r.tel) }); toast("Número desbloqueado"); openReservaWeb(r); });
}


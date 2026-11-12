"use strict";
// Fiados: clientes y lo que deben.
// ---------- Fiados ----------
const saldo = c => c.items.reduce((a,i) => a + (i.type === "fiado" ? i.amount : -i.amount), 0);
function waPhone(p){ let d = String(p||"").replace(/\D/g, ""); if (d.length === 9 && d[0] === "9") d = "56" + d; else if (d.length === 8) d = "569" + d; return d; }
// En el celular se usa el enlace web (abre la app). En el computador se abre la app de escritorio directo, sin dejar una pestaña abierta.
const IS_MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
function waQuery(phone, text){ return (phone ? "phone=" + waPhone(phone) + "&" : "") + "text=" + encodeURIComponent(text); }
function waLink(phone, text){ return (IS_MOBILE ? "https://api.whatsapp.com/send?" : "whatsapp://send?") + waQuery(phone, text); }
function waWeb(phone, text){ return "https://web.whatsapp.com/send?" + waQuery(phone, text); }
const WA_TARGET = IS_MOBILE ? 'target="_blank" rel="noopener"' : "";
const waWebNote = (id, phone, text) => IS_MOBILE ? "" : `<p class="small muted" style="margin:0">¿No tienes WhatsApp instalado en este computador? <a id="${esc(id)}" href="${esc(waWeb(phone, text))}" target="whatsapp-web" rel="noopener" style="color:var(--brand)">Usar WhatsApp Web</a></p>`;
function viewFiados(){
  const cs = S.clients.filter(c => !c.eliminado).sort((a,b) => saldo(b) - saldo(a));
  const total = cs.reduce((a,c) => a + Math.max(0, saldo(c)), 0);
  return `${header("Fiados", "Cuaderno de cuentas de clientes")}
  <div class="stack">
    <div class="card kpi"><div class="num">${clp(total)}</div><div class="lbl">por cobrar entre ${cs.filter(c => saldo(c) > 0).length} clientes</div></div>
    <button class="btn primary block" id="addc">+ Agregar cliente</button>
    <div class="card" style="padding-block:0"><div class="list">${cs.map(c => { const s = saldo(c); const last = c.items.length ? Math.max(...c.items.map(i => i.at)) : null;
      return `<button class="item tap" data-client="${esc(c.id)}"><div class="main"><div class="name">${esc(c.name)}</div><div class="sub">${last ? "Último movimiento " + ago(last) : "Sin movimientos"}</div></div>
      ${s > 0 ? `<span class="pill warn">Debe ${clp(s)}</span>` : `<span class="pill ok">Al día</span>`}</button>`; }).join("") || `<div class="empty">Aún no hay clientes.</div>`}</div></div>
    <p class="small muted" style="margin:0">Los fiados se anotan aparte: no cambian el stock ni las ventas del inventario.</p>
  </div>`;
}
function openCliente(c){
  const s = saldo(c);
  const items = c.items.slice().sort((a,b) => b.at - a.at);
  const msg = `Hola ${c.name.split(" ")[0]}, te escribimos del almacén. Tu cuenta de fiados está en ${clp(s)}. ¡Gracias!`;
  openModal(`<div class="stack">
    <div class="spread"><h2>${esc(c.name)}</h2><button class="btn ghost sm" data-close>Cerrar</button></div>
    <div class="spread"><div><div class="total">${clp(Math.max(0,s))}</div><div class="small muted">${s > 0 ? "saldo por pagar" : "al día"}${c.phone ? " · " + esc(c.phone) : ""}</div></div>
      ${s > 0 ? `<a class="btn sm" href="${esc(waLink(c.phone, msg))}" ${WA_TARGET}>Recordar por WhatsApp</a>` : ""}</div>
    ${s > 0 ? waWebNote("cweb", c.phone, msg) : ""}
    <div class="grid2">
      <div class="field"><label for="fm">Monto</label><input class="input" id="fm" type="number" inputmode="numeric" placeholder="0"></div>
      <div class="field"><label for="fn">Detalle (opcional)</label><input class="input" id="fn" placeholder="Ej: pan y leche"></div>
    </div>
    <div class="grid2"><button class="btn primary" id="addFiado">Anotar fiado</button><button class="btn" id="addAbono">Registrar pago</button></div>
    <div><h3>Movimientos</h3><div class="list">${items.map(i => `<div class="item"><div class="main"><div class="name">${i.type === "fiado" ? esc(i.note || "Fiado") : "Pago"}</div><div class="sub">${ago(i.at)}</div></div>
      <span class="diff" style="color:${i.type === "fiado" ? "var(--bad)" : "var(--ok)"}">${i.type === "fiado" ? "+" : "−"}${clp(i.amount)}</span></div>`).join("") || `<div class="empty">Sin movimientos.</div>`}</div></div>
    ${s <= 0 || puede("config") ? `<button class="btn ghost block" id="cdel" style="color:var(--bad)">Eliminar cliente</button>`
      : `<p class="small muted" style="margin:0">Para eliminar a alguien que todavía debe, pídeselo a quien puede cambiar los ajustes de la tienda.</p>`}
  </div>`);
  const cd = $("#cdel"); if (cd) cd.onclick = () => {
    openModal(`<div class="stack"><h2>¿Eliminar a ${esc(c.name)}?</h2>
      ${s > 0 ? `<p class="pill warn" style="white-space:normal;margin:0;padding:8px 10px">Todavía debe ${clp(s)}. La deuda deja de verse en Fiados, pero queda guardada en los datos de la tienda.</p>` : ""}
      <p style="margin:0">Sale de la lista de fiados. Sus pagos siguen contando en el cierre de caja y en los resúmenes.</p>
      <div class="grid2"><button class="btn" id="cdno">Cancelar</button><button class="btn primary" id="cdok" style="background:var(--bad);border-color:var(--bad)">Eliminar</button></div></div>`);
    $("#cdno").onclick = () => openCliente(c);
    $("#cdok").onclick = () => run(async () => { await act.deleteClient(c); closeModal(); render(); toast(`${c.name} eliminado`); });
  };
  const add = type => run(async () => { const a = Math.round(+$("#fm").value || 0); if (a <= 0){ $("#fm").focus(); return; }
    if (a > MAX_FIADO){ $("#fm").focus(); return toast(`Revisa el monto: el máximo por anotación es ${clp(MAX_FIADO)}`); }
    const debe = saldo(c);
    if (type === "abono" && debe <= 0){ $("#fm").focus(); return toast(`${c.name.split(" ")[0]} no debe nada`); }
    if (type === "abono" && a > debe){ $("#fm").value = debe; $("#fm").focus(); return toast(`Debe ${clp(debe)}: el pago no puede ser mayor. Si pagó con más, dale el vuelto.`); }
    await act.clientMov(c, type, a, $("#fn").value.trim()); toast(type === "fiado" ? `Fiado anotado: ${clp(a)}` : `Pago registrado: ${clp(a)}`); render(); openCliente(c); });
  $("#addFiado").onclick = () => add("fiado");
  $("#addAbono").onclick = () => add("abono");
}
function openNewClient(){
  openModal(`<div class="stack">
    <div class="spread"><h2>Nuevo cliente</h2><button class="btn ghost sm" data-close>Cerrar</button></div>
    <div class="field"><label for="cn">Nombre</label><input class="input" id="cn" placeholder="Ej: Ana Ejemplo"></div>
    <div class="field"><label for="cp">Celular (para recordatorios)</label><input class="input" id="cp" type="tel" inputmode="tel" autocomplete="off" maxlength="16" placeholder="9 1234 5678"></div>
    <button class="btn primary block" id="csave">Guardar cliente</button></div>`);
  phoneInput($("#cp"));
  $("#csave").onclick = () => run(async () => { const name = $("#cn").value.trim(); if (!name){ $("#cn").focus(); return; }
    if (!phoneOk($("#cp").value)){ $("#cp").focus(); return toast(PHONE_MSG); }
    const c = await act.newClient(name, $("#cp").value.trim()); render(); openCliente(c); });
}


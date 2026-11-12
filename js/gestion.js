"use strict";
// Cierre de caja, vencimientos, compras, proveedores, encargos y tipos de pan.
// ---------- Cierre de caja ----------
// Se cuenta desde el último cierre (si fue en las últimas 20 horas) o desde que empezó el día
function cajaDesde(){ const last = S.cajas.reduce((a, c) => Math.max(a, c.at), 0), d0 = new Date().setHours(0,0,0,0); return last > Date.now() - 20*H ? last : d0; }
function cajaEsperado(desde){
  const e = { efectivo:0, debito:0, transferencia:0 }, ventas = new Set();
  S.movs.filter(m => m.type === "venta" && m.at >= desde).forEach(m => { e[PAGOS[m.pago] ? m.pago : "efectivo"] += m.qty * (m.price ?? P(m.pid)?.price ?? 0); ventas.add(m.grupo || m.id); });
  const abonos = S.clients.flatMap(c => c.items).filter(i => i.type === "abono" && i.at >= desde).reduce((a, i) => a + i.amount, 0);
  Object.keys(e).forEach(k => e[k] = Math.round(e[k]));
  return { e, abonos, ventas:ventas.size, vendido:e.efectivo + e.debito + e.transferencia };
}
const cajaDif = k => Object.keys(PAGOS).reduce((a, m) => a + (k.contado[m] == null ? 0 : k.contado[m] - k.esperado[m]), 0);
const difPill = d => d === 0 ? `<span class="pill ok">Cuadra</span>` : d < 0 ? `<span class="pill bad">Faltan ${clp(-d)}</span>` : `<span class="pill warn">Sobran ${clp(d)}</span>`;
function cajaCalculo(){
  const desde = cajaDesde(), x = cajaEsperado(desde), c = ui.caja;
  const fondo = Math.round(+c.fondo || 0), gastos = Math.round(+c.gastos || 0);
  const esperado = { efectivo:fondo + x.e.efectivo + x.abonos - gastos, debito:x.e.debito, transferencia:x.e.transferencia };
  const val = v => v === "" || v == null ? null : Math.round(+v || 0);
  const contado = { efectivo:val(c.efectivo), debito:val(c.debito), transferencia:val(c.transferencia) };
  return { desde, x, fondo, gastos, esperado, contado };
}
function viewCaja(){
  const c = ui.caja;
  if (c.fondo == null) c.fondo = S.ajustes.fondo_caja ?? "";
  const { desde, x } = cajaCalculo();
  const cierres = S.cajas.slice().sort((a, b) => b.at - a.at).slice(0, 10);
  const inp = (id, k, label) => `<div class="field"><label for="${esc(id)}">${label}</label><input class="input" id="${esc(id)}" data-kk="${esc(k)}" type="number" min="0" inputmode="numeric" value="${esc(c[k] ?? "")}" placeholder="0"></div>`;
  return `${header("Cierre de caja", "Lo vendido contra lo que hay en la caja")}
  <div class="stack">
    <div class="card stack"><div class="spread"><h3>${desde === new Date().setHours(0,0,0,0) ? "Vendido desde las 00:00 de hoy" : "Vendido desde el último cierre, " + esc(ago(desde))}</h3><span class="small muted">${x.ventas} ${x.ventas === 1 ? "venta" : "ventas"}</span></div>
      <div class="list">${Object.entries(PAGOS).map(([k, v]) => `<div class="item"><div class="main"><div class="name">${v}</div></div><div style="font-weight:700">${clp(x.e[k])}</div></div>`).join("")}
        ${x.abonos ? `<div class="item"><div class="main"><div class="name">Pagos de fiados</div><div class="sub">Se cuentan como efectivo</div></div><div style="font-weight:700">${clp(x.abonos)}</div></div>` : ""}</div></div>
    <div class="card stack"><h3>Cuenta la caja</h3>
      <div class="grid2" style="align-items:end">${inp("kf", "fondo", "Fondo inicial (sencillo)")}${inp("kgs", "gastos", "Gastos o retiros en efectivo")}</div>
      <div class="grid2" style="align-items:end">${inp("ke", "efectivo", "Efectivo que hay en la caja")}${inp("kd", "debito", "Total de la máquina de tarjetas")}</div>
      <div class="grid2">${inp("kt", "transferencia", "Transferencias recibidas")}</div>
      <div id="kres"></div>
      <div class="field"><label for="kn">Nota (opcional)</label><input class="input" id="kn" value="${esc(c.nota || "")}" placeholder="Ej: pagué el pan con plata de la caja"></div>
      <button class="btn primary block" id="ksave">Cerrar caja</button>
      <p class="small muted" style="margin:0">Deja en blanco lo que no vas a revisar. Al cerrar, el próximo cierre parte desde este momento.</p>
    </div>
    <div class="card"><h3>Cierres anteriores</h3><div class="list">${cierres.map(k => `<button class="item tap" data-caja="${esc(k.id)}"><div class="main"><div class="name">${ago(k.at)}</div><div class="sub">Vendido ${clp(k.vendido)}${k.quien && nombrePersona(k.quien) ? " · " + esc(nombrePersona(k.quien)) : ""}</div></div>${difPill(cajaDif(k))}</button>`).join("") || `<div class="empty">Todavía no hay cierres.</div>`}</div></div>
  </div>`;
}
function cajaRes(){
  const { esperado, contado } = cajaCalculo();
  const rows = Object.entries(PAGOS).filter(([k]) => contado[k] != null).map(([k, v]) => `<div class="item"><div class="main"><div class="name">${v}</div><div class="sub">Debería haber ${clp(esperado[k])} · hay ${clp(contado[k])}</div></div>${difPill(contado[k] - esperado[k])}</div>`);
  $("#kres").innerHTML = rows.length ? `<div class="list">${rows.join("")}</div>` : `<p class="small muted" style="margin:0">En efectivo debería haber <b>${clp(esperado.efectivo)}</b> (fondo + ventas en efectivo + pagos de fiados − gastos).</p>`;
}
function bindCaja(app){
  app.querySelectorAll("[data-kk]").forEach(i => i.oninput = () => { ui.caja[i.dataset.kk] = i.value; cajaRes(); });
  $("#kn").oninput = e => ui.caja.nota = e.target.value;
  cajaRes();
  $("#ksave").onclick = () => run(async () => {
    const k = cajaCalculo();
    if (!Object.values(k.contado).some(v => v != null)) return toast("Escribe al menos el efectivo que hay en la caja");
    const rec = withWho({ id:uid(), at:LocalDB.now(), desde:k.desde, fondo:k.fondo, gastos:k.gastos, vendido:k.x.vendido, abonos:k.x.abonos, ventas:k.x.ventas, esperado:k.esperado, contado:k.contado, nota:(ui.caja.nota || "").trim() });
    await act.put("cajas", [rec]);
    if (k.fondo !== (S.ajustes.fondo_caja ?? 0)) await act.setting("fondo_caja", k.fondo);
    ui.caja = {}; render(); const d = cajaDif(rec);
    toast(d === 0 ? "Caja cerrada: cuadra" : d < 0 ? `Caja cerrada: faltan ${clp(-d)}` : `Caja cerrada: sobran ${clp(d)}`);
  });
  app.querySelectorAll("[data-caja]").forEach(b => b.onclick = () => openCierre(S.cajas.find(k => k.id === b.dataset.caja)));
}
function openCierre(k){
  openModal(`<div class="stack">
    <div class="spread"><h2>Cierre de ${esc(ago(k.at))}</h2><button class="btn ghost sm" data-close>Cerrar</button></div>
    <p class="small muted" style="margin:0">Desde ${esc(ago(k.desde))} · ${k.ventas ?? ""} ventas por ${clp(k.vendido)}${k.quien && nombrePersona(k.quien) ? " · cerró " + esc(nombrePersona(k.quien)) : ""}</p>
    <div class="list">${Object.entries(PAGOS).map(([m, v]) => `<div class="item"><div class="main"><div class="name">${v}</div><div class="sub">Debía haber ${clp(k.esperado[m])}${k.contado[m] == null ? " · no se contó" : " · había " + clp(k.contado[m])}</div></div>${k.contado[m] == null ? "" : difPill(k.contado[m] - k.esperado[m])}</div>`).join("")}</div>
    <p class="small muted" style="margin:0">Fondo inicial ${clp(k.fondo)} · gastos ${clp(k.gastos)} · pagos de fiados ${clp(k.abonos || 0)}</p>
    ${k.nota ? `<p style="margin:0">${esc(k.nota)}</p>` : ""}
  </div>`);
}

// ---------- Vencimientos ----------
function viewVencimientos(){
  const vs = S.vencimientos.filter(v => !v.done && P(v.pid)).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const sec = [["Vencidos", n => n < 0], ["Esta semana", n => n >= 0 && n <= 7], ["Este mes", n => n > 7 && n <= 31], ["Más adelante", n => n > 31]];
  const d = ui.venc;
  const row = v => { const p = P(v.pid), n = daysTo(v.fecha); return `<div class="item"><div class="main"><div class="name">${esc(p.name)}</div><div class="sub">${esc(fdate(v.fecha))}${v.qty ? " · " + fq(p, v.qty) + (p.kg ? "" : v.qty === 1 ? " unidad" : " unidades") : ""}${revisadoVigente(v) ? " · revisado " + ago(v.revisado) : ""}</div>
      <div class="row" style="gap:6px;padding-top:6px">${n <= 7 && !revisadoVigente(v) ? `<button class="btn sm" data-vrev="${esc(v.id)}">Revisado</button>` : ""}${ext("ofertas") && n >= 0 ? `<button class="btn sm" data-voferta="${esc(v.pid)}">Oferta</button>` : ""}<button class="btn sm" data-vdone="${esc(v.id)}">Listo</button></div></div>
    <span class="pill ${n < 0 ? "bad" : n <= 7 ? "warn" : "ok"}">${n < 0 ? "Vencido" : enDias(n)}</span></div>`; };
  return `${header("Vencimientos", "Lo que hay que vender o retirar pronto")}
  <div class="stack">
    ${sec.map(([t, f]) => { const l = vs.filter(v => f(daysTo(v.fecha))); return l.length ? `<div class="card" style="padding-block:12px 0"><h3>${t}</h3><div class="list">${l.map(row).join("")}</div></div>` : ""; }).join("") || `<div class="card empty">No hay vencimientos anotados.</div>`}
    <p class="small muted" style="margin:0">Toca <b>Revisado</b> si ya miraste la estantería y queda a la venta: deja de avisar en el inicio hasta que venza. Toca <b>Listo</b> cuando ya se vendió o se sacó de la estantería.${ext("ofertas") ? " Con <b>Oferta</b> le pones un descuento para venderlo antes." : ""}</p>
    <div class="card stack"><h3>Anotar un vencimiento</h3>
      ${d.pid && P(d.pid) ? `<div class="spread"><b>${esc(P(d.pid).name)}</b><button class="btn sm ghost" id="vchange">Cambiar</button></div>`
        : `<div class="searchbar"><input class="input" id="q" placeholder="Buscar producto" autocomplete="off"><button class="btn accent" id="scan">Escanear</button></div><div class="list" id="res" hidden></div>`}
      <div class="grid2"><div class="field"><label for="vf">Vence el</label><input class="input" type="date" id="vf" value="${esc(d.fecha || "")}"></div>
        <div class="field"><label for="vq">Cantidad (opcional)</label><input class="input" type="number" min="0" step="any" inputmode="decimal" id="vq" value="${esc(d.qty || "")}"></div></div>
      <button class="btn primary block" id="vsave">Guardar vencimiento</button>
      ${ext("recibir") ? `<p class="small muted" style="margin:0">También se anota al recibir mercadería.</p>` : ""}
    </div>
  </div>`;
}
function bindVencimientos(app){
  const d = ui.venc;
  app.querySelectorAll("[data-vdone]").forEach(b => b.onclick = () => run(async () => { const v = S.vencimientos.find(x => x.id === b.dataset.vdone);
    await act.put("vencimientos", [Object.assign({}, v, { done:true, hecho:LocalDB.now() })]); rerender(); toast("Listo"); }));
  app.querySelectorAll("[data-vrev]").forEach(b => b.onclick = () => run(async () => { const v = S.vencimientos.find(x => x.id === b.dataset.vrev);
    await act.put("vencimientos", [Object.assign({}, v, { revisado:LocalDB.now() }, quien() ? { revisadoPor:quien() } : {})]); rerender(); toast("Revisado"); }));
  app.querySelectorAll("[data-voferta]").forEach(b => b.onclick = () => { const p = P(b.dataset.voferta);
    openOferta(null, { tipo:"descuento", pct:30, pids:[p.id], nombre:"Liquidación " + p.name }); });
  $("#vf").oninput = e => d.fecha = e.target.value; $("#vq").oninput = e => d.qty = e.target.value;
  const pick = p => { d.pid = p.id; closeModal(); rerender(); };
  if ($("#q")){ bindSearch(pick); $("#scan").onclick = () => openScanSheet(pick); }
  const ch = $("#vchange"); if (ch) ch.onclick = () => { d.pid = null; rerender(); };
  $("#vsave").onclick = () => run(async () => {
    if (!d.pid || !P(d.pid)) return toast("Elige el producto");
    if (!d.fecha) return $("#vf").focus();
    await act.put("vencimientos", [{ id:uid(), pid:d.pid, fecha:d.fecha, qty:num(d.qty) || 0, done:false, at:LocalDB.now() }]);
    ui.venc = {}; rerender(); toast("Vencimiento anotado");
  });
}

// ---------- Stock bajo y lista de compras ----------
const sugerido = (p, s) => { const q = Math.max(1, p.min * 2 - Math.max(0, s ?? 0)); return p.kg ? r3(q) : Math.ceil(q); };
const provDe = p => ext("proveedores") ? S.proveedores.find(x => x.id === p.prov) : null;
function comprasGrupos(){
  const c = ui.compras;
  const sug = S.products.filter(p => disp(p) && !c.quitar[p.id]).map(p => [p, stockOf(p)]).filter(([p, s]) => s != null && s <= p.min);
  const ids = new Set(sug.map(([p]) => p.id));
  const extra = Object.keys(c.extra).filter(id => !ids.has(id) && P(id)).map(id => [P(id), stockOf(P(id))]);
  const groups = {};
  [...sug, ...extra].sort((a, b) => a[0].name.localeCompare(b[0].name, "es")).forEach(([p, s]) => { const pr = provDe(p), k = pr?.id || "";
    (groups[k] ||= { k, pr, items:[] }).items.push({ p, s, qty:c.qty[p.id] ?? c.extra[p.id] ?? sugerido(p, s) }); });
  return Object.values(groups).sort((a, b) => (a.pr ? a.pr.nombre : "~").localeCompare(b.pr ? b.pr.nombre : "~", "es"));
}
const pedidoTexto = g => `Hola${g.pr ? " " + g.pr.nombre : ""}, te escribo de ${S.ajustes.tienda_nombre || "el almacén"}. Quiero pedir:\n` + g.items.filter(l => l.qty > 0).map(l => `- ${fq(l.p, l.qty)} ${l.p.name}`).join("\n") + "\n¡Gracias!";
function viewCompras(){
  const gs = comprasGrupos(), contados = S.products.some(p => p.countAt != null);
  return `${header("Lista de compras", "Lo que está por acabarse")}
  <div class="stack">
    ${!contados ? `<div class="card small">Para saber qué falta, la app necesita saber cuánto hay: cuenta al menos un sector${ext("contar") ? " en Contar" : " (activa Conteo por sectores en Extensiones)"}. Mientras tanto, agrega productos a mano.</div>` : ""}
    ${gs.map(g => `<div class="card stack"><div class="spread"><h3>${g.pr ? esc(g.pr.nombre) : ext("proveedores") ? "Sin proveedor asignado" : "Para comprar"}</h3><span class="small muted">${g.items.length} productos</span></div>
      <div>${g.items.map(l => `<div class="cartline"><div style="min-width:0"><div style="font-weight:600">${esc(l.p.name)}</div><div class="small muted">${l.s == null ? "Sin contar" : l.s <= 0 ? "Agotado" : "Quedan " + fq(l.p, l.s)} · <label>mínimo <input class="input" type="number" min="0" step="any" inputmode="decimal" value="${esc(l.p.min)}" data-cmin="${esc(l.p.id)}" aria-label="Stock mínimo de ${esc(l.p.name)}" style="width:56px;padding:2px 4px;font-size:13px;display:inline-block"></label></div></div>
        <input class="input" style="width:76px;text-align:center;font-weight:700" type="number" min="0" step="any" inputmode="decimal" value="${esc(l.qty)}" data-cqty="${esc(l.p.id)}" aria-label="Cantidad a pedir de ${esc(l.p.name)}">
        <button class="btn sm ghost" data-cx="${esc(l.p.id)}" aria-label="Quitar ${esc(l.p.name)} de la lista">×</button></div>`).join("")}</div>
      <div class="grid2"><a class="btn" style="text-align:center" href="${esc(waLink(g.pr?.telefono || "", pedidoTexto(g)))}" ${WA_TARGET}>Pedir por WhatsApp</a><button class="btn" data-ccopy="${esc(g.k)}">Copiar lista</button></div>
      ${ext("recibir") ? `<button class="btn ghost block" data-crecv="${esc(g.k)}">Ya llegó: pasar a Recibir mercadería</button>` : ""}
    </div>`).join("") || `<div class="card empty">Nada bajo el mínimo. ¡Todo bien abastecido!</div>`}
    <div class="card stack"><h3>Agregar otro producto</h3>
      <input class="input" id="q" placeholder="Buscar producto" autocomplete="off"><div class="list" id="res" hidden></div></div>
    <p class="small muted" style="margin:0">Entran solos los productos que quedan en su stock mínimo o menos. La cantidad sugerida rellena hasta el doble del mínimo; el mínimo se cambia en la ficha de cada producto.${ext("proveedores") ? " Se agrupan por proveedor." : ""}</p>
  </div>`;
}
function bindCompras(app){
  const c = ui.compras;
  app.querySelectorAll("[data-cqty]").forEach(i => i.onchange = () => { c.qty[i.dataset.cqty] = Math.max(0, num(i.value)); rerender(); });
  app.querySelectorAll("[data-cmin]").forEach(i => i.onchange = () => run(async () => { const p = P(i.dataset.cmin); await act.updateProduct(p, { min:Math.max(0, num(i.value)) });
    delete c.qty[p.id]; rerender(); toast(`Mínimo de ${p.name}: ${fq(p, p.min)}`); }));
  app.querySelectorAll("[data-cx]").forEach(b => b.onclick = () => { const id = b.dataset.cx; if (id in c.extra) delete c.extra[id]; else c.quitar[id] = true; delete c.qty[id]; rerender(); });
  app.querySelectorAll("[data-ccopy]").forEach(b => b.onclick = () => copiar(pedidoTexto(comprasGrupos().find(g => g.k === b.dataset.ccopy)), "Lista copiada"));
  app.querySelectorAll("[data-crecv]").forEach(b => b.onclick = () => { const g = comprasGrupos().find(g => g.k === b.dataset.crecv);
    ui.recv = { supplier:g.pr?.nombre || "", items:g.items.filter(l => l.qty > 0).map(l => ({ pid:l.p.id, qty:l.qty, cost:l.p.cost || 0 })), debe:false };
    g.items.forEach(l => { delete c.qty[l.p.id]; delete c.extra[l.p.id]; }); go("recibir"); });
  bindSearch(p => { delete c.quitar[p.id]; c.extra[p.id] = sugerido(p, stockOf(p)); rerender(); toast(`${p.name} agregado a la lista`); }, "#q", "#res", { all:true });
}

// ---------- Proveedores ----------
const provSaldo = pr => S.provmovs.filter(m => m.prov === pr.id).reduce((a, m) => a + (m.type === "factura" ? m.amount : -m.amount), 0);
function viewProveedores(){
  const hoyD = new Date().getDay();
  const ps = S.proveedores.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const deuda = ps.reduce((a, p) => a + Math.max(0, provSaldo(p)), 0);
  return `${header("Proveedores", "Quién trae qué y cuánto le debes")}
  <div class="stack">
    <div class="card kpi"><div class="num">${clp(deuda)}</div><div class="lbl">por pagar a proveedores</div></div>
    <button class="btn primary block" id="addprov">+ Agregar proveedor</button>
    <div class="card" style="padding-block:0"><div class="list">${ps.map(p => { const s = provSaldo(p), n = S.products.filter(x => x.prov === p.id).length;
      return `<button class="item tap" data-prov="${esc(p.id)}"><div class="main"><div class="name">${esc(p.nombre)}</div><div class="sub">${p.dias?.length ? "Pasa: " + diasTxt(p.dias) : "Sin día fijo"} · ${n} ${n === 1 ? "producto" : "productos"}</div></div>
      <span class="row" style="gap:4px;justify-content:flex-end">${p.dias?.includes(hoyD) ? `<span class="pill ok">Pasa hoy</span>` : ""}${s > 0 ? `<span class="pill warn">Debes ${clp(s)}</span>` : ""}</span></button>`; }).join("") || `<div class="empty">Aún no hay proveedores. También se agregan solos al recibir mercadería.</div>`}</div></div>
  </div>`;
}
function bindProveedores(app){
  $("#addprov").onclick = () => openProveedor(null);
  app.querySelectorAll("[data-prov]").forEach(b => b.onclick = () => openProveedor(S.proveedores.find(x => x.id === b.dataset.prov)));
}
function openProveedor(pr){
  const nuevo = !pr; pr = pr || { id:uid(), nombre:"", telefono:"", dias:[], nota:"" };
  const dias = new Set(pr.dias || []), s = nuevo ? 0 : provSaldo(pr);
  const ms = S.provmovs.filter(m => m.prov === pr.id).sort((a, b) => b.at - a.at).slice(0, 20);
  const prods = S.products.filter(p => p.prov === pr.id);
  openModal(`<div class="stack">
    <div class="spread"><h2>${nuevo ? "Nuevo proveedor" : esc(pr.nombre)}</h2><button class="btn ghost sm" data-close>Cerrar</button></div>
    ${nuevo ? "" : `<div class="spread"><div><div class="total">${clp(Math.max(0, s))}</div><div class="small muted">${s > 0 ? "le debes" : "al día"}</div></div>${pr.telefono ? `<a class="btn sm" href="${esc(waLink(pr.telefono, "Hola " + pr.nombre + ", "))}" ${WA_TARGET}>WhatsApp</a>` : ""}</div>
    <div class="grid2"><div class="field"><label for="pvm">Monto</label><input class="input" id="pvm" type="number" inputmode="numeric" placeholder="0"></div><div class="field"><label for="pvn">Detalle (opcional)</label><input class="input" id="pvn" placeholder="Ej: factura 1234"></div></div>
    <div class="grid2"><button class="btn primary" id="pvf">Anotar factura</button><button class="btn" id="pvp">Registrar pago</button></div>`}
    <div class="field"><label for="pvnom">Nombre</label><input class="input" id="pvnom" value="${esc(pr.nombre)}" placeholder="Ej: Distribuidora Sur"></div>
    <div class="field"><label for="pvtel">Celular o teléfono</label><input class="input" id="pvtel" type="tel" inputmode="tel" autocomplete="off" maxlength="16" value="${esc(pr.telefono || "")}" placeholder="9 1234 5678"></div>
    <div class="field"><label>Días que pasa</label><div class="chips" style="flex-wrap:wrap">${ORDEN_DIAS.map(d => `<button class="chip" data-pvd="${esc(d)}" aria-pressed="${dias.has(d)}">${DIAS[d]}</button>`).join("")}</div></div>
    <div class="field"><label for="pvnota">Nota</label><input class="input" id="pvnota" value="${esc(pr.nota || "")}" placeholder="Ej: hacer el pedido el martes antes de las 12"></div>
    <button class="btn ${nuevo ? "primary" : ""} block" id="pvsave">${nuevo ? "Guardar proveedor" : "Guardar datos"}</button>
    ${nuevo ? "" : `<div class="stack" style="gap:8px"><div class="spread"><h3>Productos y ganancia</h3><button class="btn sm" id="pvlote">Elegir productos</button></div>
      ${prods.length ? costosTabla(prods) : `<p class="small muted" style="margin:0">Se asignan aquí, solos al recibir mercadería de este proveedor, o en la ficha de cada producto.</p>`}</div>
    <div><h3>Facturas y pagos</h3><div class="list">${ms.map(m => `<div class="item"><div class="main"><div class="name">${m.type === "factura" ? esc(m.note || "Factura") : "Pago" + (m.note ? " · " + esc(m.note) : "")}</div><div class="sub">${ago(m.at)}</div></div><span class="diff" style="color:${m.type === "factura" ? "var(--bad)" : "var(--ok)"}">${m.type === "factura" ? "+" : "−"}${clp(m.amount)}</span></div>`).join("") || `<div class="empty">Sin movimientos.</div>`}</div></div>`}
  </div>`);
  const again = () => openProveedor(S.proveedores.find(x => x.id === pr.id));
  const lb = $("#pvlote"); if (lb) lb.onclick = () => openProvProductos(pr);
  document.querySelectorAll("[data-pvd]").forEach(b => b.onclick = () => { const d = +b.dataset.pvd; dias.has(d) ? dias.delete(d) : dias.add(d); b.setAttribute("aria-pressed", dias.has(d)); });
  phoneInput($("#pvtel"));
  $("#pvsave").onclick = () => run(async () => { const nombre = $("#pvnom").value.trim(); if (!nombre) return $("#pvnom").focus();
    if (!phoneOk($("#pvtel").value)){ $("#pvtel").focus(); return toast(PHONE_MSG); }
    await act.put("proveedores", [Object.assign({}, pr, { nombre, telefono:$("#pvtel").value.trim(), dias:[...dias].sort(), nota:$("#pvnota").value.trim() })]);
    toast(nuevo ? "Proveedor agregado" : "Datos guardados"); render(); again(); });
  if (!nuevo){ const mov = type => run(async () => { const a = Math.round(+$("#pvm").value || 0); if (a <= 0) return $("#pvm").focus();
      await act.put("provmovs", [withWho({ id:uid(), prov:pr.id, type, amount:a, note:$("#pvn").value.trim(), at:LocalDB.now() })]); toast(type === "factura" ? `Factura anotada: ${clp(a)}` : `Pago registrado: ${clp(a)}`); render(); again(); });
    $("#pvf").onclick = () => mov("factura"); $("#pvp").onclick = () => mov("pago"); }
}

// Costo, precio y ganancia de cada producto, agrupados por sector
function costosTabla(prods){
  const by = {}; prods.forEach(p => (by[p.cat] ||= []).push(p));
  return sectores().filter(c => by[c]).map(c => `<div><div class="small" style="font-weight:700;padding-top:4px">${esc(c)}</div><div class="list">${by[c].sort((a, b) => a.name.localeCompare(b.name, "es")).map(p => {
    const g = p.price - p.cost, pct = p.price > 0 ? Math.round(g / p.price * 100) : 0;
    return `<div class="item" style="padding:8px 0"><div class="main"><div class="name" style="font-size:14px">${esc(p.name)}</div><div class="sub">Costo ${p.cost > 0 ? clp(p.cost) + (p.porCaja ? ` (caja de ${p.porCaja}: ${clp(p.cost * p.porCaja)})` : "") : "sin anotar"} · precio ${p.price > 0 ? clp(p.price) : "sin precio"}${p.kg ? " el kilo" : ""}</div></div>
      ${p.cost > 0 && p.price > 0 ? `<span class="pill ${g > 0 ? "ok" : "bad"}">${g > 0 ? "gana" : "pierde"} ${clp(Math.abs(g))} · ${pct}%</span>` : `<span class="pill none">—</span>`}</div>`; }).join("")}</div></div>`).join("")
    + `<p class="small muted" style="margin:0">El % es la ganancia sobre el precio de venta. El costo se actualiza solo al recibir mercadería.</p>`;
}
// Asignar varios productos a un proveedor de una vez
function openProvProductos(pr){
  const sel = new Set(S.products.filter(p => p.prov === pr.id).map(p => p.id));
  const lista = q => { const ps = S.products.filter(disp), r = q.trim() ? (x => [...x.exactos, ...x.parecidos])(buscar(q, ps)) : ps, by = {};
    r.forEach(p => (by[p.cat] ||= []).push(p));
    return sectores().filter(c => by[c]).map(c => `<div class="small" style="font-weight:700;padding-top:8px">${esc(c)} <button class="btn sm ghost" data-pvall="${esc(c)}">todos</button></div>${by[c].map(p => `<label class="row small" style="padding:6px 0;flex-wrap:nowrap"><input type="checkbox" data-pvsel="${esc(p.id)}" ${sel.has(p.id) ? "checked" : ""}> <span>${esc(p.name)}${p.prov && p.prov !== pr.id ? ` <span class="muted">(${esc(S.proveedores.find(x => x.id === p.prov)?.nombre || "otro")})</span>` : ""}</span></label>`).join("")}`).join("") || `<div class="empty">Sin resultados.</div>`; };
  openModal(`<div class="stack">
    <div class="spread"><h2>Productos de ${esc(pr.nombre)}</h2><button class="btn ghost sm" data-close>Cerrar</button></div>
    <input class="input" id="pvq" placeholder="Buscar" autocomplete="off">
    <div id="pvlist" style="max-height:50vh;overflow-y:auto">${lista("")}</div>
    <button class="btn primary block" id="pvlsave">Guardar</button>
  </div>`);
  const bind = () => { document.querySelectorAll("[data-pvsel]").forEach(i => i.onchange = () => i.checked ? sel.add(i.dataset.pvsel) : sel.delete(i.dataset.pvsel));
    document.querySelectorAll("[data-pvall]").forEach(b => b.onclick = () => { const ids = [...document.querySelectorAll("[data-pvsel]")].filter(i => P(i.dataset.pvsel).cat === b.dataset.pvall);
      const all = ids.every(i => i.checked); ids.forEach(i => { i.checked = !all; all ? sel.delete(i.dataset.pvsel) : sel.add(i.dataset.pvsel); }); }); };
  bind(); $("#pvq").oninput = e => { $("#pvlist").innerHTML = lista(e.target.value); bind(); };
  $("#pvlsave").onclick = () => run(async () => {
    const ch = S.products.filter(p => sel.has(p.id) ? p.prov !== pr.id : p.prov === pr.id).map(p => Object.assign({}, p, { prov:sel.has(p.id) ? pr.id : "" }));
    await commit(ops("products", ch)); ch.forEach(v => Object.assign(P(v.id), v)); render(); openProveedor(S.proveedores.find(x => x.id === pr.id)); toast(`${ch.length} productos actualizados`); });
}

// ---------- Encargos ----------
const ESTADOS = { pendiente:"Pendiente", listo:"Listo", entregado:"Entregado" };
function viewEncargos(){
  const es = S.encargos.slice().sort((a, b) => (a.para + (a.hora || "")).localeCompare(b.para + (b.hora || "")));
  const abiertos = es.filter(e => e.estado !== "entregado");
  const sec = [["Atrasados", n => n < 0], ["Para hoy", n => n === 0], ["Próximos", n => n > 0]];
  const ent = es.filter(e => e.estado === "entregado").sort((a, b) => (b.entregado || 0) - (a.entregado || 0)).slice(0, 10);
  const row = e => { const n = daysTo(e.para), saldo = (e.total || 0) - (e.abono || 0);
    return `<button class="item tap" data-enc="${esc(e.id)}"><div class="main"><div class="name">${esc(e.cliente)}</div><div class="sub">${esc(e.detalle)} · ${esc(fdate(e.para))}${e.hora ? " " + esc(e.hora) : ""}${saldo > 0 && e.estado !== "entregado" ? " · falta pagar " + clp(saldo) : ""}</div></div>
    <span class="pill ${e.estado === "entregado" ? "none" : e.estado === "listo" ? "ok" : n < 0 ? "bad" : "warn"}">${ESTADOS[e.estado]}</span></button>`; };
  return `${header("Encargos", "Pedidos para otro día")}
  <div class="stack">
    <button class="btn primary block" id="addenc">+ Anotar encargo</button>
    ${sec.map(([t, f]) => { const l = abiertos.filter(e => f(daysTo(e.para))); return l.length ? `<div class="card" style="padding-block:12px 0"><h3>${t}</h3><div class="list">${l.map(row).join("")}</div></div>` : ""; }).join("") || `<div class="card empty">No hay encargos pendientes.</div>`}
    ${ent.length ? `<div class="card" style="padding-block:12px 0"><h3>Entregados</h3><div class="list">${ent.map(row).join("")}</div></div>` : ""}
    <p class="small muted" style="margin:0">Más adelante los clientes podrán hacer sus encargos solos desde la página de la tienda.</p>
  </div>`;
}
function bindEncargos(app){
  $("#addenc").onclick = () => openEncargo(null);
  app.querySelectorAll("[data-enc]").forEach(b => b.onclick = () => openEncargo(S.encargos.find(e => e.id === b.dataset.enc)));
}
function openEncargo(e){
  const nuevo = !e;
  e = e || { id:uid(), cliente:"", telefono:"", detalle:"", para:ymd(Date.now() + D), hora:"", total:"", abono:"", estado:"pendiente" };
  const saldo = (e.total || 0) - (e.abono || 0);
  const msg = `Hola ${String(e.cliente).split(" ")[0]}, tu encargo (${e.detalle}) ya está listo en ${S.ajustes.tienda_nombre || "el almacén"}.${saldo > 0 ? " Queda por pagar " + clp(saldo) + "." : ""} ¡Te esperamos!`;
  openModal(`<div class="stack">
    <div class="spread"><h2>${nuevo ? "Nuevo encargo" : esc(e.cliente)}</h2><button class="btn ghost sm" data-close>Cerrar</button></div>
    ${nuevo ? "" : `<div class="seg" role="group">${Object.entries(ESTADOS).map(([k, v]) => `<button data-est="${esc(k)}" aria-pressed="${e.estado === k}">${v}</button>`).join("")}</div>
      ${e.telefono && e.estado !== "entregado" ? `<a class="btn block" style="text-align:center" href="${esc(waLink(e.telefono, msg))}" ${WA_TARGET}>Avisar por WhatsApp que está listo</a>` : ""}`}
    <div class="grid2"><div class="field"><label for="ecl">Cliente</label><input class="input" id="ecl" value="${esc(e.cliente)}" placeholder="Ej: Ana Torres"></div>
      <div class="field"><label for="etel">Celular</label><input class="input" id="etel" type="tel" inputmode="tel" autocomplete="off" maxlength="16" value="${esc(e.telefono || "")}" placeholder="Opcional"></div></div>
    <div class="field"><label for="edet">¿Qué encargó?</label><textarea class="input" id="edet" rows="2" placeholder="Ej: torta de chocolate para 15 personas">${esc(e.detalle)}</textarea></div>
    <div class="grid2"><div class="field"><label for="epara">Para el día</label><input class="input" type="date" id="epara" value="${esc(e.para)}"></div>
      <div class="field"><label for="ehora">Hora (opcional)</label><input class="input" type="time" id="ehora" value="${esc(e.hora || "")}"></div>
      <div class="field"><label for="etot">Precio total</label><input class="input" type="number" min="0" inputmode="numeric" id="etot" value="${esc(e.total || "")}" placeholder="0"></div>
      <div class="field"><label for="eab">Abono (seña)</label><input class="input" type="number" min="0" inputmode="numeric" id="eab" value="${esc(e.abono || "")}" placeholder="0"></div></div>
    <button class="btn primary block" id="esave2">${nuevo ? "Guardar encargo" : "Guardar cambios"}</button>
    ${nuevo ? "" : `<button class="btn ghost block" id="edel" style="color:var(--bad)">Borrar encargo</button>`}
  </div>`);
  phoneInput($("#etel"));
  const leer = () => ({ cliente:$("#ecl").value.trim(), telefono:$("#etel").value.trim(), detalle:$("#edet").value.trim(), para:$("#epara").value, hora:$("#ehora").value,
    total:Math.round(+$("#etot").value || 0), abono:Math.round(+$("#eab").value || 0) });
  $("#esave2").onclick = () => run(async () => { const f = leer();
    if (!f.cliente) return $("#ecl").focus(); if (!f.detalle) return $("#edet").focus(); if (!f.para) return $("#epara").focus();
    if (!phoneOk(f.telefono)){ $("#etel").focus(); return toast(PHONE_MSG); }
    await act.put("encargos", [Object.assign({}, nuevo ? withWho({ at:LocalDB.now() }) : e, f, { id:e.id, estado:e.estado })]); closeModal(); render(); toast(nuevo ? `Encargo de ${f.cliente} anotado` : "Encargo guardado"); });
  document.querySelectorAll("[data-est]").forEach(b => b.onclick = () => run(async () => { const est = b.dataset.est;
    const v = Object.assign({}, e, leer(), { estado:est }); if (est === "entregado") v.entregado = LocalDB.now();
    if (!v.cliente || !v.detalle || !v.para) return toast("Completa cliente, detalle y día");
    await act.put("encargos", [v]); render(); openEncargo(S.encargos.find(x => x.id === e.id)); toast(`Encargo: ${ESTADOS[est].toLowerCase()}`); }));
  const del = $("#edel"); if (del) del.onclick = () => run(async () => { await act.del("encargos", e.id); closeModal(); render(); toast("Encargo borrado"); });
}

// ---------- Tipos de pan ----------
// Cada pan es un producto del sector "Pan" y se vende por unidad o por kilo, según elija la tienda
function viewTiposPan(){
  const ps = S.products.filter(p => p.cat === "Pan").sort((a, b) => (b.has - a.has) || a.name.localeCompare(b.name, "es"));
  return `${header("Tipos de pan", "Precio y forma de venta de cada pan")}
  <div class="stack">
    <button class="btn primary block" id="tpadd">+ Agregar tipo de pan</button>
    ${ps.length ? `<div class="card" style="padding-block:0"><div class="list">${ps.map(p => `<button class="item tap" data-tp="${esc(p.id)}"><div class="main"><div class="name">${esc(p.name)}</div>
      <div class="sub">${clp(p.price)} ${p.kg ? "el kilo" : "la unidad"}${p.atajo ? " · botón rápido" : ""}${p.reserva !== false ? " · se puede reservar" : ""}</div></div>
      ${p.has ? `<span class="pill ok">${p.kg ? "Por kilo" : "Por unidad"}</span>` : `<span class="pill none">Ya no se vende</span>`}</button>`).join("")}</div></div>`
      : `<div class="card stack"><p style="margin:0">Todavía no hay panes en el catálogo.</p><button class="btn block" id="tpseed">Agregar los panes típicos</button>
        <p class="small muted" style="margin:0">Marraqueta, hallulla, pan amasado, dobladitas y pan integral, por kilo y con precios de referencia.</p></div>`}
    <p class="small muted" style="margin:0"><b>Por unidad:</b> cada toque en Vender suma un pan. <b>Por kilo:</b> se escribe lo que marca la balanza o un monto en pesos. Si cambias la forma de venta de un pan, ese pan queda sin contar.</p>
  </div>`;
}
function bindTiposPan(){
  $("#tpadd").onclick = () => openTipoPan(null);
  document.querySelectorAll("[data-tp]").forEach(b => b.onclick = () => openTipoPan(P(b.dataset.tp)));
  const sd = $("#tpseed"); if (sd) sd.onclick = () => run(async () => {
    const rows = CATALOG.filter(c => c[1] === "Pan").map(c => Object.assign({ id:uid(), name:c[0], cat:"Pan", price:c[2], cost:c[3], barcode:"", min:5, has:true, countQty:null, countAt:null, estimated:false }, c[5] || {}));
    await act.put("products", rows); S.products.sort((a, b) => a.name.localeCompare(b.name, "es")); render(); toast("Panes agregados"); });
}
function openTipoPan(p){
  const nuevo = !p;
  let kg = nuevo ? true : !!p.kg;
  openModal(`<div class="stack">
    <div class="spread"><h2>${nuevo ? "Nuevo tipo de pan" : esc(p.name)}</h2><button class="btn ghost sm" data-close>Cerrar</button></div>
    <div class="field"><label for="tpn">Nombre</label><input class="input" id="tpn" value="${esc(p?.name || "")}" placeholder="Ej: Coliza"></div>
    <div class="field"><label>¿Cómo se vende?</label><div class="seg" role="group"><button data-tpu="1" aria-pressed="${!kg}">Por unidad</button><button data-tpu="0" aria-pressed="${kg}">Por kilo</button></div></div>
    <div class="field"><label for="tpp" id="tppl">${kg ? "Precio del kilo" : "Precio de cada pan"}</label><input class="input" id="tpp" type="number" min="0" inputmode="numeric" value="${esc(p?.price ?? "")}" placeholder="Ej: ${kg ? "2190" : "300"}"></div>
    <label class="row small"><input type="checkbox" id="tpat" ${nuevo || p.atajo ? "checked" : ""}> Botón rápido en Vender</label>
    <label class="row small"><input type="checkbox" id="tpres" ${nuevo || p.reserva !== false ? "checked" : ""}> Los clientes lo pueden reservar</label>
    ${nuevo ? "" : `<label class="row small"><input type="checkbox" id="tpoff" ${p.has ? "" : "checked"}> Ya no lo vendemos</label>`}
    <button class="btn primary block" id="tpsave">Guardar</button>
  </div>`);
  document.querySelectorAll("[data-tpu]").forEach(b => b.onclick = () => { kg = b.dataset.tpu === "0";
    document.querySelectorAll("[data-tpu]").forEach(x => x.setAttribute("aria-pressed", x === b)); $("#tppl").textContent = kg ? "Precio del kilo" : "Precio de cada pan"; });
  $("#tpsave").onclick = () => run(async () => {
    const name = $("#tpn").value.trim(), price = Math.round(+$("#tpp").value || 0);
    if (!name) return $("#tpn").focus(); if (!(price > 0)) return $("#tpp").focus();
    const f = { name, price, kg, atajo:$("#tpat").checked, reserva:$("#tpres").checked };
    if (nuevo){ await act.put("products", [Object.assign({ id:uid(), cat:"Pan", cost:Math.round(price * 0.65), barcode:"", min:kg ? 5 : 20, has:true, countQty:null, countAt:null, estimated:false }, f)]);
      S.products.sort((a, b) => a.name.localeCompare(b.name, "es")); }
    else { f.has = !$("#tpoff").checked; Object.assign(f, cambioUnidad(p, kg)); await act.updateProduct(p, f); }
    closeModal(); render(); toast(nuevo ? `${name} agregado` : "Guardado"); });
}


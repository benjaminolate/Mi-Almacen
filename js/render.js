"use strict";
// Dibuja la pantalla actual y conecta sus botones.

function bindSearch(onPick, qs = "#q", rs = "#res", opts){
  const q = $(qs), res = $(rs);
  const upd = () => { const h = searchResults(q.value, null, opts); res.hidden = !h; res.innerHTML = h;
    res.querySelectorAll("[data-pick]").forEach(b => b.onclick = () => { onPick(P(b.dataset.pick)); }); };
  q.oninput = upd;
}

function render(){
  if (!MODE) return;
  purgeReservas();
  if (necesitaEntrar()) return showLogin();
  if ((VIEW_EXT[ui.view] && !extOn(VIEW_EXT[ui.view])) || (VIEW_PERM[ui.view] && !puede(VIEW_PERM[ui.view]))) ui.view = "inicio";
  applyTheme();
  renderTabs();
  const v = ui.view, app = $("#app");
  app.innerHTML = ({ inicio:viewInicio, vender:viewVender, recibir:viewRecibir, contar:viewContar, productos:viewProductos, historial:viewHistorial, fiados:viewFiados, mas:viewMas,
    reservas:viewReservas, datos:viewDatos, extensiones:viewExtensiones, apariencia:viewApariencia, compras:viewCompras, vencimientos:viewVencimientos,
    proveedores:viewProveedores, caja:viewCaja, tipospan:viewTiposPan, resumen:viewResumen, ofertas:viewOfertas, personas:viewPersonas, encargos:viewEncargos, pagina:viewPagina, cuentas:viewCuentas })[v]();
  ({ resumen:bindResumen, tipospan:bindTiposPan, compras:bindCompras, vencimientos:bindVencimientos, proveedores:bindProveedores, caja:bindCaja, ofertas:bindOfertas, personas:bindPersonas, encargos:bindEncargos, pagina:bindPagina, cuentas:bindCuentas })[v]?.(app);
  vitrinaSoon();
  app.querySelectorAll("[data-go]").forEach(b => b.onclick = () => go(b.dataset.go));
  app.querySelectorAll("[data-back]").forEach(b => b.onclick = back);
  const pb = $("#panbtn"); if (pb) pb.onclick = openPan;
  const tb = $("#tourbtn"); if (tb) tb.onclick = () => tour(0);
  const lo = $("#logout"); if (lo) lo.onclick = cerrarSesion;
  const tc = $("#tourno"); if (tc) tc.onclick = () => run(async () => { await setPref({ tourVisto:true }); rerender(); });
  const ts = $("#toursi"); if (ts) ts.onclick = () => { setPref({ tourVisto:true }); tour(0); };
  app.querySelectorAll("[data-ayuda]").forEach(b => b.onclick = () => openAyuda(ui.view));
  setTimeout(() => app.querySelectorAll("[data-perm]").forEach(el => { if (!puede(el.dataset.perm)) el.remove(); }));
  if (v === "fiados"){
    $("#addc").onclick = openNewClient;
    app.querySelectorAll("[data-client]").forEach(b => b.onclick = () => openCliente(S.clients.find(c => c.id === b.dataset.client)));
  }
  if (v === "extensiones"){
    app.querySelectorAll("[data-ext]").forEach(i => i.onchange = () => run(async () => { await setExtension(i.dataset.ext, i.checked); renderTabs();
      toast(`${EXTENSIONES.find(e => e.id === i.dataset.ext).nombre}: ${i.checked ? "activada" : "desactivada"}`); }));
  }
  if (v === "apariencia"){
    const redo = () => { const y = window.scrollY; render(); window.scrollTo(0, y); };
    app.querySelectorAll("[data-paleta]").forEach(b => b.onclick = () => run(async () => { const k = b.dataset.paleta;
      const extra = k === "propia" && !apariencia().brand ? (({ brand, accent }) => ({ brand, accent }))(colores(apariencia())) : {};
      await setApariencia(Object.assign({ paleta:k }, extra)); redo(); }));
    ["cbrand","caccent"].forEach(id => { const i = $("#" + id); if (i){
      i.oninput = () => { S.ajustes.apariencia = Object.assign(apariencia(), { [id === "cbrand" ? "brand" : "accent"]: i.value }); applyTheme(); };
      i.onchange = () => run(async () => { await setApariencia({ [id === "cbrand" ? "brand" : "accent"]: i.value }); redo(); }); } });
    app.querySelectorAll("[data-estilo]").forEach(b => b.onclick = () => run(async () => { await setApariencia({ estilo:b.dataset.estilo }); redo(); }));
    app.querySelectorAll("[data-fuente]").forEach(b => b.onclick = () => run(async () => { await setApariencia({ fuente:b.dataset.fuente }); redo(); }));
    app.querySelectorAll("[data-modo]").forEach(b => b.onclick = () => run(async () => { await setPref({ modo:b.dataset.modo }); redo(); }));
    app.querySelectorAll("[data-letra]").forEach(b => b.onclick = () => run(async () => { await setPref({ letra:b.dataset.letra }); redo(); }));
    $("#aporig").onclick = () => run(async () => { S.ajustes.apariencia = Object.assign({}, APARIENCIA_ORIGINAL); applyTheme(); await act.setting("apariencia", S.ajustes.apariencia);
      await setPref({ modo:"auto", letra:"normal" }); redo(); toast("Apariencia original"); });
  }
  if (v === "datos"){
    $("#tsave").onclick = () => run(async () => { const n = $("#tname").value.trim(); if (!n) return $("#tname").focus();
      await act.setting("tienda_nombre", n); meta.tienda = Object.assign({}, meta.tienda, { nombre:n }); await LocalDB.setMeta("tienda", meta.tienda); toast("Nombre guardado"); });
    $("#backup").onclick = () => run(downloadBackup);
    $("#restore").onchange = e => run(() => restoreBackup(e.target));
    const rcs = $("#rcsave"); if (rcs) rcs.onclick = () => run(async () => { const v = $("#rcor").value.trim();
      if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)){ $("#rcor").focus(); return toast("Revisa el correo, por ejemplo nombre@gmail.com"); }
      await act.setting("respaldo_correo", v); render(); toast(v ? "Correo guardado. El respaldo llega cada noche." : "Respaldo por correo apagado"); });
    const rct = $("#rctest"); if (rct) rct.onclick = () => run(async () => { rct.disabled = true; rct.textContent = "Mandando…";
      try { await Sync.syncNow(); const r = await api("/api/respaldo/correo", { tienda:meta.tienda.id }); toast(`Respaldo enviado a ${r.para}`); }
      finally { rct.disabled = false; rct.textContent = "Mandar uno ahora"; } });
    $("#wipe").onclick = () => confirmWipe(showSetup);
    if (!meta.demo){
      $("#ssave").onclick = () => run(async () => {
        const url = $("#sserv").value.trim().replace(/\/+$/, "");
        if (url && !/^https?:\/\//.test(url)) return toast("Escribe la dirección completa, con http:// o https://");
        if (url && !(await Sync.probe(url))) return toast("No se encontró el servidor en esa dirección");
        meta.servidor = url; await LocalDB.setMeta("servidor", url);
        if (url){ await LocalDB.setMeta("cursor", 0); Sync.start(url, meta.tienda.id); toast("Servidor guardado"); } else { Sync.stop(); toast("Sincronización desactivada"); }
        render(); });
      const sn = $("#snow"); if (sn) sn.onclick = () => run(async () => { await Sync.syncNow(); render(); toast(Sync.state.status === "ok" ? "Todo al día" : "No se pudo sincronizar"); });
      const sc = $("#scopy"); if (sc) sc.onclick = () => { try { navigator.clipboard.writeText(inviteLink()).then(() => toast("Link copiado"), () => toast(inviteLink())); } catch(e){ toast(inviteLink()); } };
    }
    const ib = $("#install"); if (ib) ib.onclick = async () => { const e = installEvt; installEvt = null; e.prompt(); await e.userChoice.catch(() => {}); render(); };
    if (persisted === null && navigator.storage?.persisted) navigator.storage.persisted().then(x => { persisted = x; if (ui.view === "datos") render(); }, () => {});
  }
  if (v === "reservas"){
    app.querySelectorAll("[data-res]").forEach(b => b.onclick = () => run(async () => { const r = S.reservas.find(r => r.id === b.dataset.res); if (r.origen === "web") return openReservaWeb(r); await act.reserva(r, !r.done); render(); }));
    const rn = $("#rn"); if (rn){ rn.value = ui.resName || ""; rn.oninput = () => ui.resName = rn.value;
    const step = (id, d) => { if (P(id)?.kg) d /= 2; ui.resQty[id] = Math.max(0, (ui.resQty[id]||0) + d); const y = window.scrollY; render(); window.scrollTo(0, y); };
    app.querySelectorAll("[data-binc]").forEach(x => x.onclick = () => step(x.dataset.binc, 1));
    app.querySelectorAll("[data-bdec]").forEach(x => x.onclick = () => step(x.dataset.bdec, -1));
    $("#rsave").onclick = () => run(async () => { const name = rn.value.trim(); if (!name){ rn.focus(); toast("Escribe el nombre del cliente"); return; }
      const detail = resDetail(ui.resQty); if (!detail) return;
      await act.newReserva(name, detail); ui.resQty = {}; ui.resName = ""; render(); toast(`Reserva de ${name} anotada`); }); }
  }
  if (v === "inicio" && meta.demo){
    $("#reset").onclick = () => confirmWipe(showSetup);
  }
  if (v === "vender"){
    bindSearch(addToCart);
    $("#scan").onclick = () => openScanSheet(p => { addToCart(p); toast(`+1 ${p.name}`); });
    app.querySelectorAll("[data-inc]").forEach(b => b.onclick = () => { ui.cart[b.dataset.inc].qty++; render(); });
    app.querySelectorAll("[data-dec]").forEach(b => b.onclick = () => { const l = ui.cart[b.dataset.dec]; if (--l.qty <= 0) ui.cart.splice(b.dataset.dec,1); render(); });
    app.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { ui.cart.splice(b.dataset.rm, 1); render(); });
    app.querySelectorAll("[data-quick]").forEach(b => b.onclick = () => addToCart(P(b.dataset.quick)));
    app.querySelectorAll("[data-w]").forEach(b => b.onclick = () => { const l = ui.cart[b.dataset.w]; openPeso(P(l.pid), l.qty, kg => { l.qty = kg; closeModal(); render(); }); });
    app.querySelectorAll("[data-pago]").forEach(b => b.onclick = () => { ui.pago = b.dataset.pago; rerender(); });
    const pc = $("#pagacon"); if (pc) pc.oninput = () => { ui.pagaCon = pc.value; $("#vuelto").textContent = vuelto(pricing(ui.cart).total); };
    const lr = $("#lastrec"); if (lr) lr.onclick = () => openComprobante(ui.lastSale.grupo);
    $("#confirm").onclick = () => run(async () => {
      $("#confirm").disabled = true; $("#confirm").textContent = "Guardando…";
      const r = await act.sale(ui.cart, ext("caja") ? ui.pago : null).finally(render);
      ui.cart = []; ui.pagaCon = ""; ui.pago = "efectivo"; ui.lastSale = { grupo:r.grupo, total:r.total, at:Date.now() }; render(); toast(`Venta registrada: ${clp(r.total)}`); });
  }
  if (v === "recibir"){
    bindSearch(addToRecv);
    $("#sup").oninput = e => ui.recv.supplier = e.target.value;
    $("#scan").onclick = () => openScanSheet(p => addToRecv(p));
    app.querySelectorAll("[data-rq]").forEach(i => i.oninput = () => { const l = ui.recv.items[i.dataset.rq]; l.qty = P(l.pid).kg ? r3(Math.max(0, num(i.value))) : Math.max(0, Math.round(num(i.value))); });
    app.querySelectorAll("[data-rv]").forEach(i => i.oninput = () => { ui.recv.items[i.dataset.rv].vence = i.value; });
    const rd = $("#rdebe"); if (rd) rd.onchange = () => ui.recv.debe = rd.checked;
    app.querySelectorAll("[data-sup]").forEach(b => b.onclick = () => { ui.recv.supplier = b.dataset.sup; rerender(); });
    app.querySelectorAll("[data-rpq]").forEach(b => b.onclick = () => { const y = window.scrollY; addToRecv(P(b.dataset.rpq)); window.scrollTo(0, y); });
    app.querySelectorAll("[data-rcaja]").forEach(i => i.onchange = () => { const l = ui.recv.items[i.dataset.rcaja], p = P(l.pid);
      l.caja = i.checked ? { n:"", por:p.porCaja || "", precio:"" } : null; rerender(); });
    const caja = (attr, k) => app.querySelectorAll(`[data-${attr}]`).forEach(i => i.onchange = () => { const l = ui.recv.items[i.dataset[attr]];
      if (k === "por" && cajaVal(i.value) === undefined){ toast(CAJA_MSG); l.caja.por = ""; return rerender(); }
      l.caja[k] = Math.max(0, Math.round(+i.value || 0));
      const { n, por, precio } = l.caja; if (n && por){ l.qty = n * por; if (precio) l.cost = Math.round(precio / por); } rerender(); });
    caja("rcn", "n"); caja("rcu", "por"); caja("rcp", "precio");
    app.querySelectorAll("[data-rc]").forEach(i => i.oninput = () => { ui.recv.items[i.dataset.rc].cost = Math.max(0, +i.value||0); });
    app.querySelectorAll("[data-rq],[data-rc]").forEach(i => i.onchange = render);
    $("#confirm").onclick = () => run(async () => { const n = ui.recv.items.reduce((a,l) => a + (l.qty||0), 0);
      $("#confirm").disabled = true; $("#confirm").textContent = "Guardando…";
      await act.receive(ui.recv.supplier, ui.recv.items, { debe:ui.recv.debe }).finally(render);
      const sinContar = ui.recv.items.map(l => P(l.pid)).filter(p => p && p.countAt == null);
      ui.recv = { supplier:"", items:[], debe:false }; render();
      toast(`Recepción guardada: ${fq(null, n)} unidades` + (sinContar.length ? `. ${sinContar.length === 1 ? sinContar[0].name + " todavía no se cuenta" : sinContar.length + " productos todavía no se cuentan"}: su stock aparece cuando se cuente su sector en Contar.` : "")); });
    const rdi = $("#rdiscard"); if (rdi) rdi.onclick = () => {
      openModal(`<div class="stack"><h2>¿Descartar la recepción?</h2><p style="margin:0">Se borran los productos anotados y el proveedor elegido. El stock no cambia.</p>
        <div class="grid2"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="rdok">Descartar</button></div></div>`);
      $("#rdok").onclick = () => { ui.recv = { supplier:"", items:[], debe:false }; closeModal(); render(); toast("Recepción descartada"); }; };
  }
  if (v === "contar"){
    app.querySelectorAll("[data-sector]").forEach(b => b.onclick = () => { ui.sector = b.dataset.sector; ui.draft = {}; pushNav(); render(); window.scrollTo(0,0); });
    if (ui.sector){
      $("#back").onclick = back;
      app.querySelectorAll("[data-cq]").forEach(i => i.oninput = () => { (ui.draft[i.dataset.cq] ||= {}).qty = i.value; });
      app.querySelectorAll("[data-ce]").forEach(i => i.onchange = () => { (ui.draft[i.dataset.ce] ||= {}).est = i.checked; });
      app.querySelectorAll("[data-cn]").forEach(b => b.onclick = () => { const p = P(b.dataset.cn); const d = (ui.draft[p.id] ||= {}); const off = d.none ?? !p.has; d.none = !off; render(); });
      $("#scan").onclick = () => openScanSheet(scanCount);
      app.querySelectorAll("[data-sask]").forEach(b => b.onclick = () => run(async () => { await setPref({ scanAsk:b.dataset.sask === "1" }); rerender(); }));
      app.querySelectorAll("[data-cbox]").forEach(b => b.onclick = () => openCantidad(P(b.dataset.cbox)));
      app.querySelectorAll("[data-cprod]").forEach(b => b.onclick = () => openProduct(P(b.dataset.cprod)));
      $("#addp").onclick = () => openProductForm(ui.sector, "", () => render());
      $("#finish").onclick = finishCount;
    }
  }
  if (v === "productos"){
    $("#pq").oninput = e => { ui.prodQuery = e.target.value; const pos = e.target.selectionStart; render(); const n = $("#pq"); n.focus(); n.setSelectionRange(pos,pos); };
    app.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { ui.prodFilter = b.dataset.f; render(); });
    app.querySelectorAll("[data-open]").forEach(b => b.onclick = () => openProduct(P(b.dataset.open)));
    const so = $("#secoff"); if (so) so.onclick = () => run(async () => { const c = ui.prodFilter, off = S.ajustes.sectores_off || [];
      await act.setting("sectores_off", sectorOff(c) ? off.filter(x => x !== c) : [...off, c]); rerender(); toast(`${c}: ${sectorOff(c) ? "apagado" : "prendido"}`); });
    $("#addcat").onclick = openSumarCatalogo;
    $("#addp").onclick = () => openProductForm(sectores().includes(ui.prodFilter) ? ui.prodFilter : null, "", null);
  }
  if (v === "historial"){
    app.querySelectorAll("[data-hf]").forEach(b => b.onclick = () => { ui.histFilter = b.dataset.hf; render(); });
    app.querySelectorAll("[data-hw]").forEach(b => b.onclick = () => { ui.histWho = b.dataset.hw; render(); });
    app.querySelectorAll("[data-rec]").forEach(b => b.onclick = () => openComprobante(b.dataset.rec));
  }
}

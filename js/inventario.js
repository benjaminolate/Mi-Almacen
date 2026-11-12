"use strict";
// Recibir mercadería, contar, productos e historial.

function viewRecibir(){
  const total = ui.recv.items.reduce((a,l)=>a+l.qty*l.cost,0);
  return `${header("Recibir mercadería", "Lo que llega del proveedor")}
  <div class="stack">
    <div class="field"><label for="sup">Proveedor</label><input class="input" id="sup" value="${esc(ui.recv.supplier)}" ${ext("proveedores") ? `list="provlist" autocomplete="off"` : ""}>
      ${ext("proveedores") ? `<datalist id="provlist">${S.proveedores.map(x => `<option value="${esc(x.nombre)}">`).join("")}</datalist>` : ""}
      ${ext("proveedores") && S.proveedores.length ? `<div class="chips" style="flex-wrap:wrap;padding-top:4px">${S.proveedores.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).map(x => `<button class="chip" data-sup="${esc(x.nombre)}" aria-pressed="${ui.recv.supplier.trim().toLowerCase() === x.nombre.trim().toLowerCase()}">${esc(x.nombre)}</button>`).join("")}</div>` : ""}</div>
    ${(() => { const pr = ext("proveedores") && S.proveedores.find(x => x.nombre.trim().toLowerCase() === ui.recv.supplier.trim().toLowerCase()); const ps = pr ? S.products.filter(p => p.prov === pr.id && disp(p)) : [];
      return ps.length ? `<div class="field"><label>Productos de ${esc(pr.nombre)}</label><div class="quick">${ps.map(p => `<button data-rpq="${esc(p.id)}" ${ui.recv.items.some(l => l.pid === p.id) ? 'aria-pressed="true" style="border-color:var(--brand)"' : ""}>${esc(p.name)}</button>`).join("")}</div></div>` : ""; })()}
    <div class="searchbar"><input class="input" id="q" placeholder="Buscar producto recibido" autocomplete="off"><button class="btn accent" id="scan">Escanear</button></div>
    <div class="list card" id="res" style="padding-block:0" hidden></div>
    <div class="card">
      <h3>Productos recibidos</h3>
      ${ui.recv.items.length ? ui.recv.items.map((l,i) => { const p = P(l.pid), s = stockOf(p), cj = l.caja; return `<div class="countrow" style="grid-template-columns:1fr 80px 96px"><div style="min-width:0"><div style="font-weight:600">${esc(p.name)}</div><div class="small muted">Stock actual: ${s == null ? "sin contar" : fq(p, s)}${l.cost > 0 || !puede("costos") ? "" : ' · <span class="pill warn">Sin costo</span>'}</div></div>
        <input class="input" type="number" min="0" ${p.kg ? `step="any" inputmode="decimal"` : `step="1" inputmode="numeric"`} value="${esc(l.qty)}" data-rq="${esc(i)}" aria-label="Cantidad${p.kg ? " en kilos" : ""}" ${cj ? "disabled" : ""}>
        <input class="input" type="number" min="0" inputmode="numeric" value="${esc(l.cost || (puede("costos") ? 0 : ""))}" placeholder="$" data-rc="${esc(i)}" aria-label="Costo ${p.kg ? "por kilo" : "unitario"}" ${cj ? "disabled" : ""}>
        ${p.kg ? "" : `<div class="opts"><label><input type="checkbox" data-rcaja="${esc(i)}" ${cj ? "checked" : ""}> Por caja</label>
          ${cj ? `<input class="input" type="number" min="0" inputmode="numeric" data-rcn="${esc(i)}" value="${esc(cj.n || "")}" placeholder="cajas" aria-label="Cajas" style="width:64px;font-size:14px;padding:6px">
          × <input class="input" type="number" min="2" max="1000" step="1" inputmode="numeric" data-rcu="${esc(i)}" value="${esc(cj.por || "")}" placeholder="unid." aria-label="Unidades por caja" style="width:64px;font-size:14px;padding:6px">
          a <input class="input" type="number" min="0" inputmode="numeric" data-rcp="${esc(i)}" value="${esc(cj.precio || "")}" placeholder="$ caja" aria-label="Precio de la caja" style="width:88px;font-size:14px;padding:6px">` : ""}</div>`}
        ${ext("vencimientos") ? `<div class="opts"><label for="rv${i}">Vence el</label><input class="input" type="date" id="rv${i}" data-rv="${esc(i)}" value="${esc(l.vence || "")}" style="width:auto;text-align:left;font-weight:400;font-size:14px;padding:6px 8px"><span class="muted">opcional</span></div>` : ""}</div>`; }).join("") +
        `<div class="row small muted" style="justify-content:flex-end;gap:24px;padding-top:6px"><span>cantidad</span><span>costo c/u</span></div>`
        : `<div class="empty">Agrega los productos de la factura. Ejemplo: 2 cajas de Coca-Cola 1,5 L = 24 unidades.</div>`}
      <div class="spread" style="padding-top:12px"><span class="muted">Total factura</span><span class="total">${clp(total)}</span></div>
      ${ext("proveedores") ? `<label class="row small" style="padding-top:8px"><input type="checkbox" id="rdebe" ${ui.recv.debe ? "checked" : ""}> Quedé debiendo esta factura al proveedor</label>` : ""}
    </div>
    <button class="btn primary block" id="confirm" ${ui.recv.items.length?"":"disabled"}>Guardar recepción</button>
    ${ui.recv.items.length || ui.recv.supplier ? `<button class="btn ghost block" id="rdiscard">Descartar y empezar de nuevo</button>
    <p class="small muted" style="margin:0;text-align:center">Lo anotado queda guardado aunque salgas de esta pantalla, hasta que lo guardes o lo descartes.</p>` : ""}
  </div>`;
}
function addToRecv(p){ const l = ui.recv.items.find(l => l.pid === p.id); if (l) l.qty++; else ui.recv.items.push({ pid:p.id, qty:p.kg ? 1 : 12, cost:p.cost || 0 }); render(); }

function viewContar(){
  if (!ui.sector){
    return `${header("Contar sector", "Carga del stock, un sector a la vez")}
    <div class="stack">
      <p class="muted" style="margin:0">Elige el sector que vas a contar ahora. Lo ideal es contar al abrir o al cerrar, unos 20 a 30 minutos por sector.</p>
      ${sectores().filter(c => S.products.some(p => p.cat === c && disp(p))).map(c => { const ps = S.products.filter(p => p.cat===c && disp(p)); const done = ps.filter(p => p.countAt!=null);
        const last = done.length ? Math.max(...done.map(p=>p.countAt)) : null;
        const sold = ps.filter(p => p.countAt==null).reduce((a,p)=>a+pendingSales(p),0);
        return `<button class="sector" data-sector="${esc(c)}"><span class="name">${esc(c)}</span>
          ${done.length===ps.length ? `<span class="pill ok">Contado</span>` : done.length ? `<span class="pill warn">${done.length}/${ps.length}</span>` : `<span class="pill none">Sin contar</span>`}
          <span class="sub">${ps.length} productos · ${last ? "último conteo " + ago(last) : `${sold} ventas registradas mientras tanto`}</span></button>`; }).join("")}
    </div>`;
  }
  const ps = S.products.filter(p => p.cat === ui.sector);
  return `<header class="top"><button class="btn sm" id="back">← Sectores</button><span class="small muted">${ps.filter(p=>p.has).length} productos</span></header>
  <div class="stack">
    <div><h2>Contando: ${esc(ui.sector)}</h2><p class="small muted" style="margin:4px 0 0">Escribe lo que hay en la estantería. Cada escaneo suma 1. Lo que no tengan, márcalo y desaparece de las listas.</p></div>
    <div class="row"><button class="btn accent" id="scan">Escanear</button><button class="btn" id="addp" data-perm="precios">+ Agregar producto</button></div>
    <div class="field"><label>Al escanear</label><div class="seg" role="group"><button data-sask="0" aria-pressed="${!prefs().scanAsk}">Suma 1 cada vez</button><button data-sask="1" aria-pressed="${!!prefs().scanAsk}">Preguntar cantidad</button></div></div>
    <div class="card" style="padding-block:4px">
      ${ps.map(p => { const d = ui.draft[p.id] || {}; const off = d.none ?? !p.has; const prev = stockOf(p);
        return `<div class="countrow ${off?"off":""}"><div style="min-width:0"><button class="linkbtn" data-cprod="${esc(p.id)}" style="font-weight:600">${esc(p.name)}</button><div class="small muted">${off ? "No lo tenemos" : prev==null ? "Sin contar" : `Sistema dice: ${fq(p, prev)}${p.estimated?" (aprox.)":""}`}</div></div>
          <input class="input" type="number" min="0" ${p.kg ? `step="any" inputmode="decimal"` : `inputmode="numeric"`} placeholder="${p.kg ? "kg" : "—"}" value="${esc(d.qty ?? "")}" data-cq="${esc(p.id)}" ${off?"disabled":""} aria-label="Cantidad de ${esc(p.name)}">
          <div class="opts"><label><input type="checkbox" data-ce="${esc(p.id)}" ${d.est?"checked":""} ${off?"disabled":""}> Es aproximado</label>
          ${p.kg || off ? "" : `<button class="btn sm" data-cbox="${esc(p.id)}">Cajas ×</button>`}
          <button class="btn sm ghost" data-cn="${esc(p.id)}">${off ? "Sí lo tenemos" : "No lo tenemos"}</button></div></div>`; }).join("")}
    </div>
    <button class="btn primary block" id="finish">Terminar conteo</button>
  </div>`;
}
// Escaneo en el conteo: suma 1, o pregunta la cantidad (útil con cajas)
function scanCount(p){
  if (p.cat !== ui.sector) toast(`${p.name} es del sector ${p.cat}; se cuenta igual`);
  if (prefs().scanAsk || p.kg) return openCantidad(p);
  if (p.cat === ui.sector) toast(`+1 ${p.name}`);
  const d = (ui.draft[p.id] ||= {}); d.qty = String((num(d.qty) || 0) + 1); d.none = false; rerender();
}
// Cantidad contada, escrita directo o como cajas × unidades + sueltas
function openCantidad(p){
  const d = ui.draft[p.id] || {};
  openModal(`<div class="stack">
    <div class="spread"><h2>${esc(p.name)}</h2><button class="btn ghost sm" data-close>Cerrar</button></div>
    <div class="field"><label for="ctot">Cantidad${p.kg ? " en kilos" : ""}</label><input class="input" id="ctot" type="number" min="0" ${p.kg ? 'step="any" inputmode="decimal"' : 'inputmode="numeric"'} value="${esc(d.qty ?? "")}" style="font-size:22px;font-weight:700;text-align:center"></div>
    ${p.kg ? "" : `<div><h3>O por cajas</h3><div class="row" style="flex-wrap:nowrap;gap:6px;align-items:end;padding-top:6px">
      <div class="field" style="flex:1"><label for="ccj">Cajas</label><input class="input" id="ccj" type="number" min="0" inputmode="numeric"></div><span style="padding-bottom:10px">×</span>
      <div class="field" style="flex:1"><label for="ccu">Unidades</label><input class="input" id="ccu" type="number" min="2" max="1000" step="1" inputmode="numeric" value="${esc(p.porCaja || "")}"></div><span style="padding-bottom:10px">+</span>
      <div class="field" style="flex:1"><label for="ccs">Sueltas</label><input class="input" id="ccs" type="number" min="0" inputmode="numeric"></div></div></div>`}
    <button class="btn primary block" id="cok">Listo</button>
  </div>`);
  const cajas = () => { const t = Math.round(+$("#ccj").value || 0) * Math.round(+$("#ccu").value || 0) + Math.round(+$("#ccs").value || 0); if ($("#ccj").value || $("#ccs").value) $("#ctot").value = t; };
  if (!p.kg) ["#ccj","#ccu","#ccs"].forEach(id => $(id).oninput = cajas);
  const ok = () => run(async () => { const v = $("#ctot").value;
    if (num(v) < 0){ $("#ctot").focus(); return toast("La cantidad no puede ser negativa"); }
    if (!enteroOk(p, v)){ $("#ctot").focus(); return toast(`${p.name} se cuenta por unidad: escribe un número entero`); }
    const por = p.kg || !$("#ccj").value ? 0 : cajaVal($("#ccu").value); if (por === undefined){ $("#ccu").focus(); return toast(CAJA_MSG); }
    const dd = (ui.draft[p.id] ||= {}); dd.qty = v; dd.none = false;
    if (por && por !== p.porCaja) await act.updateProduct(p, { porCaja:por });
    closeModal(); rerender(); });
  $("#cok").onclick = ok; $("#ctot").onkeydown = e => { if (e.key === "Enter") ok(); }; setTimeout(() => $(p.kg || !p.porCaja ? "#ctot" : "#ccj")?.focus(), 50);
}
function finishCount(){ run(async () => {
  const bad = Object.entries(ui.draft).map(([id, d]) => [P(id), d]).find(([p, d]) => p && !d.none && (num(d.qty) < 0 || !enteroOk(p, d.qty)));
  if (bad){ $(`[data-cq="${CSS.escape(bad[0].id)}"]`)?.focus(); return toast(num(bad[1].qty) < 0 ? `${bad[0].name}: la cantidad no puede ser negativa` : `${bad[0].name} se cuenta por unidad: escribe un número entero`); }
  const { n, diffs } = await act.count(ui.draft);
  const now = Date.now();
  ui.draft = {};
  const sector = ui.sector;
  openModal(`<div class="stack"><h2>Conteo guardado</h2>
    <p style="margin:0">${n} productos de ${esc(sector)} quedaron al día desde ahora (${new Date(now).toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit",hourCycle:"h23"})}). Las ventas que hagan desde este momento se descuentan solas.</p>
    ${diffs.length ? `<div class="card"><h3>Diferencias con lo que esperaba el sistema</h3><div class="list">${diffs.map(([p,e,q]) => `<div class="item"><div class="main"><div class="name">${esc(p.name)}</div><div class="sub">Esperaba ${e}, contaste ${q}</div></div><span class="pill ${q<e?"bad":"ok"}">${q<e?`Faltan ${e-q}`:`Sobran ${q-e}`}</span></div>`).join("")}</div>
      <p class="small muted" style="margin:8px 0 0">Las faltas quedan registradas como merma (vencidos, robo o ventas sin registrar).</p></div>` : ""}
    <button class="btn primary block" data-close>Listo</button></div>`);
  ui.sector = null; render();
}); }

function viewProductos(){
  const f = ui.prodFilter, secs = sectores();
  if (f !== "Todos" && f !== "Sin precio" && f !== "Apagados" && !secs.includes(f)) ui.prodFilter = "Todos";
  let list = S.products.filter(p => ui.prodFilter === "Todos" || (ui.prodFilter === "Sin precio" ? disp(p) && !(p.price > 0) : ui.prodFilter === "Apagados" ? !disp(p) : p.cat === ui.prodFilter));
  if (ui.prodQuery.trim()){ const r = buscar(ui.prodQuery, list); list = [...r.exactos, ...r.parecidos]; }
  const sinPrecio = S.products.filter(p => disp(p) && !(p.price > 0)).length, apagados = S.products.filter(p => !disp(p)).length;
  const sec = secs.includes(ui.prodFilter) ? ui.prodFilter : null;
  return `${header("Productos", `${S.products.filter(disp).length} productos a la venta`)}
  <div class="stack">
    <div class="searchbar"><input class="input" id="pq" placeholder="Buscar" value="${esc(ui.prodQuery)}"><button class="btn primary" id="addp" data-perm="precios">+ Agregar</button></div>
    <div class="chips">${["Todos", ...(sinPrecio ? ["Sin precio"] : []), ...(apagados ? ["Apagados"] : []), ...secs].map(c => `<button class="chip" data-f="${esc(c)}" aria-pressed="${ui.prodFilter===c}" ${sectorOff(c) ? 'style="text-decoration:line-through"' : ""}>${esc(c)}${c === "Sin precio" ? ` (${sinPrecio})` : c === "Apagados" ? ` (${apagados})` : ""}</button>`).join("")}</div>
    ${sec ? `<div class="card spread small"><span>${sectorOff(sec) ? `El sector <b>${esc(sec)}</b> está apagado: sus productos no salen en Vender, Contar ni en las listas.` : `Sector <b>${esc(sec)}</b>: ${list.length} productos.`}</span>
      <button class="btn sm" id="secoff" data-perm="precios">${sectorOff(sec) ? "Prender sector" : "Apagar sector"}</button></div>` : ""}
    <div class="card" style="padding-block:0"><div class="list" id="plist">${list.map(p => `<button class="item tap" data-open="${esc(p.id)}"><div class="main"><div class="name">${esc(p.name)}</div><div class="sub">${p.price > 0 ? clp(p.price) + (p.kg ? " el kilo" : "") : '<b style="color:var(--warn)">Sin precio</b>'} · ${esc(p.cat)}${p.barcode?" · con código":""}</div></div>${stockPill(p)}</button>`).join("") || `<div class="empty">Sin resultados.</div>`}</div></div>
    <p class="small muted" style="margin:0">Lo que no vendas, apágalo: en la ficha de cada producto, o un sector completo eligiéndolo arriba. Nada se borra.</p>
    <button class="btn ghost block" id="addcat" data-perm="precios">Sumar productos de un catálogo</button>
  </div>`;
}
function openProduct(p){
  const hist = S.movs.filter(m => m.pid === p.id).sort((a,b)=>b.at-a.at).slice(0, 12);
  openModal(`<div class="stack">
    <div class="spread"><h2>${esc(p.name)}</h2><button class="btn ghost sm" data-close>Cerrar</button></div>
    <div class="row">${stockPill(p)}<span class="small muted">${p.countAt ? "Contado " + ago(p.countAt) : "Aún no se cuenta"}</span></div>
    <div class="grid2">
      <div class="field"><label for="ep">Precio venta${p.kg ? " (kilo)" : ""}</label><input class="input" id="ep" type="number" min="0" inputmode="numeric" value="${esc(p.price)}"></div>
      <div class="field"><label for="ec">Costo${p.kg ? " (kilo)" : ""}</label><input class="input" id="ec" type="number" min="0" inputmode="numeric" value="${esc(p.cost)}"></div>
      <div class="field"><label for="em">Stock mínimo${p.kg ? " (kg)" : ""}</label><input class="input" id="em" type="number" min="0" ${p.kg ? 'step="any" inputmode="decimal"' : 'step="1" inputmode="numeric"'} value="${esc(p.min)}"></div>
      <div class="field"><label for="eb">Código de barras</label><input class="input code" id="eb" value="${esc(p.barcode)}" placeholder="Sin código"></div>
      ${p.kg ? "" : `<div class="field"><label for="epc">Unidades por caja</label><input class="input" id="epc" type="number" min="2" max="1000" step="1" inputmode="numeric" value="${esc(p.porCaja || "")}" placeholder="Opcional"></div>`}
      <div class="field"><label for="esec">Sector</label><input class="input" id="esec" list="seclist2" value="${esc(p.cat)}" autocomplete="off"><datalist id="seclist2">${[...new Set([...sectores(), ...ORDEN_SECTORES])].map(c => `<option value="${esc(c)}">`).join("")}</datalist></div>
    </div>
    <div class="field"><label for="en">Nombre</label><input class="input" id="en" value="${esc(p.name)}"></div>
    ${ext("proveedores") ? `<div class="field"><label for="eprov">Proveedor</label><select class="input" id="eprov"><option value="">Sin proveedor</option>${S.proveedores.map(x => `<option value="${esc(x.id)}" ${p.prov === x.id ? "selected" : ""}>${esc(x.nombre)}</option>`).join("")}</select></div>` : ""}
    ${ext("granel") || p.kg ? `<label class="row small"><input type="checkbox" id="ekg" ${p.kg ? "checked" : ""}> Se vende por kilo (a granel)</label>` : ""}
    <label class="row small"><input type="checkbox" id="eat" ${p.atajo ? "checked" : ""}> Botón rápido en Vender</label>
    <label class="row small"><input type="checkbox" id="ehas" ${p.has ? "checked" : ""}> Lo vendemos (si lo desmarcas, sale de Vender, Contar y las listas)</label>
    <button class="btn primary block" id="esave">Guardar cambios</button>
    ${ext("vencimientos") ? `<button class="btn block" id="evenc">Anotar vencimiento</button>` : ""}
    ${puede("precios") ? `<button class="btn ghost block" id="pdel" style="color:var(--bad)">Eliminar producto</button>` : ""}
    <div><h3>Últimos movimientos</h3><div class="list" id="phist">${hist.map(movRow).join("") || `<div class="empty">Sin movimientos.</div>`}</div></div>
  </div>`);
  $("#esave").onclick = () => run(async () => {
    const f = { price:+$("#ep").value||0, min:num($("#em").value), barcode:$("#eb").value.trim(), name:$("#en").value.trim() || p.name };
    // Quien no ve costos no tiene el campo: el producto queda con el costo que tenía
    if ($("#ec")) f.cost = +$("#ec").value||0;
    if (f.price < 0 || f.cost < 0 || f.min < 0) return toast("El precio, el costo y el stock mínimo no pueden ser negativos");
    if ($("#eprov")) f.prov = $("#eprov").value;
    if ($("#ekg")) f.kg = $("#ekg").checked;
    f.atajo = $("#eat").checked; f.has = $("#ehas").checked; f.cat = $("#esec").value.trim() || p.cat;
    if ($("#epc")){ f.porCaja = cajaVal($("#epc").value); if (f.porCaja === undefined){ $("#epc").focus(); return toast(CAJA_MSG); } }
    Object.assign(f, cambioUnidad(p, f.kg));
    await act.updateProduct(p, f);
    closeModal(); toast("Producto actualizado"); render(); });
  const ev = $("#evenc"); if (ev) ev.onclick = () => { closeModal(); ui.venc = { pid:p.id }; go("vencimientos"); };
  const pd = $("#pdel"); if (pd) pd.onclick = () => {
    openModal(`<div class="stack"><h2>¿Eliminar ${esc(p.name)}?</h2>
      <p style="margin:0">Sale de Vender, Contar, Productos y la página de la tienda${p.barcode ? ", y su código de barras queda libre para otro producto" : ""}. Sus ventas y movimientos siguen en el historial y en los resúmenes.</p>
      <p class="small muted" style="margin:0">Si solo dejaste de venderlo por un tiempo, mejor desmarca "Lo vendemos".</p>
      <div class="grid2"><button class="btn" id="pdno">Cancelar</button><button class="btn primary" id="pdok" style="background:var(--bad);border-color:var(--bad)">Eliminar</button></div></div>`);
    $("#pdno").onclick = () => openProduct(p);
    $("#pdok").onclick = () => run(async () => { await act.deleteProduct(p); closeModal(); render(); toast(`${p.name} eliminado`); });
  };
  if (!puede("costos")) $("#ec").closest(".field").remove();
  if (!puede("precios")){ document.querySelectorAll(".overlay input").forEach(i => i.disabled = true); $("#esave").replaceWith(Object.assign(document.createElement("p"), { className:"small muted", style:"margin:0", textContent:"Tu usuario puede ver este producto, pero no cambiarlo." })); }
}
function openProductForm(sector, code, cb){
  openModal(`<div class="stack">
    <div class="spread"><h2>Agregar producto</h2><button class="btn ghost sm" data-close>Cerrar</button></div>
    <div class="field"><label for="nn">Nombre</label><input class="input" id="nn" placeholder="Ej: Bebida Bilz 2 L"></div>
    <div class="grid2">
      <div class="field"><label for="ns">Sector</label><input class="input" id="ns" list="seclist" value="${esc(sector || ui.sector || "")}" placeholder="Ej: Bebidas" autocomplete="off">
        <datalist id="seclist">${[...new Set([...sectores(), ...ORDEN_SECTORES])].map(c => `<option value="${esc(c)}">`).join("")}</datalist></div>
      <div class="field"><label for="np">Precio venta</label><input class="input" id="np" type="number" min="0" inputmode="numeric" placeholder="0"></div>
      <div class="field"><label for="nb">Código de barras</label><input class="input code" id="nb" value="${esc(code||"")}" placeholder="Opcional"></div>
      <div class="field"><label for="nq">Cantidad ahora</label><input class="input" id="nq" type="number" min="0" step="any" inputmode="decimal" placeholder="Opcional"></div>
    </div>
    ${ext("granel") ? `<label class="row small"><input type="checkbox" id="nkg"> Se vende por kilo (a granel): el precio y la cantidad van en kilos</label>` : ""}
    <p class="small muted" style="margin:0">Si escribes la cantidad, el producto queda contado desde este momento.</p>
    <button class="btn primary block" id="nsave">Guardar producto</button>
  </div>`);
  $("#nsave").onclick = () => run(async () => {
    const name = $("#nn").value.trim(); if (!name){ $("#nn").focus(); return; }
    if (+$("#np").value < 0){ $("#np").focus(); return toast("El precio no puede ser negativo"); }
    if (num($("#nq").value) < 0){ $("#nq").focus(); return toast("La cantidad no puede ser negativa"); }
    if (!$("#nkg")?.checked && !enteroOk(null, $("#nq").value)){ $("#nq").focus(); return toast("Por unidad, la cantidad va sin decimales"); }
    const p = await act.newProduct({ name, cat:$("#ns").value.trim() || "Otros", price:+$("#np").value || 0, barcode:$("#nb").value.trim(), kg:!!$("#nkg")?.checked }, $("#nq").value);
    closeModal(); toast(`${name} agregado`);
    if (cb) cb(p); else render();
  });
}

function movRow(m){
  const p = P(m.pid); const nm = p ? esc(p.name) : "Producto";
  const who = m.quien && nombrePersona(m.quien) ? " · " + esc(nombrePersona(m.quien)) : "";
  if (m.type === "venta"){
    const extra = (m.pago ? " · " + PAGOS_CORTO[m.pago] : "") + (m.desc ? " · con oferta" : "");
    const inner = `<div class="main"><div class="name">${nm}</div><div class="sub">Venta · ${ago(m.at)}${who}${extra}</div></div><span class="diff" style="color:var(--bad)">−${fq(p, m.qty)}</span>`;
    return ext("comprobante") ? `<button class="item tap" data-rec="${esc(m.grupo || m.id)}" title="Ver comprobante">${inner}</button>` : `<div class="item">${inner}</div>`;
  }
  if (m.type === "compra") return `<div class="item"><div class="main"><div class="name">${nm}</div><div class="sub">Compra${m.supplier?" a "+esc(m.supplier):""} · ${ago(m.at)}${who}${m.vence ? " · vence " + esc(fdate(m.vence)) : ""}</div></div><span class="diff" style="color:var(--ok)">+${fq(p, m.qty)}</span></div>`;
  const d = m.expected != null && m.expected !== m.qty ? ` · esperaba ${fq(p, m.expected)}` : "";
  return `<div class="item"><div class="main"><div class="name">${nm}</div><div class="sub">Conteo${d} · ${ago(m.at)}${who}</div></div><span class="pill ok">= ${fq(p, m.qty)}</span></div>`;
}
function viewHistorial(){
  const f = ui.histFilter;
  const w = ext("personas") ? ui.histWho : "";
  const list = S.movs.filter(m => (f==="todos" || m.type===f) && (!w || m.quien === w)).sort((a,b)=>b.at-a.at).slice(0, 80);
  return `${header("Historial", "Todo lo que entra, sale y se cuenta")}
  <div class="stack">
    <div class="chips">${[["todos","Todos"],["venta","Ventas"],["compra","Compras"],["conteo","Conteos"]].map(([k,l]) => `<button class="chip" data-hf="${esc(k)}" aria-pressed="${f===k}">${l}</button>`).join("")}</div>
    ${ext("personas") && S.personas.length ? `<div class="chips"><button class="chip" data-hw="" aria-pressed="${!w}">Todas las personas</button>${S.personas.map(x => `<button class="chip" data-hw="${esc(x.id)}" aria-pressed="${w === x.id}">${esc(x.nombre)}</button>`).join("")}</div>` : ""}
    <div class="card" style="padding-block:0"><div class="list">${list.map(movRow).join("") || `<div class="empty">Sin movimientos.</div>`}</div></div>
  </div>`;
}


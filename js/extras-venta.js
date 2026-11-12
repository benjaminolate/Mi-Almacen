"use strict";
// Utilidades de las extensiones, quién atiende, granel, ofertas y comprobante.
// ---------- Utilidades de las extensiones ----------
const num = v => { const n = parseFloat(String(v ?? "").replace(",", ".")); return isFinite(n) ? n : 0; };
const r3 = n => Math.round(n * 1000) / 1000;
// Cantidad con su unidad: los productos a granel van en kilos
const fq = (p, q) => (+r3(q || 0)).toLocaleString("es-CL", { maximumFractionDigits:3 }) + (p?.kg ? " kg" : "");
const ymd = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const daysTo = f => Math.round((new Date(f + "T12:00") - new Date(ymd() + "T12:00")) / D);
const fdate = f => new Date(f + "T12:00").toLocaleDateString("es-CL", { weekday:"short", day:"numeric", month:"short" });
// "Revisado": alguien miró la estantería y lo dejó a la venta. No vuelve a avisar hasta que vence;
// si se revisó antes de vencer y ya venció, avisa de nuevo.
const revisadoVigente = v => !!v.revisado && (daysTo(v.fecha) >= 0 || ymd(v.revisado) >= v.fecha);
const enDias = n => n < -1 ? `hace ${-n} días` : n === -1 ? "ayer" : n === 0 ? "hoy" : n === 1 ? "mañana" : `en ${n} días`;
const DIAS = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"], ORDEN_DIAS = [1,2,3,4,5,6,0];
const diasTxt = ds => ORDEN_DIAS.filter(d => ds?.includes(d)).map(d => DIAS[d]).join(", ");
const PAGOS = { efectivo:"Efectivo", debito:"Débito o crédito", transferencia:"Transferencia" };
const PAGOS_CORTO = { efectivo:"Efectivo", debito:"Tarjeta", transferencia:"Transferencia" };
const rerender = () => { const y = window.scrollY; render(); window.scrollTo(0, y); };
const copiar = (t, ok = "Copiado") => { try { navigator.clipboard.writeText(t).then(() => toast(ok), () => toast("No se pudo copiar")); } catch(e){ toast("No se pudo copiar"); } };

// Avisos de las extensiones en la pantalla de inicio
function avisosInicio(){
  const out = [], card = (go, name, pill, sub) => out.push(`<button class="sector" data-go="${esc(go)}"><span class="name">${name}</span>${pill}<span class="sub">${sub}</span></button>`);
  if (ext("encargos")){
    const hoyE = S.encargos.filter(e => e.estado !== "entregado" && daysTo(e.para) <= 0);
    if (hoyE.length) card("encargos", "Encargos para hoy", `<span class="pill warn">${hoyE.length}</span>`, hoyE.slice(0, 3).map(e => esc(e.cliente)).join(", ") + (hoyE.length > 3 ? "…" : ""));
  }
  if (ext("vencimientos")){
    const vs = S.vencimientos.filter(v => !v.done && !revisadoVigente(v) && P(v.pid) && daysTo(v.fecha) <= 7), venc = vs.filter(v => daysTo(v.fecha) < 0).length;
    if (vs.length) card("vencimientos", "Vencen pronto", `<span class="pill ${venc ? "bad" : "warn"}">${venc ? venc + " vencidos" : vs.length}</span>`, "En los próximos 7 días: " + [...new Set(vs.map(v => P(v.pid).name))].slice(0, 3).map(esc).join(", "));
  }
  if (ext("proveedores")){
    const hoyP = S.proveedores.filter(x => x.dias?.includes(new Date().getDay()));
    if (hoyP.length) card("proveedores", "Hoy pasa", `<span class="pill ok">${hoyP.length}</span>`, hoyP.map(x => esc(x.nombre)).join(", "));
  }
  return out.join("");
}

// ---------- Quién atiende ----------
const personasActivas = () => S.personas.filter(x => x.activo !== false).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
const quien = () => cuentasOn() && meta.cuenta ? meta.cuenta.usuario.id : ext("personas") && meta.persona && S.personas.some(x => x.id === meta.persona && x.activo !== false) ? meta.persona : "";
const nombrePersona = id => S.personas.find(x => x.id === id)?.nombre || "";
const withWho = o => { const q = quien(); if (q) o.quien = q; return o; };
async function setPersona(id){ meta.persona = id; await LocalDB.setMeta("persona", id); }

function viewPersonas(){
  const ps = personasActivas(), d0 = new Date().setHours(0,0,0,0), me = quien();
  const ventas = id => S.movs.filter(m => m.type === "venta" && m.at >= d0 && m.quien === id);
  return `${header("Quién atiende", "Cada venta queda con el nombre de quien la hizo")}
  <div class="stack">
    <p class="small muted" style="margin:0">Elige quién está atendiendo en este dispositivo. Desde ahí, las ventas, recepciones, conteos y fiados quedan con su nombre.</p>
    <div class="card" style="padding-block:0"><div class="list">${ps.map(x => { const v = ventas(x.id), t = v.reduce((a, m) => a + m.qty * m.price, 0), n = new Set(v.map(m => m.grupo || m.id)).size;
      return `<div class="item"><div class="main"><div class="name">${esc(x.nombre)}${x.id === me ? ' <span class="pill ok">Atiende aquí</span>' : ""}</div><div class="sub">Hoy: ${n} ${n === 1 ? "venta" : "ventas"} · ${clp(t)}</div></div>
      ${x.id === me ? "" : `<button class="btn sm" data-soy="${esc(x.id)}">Soy yo</button>`}<button class="btn sm ghost" data-pquitar="${esc(x.id)}" aria-label="Quitar a ${esc(x.nombre)}">×</button></div>`; }).join("") || `<div class="empty">Agrega a las personas que atienden la tienda.</div>`}</div></div>
    <div class="searchbar"><input class="input" id="pnom" placeholder="Nombre, ej: Rosa" autocomplete="off"><button class="btn primary" id="padd">Agregar</button></div>
    <p class="small muted" style="margin:0">Por ahora cualquiera puede elegir cualquier nombre. Cuando lleguen las cuentas (Fase 4), cada persona entrará con su propia clave.</p>
  </div>`;
}
function bindPersonas(app){
  app.querySelectorAll("[data-soy]").forEach(b => b.onclick = () => run(async () => { await setPersona(b.dataset.soy); toast(`Atiende: ${nombrePersona(b.dataset.soy)}`); render(); }));
  app.querySelectorAll("[data-pquitar]").forEach(b => b.onclick = () => run(async () => { const x = S.personas.find(y => y.id === b.dataset.pquitar);
    await act.put("personas", [Object.assign({}, x, { activo:false })]); if (meta.persona === x.id) await setPersona(""); render(); }));
  const add = () => run(async () => { const nombre = $("#pnom").value.trim(); if (!nombre) return $("#pnom").focus();
    const x = await act.put("personas", [{ id:uid(), nombre, activo:true }]); if (!quien()) await setPersona(x.id); render(); toast(`${nombre} ya está en la lista`); });
  $("#padd").onclick = add; $("#pnom").onkeydown = e => { if (e.key === "Enter") add(); };
}

// ---------- Venta a granel ----------
function openPeso(p, cur, cb){
  let modo = "g";
  openModal(`<div class="stack">
    <div class="spread"><h2>${esc(p.name)}</h2><button class="btn ghost sm" data-close>Cerrar</button></div>
    <p class="small muted" style="margin:0">${clp(p.price)} el kilo</p>
    <div class="seg" role="group"><button data-pm="g" aria-pressed="true">Gramos</button><button data-pm="kg" aria-pressed="false">Kilos</button><button data-pm="$" aria-pressed="false">Por monto</button></div>
    <input class="input" id="pval" type="number" min="0" step="any" inputmode="decimal" placeholder="Ej: 350" value="${esc(cur ? r3(cur * 1000) : "")}" style="font-size:22px;font-weight:700;text-align:center">
    <div class="row"><button class="btn sm" data-pq="0.25">¼ kilo</button><button class="btn sm" data-pq="0.5">½ kilo</button><button class="btn sm" data-pq="1">1 kilo</button>
      <button class="btn sm" data-pp="500">$500</button><button class="btn sm" data-pp="1000">$1.000</button><button class="btn sm" data-pp="2000">$2.000</button></div>
    <div class="total" id="pprev" style="text-align:center;min-height:1.3em"></div>
    <button class="btn primary block" id="pok">${cur ? "Cambiar" : "Agregar a la venta"}</button>
  </div>`);
  const ph = { g:"Ej: 350", kg:"Ej: 1,5", $:"Ej: 2000" };
  const kg = () => { const v = num($("#pval").value); return r3(modo === "g" ? v / 1000 : modo === "kg" ? v : p.price ? v / p.price : 0); };
  const upd = () => { const k = kg(); $("#pprev").textContent = k > 0 ? `${fq(p, k)} = ${clp(k * p.price)}` : ""; };
  document.querySelectorAll("[data-pm]").forEach(b => b.onclick = () => { const k = kg(); modo = b.dataset.pm;
    document.querySelectorAll("[data-pm]").forEach(x => x.setAttribute("aria-pressed", x === b)); const i = $("#pval"); i.placeholder = ph[modo];
    if (k > 0) i.value = modo === "g" ? r3(k * 1000) : modo === "kg" ? k : Math.round(k * p.price); upd(); i.focus(); });
  document.querySelectorAll("[data-pp]").forEach(b => b.onclick = () => { modo = "$"; document.querySelectorAll("[data-pm]").forEach(x => x.setAttribute("aria-pressed", x.dataset.pm === "$"));
    $("#pval").placeholder = ph.$; $("#pval").value = b.dataset.pp; upd(); });
  document.querySelectorAll("[data-pq]").forEach(b => b.onclick = () => { const k = +b.dataset.pq; $("#pval").value = modo === "g" ? k * 1000 : modo === "kg" ? k : Math.round(k * p.price); upd(); });
  const ok = () => { const k = kg(); if (k <= 0) return $("#pval").focus(); cb(k); };
  $("#pval").oninput = upd; $("#pval").onkeydown = e => { if (e.key === "Enter") ok(); };
  $("#pok").onclick = ok; upd(); setTimeout(() => $("#pval")?.focus(), 50);
}

// ---------- Ofertas y packs ----------
function ofertaVigente(o, t = new Date()){
  if (o.activa === false) return false;
  if (o.dias?.length && !o.dias.includes(t.getDay())) return false;
  if (o.desde && o.hasta){ const hm = String(t.getHours()).padStart(2,"0") + ":" + String(t.getMinutes()).padStart(2,"0");
    if (o.desde <= o.hasta ? (hm < o.desde || hm >= o.hasta) : (hm < o.desde && hm >= o.hasta)) return false; }
  return true;
}
// Calcula el total de la venta con las ofertas que corresponden en este momento.
// Primero los packs ("3 por $1.000", se pueden mezclar los productos elegidos) y después
// los descuentos en %, solo en lo que no entró en un pack.
function pricing(cart){
  const lines = cart.map(l => { const p = P(l.pid); return { pid:l.pid, qty:l.qty, unit:p.price, bruto:Math.round(l.qty * p.price), desc:0 }; });
  const aplicadas = [], avisos = [];
  if (ext("ofertas")){
    const vig = S.ofertas.filter(o => ofertaVigente(o));
    for (const o of vig.filter(o => o.tipo === "pack" && o.n >= 2 && o.precio > 0 && o.pids?.length)){
      const units = [];
      lines.filter(x => !P(x.pid).kg && o.pids.includes(x.pid)).forEach(x => { for (let i = 0; i < x.qty; i++) units.push(x); });
      units.sort((a, b) => b.unit - a.unit);
      let ahorro = 0;
      for (let i = 0; i + o.n <= units.length; i += o.n){
        const g = units.slice(i, i + o.n), sum = g.reduce((a, x) => a + x.unit, 0), save = sum - o.precio;
        if (save <= 0) continue;
        g.forEach(x => x.desc += save * x.unit / sum); ahorro += save;
      }
      if (ahorro > 0) aplicadas.push({ nombre:o.nombre, ahorro:Math.round(ahorro) });
      const resto = units.length % o.n;
      if (resto) avisos.push(`Lleva ${o.n - resto} más para completar "${o.nombre}" (${o.n} por ${clp(o.precio)}).`);
    }
    const enPack = new Set(lines.filter(x => x.desc > 0));
    for (const o of vig.filter(o => o.tipo === "descuento" && o.pct > 0)){
      let ahorro = 0;
      lines.filter(x => !enPack.has(x) && x.desc === 0 && (!o.pids?.length || o.pids.includes(x.pid))).forEach(x => { x.desc = x.bruto * Math.min(100, o.pct) / 100; ahorro += x.desc; });
      if (ahorro > 0) aplicadas.push({ nombre:o.nombre, ahorro:Math.round(ahorro) });
    }
  }
  lines.forEach(x => x.desc = Math.min(x.bruto, Math.round(x.desc)));
  const subtotal = lines.reduce((a, x) => a + x.bruto, 0), descuento = lines.reduce((a, x) => a + x.desc, 0);
  return { lines, subtotal, descuento, total:subtotal - descuento, aplicadas, avisos };
}
function ofertaDesc(o){
  const prods = (o.pids || []).map(id => P(id)?.name).filter(Boolean);
  const que = o.tipo === "pack" ? `${o.n} por ${clp(o.precio)}` : `${o.pct}% de descuento`;
  const en = prods.length ? (prods.length > 3 ? prods.slice(0, 3).join(", ") + ` y ${prods.length - 3} más` : prods.join(", ")) : "todos los productos";
  const cuando = [o.dias?.length ? diasTxt(o.dias) : "", o.desde && o.hasta ? `${o.desde} a ${o.hasta}` : ""].filter(Boolean).join(" · ");
  return `${que} · ${en}${cuando ? " · " + cuando : ""}`;
}
function viewOfertas(){
  const os = S.ofertas.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return `${header("Ofertas y packs", "Se aplican solas al vender")}
  <div class="stack">
    <button class="btn primary block" id="addof">+ Nueva oferta</button>
    <div class="card" style="padding-block:0">${os.map(o => `<div class="ext"><button class="name" data-of="${esc(o.id)}" style="all:unset;cursor:pointer;font-weight:700">${esc(o.nombre)}${ofertaVigente(o) ? ' <span class="pill ok">Ahora</span>' : ""}</button>
      <span class="switch"><input type="checkbox" data-ofon="${esc(o.id)}" ${o.activa !== false ? "checked" : ""} aria-label="Activar ${esc(o.nombre)}"><span></span></span>
      <span class="sub">${esc(ofertaDesc(o))}</span></div>`).join("") || `<div class="empty">Aún no hay ofertas. Ejemplos: "3 galletas por $1.500" o "20% en pan después de las 19:00".</div>`}</div>
    <p class="small muted" style="margin:0">Toca el nombre de una oferta para cambiarla. Si un producto entra en un pack, no se le suma además un descuento.</p>
  </div>`;
}
function bindOfertas(app){
  $("#addof").onclick = () => openOferta(null);
  app.querySelectorAll("[data-of]").forEach(b => b.onclick = () => openOferta(S.ofertas.find(o => o.id === b.dataset.of)));
  app.querySelectorAll("[data-ofon]").forEach(i => i.onchange = () => run(async () => { const o = S.ofertas.find(x => x.id === i.dataset.ofon);
    await act.put("ofertas", [Object.assign({}, o, { activa:i.checked })]); rerender(); }));
}
function openOferta(o, preset){
  const nuevo = !o;
  const d = o ? JSON.parse(JSON.stringify(o)) : Object.assign({ id:uid(), nombre:"", tipo:"pack", n:3, precio:"", pct:10, pids:[], dias:[], desde:"", hasta:"", activa:true }, preset || {});
  // Cuánto ahorra el cliente, tomando el precio normal del primer producto elegido
  const ahorroTxt = () => { const p = P(d.pids[0]); if (!p) return "";
    if (d.tipo === "pack"){ const normal = p.price * (d.n || 0), pk = Math.round(+d.precio || 0); if (!pk || d.n < 2) return "";
      return pk < normal ? `Precio normal de ${d.n}: ${clp(normal)}. El cliente ahorra ${clp(normal - pk)}.` : `Ojo: ${d.n} de ${p.name} cuestan ${clp(normal)} sin oferta.`; }
    return d.pct > 0 ? `${p.name}: de ${clp(p.price)} queda en ${clp(p.price * (1 - Math.min(100, d.pct) / 100))}${p.kg ? " el kilo" : ""}.` : ""; };
  const keep = () => { d.nombre = $("#ofn").value; if ($("#ofq")){ d.n = Math.round(+$("#ofq").value || 0); d.precio = $("#ofp").value; } if ($("#ofpct")) d.pct = +$("#ofpct").value || 0;
    d.desde = $("#ofd1").value; d.hasta = $("#ofd2").value; };
  const draw = () => {
    openModal(`<div class="stack">
      <div class="spread"><h2>${nuevo ? "Nueva oferta" : "Editar oferta"}</h2><button class="btn ghost sm" data-close>Cerrar</button></div>
      <div class="field"><label for="ofn">Nombre</label><input class="input" id="ofn" value="${esc(d.nombre)}" placeholder="Ej: 3 galletas por $1.500"></div>
      <div class="seg" role="group"><button data-oft="pack" aria-pressed="${d.tipo === "pack"}">Pack: varios por un precio</button><button data-oft="descuento" aria-pressed="${d.tipo === "descuento"}">Descuento en %</button></div>
      ${d.tipo === "pack" ? `<div class="grid2"><div class="field"><label for="ofq">¿Cuántos?</label><input class="input" id="ofq" type="number" min="2" max="100" inputmode="numeric" value="${esc(d.n)}"></div>
        <div class="field"><label for="ofp">Precio por todos</label><input class="input" id="ofp" type="number" min="0" inputmode="numeric" value="${esc(d.precio)}" placeholder="Ej: 1500"></div></div>
        <p class="small muted" style="margin:0">Se pueden mezclar los productos elegidos: 2 de chocolate y 1 de vainilla también forman el pack.</p>`
      : `<div class="field"><label for="ofpct">Descuento (%)</label><input class="input" id="ofpct" type="number" min="1" max="100" inputmode="numeric" value="${esc(d.pct)}"></div>`}
      <div class="field"><label>Productos${d.tipo === "descuento" ? " (si no eliges ninguno, vale para todos)" : ""}</label>
        ${d.pids.length ? `<div class="row">${d.pids.filter(P).map(id => `<button class="chip" data-ofx="${esc(id)}" aria-label="Quitar ${esc(P(id).name)}">${esc(P(id).name)} ×</button>`).join("")}</div>` : ""}
        <input class="input" id="oq" placeholder="Buscar producto para agregar" autocomplete="off"><div class="list" id="ores" hidden></div></div>
      <div class="field"><label>Días (si no eliges ninguno, todos los días)</label><div class="chips" style="flex-wrap:wrap">${ORDEN_DIAS.map(n => `<button class="chip" data-ofd="${esc(n)}" aria-pressed="${d.dias.includes(n)}">${DIAS[n]}</button>`).join("")}</div></div>
      <div class="grid2"><div class="field"><label for="ofd1">Desde la hora (opcional)</label><input class="input" type="time" id="ofd1" value="${esc(d.desde)}"></div>
        <div class="field"><label for="ofd2">Hasta la hora</label><input class="input" type="time" id="ofd2" value="${esc(d.hasta)}"></div></div>
      <div class="hint" id="ofah" ${ahorroTxt() ? "" : "hidden"}>${esc(ahorroTxt())}</div>
      <button class="btn primary block" id="ofsave">Guardar oferta</button>
      ${nuevo ? "" : `<button class="btn ghost block" id="ofdel" style="color:var(--bad)">Borrar oferta</button>`}
    </div>`);
    document.querySelectorAll("[data-oft]").forEach(b => b.onclick = () => { keep(); d.tipo = b.dataset.oft; draw(); });
    ["#ofq","#ofp","#ofpct"].forEach(id => { const i = $(id); if (i) i.oninput = () => { keep(); const t = ahorroTxt(), h = $("#ofah"); h.textContent = t; h.hidden = !t; }; });
    document.querySelectorAll("[data-ofx]").forEach(b => b.onclick = () => { keep(); d.pids = d.pids.filter(x => x !== b.dataset.ofx); draw(); });
    document.querySelectorAll("[data-ofd]").forEach(b => b.onclick = () => { const n = +b.dataset.ofd; d.dias = d.dias.includes(n) ? d.dias.filter(x => x !== n) : [...d.dias, n]; b.setAttribute("aria-pressed", d.dias.includes(n)); });
    bindSearch(p => { keep(); if (!d.pids.includes(p.id)) d.pids.push(p.id); draw(); $("#oq").focus(); }, "#oq", "#ores", { all:true });
    $("#ofsave").onclick = () => run(async () => { keep();
      if (d.tipo === "pack"){ d.precio = Math.round(+d.precio || 0);
        if (!d.pids.length) return toast("Elige los productos del pack");
        if (d.n < 2 || d.precio <= 0) return toast("Escribe cuántos y el precio del pack");
        if (d.n > 100){ $("#ofq").focus(); return toast("El pack puede tener hasta 100 unidades"); }
        // Si se mezclan productos, el pack tiene que convenir incluso llevando solo el más barato
        const base = d.pids.map(P).filter(p => p?.price > 0).sort((a, b) => a.price - b.price)[0];
        if (base && d.precio >= base.price * d.n){ $("#ofp").focus();
          return toast(`El pack tiene que costar menos de ${clp(base.price * d.n)}, que es lo que valen ${d.n}${d.pids.length > 1 ? " del más barato" : ""} por separado`); } }
      else if (!(d.pct > 0 && d.pct <= 100)) return toast("El descuento va de 1 a 100%");
      if ((d.desde && !d.hasta) || (!d.desde && d.hasta)) return toast("Escribe las dos horas, o ninguna");
      if (!d.nombre.trim()) d.nombre = d.tipo === "pack" ? `${d.n} por ${clp(d.precio)}` : `${d.pct}% de descuento`;
      d.nombre = d.nombre.trim();
      const v = { id:d.id, nombre:d.nombre, tipo:d.tipo, pids:d.pids, dias:d.dias.sort(), desde:d.desde, hasta:d.hasta, activa:d.activa !== false };
      if (d.tipo === "pack") Object.assign(v, { n:d.n, precio:d.precio }); else v.pct = d.pct;
      await act.put("ofertas", [v]); closeModal(); render(); toast("Oferta guardada"); });
    const del = $("#ofdel"); if (del) del.onclick = () => run(async () => { await act.del("ofertas", d.id); closeModal(); render(); toast("Oferta borrada"); });
  };
  draw();
}

// ---------- Comprobante de venta ----------
const ventaGrupo = g => S.movs.filter(m => m.type === "venta" && (m.grupo || m.id) === g);
function comprobanteTexto(g){
  const ms = ventaGrupo(g); if (!ms.length) return "";
  const tot = ms.reduce((a, m) => a + m.qty * m.price, 0), desc = ms.reduce((a, m) => a + (m.desc || 0), 0);
  const lines = ms.map(m => { const p = P(m.pid); return `${fq(p, m.qty)} x ${p?.name || "Producto"}  ${clp(m.qty * (m.lista ?? m.price))}`; });
  return [`*${S.ajustes.tienda_nombre || "Mi Almacén"}*`, new Date(ms[0].at).toLocaleString("es-CL", { dateStyle:"short", timeStyle:"short", hourCycle:"h23" }), "",
    ...lines, ...(desc ? [`Descuentos  −${clp(desc)}`] : []), "", `*Total: ${clp(tot)}*`,
    ...(ms[0].pago ? [`Pago: ${PAGOS[ms[0].pago]}`] : []), ...(ms[0].quien && nombrePersona(ms[0].quien) ? [`Atendió: ${nombrePersona(ms[0].quien)}`] : []),
    "", "¡Gracias por su compra!", "Comprobante sin valor tributario"].join("\n");
}
function openComprobante(g){
  const txt = comprobanteTexto(g); if (!txt) return;
  const plano = txt.replace(/\*/g, "");
  openModal(`<div class="stack">
    <div class="spread"><h2>Comprobante</h2><button class="btn ghost sm" data-close>Cerrar</button></div>
    <pre class="receipt">${esc(plano)}</pre>
    <div class="field"><label for="rtel">Celular del cliente (opcional)</label><input class="input" id="rtel" type="tel" inputmode="tel" autocomplete="off" maxlength="16" placeholder="9 1234 5678"></div>
    <a class="btn primary block" id="rwa" style="text-align:center" href="${esc(waLink("", txt))}" ${WA_TARGET}>Enviar por WhatsApp</a>
    <div class="grid2"><button class="btn" id="rprint">Imprimir</button><button class="btn" id="rcopy">Copiar</button></div>
    <p class="small muted" style="margin:0">Es un detalle de la compra para el cliente. No reemplaza la boleta del SII.</p>
  </div>`);
  phoneInput($("#rtel")); $("#rtel").oninput = e => { $("#rwa").href = waLink(e.target.value.trim(), txt); };
  $("#rprint").onclick = () => { $("#print").textContent = plano; window.print(); };
  $("#rcopy").onclick = () => copiar(plano, "Comprobante copiado");
}


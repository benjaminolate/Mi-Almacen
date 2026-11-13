"use strict";
// Página pública de la tienda (la vitrina) y sus links.
// ---------- Página de la tienda ----------
// ajustes.publico: { pid, activo, url, mostrar:"todo"|"pan", stock, reservas, reservar:"pan"|"todo", diasMax, maxDia,
//   mensaje, direccion, horario, whatsapp, bloqueados }. El pid es distinto al código de la tienda: el link público
// nunca da acceso a los datos. Cualquier dispositivo conectado al servidor publica la vitrina cuando algo cambia.
const pub = () => S.ajustes.publico || {};
const nuevoPid = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), b => "abcdefghijkmnpqrstuvwxyz23456789"[b % 32]).join("");
async function setPub(cambios){ await act.setting("publico", Object.assign({}, pub(), cambios)); vit.last = ""; vitrinaSoon(300); }
const esHttps = u => /^https:\/\//.test(u || "");
// Dirección que abren los clientes: la de internet si está anotada, o la de este servidor
const pubBase = () => (pub().url || (location.protocol === "https:" && sameOrigin ? location.origin : "") || meta.servidor || "").replace(/\/+$/, "");
const pubLink = () => pubBase() && pub().pid ? `${pubBase()}/tienda.html?t=${pub().pid}` : "";
const telCL = t => { let d = String(t || "").replace(/\D/g, ""); if (d.length === 9 && d[0] === "9") d = "56" + d; if (d.length === 8) d = "569" + d; return /^569\d{8}$/.test(d) ? d : ""; };
function vitrina(){
  const o = pub(), pan = new Set(panesReserva().map(p => p.id));
  const reservable = p => !!o.reservas && (o.reservar === "todo" || pan.has(p.id));
  const estado = p => { const s = stockOf(p); return s == null ? undefined : s <= 0 ? "no" : s <= p.min ? "poco" : "hay"; };
  const productos = S.products.filter(p => disp(p) && (o.mostrar !== "pan" || p.cat === "Pan") && (p.price > 0 || reservable(p)))
    .sort((a, b) => sectores().indexOf(a.cat) - sectores().indexOf(b.cat) || a.name.localeCompare(b.name, "es"))
    .map(p => Object.assign({ id:p.id, n:p.name, c:p.cat, p:p.price }, p.kg ? { kg:1 } : {}, reservable(p) ? { r:1 } : {}, o.stock ? { s:estado(p) } : {}));
  const v = { data:{ v:1, nombre:S.ajustes.tienda_nombre || "", mensaje:o.mensaje || "", direccion:o.direccion || "", horario:o.horario || "", whatsapp:telCL(o.whatsapp),
      color:getComputedStyle(document.documentElement).getPropertyValue("--brand").trim(), reservas:!!o.reservas, stock:!!o.stock, diasMax:o.diasMax ?? 1, porPersona:o.porPersona || 3, productos },
    privado:{ bloqueados:o.bloqueados || [], maxDia:o.maxDia || 40 }, activo:ext("pagina") && !!o.activo };
  if (fotoOk(o.foto)) v.data.foto = o.foto;
  const links = (o.links || []).filter(l => PAGINA.href(l)).map(l => ({ tipo:l.tipo, titulo:l.titulo, valor:l.valor }));
  if (links.length) v.data.links = links;
  return v;
}
const vit = { last:"", timer:null, due:0, at:0, error:"" };
const vitEstado = () => !meta.servidor ? "" : vit.error ? `No se pudo publicar: ${vit.error}. Se reintenta solo.` : vit.at ? `✓ Publicada ${ago(vit.at)}` : pub().activo ? "Publicando…" : "";
function vitrinaSoon(ms = 6000){
  if (!S || meta.demo || !meta.servidor || !pub().pid) return;
  // Si ya hay una publicación pendiente que sale antes, se deja esa
  if (vit.timer && vit.due <= Date.now() + ms) return;
  clearTimeout(vit.timer); vit.due = Date.now() + ms; vit.timer = setTimeout(() => { vit.timer = null; publicar(); }, ms);
}
async function publicar(){
  // Solo publica un dispositivo al día con el servidor, para no subir una vitrina vieja
  if (Sync.state.status !== "ok"){ vitrinaSoon(Sync.state.status === "syncing" ? 1500 : 15e3); return; }
  const v = vitrina(), key = JSON.stringify(v);
  if (key === vit.last) return;
  try {
    const r = await fetch(meta.servidor.replace(/\/+$/, "") + "/api/publico/publicar", { method:"POST", headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({ tienda:meta.tienda.id, pid:pub().pid, activo:v.activo, data:Object.assign({ publicado:Date.now() }, v.data), privado:v.privado }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.message || `El servidor respondió ${r.status}`);
    vit.last = key; vit.at = Date.now(); vit.error = "";
  } catch(e){ vit.error = e.message || "Sin conexión con el servidor"; vitrinaSoon(60e3); }
  const el = $("#pgest"); if (el) el.textContent = vitEstado();
}
// Aviso cuando llega una reserva nueva por internet
let resVistas = null;
function avisarReservas(){
  const ids = webNuevas().map(r => r.id);
  if (!resVistas){ resVistas = new Set(ids); return; }
  const nuevas = webNuevas().filter(r => !resVistas.has(r.id)); ids.forEach(id => resVistas.add(id));
  if (!nuevas.length || !ext("pagina")) return;
  toast(nuevas.length === 1 ? `Nueva reserva por internet: ${nuevas[0].name}` : `${nuevas.length} reservas nuevas por internet`);
  try { navigator.vibrate?.(200); const ac = new (window.AudioContext || window.webkitAudioContext)(), o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = 880; g.gain.value = 0.08; o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.18); } catch(e){}
}
// El generador de códigos QR (qr.js) se carga recién cuando se necesita
let qrLib = null;
const cargarQR = () => qrLib || (qrLib = new Promise((ok, no) => { if (window.qrcode) return ok(window.qrcode); const sc = document.createElement("script"); sc.src = "qr.js"; sc.onload = () => ok(window.qrcode); sc.onerror = () => { qrLib = null; no(new Error("No se pudo cargar el generador del código QR")); }; document.head.append(sc); }));
async function qrSvg(texto, px = 4){ const q = (await cargarQR())(0, "M"); q.addData(texto); q.make(); return q.createSvgTag({ cellSize:px, margin:4, scalable:true }); }

function viewPagina(){
  const o = pub(), link = pubLink(), on = !!o.activo;
  const estado = vitEstado();
  const seg = (attr, val, opts) => `<div class="seg" role="group">${opts.map(([v, t]) => `<button ${attr}="${v}" aria-pressed="${String(val) === String(v)}">${t}</button>`).join("")}</div>`;
  return `${header("Página de la tienda", "Precios y reservas para tus clientes")}
  <div class="stack">
    ${!meta.servidor ? `<div class="card stack"><p style="margin:0">Para tener página, la tienda necesita el servidor. Configúralo en <b>Tienda y datos</b> y vuelve aquí.</p><button class="btn block" data-go="datos">Ir a Tienda y datos</button></div>` : `
    <div class="card stack">
      <label class="ext" style="padding:0;border:0"><span class="name" style="font-weight:700">Página activa</span><span class="switch"><input type="checkbox" id="pgon" ${on ? "checked" : ""} aria-label="Página activa"><span></span></span>
        <span class="sub">${on ? "Cualquiera con el link o el código QR ve tus productos y precios." : "Nadie puede verla. Actívala cuando quieras compartirla."}</span></label>
      ${on && link ? `<div class="code" id="pglink">${esc(link)}</div>
        <div class="grid2"><a class="btn" style="text-align:center" href="${esc(waLink("", (o.mensaje || "Mira nuestros productos y precios") + ": " + link))}" ${WA_TARGET}>Enviar por WhatsApp</a><button class="btn" id="pgcopy">Copiar link</button></div>
        <a class="btn block" style="text-align:center" href="${esc(link)}" target="_blank" rel="noopener">Ver la página</a>
        <div id="pgqr" style="background:#fff;border-radius:var(--r2);padding:12px;max-width:240px;margin:0 auto;width:100%;aspect-ratio:1"></div>
        <div class="grid2"><button class="btn" id="pgqrdl">Descargar QR</button><button class="btn" id="pgprint">Imprimir cartel</button></div>
        ${esHttps(link) ? "" : `<p class="pill warn" style="white-space:normal;margin:0;padding:8px 10px">Este link solo funciona en el wifi de la tienda. Para que tus clientes la abran desde su casa, conecta el servidor a internet (está explicado en servidor/INSTRUCCIONES.md) y anota abajo su dirección.</p>`}
        <p class="small muted" style="margin:0" id="pgest">${esc(estado)}</p>` : ""}
    </div>
    <div class="card stack"><h3>Qué se muestra</h3>
      <div class="field"><label>Productos</label>${seg("data-pgm", o.mostrar || "todo", [["todo","Todos los que tienen precio"],["pan","Solo el pan"]])}</div>
      <label class="row small"><input type="checkbox" id="pgstock" ${o.stock ? "checked" : ""}> Mostrar si hay, quedan pocos o está agotado (solo los productos contados)</label>
      <div class="row" style="gap:14px;flex-wrap:nowrap"><div class="avatar">${fotoOk(o.foto) ? `<img src="${esc(o.foto)}" alt="">` : esc((S.ajustes.tienda_nombre || "T")[0])}</div>
        <div class="stack" style="gap:8px;flex:1"><label class="btn sm filebtn">${fotoOk(o.foto) ? "Cambiar foto" : "Agregar foto o logo"}<input type="file" id="pgfoto" accept="image/*"></label>
        ${fotoOk(o.foto) ? `<button class="btn sm ghost" id="pgnofoto">Quitar foto</button>` : ""}</div></div>
      <div class="field"><label for="pgmsg">Mensaje de bienvenida</label><input class="input" id="pgmsg" value="${esc(o.mensaje || "")}" maxlength="140" placeholder="Ej: Pan amasado calentito todos los días"></div>
      <div class="field"><label for="pgdir">Dirección</label><input class="input" id="pgdir" value="${esc(o.direccion || "")}" maxlength="80" placeholder="Ej: Los Aromos 123, Quilpué"></div>
      <div class="field"><label for="pghor">Horario</label><input class="input" id="pghor" value="${esc(o.horario || "")}" maxlength="80" placeholder="Ej: Lunes a sábado de 8:00 a 21:00"></div>
      <div class="field"><label for="pgwa">WhatsApp de la tienda (opcional)</label><input class="input" id="pgwa" value="${esc(o.whatsapp || "")}" inputmode="tel" placeholder="9 XXXX XXXX"></div>
      <button class="btn block" id="pgsave">Guardar</button>
    </div>
    <div class="card"><div class="spread"><h3>Links</h3><button class="btn sm primary" id="pgadd">+ Agregar link</button></div>
      <div class="list">${(o.links || []).map((l, i, ls) => `<div class="lk">${PAGINA.ICONS[l.tipo] || PAGINA.ICONS.otro}<div class="main"><div style="font-weight:600">${esc(l.titulo || PAGINA.tipo(l.tipo)[1])}</div><div class="small muted code">${esc(l.valor)}</div></div>
        <button class="btn sm ghost" data-lup="${esc(i)}" aria-label="Subir" ${i ? "" : "disabled"}>↑</button><button class="btn sm ghost" data-ldown="${esc(i)}" aria-label="Bajar" ${i < ls.length - 1 ? "" : "disabled"}>↓</button><button class="btn sm" data-ledit="${esc(i)}">Editar</button></div>`).join("")
        || `<div class="empty">Todavía no hay links. Agrega el de las reseñas de Google, el del grupo de WhatsApp, cómo llegar y tus redes sociales.</div>`}</div>
      <p class="small muted" style="margin:0">Aparecen como botones grandes arriba de los productos, en este orden.</p></div>
    <div class="card stack"><h3>Reservas por internet</h3>
      <label class="row small"><input type="checkbox" id="pgres" ${o.reservas ? "checked" : ""}> Los clientes pueden reservar desde la página</label>
      ${o.reservas ? `<div class="field"><label>Qué se puede reservar</label>${seg("data-pgr", o.reservar || "pan", [["pan","El pan marcado en Tipos de pan"],["todo","Cualquier producto"]])}</div>
      <div class="field"><label>Con cuánta anticipación</label>${seg("data-pgd", o.diasMax ?? 1, [[0,"Solo hoy"],[1,"Hasta mañana"],[2,"Hasta 2 días"]])}</div>
      <div class="field"><label>Reservas por persona para un mismo día</label>${seg("data-pgpp", o.porPersona || 3, [[1,"1"],[2,"2"],[3,"3"],[5,"5"]])}</div>
      <div class="field"><label for="pgmax">Máximo de reservas por día</label><input class="input" id="pgmax" type="number" min="1" inputmode="numeric" value="${esc(o.maxDia || 40)}"></div>
      <p class="small muted" style="margin:0">Para evitar abusos: se cuenta por celular y las rechazadas no cuentan; se pide nombre y celular, y puedes bloquear números desde cada reserva. Para pedidos más grandes, el cliente tiene que hablar con la tienda.${(o.bloqueados || []).length ? ` Números bloqueados: ${(o.bloqueados || []).length}.` : ""}</p>` : ""}
    </div>
    <div class="card stack"><h3>Dirección en internet</h3>
      <p class="small muted" style="margin:0">La dirección con candado (https) del servidor, por ejemplo la de Tailscale Funnel. Si la dejas vacía se usa la del servidor.</p>
      <div class="searchbar"><input class="input code" id="pgurl" value="${esc(o.url || "")}" placeholder="https://mi-pc.tu-red.ts.net" autocapitalize="none" inputmode="url"><button class="btn" id="pgurls">Guardar</button></div>
    </div>
    ${o.pid ? `<button class="btn ghost block" id="pgnew">Cambiar el link (el anterior y su QR dejan de funcionar)</button>` : ""}`}
  </div>`;
}
// La foto se achica a 320 px para que la página cargue rápido
const fotoOk = f => /^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(String(f || ""));
function resizeImage(file){ return new Promise((res, rej) => { const img = new Image(), url = URL.createObjectURL(file);
  img.onload = () => { const s = 320, c = document.createElement("canvas"); c.width = c.height = s; const m = Math.min(img.width, img.height);
    c.getContext("2d").drawImage(img, (img.width - m)/2, (img.height - m)/2, m, m, 0, 0, s, s); URL.revokeObjectURL(url); res(c.toDataURL("image/jpeg", 0.82)); };
  img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("No se pudo leer la imagen")); }; img.src = url; }); }
// Agregar o editar un link de la página (tipos en pagina.js)
function openLink(i){
  const links = (pub().links || []).slice(), cur = i != null ? links[i] : null;
  let tp = cur?.tipo || "resena";
  const draw = () => { const t = PAGINA.tipo(tp);
    openModal(`<div class="stack">
      <div class="spread"><h2>${cur ? "Editar link" : "Agregar link"}</h2><button class="btn ghost sm" data-close>Cerrar</button></div>
      <div class="chips" style="flex-wrap:wrap">${PAGINA.TIPOS.filter(x => x[0] !== "pan").map(x => `<button class="chip" data-ltipo="${esc(x[0])}" aria-pressed="${tp === x[0]}">${esc(x[0] === "otro" ? "Otro" : x[1].replace(/^(Déjanos tu |Únete a nuestro |Escríbenos por )/, "").replace(/^./, c => c.toUpperCase()))}</button>`).join("")}</div>
      <div class="field"><label for="lval">${esc(t[2])}</label><input class="input code" id="lval" value="${esc(cur && cur.tipo === tp ? cur.valor : "")}" placeholder="${esc(t[3])}" ${tp === "whatsapp" || tp === "telefono" ? 'type="tel" inputmode="tel"' : 'inputmode="url" autocapitalize="none"'} maxlength="300"></div>
      ${t[4] ? `<p class="small muted" style="margin:0">${esc(t[4])}</p>` : ""}
      <div class="field"><label for="ltit">Texto del botón</label><input class="input" id="ltit" maxlength="60" value="${esc(cur && cur.tipo === tp && cur.titulo ? cur.titulo : t[1])}"></div>
      <button class="btn primary block" id="lsave">Guardar</button>
      ${cur ? `<button class="btn ghost block" id="ldel" style="color:var(--bad)">Quitar este link</button>` : ""}
    </div>`);
    document.querySelectorAll("[data-ltipo]").forEach(b => b.onclick = () => { tp = b.dataset.ltipo; draw(); });
    if (tp === "whatsapp" || tp === "telefono") phoneInput($("#lval"));
    $("#lsave").onclick = () => run(async () => { const valor = $("#lval").value.trim(); if (!valor) return $("#lval").focus();
      if ((tp === "whatsapp" || tp === "telefono") && !phoneOk(valor)){ $("#lval").focus(); return toast(PHONE_MSG); }
      if (tp !== "whatsapp" && tp !== "telefono" && !/^(https?:\/\/)?[^\s/]+\.[^\s]+$/i.test(valor)){ $("#lval").focus(); return toast("Pega el link completo, por ejemplo " + t[3]); }
      const l = { tipo:tp, valor, titulo:$("#ltit").value.trim() || t[1] };
      if (cur) links[i] = l; else links.push(l);
      await setPub({ links }); closeModal(); render(); toast("Link guardado"); });
    const del = $("#ldel"); if (del) del.onclick = () => run(async () => { links.splice(i, 1); await setPub({ links }); closeModal(); render(); toast("Link quitado"); });
  };
  draw();
}
function bindPagina(app){
  if (!meta.servidor) return;
  const o = pub();
  $("#pgon").onchange = e => run(async () => { await setPub(Object.assign({ activo:e.target.checked }, o.pid ? {} : { pid:nuevoPid(), reservas:ext("pan"), stock:false, diasMax:1 })); render(); });
  app.querySelectorAll("[data-pgm]").forEach(b => b.onclick = () => run(async () => { await setPub({ mostrar:b.dataset.pgm }); render(); }));
  app.querySelectorAll("[data-pgr]").forEach(b => b.onclick = () => run(async () => { await setPub({ reservar:b.dataset.pgr }); render(); }));
  app.querySelectorAll("[data-pgd]").forEach(b => b.onclick = () => run(async () => { await setPub({ diasMax:+b.dataset.pgd }); render(); }));
  app.querySelectorAll("[data-pgpp]").forEach(b => b.onclick = () => run(async () => { await setPub({ porPersona:+b.dataset.pgpp }); render(); toast("Límite guardado"); }));
  $("#pgstock").onchange = e => run(async () => { await setPub({ stock:e.target.checked }); });
  $("#pgres").onchange = e => run(async () => { await setPub({ reservas:e.target.checked }); render(); });
  const mx = $("#pgmax"); if (mx) mx.onchange = () => run(async () => { await setPub({ maxDia:Math.max(1, Math.round(+mx.value || 40)) }); toast("Guardado"); });
  $("#pgfoto").onchange = e => run(async () => { const f = e.target.files[0]; if (!f) return; await setPub({ foto:await resizeImage(f) }); render(); toast("Foto guardada"); });
  const nf = $("#pgnofoto"); if (nf) nf.onclick = () => run(async () => { await setPub({ foto:"" }); render(); toast("Foto quitada"); });
  $("#pgadd").onclick = () => openLink(null);
  app.querySelectorAll("[data-ledit]").forEach(b => b.onclick = () => openLink(+b.dataset.ledit));
  const mover = (i, d) => run(async () => { const ls = (pub().links || []).slice(); [ls[i], ls[i + d]] = [ls[i + d], ls[i]]; await setPub({ links:ls }); render(); });
  app.querySelectorAll("[data-lup]").forEach(b => b.onclick = () => mover(+b.dataset.lup, -1));
  app.querySelectorAll("[data-ldown]").forEach(b => b.onclick = () => mover(+b.dataset.ldown, 1));
  $("#pgsave").onclick = () => run(async () => { const wa = $("#pgwa").value.trim(); if (wa && !telCL(wa)){ $("#pgwa").focus(); return toast("Revisa el número de WhatsApp"); }
    await setPub({ mensaje:$("#pgmsg").value.trim(), direccion:$("#pgdir").value.trim(), horario:$("#pghor").value.trim(), whatsapp:wa }); toast("Guardado"); render(); });
  $("#pgurls").onclick = () => run(async () => { const u = $("#pgurl").value.trim().replace(/\/+$/, "");
    if (u && !/^https?:\/\/[^\s/]+$/.test(u)){ $("#pgurl").focus(); return toast("Escribe solo la dirección, por ejemplo https://mi-pc.tu-red.ts.net"); }
    await setPub({ url:u }); toast("Dirección guardada"); render(); });
  const nw = $("#pgnew"); if (nw) nw.onclick = () => { openModal(`<div class="stack"><h2>¿Cambiar el link?</h2><p style="margin:0">El link y el código QR que ya compartiste dejan de funcionar. Tendrás que imprimir y compartir los nuevos.</p>
    <div class="grid2"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="pgnewok">Cambiar</button></div></div>`);
    $("#pgnewok").onclick = () => run(async () => { await setPub({ pid:nuevoPid() }); closeModal(); render(); toast("Link nuevo listo"); }); };
  const link = pubLink(); if (!o.activo || !link) return;
  const cp = $("#pgcopy"); if (cp) cp.onclick = () => { try { navigator.clipboard.writeText(link).then(() => toast("Link copiado"), () => toast("Selecciona y copia el link")); } catch(e){ toast("Selecciona y copia el link"); } };
  qrSvg(link).then(svg => { const el = $("#pgqr"); if (el) el.innerHTML = svg.replace("<svg ", '<svg style="width:100%;height:100%;display:block" '); }, e => { const el = $("#pgqr"); if (el) el.textContent = e.message; });
  $("#pgqrdl").onclick = () => run(async () => { const svg = await qrSvg(link, 10), img = new Image(), c = document.createElement("canvas");
    await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); });
    c.width = c.height = 1000; const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, 1000, 1000); g.drawImage(img, 0, 0, 1000, 1000);
    const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = `qr-${slug(S.ajustes.tienda_nombre)}.png`; a.click(); toast("Código QR descargado"); });
  $("#pgprint").onclick = () => run(async () => { const svg = await qrSvg(link, 10), w = window.open("", "_blank"); if (!w) return toast("Permite las ventanas emergentes para imprimir");
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(S.ajustes.tienda_nombre || "Tienda")}</title><style>body{font-family:system-ui,sans-serif;text-align:center;margin:40px;color:#111}h1{font-size:40px;margin:0 0 8px}p{font-size:22px;margin:8px 0}svg{width:70vmin;height:70vmin;margin:24px auto;display:block}small{font-size:14px;color:#555;word-break:break-all}</style></head>
      <body><h1>${esc(S.ajustes.tienda_nombre || "")}</h1><p>${o.reservas ? "Escanea para ver precios y reservar" : "Escanea para ver nuestros productos y precios"}</p>${svg}<small>${esc(link)}</small><script>onload=()=>print()<\/script></body></html>`);
    w.document.close(); });
}


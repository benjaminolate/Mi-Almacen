"use strict";
// Crear la tienda la primera vez, unirse a una o abrirla.
// ---------- Inicio: crear la tienda la primera vez, o abrirla ----------
function gate(html){ MODE = null; $("nav.tabs").hidden = true; $("#app").innerHTML = html; window.scrollTo(0,0); }
const gateHead = () => `<header class="top"><h1 class="brandname">Mi Almacén<small>Inventario y ventas para tu negocio</small></h1></header>`;

// Servidor que sirvió esta página (cuando la app se abre desde PocketBase), si existe
let sameOrigin = null;
async function localServer(){
  // En GitHub Pages no hay servidor: no se pregunta
  if (sameOrigin === null) sameOrigin = /^https?:$/.test(location.protocol) && !location.hostname.endsWith("github.io") && await Sync.probe(location.origin) ? location.origin : "";
  return sameOrigin;
}
// Invitación: ?unirse=<código de la tienda>&servidor=<dirección>
const invite = (() => { const q = new URLSearchParams(location.search); return q.get("unirse") ? { tienda:q.get("unirse"), servidor:q.get("servidor") || "" } : null; })();
const clearInvite = () => { if (invite) history.replaceState(null, "", location.pathname); };

async function openStore(){
  await loadLocal();
  if (!meta.tienda) return showSetup();
  resVistas = null; avisarReservas();
  if (invite && invite.tienda !== meta.tienda.id) toast("Este dispositivo ya tiene otra tienda. Para unirte, primero borra sus datos en Más > Tienda y datos.");
  clearInvite();
  if (!meta.demo && !meta.servidor){ const o = await localServer(); if (o){ meta.servidor = o; await LocalDB.setMeta("servidor", o); } }
  MODE = "local"; $("nav.tabs").hidden = false; history.replaceState({ v:ui.view, n:0 }, ""); render();
  Sync.state.token = meta.cuenta?.token || "";
  if (!meta.demo && meta.servidor){ Sync.start(meta.servidor, meta.tienda.id); refrescarCuenta(); } else Sync.stop();
}
Sync.state.onStatus = s => { LocalDB.pendingCount().then(n => { meta.pending = n; if (MODE) updateNet(); }, () => {}); if (s === "cuenta" && MODE) render(); };
Sync.state.onRechazo = n => toast(`${n === 1 ? "Un cambio no se guardó" : n + " cambios no se guardaron"} en el servidor: tu usuario no tiene permiso o había un número fuera de lo permitido. Queda una copia en este celular`);
Sync.state.onChange = async () => { await loadLocal(); avisarReservas(); if (MODE) softRender(); };

function showSetup(){
  if (invite) return showJoin(invite.servidor, invite.tienda);
  S = null; applyTheme();
  const st = { inicio:"catalogo", tipo:"almacen" };
  const iniTxt = () => { const n = NEGOCIOS[st.tipo], c = cuantosCatalogo(st.tipo);
    return `Productos típicos de ${n.nombre.toLowerCase()}<small>${c.n} productos en ${c.sec} sectores. Los que no vendas los apagas uno por uno o por sector. Los precios se completan después o la primera vez que vendes cada uno.</small>`; };
  gate(`${gateHead()}<div class="stack">
    <div class="card stack"><h2>Crea tu tienda</h2>
      <p class="small muted" style="margin:0">Todo queda guardado en este dispositivo y funciona sin internet. No necesitas crear una cuenta.</p>
      <div class="field"><label for="sn">Nombre de la tienda</label><input class="input" id="sn" placeholder="Ej: Almacén Don José" autocomplete="organization"></div>
      <div class="field"><label for="sp">Tu nombre</label><input class="input" id="sp" placeholder="Ej: Rosa" autocomplete="given-name"></div>
      <div class="field"><label>¿Qué tipo de negocio es?</label>
        <div class="grid2" style="gap:8px">${Object.entries(NEGOCIOS).map(([k, n]) => `<button class="choice" data-tipo="${esc(k)}" aria-pressed="${k === st.tipo}">${esc(n.nombre)}<small>${esc(n.desc)}</small></button>`).join("")}</div></div>
      <div class="field"><label>¿Con qué productos empiezas?</label>
        <div class="stack" style="gap:8px">
          <button class="choice" data-ini="catalogo" aria-pressed="true" id="inicat">${iniTxt()}</button>
          <button class="choice" data-ini="vacio" aria-pressed="false">Empezar vacío<small>Agregas tus productos uno por uno o escaneando el código de barras.</small></button>
        </div></div>
      <div class="field"><label>¿Qué vas a usar?</label>
        <div style="padding:0 2px" id="sextbox">${extSwitches("data-sext", e => NEGOCIOS[st.tipo].ext.includes(e.id))}</div>
        <p class="small muted" style="margin:0">Lo puedes cambiar cuando quieras en Más &gt; Extensiones.</p></div>
      <button class="btn primary block" id="screate">Crear tienda</button>
    </div>
    <button class="btn block" id="sjoin">Unirme a una tienda que ya existe</button>
    <button class="btn block" id="slogin">Entrar con mi usuario</button>
    <button class="btn block" id="sdemo">Solo quiero probar con datos de ejemplo</button>
    <label class="btn ghost block filebtn">Tengo un respaldo: restaurarlo<input type="file" id="srestore" accept="application/json,.json" multiple></label>
  </div>`);
  document.querySelectorAll("[data-ini]").forEach(b => b.onclick = () => { st.inicio = b.dataset.ini; st.auto = false; document.querySelectorAll("[data-ini]").forEach(x => x.setAttribute("aria-pressed", x === b)); });
  document.querySelectorAll("[data-tipo]").forEach(b => b.onclick = () => { st.tipo = b.dataset.tipo; document.querySelectorAll("[data-tipo]").forEach(x => x.setAttribute("aria-pressed", x === b));
    $("#inicat").innerHTML = iniTxt(); $("#inicat").hidden = st.tipo === "otro";
    // "Otro negocio" no trae catálogo; al volver a un tipo con catálogo, se vuelve a ofrecer
    const ini = st.tipo === "otro" ? "vacio" : st.auto ? "catalogo" : st.inicio;
    if (st.tipo === "otro"){ if (st.inicio !== "vacio") st.auto = true; } else st.auto = false;
    if (ini !== st.inicio){ st.inicio = ini; document.querySelectorAll("[data-ini]").forEach(x => x.setAttribute("aria-pressed", x.dataset.ini === ini)); }
    $("#sextbox").innerHTML = extSwitches("data-sext", e => NEGOCIOS[st.tipo].ext.includes(e.id)); });
  $("#screate").onclick = () => run(async () => {
    const nombre = $("#sn").value.trim(), persona = $("#sp").value.trim();
    if (!nombre){ $("#sn").focus(); return toast("Escribe el nombre de la tienda"); }
    $("#screate").disabled = true; $("#screate").textContent = "Creando…";
    meta.servidor = await localServer();
    const exts = Object.fromEntries([...document.querySelectorAll("[data-sext]")].map(i => [i.dataset.sext, i.checked]));
    await createStore(nombre, persona, st.inicio, exts, st.tipo).finally(() => { const b = $("#screate"); if (b){ b.disabled = false; b.textContent = "Crear tienda"; } });
    ui.view = "inicio"; await openStore(); toast(`${nombre} está lista`);
  });
  $("#sdemo").onclick = () => run(async () => { meta.servidor = ""; await createStore("Almacén de ejemplo", "", "ejemplo"); ui.view = "inicio"; await openStore(); });
  $("#sjoin").onclick = () => run(async () => showJoin(await localServer(), ""));
  $("#slogin").onclick = () => run(async () => showJoin(await localServer(), "", true));
  $("#srestore").onchange = e => run(() => restoreBackup(e.target));
}

function showJoin(servidor, tienda, conCuenta){
  gate(`${gateHead()}<div class="stack">
    <div class="card stack"><h2>${conCuenta ? "Entrar con mi usuario" : "Unirme a una tienda"}</h2>
      <p class="small muted" style="margin:0">Este dispositivo va a descargar todos los datos de la tienda y desde ahí se mantiene al día con los demás. ${conCuenta ? "Usa el usuario y la contraseña que te dio el dueño de la tienda." : "Lo más fácil es abrir el link de invitación que se comparte desde Más > Tienda y datos en el dispositivo de la tienda."}</p>
      <div class="field"><label for="jserv">Dirección del servidor</label><input class="input code" id="jserv" value="${esc(servidor || "")}" placeholder="Ej: http://192.168.1.20:8090" autocapitalize="none" inputmode="url"></div>
      <div class="field" ${conCuenta && !tienda ? "hidden" : ""} id="jcodef"><label for="jcode">Código de la tienda</label><input class="input code" id="jcode" value="${esc(tienda || "")}" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" autocapitalize="none" autocomplete="off"></div>
      <div class="stack" id="jcuenta" style="gap:12px" ${conCuenta ? "" : "hidden"}>
        <p class="pill warn" id="javiso" style="white-space:normal;margin:0;padding:8px 10px" hidden>Esta tienda usa cuentas: entra con tu usuario y contraseña.</p>
        <div class="field"><label for="juser">Usuario</label><input class="input" id="juser" autocapitalize="none" autocomplete="username"></div>
        <div class="field"><label for="jpass">Contraseña</label><input class="input" id="jpass" type="password" autocomplete="current-password"></div>
        <div class="field" id="jselbox" hidden><label for="jsel">Tienda</label><select class="input" id="jsel"></select></div>
      </div>
      <button class="btn primary block" id="jgo">${conCuenta ? "Entrar" : "Unirme y descargar los datos"}</button>
    </div>
    <button class="btn ghost block" id="jback">Volver</button>
  </div>`);
  let sesion = null;
  $("#jback").onclick = () => { clearInvite(); location.reload(); };
  $("#jgo").onclick = () => run(async () => {
    const url = $("#jserv").value.trim().replace(/\/+$/, "");
    let code = $("#jcode").value.trim().toLowerCase();
    if (!/^https?:\/\//.test(url)) return toast("Escribe la dirección completa del servidor, con http:// o https://");
    const usuario = $("#juser").value.trim();
    if (usuario && !sesion){ sesion = await entrar(url, usuario, $("#jpass").value);
      if (!code){ if (!sesion.tiendas.length){ sesion = null; return toast("Tu usuario todavía no tiene acceso a ninguna tienda"); }
        if (sesion.tiendas.length > 1){ $("#jsel").innerHTML = sesion.tiendas.map(t => `<option value="${esc(t.tienda)}">${esc(t.nombre || t.tienda)}</option>`).join(""); $("#jselbox").hidden = false; $("#jgo").textContent = "Entrar a esta tienda"; return; }
        code = sesion.tiendas[0].tienda; } }
    if (sesion && !code) code = $("#jsel").value;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(code)) return toast("El código de la tienda no está completo");
    if (sesion && !sesion.tiendas.some(t => t.tienda === code)){ sesion = null; return toast("Tu usuario no tiene acceso a esta tienda"); }
    const b = $("#jgo"), txt = b.textContent; b.disabled = true; b.textContent = "Descargando datos…";
    try { await joinStore(url, code, sesion); }
    catch(e){ await LocalDB.wipe().catch(() => {}); Sync.stop();
      if (e.code === "cuenta" && !sesion){ $("#jcuenta").hidden = false; $("#javiso").hidden = false; $("#juser").focus(); return; }
      throw e; }
    finally { b.disabled = false; b.textContent = txt; }
    clearInvite(); ui.view = "inicio"; await openStore(); toast(`Listo: ${S.ajustes.tienda_nombre || "la tienda"} está en este dispositivo`);
  });
}


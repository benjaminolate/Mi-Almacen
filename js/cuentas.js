"use strict";
// Cuentas y permisos.
// ---------- Cuentas y permisos (Fase 4) ----------
// Con las cuentas activas (ajustes.cuentas), cada dispositivo entra con un usuario. meta.cuenta guarda la sesión
// de este dispositivo: { token, usuario:{ id, usuario, nombre }, tiendas:[{ tienda, nombre, rol, permisos }] }.
// El servidor revisa cada cambio contra los permisos; la app además esconde lo que no se puede usar.
const cuentasOn = () => !!S?.ajustes?.cuentas;
const miTienda = () => meta.cuenta?.tiendas?.find(t => t.tienda === meta.tienda?.id) || null;
const puede = k => !cuentasOn() || !!miTienda()?.permisos?.[k];
const necesitaEntrar = () => !meta.demo && !!meta.tienda && (cuentasOn() || Sync.state.status === "cuenta") && (!miTienda() || Sync.state.status === "cuenta");
const ROLES = { dueno:"Dueño", encargado:"Encargado", vendedor:"Vendedor" };
const PERMISOS = { precios:"Cambiar productos, precios y ofertas", costos:"Ver costos, ganancias y proveedores", inventario:"Contar, recibir mercadería y vencimientos", reportes:"Ver el resumen de ventas y el historial", config:"Cambiar ajustes, extensiones, apariencia y la página" };
async function cuentaApi(base, path, body, token){
  const h = { "Content-Type":"application/json" }; if (token) h.Authorization = token;
  let r; try { r = await fetch(base.replace(/\/+$/, "") + path, body ? { method:"POST", headers:h, body:JSON.stringify(body) } : { headers:h, cache:"no-store" }); }
  catch(e){ throw new Error("No hay conexión con el servidor. Para esto se necesita estar conectado."); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.message || `El servidor respondió ${r.status}`), { status:r.status });
  return j;
}
// Cerrar sesión para que entre otra persona en este dispositivo (en Cuentas y en Más > Configuración)
function cerrarSesion(){
  const salir = () => run(async () => { await guardarCuenta(null); closeModal(); render(); });
  const pend = meta.pending ? `<p class="small" style="margin:0;color:var(--warn);font-weight:600">Este dispositivo tiene ${meta.pending} cambios que todavía no llegan al servidor. Se van a enviar con el usuario que entre después, y si no tiene permiso para alguno, ese cambio se pierde.</p>` : "";
  openModal(`<div class="stack"><h2>¿Cerrar sesión?</h2><p style="margin:0">Sales de la cuenta de ${esc(meta.cuenta?.usuario?.nombre || "")} y vuelve la pantalla para entrar con usuario y contraseña.</p>${pend}
    <div class="grid2"><button class="btn" data-close>${meta.pending ? "Esperar" : "Cancelar"}</button><button class="btn primary" id="csok">Cerrar sesión</button></div></div>`);
  $("#csok").onclick = salir;
}
const api = (path, body) => cuentaApi(meta.servidor, path, body, meta.cuenta?.token);
const entrar = (base, usuario, password) => cuentaApi(base, "/api/cuentas/entrar", { usuario, password });
async function guardarCuenta(c){
  const veiaCostos = !!miTienda()?.permisos?.costos;
  meta.cuenta = c; await LocalDB.setMeta("cuenta", c); Sync.state.token = c?.token || "";
  // Sin el permiso, el servidor manda todo sin costos: quien recién lo tiene vuelve a pedir todo
  if (!veiaCostos && miTienda()?.permisos?.costos) await Sync.pedirTodo();
}
// Renueva la sesión y los permisos cuando hay conexión
async function refrescarCuenta(){
  if (!meta.cuenta?.token || !meta.servidor) return;
  try { await guardarCuenta(await api("/api/cuentas/yo")); if (MODE && !document.querySelector(".overlay")) softRender(); } catch(e){}
}

function showLogin(){
  const quitado = meta.cuenta && Sync.state.status === "cuenta";
  gate(`${gateHead()}<div class="stack">
    <div class="card stack"><h2>${esc(S?.ajustes?.tienda_nombre || meta.tienda?.nombre || "Tu tienda")}</h2>
      <p class="small muted" style="margin:0">${quitado ? esc(Sync.state.error || "Tu sesión terminó.") + " Vuelve a entrar." : "Esta tienda usa cuentas. Entra con tu usuario y contraseña."}</p>
      <div class="field"><label for="luser">Usuario</label><input class="input" id="luser" autocapitalize="none" autocomplete="username" value="${esc(meta.cuenta?.usuario?.usuario || "")}"></div>
      <div class="field"><label for="lpass">Contraseña</label><input class="input" id="lpass" type="password" autocomplete="current-password"></div>
      <button class="btn primary block" id="lgo">Entrar</button>
      ${meta.pending ? `<p class="small muted" style="margin:0">Hay ${meta.pending} cambios guardados en este dispositivo. Se envían al entrar.</p>` : ""}
    </div>
    <button class="btn ghost block" id="lwipe">Borrar este dispositivo y usar otra tienda</button>
  </div>`);
  const go = () => run(async () => {
    const s = await entrar(meta.servidor, $("#luser").value, $("#lpass").value);
    if (!s.tiendas.some(t => t.tienda === meta.tienda.id)) return toast("Tu usuario no tiene acceso a esta tienda");
    await guardarCuenta(s); Sync.state.status = "off"; ui.view = "inicio"; await openStore(); toast(`Hola, ${s.usuario.nombre}`);
  });
  $("#lgo").onclick = go; $("#lpass").onkeydown = e => { if (e.key === "Enter") go(); };
  $("#lwipe").onclick = () => confirmWipe(showSetup);
  setTimeout(() => { if (document.activeElement === document.body) $(meta.cuenta ? "#lpass" : "#luser")?.focus(); }, 50);
}

function viewCuentas(){
  const yo = meta.cuenta, t = miTienda();
  if (!cuentasOn()) return `${header("Cuentas y permisos", "Usuario y contraseña para cada persona")}
  <div class="stack">
    <div class="card stack">
      <p style="margin:0">Hoy cualquiera con el link de invitación entra a la tienda y puede hacer de todo. Con las cuentas, cada persona entra con su usuario y contraseña, y tú eliges qué puede hacer.</p>
      <ul class="small" style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:4px"><li><b>Vendedor:</b> vende, anota fiados, reservas y encargos, y cierra la caja. Puedes darle permisos extra, como contar o recibir.</li><li><b>Encargado:</b> todo, menos crear cuentas.</li><li><b>Dueño:</b> todo, y administra las cuentas.</li></ul>
      <p class="small muted" style="margin:0">Al activarlas, todos los dispositivos de la tienda van a pedir usuario y contraseña. Se necesita conexión con el servidor.</p>
    </div>
    <div class="card stack"><h3>Tu cuenta de dueño</h3>
      <div class="field"><label for="cnom">Tu nombre</label><input class="input" id="cnom" value="${esc(meta.tienda?.persona || "")}" autocomplete="name"></div>
      <div class="field"><label for="cusr">Usuario</label><input class="input" id="cusr" autocapitalize="none" autocomplete="username" placeholder="Ej: rosa"></div>
      <div class="field"><label for="cpw">Contraseña</label><input class="input" id="cpw" type="password" autocomplete="new-password" placeholder="Al menos 6 caracteres"></div>
      <div class="field"><label for="cpw2">Repite la contraseña</label><input class="input" id="cpw2" type="password" autocomplete="new-password"></div>
      <button class="btn primary block" id="cact">Activar las cuentas</button>
    </div>
  </div>`;
  return `${header("Cuentas y permisos", "Quién entra y qué puede hacer")}
  <div class="stack">
    <div class="card stack"><h3>Tu cuenta</h3>
      <div class="spread"><div><div style="font-weight:700">${esc(yo?.usuario?.nombre || "")}</div><div class="small muted">Usuario ${esc(yo?.usuario?.usuario || "")} · ${esc(ROLES[t?.rol] || "")}</div></div></div>
      <div class="grid2"><button class="btn" id="cclave">Cambiar contraseña</button><button class="btn" id="csalir">Cerrar sesión</button></div>
    </div>
    ${puede("cuentas") ? `<div class="card stack"><div class="spread"><h3>Personas con acceso</h3><button class="btn sm" id="cadd">+ Agregar</button></div>
      <div class="list" id="clist"><div class="empty">Cargando…</div></div>
      <p class="small muted" style="margin:0">Para que alguien entre desde otro celular: abre la app en ese celular, toca "Entrar con mi usuario" y escribe su usuario y contraseña.</p></div>` : ""}
  </div>`;
}
const PERM_CORTO = { precios:"precios", costos:"costos", inventario:"inventario", reportes:"reportes", config:"ajustes" };
const permTxt = m => m.rol === "vendedor" ? "vende" + Object.keys(PERMISOS).filter(k => m.permisos?.[k]).map(k => " · " + PERM_CORTO[k]).join("") : m.rol === "dueno" ? "todo y las cuentas" : "todo menos las cuentas";
function bindCuentas(app){
  if (!cuentasOn()){
    $("#cact").onclick = () => run(async () => {
      const nombre = $("#cnom").value.trim(), usuario = $("#cusr").value.trim(), pw = $("#cpw").value;
      if (!nombre) return $("#cnom").focus(); if (!usuario) return $("#cusr").focus();
      if (pw !== $("#cpw2").value) return toast("Las contraseñas no son iguales");
      await Sync.syncNow();
      const s = await api("/api/cuentas/activar", { tienda:meta.tienda.id, nombre, usuario, password:pw });
      await guardarCuenta(s);
      await act.put("personas", [{ id:s.usuario.id, nombre:s.usuario.nombre, activo:true }]);
      await act.setting("cuentas", true);
      render(); toast("Cuentas activadas. Ahora agrega a quienes atienden.");
    });
    return;
  }
  $("#csalir").onclick = cerrarSesion;
  $("#cclave").onclick = () => { openModal(`<div class="stack"><div class="spread"><h2>Cambiar contraseña</h2><button class="btn ghost sm" data-close>Cerrar</button></div>
      <div class="field"><label for="ka">Contraseña actual</label><input class="input" id="ka" type="password" autocomplete="current-password"></div>
      <div class="field"><label for="kn">Contraseña nueva</label><input class="input" id="kn" type="password" autocomplete="new-password" placeholder="Al menos 6 caracteres"></div>
      <button class="btn primary block" id="kok">Guardar</button></div>`);
    $("#kok").onclick = () => run(async () => { await guardarCuenta(await api("/api/cuentas/clave", { actual:$("#ka").value, nueva:$("#kn").value })); closeModal(); toast("Contraseña cambiada"); }); };
  if (!puede("cuentas")) return;
  const pintar = ms => { const l = $("#clist"); if (!l) return;
    l.innerHTML = ms.map(m => `<button class="item tap" data-cm="${esc(m.id)}"><div class="main"><div class="name">${esc(m.nombre)}${m.usuarioId === meta.cuenta.usuario.id ? ` <span class="small muted">· tú</span>` : ""}</div><div class="sub">${esc(m.usuario)} · ${esc(permTxt(m))}</div></div>
      ${m.activo ? `<span class="pill ${m.rol === "vendedor" ? "none" : "ok"}">${ROLES[m.rol]}</span>` : `<span class="pill bad">Sin acceso</span>`}</button>`).join("");
    l.querySelectorAll("[data-cm]").forEach(b => b.onclick = () => openMiembro(ms.find(m => m.id === b.dataset.cm))); };
  api(`/api/cuentas/miembros?tienda=${meta.tienda.id}`).then(r => { ui.miembros = r.miembros; pintar(r.miembros); }, e => { const l = $("#clist"); if (l) l.innerHTML = `<div class="empty">${esc(e.message)}</div>`; });
  $("#cadd").onclick = () => openMiembro(null);
}
// Crear o cambiar a una persona: rol, permisos extra, contraseña y acceso
function openMiembro(m){
  const nuevo = !m, rol0 = m?.rol || "vendedor", extra = m?.extra || {};
  openModal(`<div class="stack">
    <div class="spread"><h2>${nuevo ? "Agregar persona" : esc(m.nombre)}</h2><button class="btn ghost sm" data-close>Cerrar</button></div>
    ${nuevo ? `<div class="field"><label for="mnom">Nombre</label><input class="input" id="mnom" placeholder="Ej: Pedro"></div>
    <div class="field"><label for="musr">Usuario</label><input class="input" id="musr" autocapitalize="none" autocomplete="off" placeholder="Ej: pedro"></div>` : `<p class="small muted" style="margin:0">Usuario: ${esc(m.usuario)}</p>`}
    <div class="field"><label for="mpw">${nuevo ? "Contraseña" : "Contraseña nueva (opcional)"}</label><input class="input" id="mpw" type="text" autocomplete="off" placeholder="Al menos 6 caracteres"></div>
    <div class="field"><label>Rol</label><div class="seg" role="group">${Object.entries(ROLES).map(([k, v]) => `<button data-mrol="${esc(k)}" aria-pressed="${k === rol0}">${v}</button>`).join("")}</div></div>
    <div class="stack" id="mperm" style="gap:8px" ${rol0 === "vendedor" ? "" : "hidden"}><div class="small" style="font-weight:600">Además de vender, puede:</div>
      ${Object.entries(PERMISOS).map(([k, v]) => `<label class="row small"><input type="checkbox" data-mp="${esc(k)}" ${extra[k] ? "checked" : ""}> ${esc(v)}</label>`).join("")}</div>
    <button class="btn primary block" id="msave">${nuevo ? "Crear usuario" : "Guardar cambios"}</button>
    ${nuevo ? `<p class="small muted" style="margin:0">Después dale a esa persona su usuario y contraseña. Puede cambiar la contraseña desde su celular.</p>`
      : m.usuarioId === meta.cuenta.usuario.id ? "" : `<button class="btn ghost block" id="macc" style="${m.activo ? "color:var(--bad)" : ""}">${m.activo ? "Quitarle el acceso" : "Devolverle el acceso"}</button>`}
  </div>`);
  let rol = rol0;
  document.querySelectorAll("[data-mrol]").forEach(b => b.onclick = () => { rol = b.dataset.mrol; document.querySelectorAll("[data-mrol]").forEach(x => x.setAttribute("aria-pressed", x === b)); $("#mperm").hidden = rol !== "vendedor"; });
  const permisos = () => Object.fromEntries([...document.querySelectorAll("[data-mp]")].filter(i => i.checked).map(i => [i.dataset.mp, true]));
  const listo = msg => { closeModal(); render(); toast(msg); };
  $("#msave").onclick = () => run(async () => {
    const pw = $("#mpw").value;
    if (nuevo){ const nombre = $("#mnom").value.trim(), usuario = $("#musr").value.trim(); if (!nombre) return $("#mnom").focus(); if (!usuario) return $("#musr").focus();
      const r = await api("/api/cuentas/miembros", { tienda:meta.tienda.id, nombre, usuario, password:pw, rol, permisos:permisos() });
      if (!S.personas.some(x => x.id === r.usuarioId)) await act.put("personas", [{ id:r.usuarioId, nombre:r.nombre, activo:true }]);
      return listo(`${r.nombre} ya puede entrar como ${r.usuario}`); }
    await api(`/api/cuentas/miembros/${m.id}`, Object.assign({ tienda:meta.tienda.id, rol, permisos:permisos() }, pw ? { password:pw } : {}));
    if (m.usuarioId === meta.cuenta.usuario.id) await refrescarCuenta();
    listo("Cambios guardados");
  });
  const ac = $("#macc"); if (ac) ac.onclick = () => run(async () => { await api(`/api/cuentas/miembros/${m.id}`, { tienda:meta.tienda.id, activo:!m.activo }); listo(m.activo ? `${m.nombre} ya no puede entrar` : `${m.nombre} puede volver a entrar`); });
}


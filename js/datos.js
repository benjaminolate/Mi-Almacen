"use strict";
// Datos de la tienda y del dispositivo, respaldos y pantalla Más.
// ---------- Tienda y datos de este dispositivo ----------
let installEvt = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; if (ui.view === "datos" && MODE) render(); });
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);
const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone:"America/Santiago" }).format(new Date());
// Nombre de archivo sin tildes ni ñ: con ellas, Chromium puede guardar el archivo como "download", sin extensión
const slug = s => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tienda";
let persisted = null;

function viewDatos(){
  const n = (k, one, many) => `${k.toLocaleString("es-CL")} ${k === 1 ? one : many}`;
  const fiados = S.clients.reduce((a, c) => a + c.items.length, 0);
  const install = isStandalone() ? `<p class="small muted" style="margin:0">La app ya está instalada en este dispositivo.</p>`
    : installEvt ? `<button class="btn primary block" id="install">Instalar la app en este dispositivo</button>`
    : isIOS() ? `<p class="small muted" style="margin:0">En iPhone: toca el botón Compartir de Safari y elige "Agregar a pantalla de inicio".</p>`
    : `<p class="small muted" style="margin:0">Abre el menú del navegador (⋮) y elige "Instalar app" o "Agregar a la pantalla principal".</p>`;
  return `<header class="top"><button class="btn sm" data-back>← Regresar</button>${netPill()}</header>
  <div class="stack">
    <h2>Tienda y datos</h2>
    <div class="card stack"><h3>Tienda</h3>
      <div class="field"><label for="tname">Nombre de la tienda</label><div class="searchbar"><input class="input" id="tname" value="${esc(S.ajustes.tienda_nombre || "")}"><button class="btn" id="tsave">Guardar</button></div></div>
      ${meta.tienda?.persona ? `<p class="small muted" style="margin:0">A cargo: ${esc(meta.tienda.persona)}</p>` : ""}
    </div>
    <div class="card stack"><h3>Datos guardados en este dispositivo</h3>
      <div class="list">
        <div class="item"><div class="main"><div class="name">Productos</div></div><div class="qty">${S.products.length}</div></div>
        <div class="item"><div class="main"><div class="name">Ventas, compras y conteos</div></div><div class="qty">${S.movs.length}</div></div>
        <div class="item"><div class="main"><div class="name">Clientes con fiado</div><div class="sub">${n(fiados, "movimiento", "movimientos")}</div></div><div class="qty">${S.clients.length}</div></div>
        <div class="item"><div class="main"><div class="name">Cambios por enviar al servidor</div><div class="sub">${meta.demo ? "Los datos de ejemplo no se envían" : meta.servidor ? "Se envían solos cuando hay conexión con el servidor" : "Quedan guardados aquí hasta que configures un servidor"}</div></div><div class="qty">${meta.pending}</div></div>
      </div>
      <p class="small muted" style="margin:0">${persisted === true ? "✓ El navegador no borrará estos datos aunque le falte espacio." : persisted === false ? "El navegador podría borrar estos datos si le falta espacio. Instalar la app y descargar respaldos lo evita." : ""}</p>
      <p class="small muted" style="margin:0">Todo funciona sin internet. ${meta.servidor ? "Cuando hay conexión, los cambios se juntan con los de los otros dispositivos de la tienda." : "Por ahora los datos están solo en este dispositivo."}</p>
    </div>
    ${meta.demo ? "" : syncCard()}
    <div class="card stack"><h3>Instalar</h3>${install}</div>
    <div class="card stack" data-perm="config"><h3>Respaldo</h3>
      <p class="small muted" style="margin:0">Descarga una copia de todo en un archivo y guárdala en otro lugar (computador, Google Drive o WhatsApp a ti mismo). Conviene hacerlo una vez por semana.</p>
      <button class="btn block" id="backup">Descargar respaldo</button>
      <label class="btn block filebtn">Restaurar desde un respaldo<input type="file" id="restore" accept="application/json,.json" multiple></label>
      ${!meta.demo && meta.servidor ? `<div class="field" style="padding-top:8px"><label for="rcor">Respaldo diario por correo</label><input class="input" id="rcor" type="email" inputmode="email" autocomplete="email" value="${esc(S.ajustes.respaldo_correo || "")}" placeholder="Ej: mitienda.respaldos@gmail.com"></div>
      <div class="grid2"><button class="btn" id="rcsave">Guardar correo</button><button class="btn" id="rctest" ${S.ajustes.respaldo_correo ? "" : "disabled"}>Mandar uno ahora</button></div>
      <p class="small muted" style="margin:0">Cada noche el servidor manda a ese correo un archivo con todo, para que quede una copia fuera del computador del servidor. Si algún día se pierde todo, se restaura aquí con ese archivo. El servidor necesita tener el correo configurado (servidor/INSTRUCCIONES.md).</p>` : ""}
    </div>
    <div class="card stack" data-perm="config"><h3>Borrar todo</h3>
      <p class="small muted" style="margin:0">Borra la tienda y todos sus datos de este dispositivo. Descarga un respaldo antes.</p>
      <button class="btn block" id="wipe" style="color:var(--bad)">Borrar todo de este dispositivo</button>
    </div>
    <p class="small muted" style="margin:0">Dispositivo ${esc(meta.device?.nombre || "")} · código ${esc(meta.device?.id || "")}</p>
  </div>`;
}
// Si la app la sirve el mismo servidor (PocketBase), el link apunta a él, para que sirva
// desde otros dispositivos aunque aquí se haya abierto como "localhost"
const inviteLink = () => { const u = sameOrigin ? new URL(meta.servidor + "/") : new URL(location.pathname, location.origin);
  u.searchParams.set("unirse", meta.tienda.id); u.searchParams.set("servidor", meta.servidor); return u.href; };
function syncCard(){
  const st = Sync.state, on = !!meta.servidor;
  const estado = !on ? "Sin servidor: los datos están solo en este dispositivo."
    : st.status === "ok" ? `✓ Al día con el servidor${st.last ? " · " + ago(st.last) : ""}.`
    : st.status === "syncing" ? "Sincronizando…"
    : st.status === "error" ? `No se pudo conectar: ${esc(st.error)}. Los cambios se guardan aquí y se envían cuando vuelva la conexión.` : "";
  return `<div class="card stack"><h3>Sincronización</h3>
    <p class="small" style="margin:0">${estado}</p>
    <div class="field" data-perm="config"><label for="sserv">Dirección del servidor</label><div class="searchbar"><input class="input code" id="sserv" value="${esc(meta.servidor)}" placeholder="Ej: http://192.168.1.20:8090" autocapitalize="none" inputmode="url"><button class="btn" id="ssave">Guardar</button></div></div>
    ${on ? `<button class="btn block" id="snow">Sincronizar ahora</button>
    <div class="field"><label>Sumar otro celular o computador</label>
      <p class="small muted" style="margin:0">Abre este link en el otro dispositivo ${/^https:/.test(meta.servidor) ? "" : "(tiene que estar en el mismo wifi mientras el servidor esté en tu computador)"}:</p>
      <div class="code">${esc(inviteLink())}</div></div>
    <div class="grid2"><a class="btn" style="text-align:center" href="${esc(waLink("", "Únete a " + (S.ajustes.tienda_nombre || "la tienda") + " en Mi Almacén: " + inviteLink()))}" ${WA_TARGET}>Enviar por WhatsApp</a><button class="btn" id="scopy">Copiar link</button></div>` : ""}
    <p class="small muted" style="margin:0">Código de la tienda: <span class="code">${esc(meta.tienda?.id || "")}</span>. ${cuentasOn() ? "Además del link, cada persona necesita su usuario y contraseña." : "No lo compartas con personas ajenas: es la llave para entrar a los datos. Para más seguridad, activa las cuentas en Más &gt; Cuentas y permisos."}</p>
  </div>`;
}

async function downloadBackup(){
  const file = await LocalDB.exportAll();
  const url = URL.createObjectURL(new Blob([JSON.stringify(file)], { type:"application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = `respaldo-${slug(S.ajustes.tienda_nombre)}-${hoy()}.json`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast(`Respaldo descargado: ${file.tablas.movs.length} movimientos`);
}
async function leerRespaldo(f){
  let data; try { data = JSON.parse(await f.text()); } catch(e){ throw new Error("No se pudo leer el archivo"); }
  if (data?.app !== "mi-almacen") throw new Error("El archivo no es un respaldo de esta app");
  if (!data.tablas || typeof data.tablas !== "object") throw new Error("El respaldo está incompleto o dañado");
  return data;
}
// Un respaldo grande llega por correo en partes: se eligen todas juntas y se arma uno solo
function juntarPartes(lista){
  if (lista.length === 1 && !lista[0].parte) return lista[0];
  const de = lista[0].parte?.de;
  const mismo = lista.every(d => d.parte && d.parte.de === de && d.creado === lista[0].creado && d.tienda?.id === lista[0].tienda?.id);
  if (!mismo) throw new Error("Elige un solo respaldo, o todas las partes del mismo respaldo");
  const n = new Set(lista.map(d => d.parte.n));
  if (lista.length !== de || n.size !== de) throw new Error(`Este respaldo viene en ${de} partes: elige los ${de} archivos juntos`);
  const tablas = {};
  for (const d of lista) for (const [s, filas] of Object.entries(d.tablas)) tablas[s] = [...(tablas[s] || []), ...(Array.isArray(filas) ? filas : [])];
  const { parte, ...base } = lista[0];
  return Object.assign(base, { tablas });
}
async function restoreBackup(input){
  const files = [...(input.files || [])]; input.value = ""; if (!files.length) return;
  const data = juntarPartes(await Promise.all(files.map(leerRespaldo)));
  // Los respaldos que llegan por correo vienen del servidor: traen la tienda, pero no los datos de un dispositivo
  const delServidor = !data.tablas.meta && data.tienda?.id;
  const tiendaMeta = delServidor ? data.tienda : (data.tablas.meta || []).find(m => m.key === "tienda")?.value;
  const tienda = tiendaMeta?.nombre || "la tienda";
  if (MODE){
    const otra = tiendaMeta?.id !== meta.tienda?.id;
    openModal(`<div class="stack"><h2>Restaurar el respaldo</h2>
      <p style="margin:0">Respaldo de <b>${esc(tienda)}</b> del ${esc(new Date(data.creado).toLocaleString("es-CL"))}.</p>
      ${otra ? `<p class="pill warn" style="white-space:normal;margin:0;padding:8px 10px">Este respaldo es de otra tienda. Si agregas sus datos, quedan mezclados con los de esta.</p>` : ""}
      <button class="btn primary block" id="domerge">Agregar lo que falta</button>
      <p class="small muted" style="margin:0">Suma los productos, ventas, fiados y demás que no estén aquí. No borra ni cambia nada de lo que ya tienes.</p>
      <button class="btn block" id="doreplace">Reemplazar todo</button>
      <p class="small muted" style="margin:0">Borra lo de este dispositivo y deja exactamente lo del respaldo.</p>
    </div>`);
    $("#domerge").onclick = () => run(async () => { const faltan = await LocalDB.missing(data); faltan.forEach(o => o.local = meta.demo);
      await commit(faltan); closeModal(); await openStore(); toast(faltan.length ? `Se agregaron ${faltan.length} registros` : "No faltaba nada"); });
    $("#doreplace").onclick = () => run(async () => { await LocalDB.importAll(data); closeModal(); await openStore(); toast("Respaldo restaurado"); });
    return;
  }
  openModal(`<div class="stack"><h2>¿Restaurar el respaldo?</h2>
    <p style="margin:0">Se reemplaza todo lo de este dispositivo por el respaldo de <b>${esc(tienda)}</b> del ${esc(new Date(data.creado).toLocaleString("es-CL"))}: ${(data.tablas.products || []).length} productos y ${(data.tablas.movs || []).length} movimientos.</p>
    <div class="grid2"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="dorestore">Restaurar</button></div></div>`);
  $("#dorestore").onclick = () => run(async () => {
    if (delServidor){
      // Dispositivo nuevo: se crea con la misma tienda y todo entra a la bandeja de salida, para que llegue
      // al servidor que se conecte después (por ejemplo, uno nuevo si se perdió el anterior)
      await LocalDB.wipe(); const device = newDevice(); LocalDB.clock.device = device.id;
      await LocalDB.setMeta("device", device); await LocalDB.setMeta("demo", false);
      await LocalDB.setMeta("tienda", { id:data.tienda.id, nombre:data.tienda.nombre, persona:"", restaurada:Date.now() });
      await LocalDB.apply(await LocalDB.missing(data));
    } else await LocalDB.importAll(data);
    closeModal(); await openStore(); toast("Respaldo restaurado"); });
}
function confirmWipe(after){
  openModal(`<div class="stack"><h2>¿Borrar todo?</h2>
    <p style="margin:0">${meta.demo ? "Se borran los datos de ejemplo y puedes crear tu tienda." : "Se borran la tienda, los productos, las ventas y los fiados de este dispositivo. No se puede deshacer."}</p>
    ${meta.demo ? "" : `<div class="field"><label for="wconf">Escribe BORRAR para confirmar</label><input class="input" id="wconf" autocomplete="off"></div>`}
    <div class="grid2"><button class="btn" data-close>Cancelar</button><button class="btn primary" id="dowipe">Borrar</button></div></div>`);
  $("#dowipe").onclick = () => run(async () => {
    if (!meta.demo && $("#wconf").value.trim().toUpperCase() !== "BORRAR") return $("#wconf").focus();
    Sync.stop(); await LocalDB.wipe(); closeModal(); ui.view = "inicio"; ui.cart = []; ui.recv.items = []; ui.draft = {}; ui.lastSale = null; after(); });
}

function viewMas(){
  const pend = S.reservas.filter(r => !r.done && r.estado !== "rechazada").length;
  const opt = (go, icon, title, sub) => VIEW_PERM[go] && !puede(VIEW_PERM[go]) ? "" : `<button class="sector" data-go="${esc(go)}"><span class="name" style="display:flex;gap:10px;align-items:center"><span style="width:22px;height:22px;display:inline-flex" class="mi">${ICONS[icon]}</span>${title}</span><span></span><span class="sub">${sub}</span></button>`;
  const sec = (t, items) => { const h = items.filter(Boolean).join(""); return h ? `<h3 style="margin-top:8px">${t}</h3>${h}` : ""; };
  return `${header("Más", "Otras herramientas")}
  <div class="stack">
    ${sec("Logística", [
      ext("recibir") && opt("recibir","recibir","Recibir mercadería","Registrar lo que llega del proveedor"),
      ext("compras") && opt("compras","compras","Lista de compras","Lo que está por acabarse, para pedir al proveedor"),
      ext("proveedores") && opt("proveedores","proveedores","Proveedores","Días de visita y lo que les debes"),
      ext("vencimientos") && opt("vencimientos","vencimientos","Vencimientos","Lo que vence pronto"),
      ext("ofertas") && opt("ofertas","ofertas","Ofertas y packs", `${S.ofertas.filter(o => ofertaVigente(o)).length} activas ahora`),
      ext("caja") && opt("caja","caja","Cierre de caja","Compara lo vendido con lo que hay en la caja"),
      opt("resumen","resumen","Resumen de ventas","Hoy, semana, mes y año, ganancia y descarga en Excel"),
      opt("historial","historial","Historial","Todo lo que entra, sale y se cuenta")])}
    ${sec("Clientes y pan", [
      ext("encargos") && opt("encargos","encargos","Encargos", `${S.encargos.filter(e => e.estado !== "entregado").length} por entregar`),
      ext("pan") && `<button class="sector" id="panbtn"><span class="name" style="display:flex;gap:10px;align-items:center"><span style="width:22px;height:22px;display:inline-flex" class="mi">${ICONS.pan}</span>Avisar que llegó el pan</span><span></span><span class="sub">Mensaje al grupo de WhatsApp de clientes</span></button>`,
      extOn(["pan","pagina"]) && opt("reservas","reservas", ext("pan") ? "Reservas de pan" : "Reservas", `${pend} por entregar${webNuevas().length ? ` · ${webNuevas().length} nuevas por internet` : ""}`),
      ext("pagina") && opt("pagina","pagina","Página de la tienda", pub().activo ? "Activa · link, código QR y reservas" : "Link y código QR para tus clientes"),
      ext("pan") && opt("tipospan","pan","Tipos de pan", "Precios, por unidad o por kilo, botones rápidos y reservas")])}
    ${sec("Configuración", [
      ext("personas") && opt("personas","personas","Quién atiende", quien() ? "Ahora atiende " + esc(nombrePersona(quien())) : "Elige quién atiende en este dispositivo"),
      `<button class="sector" id="tourbtn"><span class="name" style="display:flex;gap:10px;align-items:center"><span style="width:22px;height:22px;display:inline-flex" class="mi">${ICONS.ayuda}</span>Tutorial</span><span></span><span class="sub">Un recorrido corto por la app</span></button>`,
      meta.servidor && !meta.demo && opt("cuentas","personas","Cuentas y permisos", cuentasOn() ? `Entraste como ${esc(meta.cuenta?.usuario?.nombre || "")}` : "Usuario y contraseña para cada persona que atiende"),
      opt("extensiones","extensiones","Extensiones", "Activa solo las funciones que usa tu negocio"),
      opt("apariencia","apariencia","Apariencia", "Colores, estilo y tipo de letra"),
      opt("datos","datos","Tienda y datos", `${meta.pending} cambios guardados en este dispositivo · respaldo e instalación`),
      cuentasOn() && meta.cuenta && `<button class="sector" id="logout"><span class="name" style="display:flex;gap:10px;align-items:center"><span style="width:22px;height:22px;display:inline-flex" class="mi">${ICONS.personas}</span>Cerrar sesión</span><span></span><span class="sub">Estás como ${esc(meta.cuenta.usuario.nombre)} · para que entre otra persona en este dispositivo</span></button>`])}
  </div>`;
}

"use strict";
// Extensiones y apariencia.
// ---------- Extensiones: cada tienda activa solo lo que usa ----------
// Vender, productos, historial y los datos de la tienda siempre están. Lo demás se
// activa o se quita en Más > Extensiones, y se guarda para todos los dispositivos de la tienda.
// def: si viene activada al crear una tienda nueva
const EXTENSIONES = [
  { id:"contar", grupo:"Inventario", def:true, nombre:"Conteo por sectores", desc:"Contar el inventario de a un sector por día y ver las diferencias con lo que esperaba el sistema." },
  { id:"recibir", grupo:"Inventario", def:true, nombre:"Recibir mercadería", desc:"Anotar lo que llega del proveedor, con cantidad y costo." },
  { id:"compras", grupo:"Inventario", def:true, nombre:"Stock bajo y lista de compras", desc:"Junta lo que está por acabarse y arma el pedido para cada proveedor, listo para mandar por WhatsApp." },
  { id:"vencimientos", grupo:"Inventario", def:false, nombre:"Vencimientos", desc:"Anotar la fecha de vencimiento al recibir y ver lo que vence esta semana, para venderlo antes o sacarlo." },
  { id:"proveedores", grupo:"Inventario", def:false, nombre:"Proveedores", desc:"Quién trae qué, qué día pasa y cuánto le debes a cada uno." },
  { id:"granel", grupo:"Inventario", def:false, nombre:"Venta a granel", desc:"Productos que se venden por kilo o por gramos (pan, fiambre, verdura), con precio por kilo." },
  { id:"caja", grupo:"Ventas", def:false, nombre:"Cierre de caja", desc:"Anotar si pagan en efectivo, tarjeta o transferencia, calcular el vuelto y comparar al final del día lo vendido con lo que hay en la caja." },
  { id:"ofertas", grupo:"Ventas", def:false, nombre:"Ofertas y packs", desc:"Precios como \"3 por $1.000\" o descuentos por día y horario, que se aplican solos al vender." },
  { id:"comprobante", grupo:"Ventas", def:false, nombre:"Comprobante de venta", desc:"Mandar el detalle de la compra por WhatsApp o imprimirlo. No reemplaza la boleta del SII." },
  { id:"personas", grupo:"Ventas", def:false, nombre:"Quién atiende", desc:"Cada persona que atiende elige su nombre y queda registrado quién vendió, recibió o contó." },
  { id:"fiados", grupo:"Clientes", def:true, nombre:"Fiados", desc:"Cuaderno de cuentas por cliente, con pagos y recordatorio por WhatsApp." },
  { id:"pan", grupo:"Clientes", def:false, nombre:"Pan: aviso y reservas", desc:"Botón para avisar al grupo de WhatsApp que llegó el pan, y lista de reservas de pan." },
  { id:"pagina", grupo:"Clientes", def:false, nombre:"Página de la tienda", desc:"Una página con tus productos y precios para compartir con un código QR, donde los clientes pueden reservar. Necesita el servidor conectado a internet." },
  { id:"encargos", grupo:"Clientes", def:false, nombre:"Encargos y pedidos", desc:"Pedidos para otro día (tortas, gas, pedidos especiales) con abono y aviso por WhatsApp cuando están listos." }
];
const GRUPOS_EXT = ["Inventario","Ventas","Clientes"];
// Lista de interruptores agrupada; attr es el atributo que identifica cada uno, on(e) dice si está prendido
const extSwitches = (attr, on) => GRUPOS_EXT.map(g => `<h3 class="ext-g">${g}</h3>${EXTENSIONES.filter(e => e.grupo === g).map(e => `<label class="ext"><span class="name" style="font-weight:700">${esc(e.nombre)}</span>
  <span class="switch"><input type="checkbox" ${attr}="${e.id}" ${on(e) ? "checked" : ""} aria-label="${esc(e.nombre)}"><span></span></span>
  <span class="sub">${esc(e.desc)}</span></label>`).join("")}`).join("");
// Las tiendas creadas antes de las extensiones tienen todo activado
const ext = id => (S?.ajustes?.extensiones || {})[id] !== false;
// Una pantalla que sirve a varias extensiones se muestra si cualquiera está activa
const extOn = x => [].concat(x).some(ext);

function viewExtensiones(){
  return `<header class="top"><button class="btn sm" data-back>← Regresar</button>${netPill()}</header>
  <div class="stack">
    <div><h2>Extensiones</h2><p class="small muted" style="margin:4px 0 0">Activa solo lo que usa tu negocio. Lo que quites desaparece de las pantallas, pero sus datos no se borran: si la vuelves a activar, todo sigue ahí. El cambio se aplica en todos los dispositivos de la tienda.</p></div>
    <div class="card" style="padding-block:4px 0">${extSwitches("data-ext", e => ext(e.id))}</div>
    <p class="small muted" style="margin:0">Siempre incluidos: vender, productos con escáner de códigos, historial, respaldo y sincronización.</p>
  </div>`;
}
async function setExtension(id, on){
  const v = Object.assign({}, S.ajustes.extensiones || {}, { [id]:on });
  await act.setting("extensiones", v);
}

// ---------- Apariencia ----------
// Colores, estilo y tipo de letra: se guardan para toda la tienda.
// Modo claro u oscuro y tamaño de letra: solo para este dispositivo.
const PALETAS = {
  verde:    { nombre:"Verde almacén", brand:"#1f5c3d", accent:"#e0a526", brandD:"#5fb487", accentD:"#f0bd4f" },
  azul:     { nombre:"Azul mar",      brand:"#1d4e89", accent:"#f2a541", brandD:"#6ea8e8", accentD:"#f5b864" },
  terracota:{ nombre:"Terracota",     brand:"#a3482a", accent:"#2f7a73", brandD:"#e5906f", accentD:"#6cc0b8" },
  morado:   { nombre:"Morado",        brand:"#5b3b8c", accent:"#e6a23c", brandD:"#ab8de2", accentD:"#f0bd4f" },
  rosado:   { nombre:"Panadería",     brand:"#9c3360", accent:"#c98a2b", brandD:"#ec8fb4", accentD:"#e8b35a" },
  grafito:  { nombre:"Grafito",       brand:"#2d3436", accent:"#d35400", brandD:"#c3ccd0", accentD:"#f0894d" }
};
const ESTILOS = { redondeado:"Redondeado", suave:"Suave", recto:"Recto" };
const FUENTES = { moderna:"Original", redondeada:"Redondeada", clasica:"Con serifa", legible:"Fácil de leer", simple:"Simple" };
// Letras que se descargan solo si alguien las elige
const FUENTES_CSS = { redondeada:"https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap",
  legible:"https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap" };
const FUENTE_MUESTRA = { moderna:'"Bricolage Grotesque"', redondeada:'"Nunito"', clasica:"Georgia,serif", legible:'"Atkinson Hyperlegible"', simple:"system-ui" };
const APARIENCIA_ORIGINAL = { paleta:"verde", estilo:"redondeado", fuente:"moderna" };
function cargarFuente(f){ if (!FUENTES_CSS[f] || document.getElementById("font-" + f)) return;
  const l = document.createElement("link"); l.id = "font-" + f; l.rel = "stylesheet"; l.href = FUENTES_CSS[f]; document.head.appendChild(l); }
const MODOS = { auto:"Automático", claro:"Claro", oscuro:"Oscuro" };
const LETRAS = { normal:"Normal", grande:"Grande" };

const hexRgb = h => [1,3,5].map(i => parseInt(h.slice(i, i+2), 16));
const rgbHex = c => "#" + c.map(x => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, "0")).join("");
const mix = (a, b, t) => rgbHex(hexRgb(a).map((x, i) => x + (hexRgb(b)[i] - x) * t));
const apariencia = () => Object.assign({}, APARIENCIA_ORIGINAL, S?.ajustes?.apariencia || {});
const prefs = () => Object.assign({ modo:"auto", letra:"normal" }, meta.prefs || {});
function colores(a){
  if (a.paleta === "propia" && /^#[0-9a-f]{6}$/i.test(a.brand || "") && /^#[0-9a-f]{6}$/i.test(a.accent || ""))
    return { brand:a.brand, accent:a.accent, brandD:mix(a.brand, "#ffffff", .45), accentD:mix(a.accent, "#ffffff", .2) };
  return PALETAS[a.paleta] || PALETAS.verde;
}
function applyTheme(){
  const a = apariencia(), p = prefs(), c = colores(a), root = document.documentElement;
  const vars = (brand, accent, bg) => `--brand:${brand};--brand-fg:${PAGINA.letraSobre(brand)};--accent:${accent};--accent-soft:${mix(accent, bg, .78)};`;
  $("#tema").textContent = `:root{${vars(c.brand, c.accent, "#f4f6f1")}}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${vars(c.brandD, c.accentD, "#121814")}}}
:root[data-theme="dark"]{${vars(c.brandD, c.accentD, "#121814")}}`;
  if (p.modo === "auto") root.removeAttribute("data-theme"); else root.dataset.theme = p.modo === "oscuro" ? "dark" : "light";
  root.dataset.estilo = a.estilo; root.dataset.fuente = a.fuente; root.dataset.letra = p.letra; cargarFuente(a.fuente);
  const dark = p.modo === "oscuro" || (p.modo === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#121814" : c.brand);
}
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applyTheme);

function viewApariencia(){
  const a = apariencia(), p = prefs(), c = colores(a);
  const seg = (name, opts, cur) => `<div class="seg" role="group">${Object.entries(opts).map(([k, v]) => `<button data-${name}="${k}" aria-pressed="${k === cur}">${esc(v)}</button>`).join("")}</div>`;
  return `<header class="top"><button class="btn sm" data-back>← Regresar</button>${netPill()}</header>
  <div class="stack">
    <div><h2>Apariencia</h2><p class="small muted" style="margin:4px 0 0">Elige cómo se ve tu sistema. Los cambios se ven al instante.</p></div>
    <div class="card stack"><h3>Colores</h3>
      <div class="swatches">${Object.entries(PALETAS).map(([k, v]) => `<button class="swatch" data-paleta="${esc(k)}" aria-pressed="${a.paleta === k}"><i><b style="background:${v.brand}"></b><b style="background:${v.accent}"></b></i>${esc(v.nombre)}</button>`).join("")}
        <button class="swatch" data-paleta="propia" aria-pressed="${a.paleta === "propia"}"><i><b style="background:${a.brand || c.brand}"></b><b style="background:${a.accent || c.accent}"></b></i>Mis colores</button></div>
      ${a.paleta === "propia" ? `<div class="grid2">
        <div class="field"><label for="cbrand">Color principal</label><input class="input" type="color" id="cbrand" value="${esc(a.brand || c.brand)}" style="height:44px;padding:4px"></div>
        <div class="field"><label for="caccent">Color de acento</label><input class="input" type="color" id="caccent" value="${esc(a.accent || c.accent)}" style="height:44px;padding:4px"></div></div>` : ""}
    </div>
    <div class="card stack"><h3>Estilo</h3>${seg("estilo", ESTILOS, a.estilo)}
      <p class="small muted" style="margin:0">Redondeado es el de siempre; Suave tiene esquinas más curvas y tarjetas con sombra; Recto tiene esquinas rectas.</p></div>
    <div class="card stack"><h3>Tipo de letra</h3><div class="seg wrap" role="group">${Object.entries(FUENTES).map(([k, v]) => `<button data-fuente="${esc(k)}" aria-pressed="${k === a.fuente}" style="font-family:${FUENTE_MUESTRA[k]}">${esc(v)}</button>`).join("")}</div>
      <p class="small muted" style="margin:0">Original, Redondeada y Fácil de leer cambian toda la letra; Con serifa y Simple cambian los títulos.</p></div>
    <div class="card stack"><h3>En este dispositivo</h3>
      <div class="field"><label>Modo</label>${seg("modo", MODOS, p.modo)}</div>
      <div class="field"><label>Tamaño de letra</label>${seg("letra", LETRAS, p.letra)}</div>
      <p class="small muted" style="margin:0">Estos dos cambian solo aquí. Los colores, el estilo y la letra cambian en todos los dispositivos de la tienda.</p></div>
    <div class="card stack"><h3>Vista previa</h3>
      <div class="row"><span class="pill ok">12 en stock</span><span class="pill warn">Quedan 2</span><span class="pill bad">Agotado</span></div>
      <div class="grid2"><button class="btn primary">Confirmar venta</button><button class="btn accent">Escanear</button></div></div>
    <button class="btn block" id="aporig">Volver a la apariencia original</button>
  </div>`;
}
async function setApariencia(cambio){
  const v = Object.assign(apariencia(), cambio);
  S.ajustes.apariencia = v; applyTheme();
  await act.setting("apariencia", v);
}
async function setPref(cambio){
  meta.prefs = Object.assign(prefs(), cambio); applyTheme();
  await LocalDB.setMeta("prefs", meta.prefs);
}


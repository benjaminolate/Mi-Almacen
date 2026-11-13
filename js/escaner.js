"use strict";
// Escaneo de códigos de barras, precio de un producto nuevo y sumar un catálogo.
// ---------- Escaneo de códigos de barras ----------
async function decodeFile(file){
  if ("BarcodeDetector" in window){
    try { const bd = new BarcodeDetector({ formats:["ean_13","ean_8","upc_a","upc_e","code_128","code_39"] });
      const bmp = await createImageBitmap(file); const r = await bd.detect(bmp); if (r.length) return r[0].rawValue; } catch(e){}
  }
  if (!window.ZXing) return null;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    return zxingDecode(img, img.width, img.height, 1400, true);
  } catch(e){ return null; } finally { URL.revokeObjectURL(url); }
}
const zxCanvas = document.createElement("canvas");
function zxingDecode(src, sw, sh, maxSide, hard){
  if (!window.ZXing || !sw || !sh) return null;
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const w = Math.round(sw*scale), h = Math.round(sh*scale);
  zxCanvas.width = w; zxCanvas.height = h;
  const cx = zxCanvas.getContext("2d", { willReadFrequently:true }); cx.drawImage(src, 0, 0, w, h);
  const px = cx.getImageData(0, 0, w, h).data, lum = new Uint8ClampedArray(w*h);
  for (let i = 0; i < w*h; i++) lum[i] = (px[i*4]*299 + px[i*4+1]*587 + px[i*4+2]*114) / 1000;
  const hints = new Map(); if (hard) hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
  const reader = new ZXing.MultiFormatReader(); reader.setHints(hints);
  const tryDecode = s => { try { return reader.decode(new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(s))).getText(); } catch(e){ return null; } };
  const lsrc = new ZXing.RGBLuminanceSource(lum, w, h);
  return tryDecode(lsrc) || (hard && lsrc.isRotateSupported && lsrc.isRotateSupported() ? tryDecode(lsrc.rotateCounterClockwise()) : null);
}

// Cámara en vivo: funciona cuando la página se abre como sitio propio (https). Dentro de un visor que bloquea la cámara, se usa la foto.
let live = null;
function stopLive(){ if (!live) return; live.stop = true; live.stream?.getTracks().forEach(t => t.stop()); live = null; }
async function startLive(cb){
  stopLive();
  const box = $("#liveBox"); if (!box) return;
  if (!navigator.mediaDevices?.getUserMedia){ box.hidden = true; return; }
  const me = live = { stop:false, stream:null };
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:{ ideal:"environment" }, width:{ ideal:1280 }, height:{ ideal:720 } }, audio:false });
    if (me.stop){ stream.getTracks().forEach(t => t.stop()); return; }
    me.stream = stream;
    const v = $("#liveVideo"); v.srcObject = stream; await v.play().catch(() => {});
    box.hidden = false; $("#liveMsg").textContent = "Apunta al código de barras";
    let bd = null;
    if ("BarcodeDetector" in window){ try { bd = new BarcodeDetector({ formats:["ean_13","ean_8","upc_a","upc_e","code_128","code_39"] }); } catch(e){} }
    const tick = async () => {
      if (me.stop) return;
      let code = null;
      try {
        if (v.readyState >= 2){
          if (bd){ const r = await bd.detect(v); if (r.length) code = r[0].rawValue; }
          else code = zxingDecode(v, v.videoWidth, v.videoHeight, 800, false);
        }
      } catch(e){}
      if (me.stop) return;
      if (code){ if (navigator.vibrate) try { navigator.vibrate(80); } catch(e){} stopLive(); handleCode(code, cb); return; }
      setTimeout(tick, bd ? 150 : 250);
    };
    tick();
  } catch(e){
    if (live === me) live = null;
    box.hidden = true;
    const note = $("#liveNote"); if (note) note.hidden = false;
  }
}
async function handleFile(input, cb){
  const f = input.files && input.files[0]; if (!f) return;
  toast("Leyendo código…");
  const code = await decodeFile(f);
  if (!code){ openScanSheet(cb, "No se pudo leer el código en la foto. Intenta acercarte más, con buena luz y el código derecho, o escríbelo a mano."); return; }
  handleCode(code, cb);
}
function handleCode(code, cb){
  code = String(code).trim(); if (!code) return;
  const p = S.products.find(p => p.barcode === code);
  if (p){ closeModal(); cb(p); return; }
  openAssociate(code, cb);
}
function openScanSheet(cb, error){
  openModal(`<div class="stack">
    <div class="spread"><h2>Escanear producto</h2><button class="btn ghost sm" data-close>Cerrar</button></div>
    ${error ? `<div class="pill bad" style="white-space:normal;padding:8px 10px">${esc(error)}</div>` : ""}
    <div id="liveBox" class="livebox" hidden><video id="liveVideo" playsinline muted></video><div class="liveline"></div><div class="livemsg" id="liveMsg">Abriendo cámara…</div></div>
    <p id="liveNote" class="small muted" hidden style="margin:0">La cámara en vivo no está disponible en esta vista. Funciona cuando la demo se abre como página propia en el navegador. Mientras tanto, usa una foto o escribe el código.</p>
    <label class="btn primary block filebtn">Sacar foto al código de barras<input type="file" id="scanCam" accept="image/*" capture="environment"></label>
    <label class="btn block filebtn">Elegir una foto ya tomada<input type="file" id="scanPick" accept="image/*"></label>
    <p class="small muted" style="margin:0">Saca la foto de cerca, con buena luz y el código derecho. Si la cámara no se abre, saca la foto con la app de cámara y elígela con el segundo botón.</p>
    <div class="field"><label for="scanCode">O escribe el número del código</label>
      <div class="searchbar"><input class="input code" id="scanCode" inputmode="numeric" placeholder="7801234567890"><button class="btn" id="scanGo">Buscar</button></div></div>
    ${!meta.demo ? "" : `<div class="field"><label>Para probar sin cámara</label>
      <div class="row"><button class="btn sm" data-code="7800000000011">Coca-Cola 1,5 L</button><button class="btn sm" data-code="7800000000028">Coca-Cola 3 L</button><button class="btn sm" data-code="7801234000099">Código nuevo</button></div></div>`}
  </div>`);
  if (!error) startLive(cb); else { const n = $("#liveNote"); if (n && !live) n.hidden = true; }
  $("#scanCam").onchange = e => { stopLive(); handleFile(e.target, cb); };
  $("#scanPick").onchange = e => handleFile(e.target, cb);
  $("#scanGo").onclick = () => handleCode($("#scanCode").value, cb);
  $("#scanCode").onkeydown = e => { if (e.key === "Enter") handleCode(e.target.value, cb); };
  document.querySelectorAll("[data-code]").forEach(b => b.onclick = () => handleCode(b.dataset.code, cb));
}
function openAssociate(code, cb){
  const render = q => {
    const r = buscar(q || " ", S.products.filter(p => !p.barcode)), items = (q.trim() ? [...r.exactos, ...r.parecidos] : S.products.filter(p => !p.barcode)).slice(0, 8);
    return items.map(p => `<button class="item tap" data-pid="${esc(p.id)}"><div class="main"><div class="name">${esc(p.name)}</div><div class="sub">${esc(p.cat)}</div></div><span class="btn sm">Es este</span></button>`).join("") || `<div class="empty">No hay coincidencias. Créalo como producto nuevo.</div>`;
  };
  openModal(`<div class="stack">
    <div class="spread"><h2>Código nuevo</h2><button class="btn ghost sm" data-close>Cerrar</button></div>
    <p style="margin:0">El código <span class="code">${esc(code)}</span> todavía no está asociado a ningún producto. Elige cuál es y desde ahora se reconocerá solo.</p>
    <input class="input" id="assocQ" placeholder="Buscar en el catálogo, ej: lentejas">
    <div class="list" id="assocList">${render("")}</div>
    <button class="btn block" id="assocNew">+ Crear producto nuevo con este código</button>
  </div>`);
  const bind = () => document.querySelectorAll("#assocList [data-pid]").forEach(b => b.onclick = () => run(async () => {
    const p = await act.updateProduct(P(b.dataset.pid), { barcode:code }); closeModal(); toast(`Código asociado a ${p.name}`); cb(p); }));
  bind();
  $("#assocQ").oninput = e => { $("#assocList").innerHTML = render(e.target.value); bind(); };
  $("#assocNew").onclick = () => openProductForm(null, code, cb);
}

// Producto sin precio: se pregunta la primera vez que se vende y queda guardado
function openPrecio(p, then){
  if (!puede("precios")) return openModal(`<div class="stack"><div class="spread"><h2>${esc(p.name)}</h2><button class="btn ghost sm" data-close>Cerrar</button></div>
    <p style="margin:0">Este producto todavía no tiene precio y tu usuario no puede ponérselo. Pídele a quien administra la tienda que lo agregue.</p><button class="btn block" data-close>Entendido</button></div>`);
  openModal(`<div class="stack">
    <div class="spread"><h2>${esc(p.name)}</h2><button class="btn ghost sm" data-close>Cerrar</button></div>
    <p style="margin:0">Este producto todavía no tiene precio. ¿A cuánto lo vendes${p.kg ? " el kilo" : ""}?</p>
    <input class="input" id="ppr" type="number" min="1" inputmode="numeric" placeholder="Ej: 1990" style="font-size:22px;font-weight:700;text-align:center">
    <button class="btn primary block" id="pprok">Guardar precio y seguir</button>
    <p class="small muted" style="margin:0">Queda guardado para las próximas ventas. Lo puedes cambiar en Productos.</p>
  </div>`);
  const ok = () => run(async () => { const v = Math.round(+$("#ppr").value || 0); if (v <= 0) return $("#ppr").focus();
    await act.updateProduct(p, { price:v }); closeModal(); toast(`${p.name}: ${clp(v)}`); then(); });
  $("#pprok").onclick = ok; $("#ppr").onkeydown = e => { if (e.key === "Enter") ok(); }; setTimeout(() => $("#ppr")?.focus(), 50);
}
// Sumar a una tienda que ya existe los productos de un catálogo que todavía no tiene
function openSumarCatalogo(){
  openModal(`<div class="stack">
    <div class="spread"><h2>Sumar productos</h2><button class="btn ghost sm" data-close>Cerrar</button></div>
    <p class="small muted" style="margin:0">Se agregan solo los que todavía no están (se comparan por nombre). Vienen sin precio y los que no vendas los puedes apagar.</p>
    ${Object.entries(NEGOCIOS).filter(([k]) => k !== "otro").map(([k, n]) => { const c = catalogoNegocio(k, S.products).length;
      return `<button class="choice" data-sum="${esc(k)}" ${c ? "" : "disabled"}>${esc(n.nombre)}<small>${c ? `${c} productos nuevos` : "Ya tienes todos"}</small></button>`; }).join("")}
  </div>`);
  document.querySelectorAll("[data-sum]").forEach(b => b.onclick = () => run(async () => { const rows = catalogoNegocio(b.dataset.sum, S.products);
    await commit(ops("products", rows)); S.products.push(...rows); S.products.sort((a, b) => a.name.localeCompare(b.name, "es")); closeModal(); render(); toast(`${rows.length} productos agregados`); }));
}


"use strict";
// Pistola de códigos, indicador de conexión y arranque de la app. Va al final.
// ---------- Pistola de códigos ----------
// La pistola "escribe" el código muy rápido y termina con Enter. Si las teclas llegan con menos de
// 50 ms entre una y otra, se toma como un código escaneado, sin importar dónde esté el cursor.
const pist = { buf:"", t:0 };
document.addEventListener("keydown", e => {
  if (!MODE) return;
  const now = Date.now(), gap = now - pist.t;
  if (e.key === "Enter"){
    const code = pist.buf; pist.buf = "";
    if (code.length >= 6 && gap < 100 && !document.querySelector(".overlay")){
      e.preventDefault();
      const a = document.activeElement; if (a && /^(INPUT|TEXTAREA)$/.test(a.tagName) && a.value.endsWith(code)){ a.value = a.value.slice(0, -code.length); a.dispatchEvent(new Event("input")); }
      pistola(code);
    }
    return;
  }
  if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
  pist.buf = gap < 50 ? pist.buf + e.key : e.key; pist.t = now;
}, true);
function pistola(code){
  const v = ui.view;
  const cb = v === "recibir" ? addToRecv : v === "contar" && ui.sector ? scanCount : v === "productos" ? openProduct
    : v === "vencimientos" ? (p => { ui.venc.pid = p.id; rerender(); })
    : p => { if (ui.view !== "vender") go("vender"); addToCart(p); if (p.price > 0 && !p.kg) toast(`+1 ${p.name}`); };
  handleCode(code, cb);
}

// Indicador de conexión: la app no la necesita, pero así se ve que todo se guarda igual
const netChanged = () => { if (MODE && !document.querySelector(".overlay")) softRender(); };
window.addEventListener("online", netChanged); window.addEventListener("offline", netChanged);
// Redibuja sin interrumpir a quien está escribiendo en un campo
function softRender(){
  const a = document.activeElement;
  if (a && $("#app").contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
  const y = window.scrollY; render(); window.scrollTo(0, y);
}

// Guarda la app en el dispositivo para que abra sin internet (sw.js)
if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(e => console.warn("Sin modo sin conexión:", e));

openStore().catch(e => { console.error(e);
  gate(`${gateHead()}<div class="card stack"><h2>No se pudo abrir la base de datos</h2><p style="margin:0">${esc(friendly(e))}</p>
    <p class="small muted" style="margin:0">Si estás en una ventana privada o de incógnito, abre la app en una ventana normal.</p>
    <button class="btn primary block" onclick="location.reload()">Reintentar</button></div>`); });

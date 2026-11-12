"use strict";
// Búsqueda de productos y pantalla de vender.
// Búsqueda que no se fija en tildes, mayúsculas ni apóstrofes y aguanta una letra mal escrita.
// Primero lo que empieza igual, después lo que tiene todas las palabras y al final los "Parecidos".
const norm = s => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/['’`´]/g, "").replace(/\s+/g, " ").trim();
function casi(a, b){ // ¿a y b difieren en una letra como máximo?
  if (a === b) return true; const la = a.length, lb = b.length; if (Math.abs(la - lb) > 1) return false;
  let i = 0, j = 0, d = 0;
  while (i < la && j < lb){ if (a[i] === b[j]){ i++; j++; continue; } if (++d > 1) return false; if (la > lb) i++; else if (lb > la) j++; else { i++; j++; } }
  return d + (la - i) + (lb - j) <= 1;
}
// Cómo suena en español de Chile: qu/k/c fuerte, c suave/z/s, v/b, ll/y, h muda ("marraketa" = "marraqueta")
const fon = s => s.replace(/qu/g, "k").replace(/c(?=[aou ]|$)/g, "k").replace(/c(?=[ei])/g, "s").replace(/z/g, "s").replace(/v/g, "b").replace(/ll/g, "y").replace(/(^|[^c])h/g, "$1");
function buscar(q, list){
  const nq = norm(q), code = String(q).trim(); if (!nq) return { exactos:[], parecidos:[] };
  const words = nq.split(" "), fw = words.map(fon), a = [], b = [], c = [];
  for (const p of list){
    if (p.barcode && p.barcode === code){ a.unshift(p); continue; }
    const n = norm(p.name);
    if (n.startsWith(nq)) a.push(p);
    else if (words.every(w => n.includes(w))) b.push(p);
    else if (fw.every(w => w.length >= 3 && fon(n).includes(w))) b.push(p);
    else { const pw = n.split(/[ ,.\-()]+/);
      if (words.every(w => n.includes(w) || (w.length >= 3 && pw.some(x => casi(w, x) || (x.length > w.length && casi(w, x.slice(0, w.length))))))) c.push(p); }
  }
  return { exactos:[...a, ...b], parecidos:c };
}
function searchResults(q, onPick, opts){
  if (!q.trim()) return "";
  const r = buscar(q, S.products.filter(p => opts?.all || disp(p)));
  const row = p => `<button class="item tap" data-pick="${esc(p.id)}"><div class="main"><div class="name">${esc(p.name)}</div><div class="sub">${p.price > 0 ? clp(p.price) + (p.kg ? " el kilo" : "") : "Sin precio"} · ${esc(p.cat)}</div></div>${stockPill(p)}</button>`;
  return r.exactos.slice(0, 8).map(row).join("") + (r.parecidos.length ? `<div class="small muted" style="padding-top:8px;font-weight:600">Parecidos</div>` + r.parecidos.slice(0, 5).map(row).join("") : "")
    || `<div class="empty">Sin resultados para “${esc(q.trim())}”.</div>`;
}

function viewVender(){
  const pr = pricing(ui.cart), caja = ext("caja");
  const last = ui.lastSale && ext("comprobante") ? `<div class="card spread"><div><div style="font-weight:700">Venta registrada: ${clp(ui.lastSale.total)}</div><div class="small muted">${ago(ui.lastSale.at)}</div></div><button class="btn sm" id="lastrec">Comprobante</button></div>` : "";
  const quick = S.products.filter(p => p.atajo && disp(p) && (p.cat !== "Pan" || ext("pan")));
  return `${header("Vender", "Registrar una venta")}
  <div class="stack">
    ${quick.length ? `<div class="quick">${quick.map(p => `<button data-quick="${esc(p.id)}">${esc(p.name)}<small>${clp(p.price)}${p.kg ? " el kilo" : ""}</small></button>`).join("")}</div>` : ""}
    <div class="searchbar"><input class="input" id="q" placeholder="Buscar producto, ej: coca" autocomplete="off"><button class="btn accent" id="scan">Escanear</button></div>
    <div class="list card" id="res" style="padding-block:0" hidden></div>
    <div class="card">
      <h3>Venta actual</h3>
      ${ui.cart.length ? pr.lines.map((l,i) => { const p = P(l.pid); return `<div class="cartline"><div style="min-width:0"><div class="name" style="font-weight:600">${esc(p.name)}</div><div class="small muted">${clp(p.price)} ${p.kg ? "el kilo" : "c/u"}${l.desc ? ` · <span style="color:var(--ok);font-weight:600">oferta −${clp(l.desc)}</span>` : ""}</div>
        ${(st => st != null && l.qty > st ? `<div class="small" style="color:var(--warn);font-weight:600">Según el sistema ${st > 0 ? `quedan ${fq(p, st)}` : "no quedan"}. Revisa la cantidad.</div>` : "")(stockOf(p))}</div>
        ${p.kg ? `<div class="stepper"><button data-w="${esc(i)}" style="width:auto;padding:0 10px" aria-label="Cambiar el peso">${fq(p, l.qty)}</button><button data-rm="${esc(i)}" aria-label="Quitar">×</button></div>`
          : `<div class="stepper"><button data-dec="${esc(i)}" aria-label="Quitar uno">−</button><span>${l.qty}</span><button data-inc="${esc(i)}" aria-label="Agregar uno">+</button></div>`}<div style="font-weight:700;min-width:6ch;text-align:right">${clp(l.bruto - l.desc)}</div></div>`; }).join("")
        : `<div class="empty">Busca o escanea un producto para agregarlo.</div>`}
      ${pr.aplicadas.map(a => `<div class="spread small" style="padding-top:8px;color:var(--ok);font-weight:600"><span>${esc(a.nombre)}</span><span>−${clp(a.ahorro)}</span></div>`).join("")}
      ${pr.avisos.map(a => `<div class="hint" style="margin-top:8px">${esc(a)}</div>`).join("")}
      <div class="spread" style="padding-top:12px"><span class="muted">Total</span><span class="total">${clp(pr.total)}</span></div>
    </div>
    ${caja && ui.cart.length ? `<div class="card stack"><h3>¿Cómo paga?</h3>
      <div class="seg" role="group">${Object.entries(PAGOS_CORTO).map(([k, v]) => `<button data-pago="${esc(k)}" aria-pressed="${ui.pago === k}">${v}</button>`).join("")}</div>
      ${ui.pago === "efectivo" ? `<div class="grid2" style="align-items:end"><div class="field"><label for="pagacon">Paga con</label><input class="input" id="pagacon" type="number" inputmode="numeric" placeholder="Ej: 5000" value="${esc(ui.pagaCon)}"></div>
        <div class="field"><label>Vuelto</label><div class="total" id="vuelto">${vuelto(pr.total)}</div></div></div>` : ""}</div>` : ""}
    <button class="btn primary block" id="confirm" ${ui.cart.length?"":"disabled"}>Confirmar venta</button>
    ${last}
  </div>`;
}
const vuelto = total => { const v = Math.round(+ui.pagaCon || 0) - total; return ui.pagaCon === "" ? "—" : v < 0 ? `Faltan ${clp(-v)}` : clp(v); };
function addToCart(p){
  if (!(p.price > 0)) return openPrecio(p, () => addToCart(P(p.id)));
  if (p.kg) return openPeso(p, null, kg => { ui.cart.push({ pid:p.id, qty:kg }); closeModal(); render(); });
  const l = ui.cart.find(l => l.pid === p.id); if (l) l.qty++; else ui.cart.push({ pid:p.id, qty:1 }); render();
}

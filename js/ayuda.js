"use strict";
// Recorrido guiado y ayuda de cada pantalla.
// ---------- Tutorial y ayuda ----------
// Recorrido guiado: resalta una parte de la pantalla y explica para qué sirve. No guarda nada.
const TOUR = [
  { view:"inicio", sel:".kpis", txt:"Aquí ves cuánto llevas vendido hoy y, si cuentas el inventario, cuánto llevas contado." },
  { view:"vender", sel:"#q", txt:"Para vender, busca el producto por su nombre. No importa si lo escribes sin tildes o con una letra mal." },
  { view:"vender", sel:"#scan", txt:"También puedes escanear el código de barras con la cámara. Si tienes pistola de códigos, dispara en cualquier momento y el producto se suma solo." },
  { view:"vender", sel:"#confirm", txt:"Cuando esté todo, confirma la venta. El stock se descuenta solo." },
  { view:"contar", sel:"#app .sector", txt:"Cuenta un sector a la vez, cuando tengas tiempo. Desde ahí la app sabe cuánto queda de cada producto.", ext:"contar" },
  { view:"productos", sel:"#addp", txt:"Aquí agregas productos y cambias precios. Lo que no vendas lo apagas, uno por uno o por sector." },
  { view:"fiados", sel:"#addc", txt:"Anota lo que te quedan debiendo y recuérdalo por WhatsApp con un toque.", ext:"fiados" },
  { view:"mas", sel:"#app .sector", txt:"En Más están el resto de las herramientas. Cada pantalla tiene un botón ? arriba que explica cómo usarla." }
];
function tour(i){
  document.querySelectorAll(".tour-hole,.tour-card").forEach(x => x.remove());
  const steps = TOUR.filter(t => !t.ext || ext(t.ext));
  if (i >= steps.length){ go("inicio"); return; }
  const t = steps[i];
  if (ui.view !== t.view) go(t.view);
  const el = document.querySelector(t.sel);
  if (el) el.scrollIntoView({ block:"center" });
  setTimeout(() => {
    const r = el?.getBoundingClientRect(), hole = document.createElement("div"), card = document.createElement("div");
    hole.className = "tour-hole";
    if (r) Object.assign(hole.style, { left:r.left - 6 + "px", top:r.top - 6 + "px", width:r.width + 12 + "px", height:r.height + 12 + "px" });
    else Object.assign(hole.style, { left:"50%", top:"40%", width:"0", height:"0" });
    card.className = "tour-card";
    card.innerHTML = `<div class="small muted" style="font-weight:600">Paso ${i + 1} de ${steps.length}</div><p style="margin:6px 0 12px">${esc(t.txt)}</p>
      <div class="spread"><button class="btn sm ghost" data-tx>Salir</button><button class="btn sm primary" data-tn>${i + 1 < steps.length ? "Siguiente" : "Terminar"}</button></div>`;
    const below = !r || r.bottom < innerHeight * 0.55;
    card.style[below ? "top" : "bottom"] = below ? (r ? r.bottom + 18 : innerHeight * 0.45) + "px" : innerHeight - r.top + 18 + "px";
    document.body.append(hole, card);
    card.querySelector("[data-tx]").onclick = () => { hole.remove(); card.remove(); };
    card.querySelector("[data-tn]").onclick = () => tour(i + 1);
  }, 120);
}
// Lo que explica el botón ? de cada pantalla
const AYUDA = {
  vender:["Busca por nombre (aguanta errores y tildes), escanea con la cámara o dispara la pistola de códigos.", "Los botones de arriba suman con un toque lo que más se vende. Se activan en la ficha de cada producto.", "Si un producto no tiene precio, la app lo pregunta la primera vez y lo deja guardado.", "Los productos por kilo piden el peso de la balanza o un monto en pesos."],
  contar:["Elige un sector y escribe lo que hay en la estantería. Lo vendido antes del conteo no se descuenta dos veces.", "Con muchas unidades usa Cajas ×: 4 cajas × 12 + 3 sueltas.", "Al escanear puedes sumar de a 1 o que te pregunte la cantidad.", "Marca No lo tenemos y el producto desaparece de las listas."],
  productos:["Toca un producto para cambiar precio, costo, mínimo, código, unidades por caja o proveedor.", "El filtro Sin precio muestra lo que falta completar.", "Para dejar de vender algo, desmárcalo en su ficha. Para apagar un sector completo, elígelo arriba y toca Apagar sector.", "Con Sumar productos de un catálogo agregas los productos típicos de otro tipo de negocio."],
  fiados:["Agrega al cliente, anota lo que se lleva fiado y registra sus pagos.", "Con un toque le mandas por WhatsApp un recordatorio con su saldo.", "Los fiados no cambian el stock: la venta se anota aparte en Vender."],
  recibir:["Elige el proveedor (aparecen sus productos para tocarlos) y agrega lo que llegó.", "Marca Por caja para escribir cajas, unidades por caja y precio de la caja: la app calcula unidades y costo.", "El costo de cada producto se actualiza solo con lo que pagaste."],
  compras:["Aparecen solos los productos que llegaron a su mínimo o menos, separados por proveedor.", "Cambia la cantidad a pedir o el mínimo ahí mismo.", "Pide por WhatsApp o copia la lista, y cuando llegue pásala a Recibir mercadería."],
  proveedores:["Guarda celular, días de visita y lo que le debes a cada proveedor.", "Con Elegir productos le asignas varios de una vez y ves cuánto ganas con cada uno."],
  vencimientos:["Anota la fecha al recibir o aquí abajo.", "Con Revisado avisas que ya miraste la estantería; con Oferta le pones un descuento para venderlo antes; con Listo lo sacas de la lista."],
  ofertas:["Pack: varios por un precio, mezclando los productos elegidos.", "Descuento: un % por días u horas.", "Se aplican solas en Vender, y avisa cuando falta poco para completar un pack."],
  caja:["Muestra lo vendido desde el último cierre por medio de pago, más los pagos de fiados.", "Escribe el sencillo inicial y lo que cuentas en la caja: la app dice si cuadra, falta o sobra."],
  resumen:["Elige el período para ver total, ventas, ganancia estimada y lo más vendido.", "La ganancia usa el costo actual de cada producto.", "Descarga todo en Excel con una hoja de resumen y otra con cada venta."],
  encargos:["Anota pedidos para otro día con abono.", "Márcalo Listo y avísale al cliente por WhatsApp con un toque."],
  personas:["Agrega a quienes atienden y elige quién está en este dispositivo.", "Cada venta, recepción y conteo queda con su nombre."],
  historial:["Todo lo que entra, sale y se cuenta, del más nuevo al más viejo.", "Toca una venta para ver su comprobante (si está activado)."],
  reservas:["Las reservas de internet llegan solas y suenan. Tócalas para confirmarlas o rechazarlas y avisarle al cliente por WhatsApp.", "Las demás se marcan como entregadas con un toque.", "Si alguien reserva y no viene, bloquea su número desde la reserva."],
  cuentas:["Con las cuentas activas, cada persona entra con su usuario y contraseña.", "El vendedor vende, anota fiados, reservas y encargos, y cierra la caja; puedes darle permisos extra.", "El encargado puede todo menos crear cuentas. Solo el dueño administra las cuentas.", "Si alguien deja de trabajar en la tienda, quítale el acceso: su celular deja de recibir y enviar datos."],
  pagina:["Activa la página y comparte el link por WhatsApp o imprime el cartel con el código QR.", "Muestra los productos con precio. Lo que apagues o no tenga precio no aparece.", "Los clientes reservan con su nombre y celular, y ven cuando la confirmas.", "Para que la abran desde su casa, el servidor tiene que estar conectado a internet con candado (https)."],
  tipospan:["Elige para cada pan si se vende por unidad o por kilo, su precio, si tiene botón rápido y si se puede reservar."]
};
function openAyuda(v){
  openModal(`<div class="stack">
    <div class="spread"><h2>Cómo se usa</h2><button class="btn ghost sm" data-close>Cerrar</button></div>
    <ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:8px">${AYUDA[v].map(t => `<li>${esc(t)}</li>`).join("")}</ul>
    <button class="btn block" id="ayutour">Ver el tutorial completo</button>
  </div>`);
  $("#ayutour").onclick = () => { closeModal(); tour(0); };
}


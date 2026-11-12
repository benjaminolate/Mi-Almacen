"use strict";
// Acciones: cada cambio pasa por act y queda guardado en el dispositivo.
// ---------- Acciones: cada cambio pasa por aquí y queda guardado en el dispositivo ----------
const act = {
  // Cada línea guarda el precio que se cobró de verdad (con la oferta ya descontada)
  async sale(cart, pago){
    const now = LocalDB.now(), grupo = uid(), pr = pricing(cart);
    const movs = pr.lines.map(l => { const m = withWho({ id:uid(), pid:l.pid, type:"venta", qty:l.qty, at:now, price:(l.bruto - l.desc) / l.qty, lista:l.unit, grupo });
      if (l.desc) m.desc = l.desc; if (pago) m.pago = pago; return m; });
    await commit(ops("movs", movs)); S.movs.push(...movs);
    return { grupo, total:pr.total };
  },
  // opts.debe: la factura queda como deuda con el proveedor
  async receive(supplier, items, opts = {}){
    items = items.filter(l => l.qty > 0);
    const now = LocalDB.now(), grupo = uid(), extra = [];
    supplier = (supplier || "").trim();
    let prov = null;
    if (ext("proveedores") && supplier){
      prov = S.proveedores.find(x => x.nombre.trim().toLowerCase() === supplier.toLowerCase());
      if (!prov){ prov = { id:uid(), nombre:supplier, telefono:"", dias:[], nota:"" }; extra.push(["proveedores", prov]); }
    }
    const movs = items.map(l => withWho(Object.assign({ id:uid(), pid:l.pid, type:"compra", qty:l.qty, at:now, cost:l.cost, supplier, grupo }, ext("vencimientos") && l.vence ? { vence:l.vence } : {})));
    // El costo se actualiza con lo que se pagó; si se recibió por caja, queda guardado cuántas trae
    const prods = items.map(l => Object.assign({}, P(l.pid), l.cost > 0 ? { cost:l.cost } : {}, { has:true }, prov && !P(l.pid).prov ? { prov:prov.id } : {}, l.caja?.por ? { porCaja:l.caja.por } : {}));
    if (ext("vencimientos")) items.filter(l => l.vence).forEach(l => extra.push(["vencimientos", { id:uid(), pid:l.pid, fecha:l.vence, qty:l.qty, done:false, at:now }]));
    const total = Math.round(items.reduce((a, l) => a + l.qty * l.cost, 0));
    if (prov && opts.debe && total > 0) extra.push(["provmovs", { id:uid(), prov:prov.id, type:"factura", amount:total, note:"Mercadería recibida", at:now }]);
    await commit([...ops("products", prods), ...ops("movs", movs), ...extra.map(([store, value]) => ({ store, value }))]);
    prods.forEach(p => Object.assign(P(p.id), p)); S.movs.push(...movs);
    extra.forEach(([store, v]) => upsert(store, [v]));
  },
  // draft: { pid: { qty, est, none } }. Devuelve cuántos se contaron y las diferencias
  async count(draft){
    const diffs = [], movs = [], prods = []; let n = 0;
    const now = LocalDB.now();
    for (const [pid, d] of Object.entries(draft)){
      const p = Object.assign({}, P(pid));
      if (d.none === true){ p.has = false; prods.push(p); continue; }
      if (d.none === false) p.has = true;
      if (d.qty === "" || d.qty == null){ if (d.none === false) prods.push(p); continue; }
      const c = p.kg ? r3(Math.max(0, num(d.qty))) : Math.max(0, Math.round(num(d.qty)));
      const expected = stockOf(P(pid));
      if (expected != null && expected !== c) diffs.push([P(pid), expected, c]);
      Object.assign(p, { countQty:c, countAt:now, estimated:!!d.est }); n++;
      prods.push(p); movs.push(withWho({ id:uid(), pid, type:"conteo", qty:c, expected, at:now }));
    }
    await commit([...ops("products", prods), ...ops("movs", movs)]);
    prods.forEach(p => Object.assign(P(p.id), p)); S.movs.push(...movs);
    return { n, diffs };
  },
  async updateProduct(p, f){
    const v = Object.assign({}, p, f);
    if (f.barcode && S.products.some(o => o.id !== p.id && o.barcode === f.barcode)) throw new Error("Ese código de barras ya está en otro producto");
    await commit(ops("products", [v])); return Object.assign(p, f);
  },
  async newProduct(f, qty){
    if (f.barcode && S.products.some(o => o.barcode === f.barcode)) throw new Error("Ese código de barras ya está en otro producto");
    const p = { id:uid(), name:f.name, cat:f.cat, price:f.price, cost:Math.round(f.price*0.65), barcode:f.barcode, min:3, has:true, countQty:null, countAt:null, estimated:false };
    if (f.kg) p.kg = true;
    const movs = [];
    if (qty !== ""){ p.countQty = p.kg ? r3(Math.max(0, num(qty))) : Math.max(0, Math.round(num(qty))); p.countAt = LocalDB.now(); movs.push({ id:uid(), pid:p.id, type:"conteo", qty:p.countQty, expected:null, at:p.countAt }); }
    await commit([...ops("products", [p]), ...ops("movs", movs)]);
    S.products.push(p); S.movs.push(...movs); return p;
  },
  // Eliminar: queda marcado (no se borra) para que el historial, los resúmenes y la caja sigan cuadrando
  async deleteProduct(p){
    const v = Object.assign({}, p, { eliminado:true, barcode:"", atajo:false });
    await commit(ops("products", [v]));
    S.products = S.products.filter(x => x.id !== p.id); S.gone.push(v);
    ui.cart = ui.cart.filter(l => l.pid !== p.id); ui.recv.items = ui.recv.items.filter(l => l.pid !== p.id); delete ui.draft[p.id];
  },
  async deleteClient(c){ c.eliminado = true; await commit(ops("clients", [clientRow(c)])); },
  async newClient(name, phone){
    const c = { id:uid(), name, phone, items:[] };
    await commit(ops("clients", [clientRow(c)])); S.clients.push(c); return c;
  },
  async clientMov(c, type, amount, note){
    const i = withWho({ id:uid(), type, amount, note, at:LocalDB.now() });
    await commit(ops("fiados", [fiadoRow(c, i)])); c.items.push(i);
  },
  async setting(clave, valor){
    await commit([{ store:"ajustes", value:{ clave, valor } }]); S.ajustes[clave] = valor;
  },
  panMsg(text){
    S.panMsg = text;
    clearTimeout(act._pm); act._pm = setTimeout(() => act.setting("mensaje_pan", text).catch(e => toast(friendly(e))), 700);
  },
  async newReserva(name, detail){
    const r = { id:uid(), name, detail, at:LocalDB.now(), done:false };
    await commit(ops("reservas", [r])); S.reservas.push(r); return r;
  },
  async reserva(r, done){
    await commit(ops("reservas", [Object.assign({}, r, { done })])); r.done = done;
  },
  // Guardar o borrar registros de las tablas de las extensiones
  async put(store, rows){ await commit(ops(store, rows)); upsert(store, rows); return rows[0]; },
  async del(store, id){ await commit([{ store, del:id }]); S[store] = S[store].filter(x => x.id !== id); }
};
// Si un producto pasa de unidades a kilos (o al revés), su stock contado ya no sirve: queda sin contar
const cambioUnidad = (p, kg) => kg == null || !!kg === !!p.kg ? {} : { countQty:null, countAt:null, estimated:false };
function upsert(store, rows){ for (const r of rows){ const a = S[store], i = a.findIndex(x => x.id === r.id); if (i >= 0) a[i] = r; else a.push(r); } }

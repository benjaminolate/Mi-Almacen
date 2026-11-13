"use strict";
// La app está repartida en los archivos de js/, que comparten sus nombres (no hay función cerrada).
// index.html los carga en orden y arranque.js va al final. Ningún nombre puede pisar uno del
// navegador (lo revisa tests/globales.test.js).
const H = 3600e3, D = 24*H;
// Las reservas son del día: se borran solas a las 3 de la mañana
const RES_CUT_HOUR = 3;

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clp = n => "$" + Math.round(n).toLocaleString("es-CL");
const uid = () => LocalDB.uuid();

// Orden en que se muestran los sectores; los que no están en la lista van al final
const ORDEN_SECTORES = ["Pan","Pastelería","Fiambrería","Verduras","Frutas","Vacuno","Cerdo","Pollo","Embutidos","Parrilla","Bebidas","Cervezas","Vinos","Licores",
  "Jugos","Lácteos","Abarrotes","Legumbres","Galletas","Conservas","Snacks","Dulces","Helados","Aseo","Mascotas","Otros"];
// Sectores que tienen productos en esta tienda
function sectores(){ const set = new Set(S.products.map(p => p.cat)); return [...ORDEN_SECTORES.filter(c => set.has(c)), ...[...set].filter(c => !ORDEN_SECTORES.includes(c)).sort((a, b) => a.localeCompare(b, "es"))]; }
// Un producto se vende si la tienda lo tiene y su sector no está apagado
const sectorOff = c => (S.ajustes.sectores_off || []).includes(c);
const disp = p => p.has && !sectorOff(p.cat);

// Tipos de negocio: qué productos trae al empezar y qué extensiones vienen prendidas.
// catalogo: "generico" (con precios de referencia) o un catálogo de catalogos.js, opcionalmente filtrado por sectores
const NEGOCIOS = {
  almacen:   { nombre:"Almacén", desc:"Abarrotes, bebidas, lácteos, aseo, pan y verduras", catalogo:[["generico"], ["emporio"]], ext:["contar","recibir","compras","fiados","pan","granel","caja"] },
  minimarket:{ nombre:"Minimarket", desc:"Como un almacén, con más control de caja, ofertas y equipo", catalogo:[["generico"], ["emporio"]], ext:["contar","recibir","compras","vencimientos","proveedores","granel","caja","ofertas","comprobante","personas","fiados"] },
  panaderia: { nombre:"Panadería", desc:"Pan por kilo o por unidad, pastelería y fiambrería", catalogo:[["panaderia"]], ext:["contar","recibir","compras","pan","granel","caja","comprobante","encargos"] },
  carniceria:{ nombre:"Carnicería", desc:"Vacuno, cerdo, pollo y embutidos por kilo", catalogo:[["carniceria"]], ext:["contar","recibir","compras","proveedores","vencimientos","granel","caja","comprobante","encargos"] },
  verduleria:{ nombre:"Verdulería", desc:"Frutas y verduras por kilo", catalogo:[["verduleria"]], ext:["recibir","compras","proveedores","granel","caja","fiados"] },
  botilleria:{ nombre:"Botillería", desc:"Bebidas, cervezas, vinos, licores y snacks", catalogo:[["emporio", ["Bebidas","Jugos","Snacks","Dulces","Helados"]], ["botilleria"]], ext:["contar","recibir","compras","proveedores","caja","ofertas","comprobante","personas"] },
  otro:      { nombre:"Otro negocio", desc:"Empiezas sin productos y eliges qué usar", catalogo:[], ext:["contar","recibir","compras"] }
};
const ATAJOS_PAN = ["Marraqueta","Hallulla","Pan amasado"];
const nuevoProd = (name, cat, kg) => Object.assign({ id:uid(), name, cat, price:0, cost:0, barcode:"", min:kg ? 2 : 3, has:true, countQty:null, countAt:null, estimated:false },
  kg ? { kg:true } : {}, cat === "Pan" && ATAJOS_PAN.includes(name) ? { atajo:true } : {});
// Productos de un tipo de negocio, sin repetir nombres (ni los que ya están en `ya`)
function catalogoNegocio(tipo, ya = []){
  const out = [], seen = new Set(ya.map(p => norm(p.name)));
  const add = p => { const k = norm(p.name); if (seen.has(k)) return; seen.add(k); out.push(p); };
  for (const [src, secs] of (NEGOCIOS[tipo] || NEGOCIOS.otro).catalogo){
    if (src === "generico") buildSeed().products.forEach(p => { delete p.pop; delete p.prov; add(Object.assign(p, { countQty:null, countAt:null, has:true, barcode:"", estimated:false })); });
    else (window.CATALOGOS?.[src] || []).filter(c => !secs || secs.includes(c[1])).forEach(([name, cat, kg]) => add(nuevoProd(name, cat, kg)));
  }
  return out;
}
const cuantosCatalogo = tipo => { const ps = catalogoNegocio(tipo); return { n:ps.length, sec:new Set(ps.map(p => p.cat)).size }; };

// Catálogo precargado típico de almacén: [nombre, sector, precio venta, costo, popularidad 0-3, extras]
// El pan y las verduras van por kilo (precio por kilo); cada tipo de pan se puede cambiar a "por unidad" en Tipos de pan
const KG = { kg:true }, PAN = { kg:true, atajo:true };
const CATALOG = [
 ["Marraqueta","Pan",2190,1450,3,PAN],["Hallulla","Pan",2190,1450,3,PAN],["Pan amasado","Pan",2490,1650,2,PAN],
 ["Dobladitas","Pan",2490,1650,1,KG],["Pan integral","Pan",2690,1800,1,KG],
 ["Tomate","Verduras",1990,1300,2,KG],["Papa","Verduras",1290,800,2,KG],["Cebolla","Verduras",1190,750,2,KG],["Zanahoria","Verduras",990,600,1,KG],
 ["Palta","Verduras",4990,3500,2,KG],["Limón","Verduras",1990,1250,1,KG],["Plátano","Verduras",1490,950,1,KG],["Lechuga","Verduras",990,600,1],
 ["Coca-Cola 1,5 L","Bebidas",1990,1300,3],["Coca-Cola 3 L","Bebidas",2990,2050,2],["Coca-Cola Zero 1,5 L","Bebidas",1990,1300,1],
 ["Sprite 1,5 L","Bebidas",1790,1150,1],["Fanta 1,5 L","Bebidas",1790,1150,1],["Pepsi 1,5 L","Bebidas",1690,1080,1],
 ["Bilz 1,5 L","Bebidas",1590,1000,1],["Pap 1,5 L","Bebidas",1590,1000,1],["Agua mineral sin gas 1,6 L","Bebidas",990,560,2],
 ["Agua mineral con gas 1,6 L","Bebidas",990,560,0],
 ["Jugo en caja naranja 1 L","Jugos",1290,820,2],["Jugo en caja durazno 1 L","Jugos",1290,820,1],["Jugo en caja piña 1 L","Jugos",1290,820,1],
 ["Néctar individual 200 ml","Jugos",450,260,2],["Jugo en polvo sobre","Jugos",150,80,2],
 ["Leche entera 1 L","Lácteos",1150,820,3],["Leche descremada 1 L","Lácteos",1150,820,1],["Yogur batido 125 g","Lácteos",350,210,2],
 ["Mantequilla 250 g","Lácteos",2490,1750,1],["Queso laminado 250 g","Lácteos",2990,2100,1],
 ["Arroz grado 2, 1 kg","Abarrotes",1490,980,2],["Fideos espirales 400 g","Abarrotes",790,480,2],["Fideos spaghetti 400 g","Abarrotes",790,480,2],
 ["Azúcar 1 kg","Abarrotes",1190,820,2],["Harina 1 kg","Abarrotes",1090,720,1],["Sal 1 kg","Abarrotes",490,280,1],
 ["Aceite maravilla 1 L","Abarrotes",2690,1890,2],["Té 20 bolsitas","Abarrotes",990,610,1],["Café instantáneo 170 g","Abarrotes",4990,3500,1],
 ["Pan de molde","Abarrotes",2190,1500,2],
 ["Lentejas 1 kg","Legumbres",1990,1350,1],["Porotos 1 kg","Legumbres",2490,1700,1],["Garbanzos 1 kg","Legumbres",2290,1550,1],
 ["Arvejas partidas 500 g","Legumbres",1190,780,0],
 ["Galletas de agua","Galletas",690,420,2],["Galletas de soda","Galletas",690,420,2],["Galletas rellenas chocolate","Galletas",590,350,3],
 ["Galletas rellenas vainilla","Galletas",590,350,2],["Galletas de vino","Galletas",890,560,1],
 ["Atún lomitos en lata","Conservas",2290,1550,1],["Jurel en lata","Conservas",1990,1300,1],["Choclo en lata","Conservas",1190,760,1],
 ["Salsa de tomate 200 g","Conservas",590,350,2],["Duraznos en almíbar","Conservas",1890,1250,0],
 ["Papas fritas 110 g","Snacks",1490,950,2],["Ramitas 90 g","Snacks",1090,690,1],["Maní salado 100 g","Snacks",990,620,1],
 ["Chocolate 100 g","Snacks",1390,900,2],["Chicle","Snacks",200,110,2],
 ["Papel higiénico 4 rollos","Aseo",2490,1700,1],["Lavaloza 500 ml","Aseo",1490,950,1],["Cloro 1 L","Aseo",990,600,1],
 ["Detergente en polvo 1 kg","Aseo",3490,2400,0],["Jabón de tocador","Aseo",450,270,1]
];

// Generador pseudoaleatorio con semilla, para que la demo siempre arranque igual
function rng(seed){ return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; }

function atDay(daysAgo, hour, min){ const d = new Date(Date.now() - daysAgo*D); d.setHours(hour, min||0, 0, 0); return d.getTime(); }

function buildSeed(){
  const r = rng(42);
  const codes = { "Coca-Cola 1,5 L":"7800000000011", "Coca-Cola 3 L":"7800000000028", "Coca-Cola Zero 1,5 L":"7800000000035" };
  const products = CATALOG.map(c => Object.assign({ id:uid(), name:c[0], cat:c[1], price:c[2], cost:c[3], pop:c[4],
    barcode: codes[c[0]] || "", min: c[5]?.kg ? (c[4] >= 2 ? 5 : 2) : c[4] >= 2 ? 6 : 3,
    has:true, countQty:null, countAt:null, estimated:false }, c[5] || {}));
  const byName = n => products.find(p => p.name === n);
  byName("Agua mineral con gas 1,6 L").has = false;
  byName("Arvejas partidas 500 g").has = false;
  const movs = [];
  const now = Date.now();
  // Ventas de los últimos 5 días (incluido hoy hasta la hora actual)
  for (let d = 5; d >= 0; d--){
    for (const p of products){
      if (!p.has) continue;
      const n = [0.15, 0.6, 1.6, 3.2][p.pop];
      let k = Math.floor(n + r()*n);
      while (k-- > 0){
        const t = atDay(d, 9 + Math.floor(r()*12), Math.floor(r()*60));
        if (t > now - 5*60e3) continue;
        movs.push({ id:uid(), pid:p.id, type:"venta", qty: p.kg ? r3(0.25 + Math.round(r()*5)/4) : r() < 0.2 ? 2 : 1, at:t, price:p.price });
      }
    }
  }
  // Conteos ya hechos: Bebidas hace 3 días, Lácteos hace 2, Galletas ayer (al cierre)
  const counts = { "Bebidas":[3,20,30], "Lácteos":[2,20,15], "Galletas":[1,20,40] };
  const qtys = { "Coca-Cola 1,5 L":30,"Coca-Cola 3 L":12,"Coca-Cola Zero 1,5 L":9,"Sprite 1,5 L":3,"Fanta 1,5 L":2,"Pepsi 1,5 L":6,"Bilz 1,5 L":7,"Pap 1,5 L":6,"Agua mineral sin gas 1,6 L":18,
    "Leche entera 1 L":16,"Leche descremada 1 L":6,"Yogur batido 125 g":14,"Mantequilla 250 g":5,"Queso laminado 250 g":4,
    "Galletas de agua":15,"Galletas de soda":13,"Galletas rellenas chocolate":22,"Galletas rellenas vainilla":16,"Galletas de vino":8 };
  for (const [cat,[d,h,m]] of Object.entries(counts)){
    const t = atDay(d,h,m);
    for (const p of products.filter(p => p.cat === cat && p.has)){
      p.countQty = qtys[p.name] ?? 6; p.countAt = t;
      movs.push({ id:uid(), pid:p.id, type:"conteo", qty:p.countQty, expected:null, at:t });
    }
  }
  // Una compra al proveedor después del conteo de Bebidas
  const coca = byName("Coca-Cola 1,5 L");
  movs.push({ id:uid(), pid:coca.id, type:"compra", qty:24, at:atDay(2,11,15), cost:1300, supplier:"Distribuidora Ejemplo" });
  const agua = byName("Agua mineral sin gas 1,6 L");
  movs.push({ id:uid(), pid:agua.id, type:"compra", qty:12, at:atDay(2,11,15), cost:560, supplier:"Distribuidora Ejemplo" });
  movs.sort((a,b) => a.at - b.at);
  // Si alguna venta deja un producto contado en negativo, se elimina (la demo debe ser coherente)
  for (const p of products){
    if (p.countAt == null) continue;
    let s = p.countQty;
    for (const m of movs.filter(m => m.pid === p.id && m.at > p.countAt)){
      if (m.type === "compra") s += m.qty;
      if (m.type === "venta"){ if (s - m.qty < 1 && p.pop < 3){ m.drop = true; } else s -= m.qty; }
    }
  }
  return Object.assign({ products, movs: movs.filter(m => !m.drop), seededAt: now }, seedExtras(), seedExtensiones(byName));
}
// Ejemplos para las extensiones (proveedores, vencimientos, ofertas y encargos)
function seedExtensiones(byName){
  const dia = n => ymd(Date.now() + n*D);
  const dist = { id:uid(), nombre:"Distribuidora Ejemplo", telefono:"", dias:[2,5], nota:"Hacer el pedido el día antes" };
  const lac = { id:uid(), nombre:"Lácteos del Sur", telefono:"", dias:[1,3,5], nota:"" };
  ["Coca-Cola 1,5 L","Coca-Cola 3 L","Coca-Cola Zero 1,5 L","Sprite 1,5 L","Fanta 1,5 L","Agua mineral sin gas 1,6 L"].forEach(n => byName(n).prov = dist.id);
  ["Leche entera 1 L","Leche descremada 1 L","Yogur batido 125 g","Mantequilla 250 g","Queso laminado 250 g"].forEach(n => byName(n).prov = lac.id);
  const v = (n, d, q) => ({ id:uid(), pid:byName(n).id, fecha:dia(d), qty:q, done:false, at:atDay(3,10,0) });
  return {
    proveedores:[dist, lac],
    provmovs:[{ id:uid(), prov:dist.id, type:"factura", amount:38400, note:"Mercadería recibida", at:atDay(2,11,15) }, { id:uid(), prov:dist.id, type:"pago", amount:20000, note:"", at:atDay(1,18,0) }],
    vencimientos:[v("Yogur batido 125 g", -1, 4), v("Leche entera 1 L", 3, 6), v("Queso laminado 250 g", 6, 2), v("Pan de molde", 12, 3)],
    ofertas:[{ id:uid(), nombre:"3 galletas rellenas por $1.500", tipo:"pack", n:3, precio:1500, pids:[byName("Galletas rellenas chocolate").id, byName("Galletas rellenas vainilla").id], dias:[], desde:"", hasta:"", activa:true }],
    encargos:[{ id:uid(), cliente:"Carla Demo", telefono:"", detalle:"Torta de chocolate para 15 personas", para:dia(0), hora:"18:00", total:18000, abono:5000, estado:"pendiente", at:atDay(2,12,0) },
      { id:uid(), cliente:"Luis Ficticio", telefono:"", detalle:"2 balones de gas de 15 kg", para:dia(2), hora:"", total:0, abono:0, estado:"pendiente", at:atDay(0,9,0) }]
  };
}

// Fiados, aviso del pan y reservas (datos ficticios de ejemplo; los clientes no tienen celular para no escribirle a nadie real)
function resSeedAt(i){ const cut = resCutoff(), now = Date.now(); return Math.round(cut + (now - cut) * (i + 1) / 6); }
function seedExtras(){
  return {
    clients: [
      { id:uid(), name:"Ana Ejemplo", phone:"", items:[
        { id:uid(), type:"fiado", amount:4580, note:"Pan, leche y mantequilla", at:atDay(4,9,10) },
        { id:uid(), type:"fiado", amount:2990, note:"Coca-Cola 3 L", at:atDay(2,19,40) },
        { id:uid(), type:"abono", amount:3000, note:"", at:atDay(1,12,5) } ] },
      { id:uid(), name:"Pedro Prueba", phone:"", items:[
        { id:uid(), type:"fiado", amount:6200, note:"Cigarros y bebida", at:atDay(6,20,15) },
        { id:uid(), type:"fiado", amount:3700, note:"Pan y jamón", at:atDay(3,8,50) },
        { id:uid(), type:"fiado", amount:2500, note:"Galletas y jugo", at:atDay(0,10,30) } ] },
      { id:uid(), name:"Carla Demo", phone:"", items:[
        { id:uid(), type:"fiado", amount:1990, note:"Leche y yogur", at:atDay(5,18,0) },
        { id:uid(), type:"abono", amount:1990, note:"", at:atDay(2,18,30) } ] }
    ],
    panMsg: "🍞 ¡Llegó el pan calentito! Marraquetas y hallullas recién salidas. Los esperamos en el almacén.",
    reservas: [
      { id:uid(), name:"Ana Ejemplo", detail:"10 marraquetas, 4 hallullas", at:resSeedAt(0), done:true },
      { id:uid(), name:"Luis Ficticio", detail:"6 hallullas", at:resSeedAt(1), done:false },
      { id:uid(), name:"Carla Demo", detail:"4 pan amasado, 2 dobladitas", at:resSeedAt(2), done:false },
      { id:uid(), name:"Jorge Prueba", detail:"15 marraquetas", at:resSeedAt(3), done:false }
    ]
  };
}

// ---------- Datos: todo vive en la base local de este dispositivo (local-db.js) ----------
// S es la copia en memoria con la que se dibujan las pantallas. Cada acción pasa por
// `act`, que actualiza S y guarda el cambio en la base local antes de confirmarlo.
let MODE = null;      // "local" cuando la tienda está abierta; null en la pantalla de inicio
let S = null;
const meta = { tienda:null, device:null, demo:false, pending:0, servidor:"" };

const P = id => S.products.find(p => p.id === id) || S.gone.find(p => p.id === id);
const clientRow = c => Object.assign({ id:c.id, name:c.name, phone:c.phone || "" }, c.eliminado ? { eliminado:true } : {});
const fiadoRow = (c, i) => Object.assign({ id:i.id, cid:c.id, type:i.type, amount:i.amount, note:i.note || "", at:i.at }, i.quien ? { quien:i.quien } : {});
const ops = (store, list) => list.map(value => ({ store, value }));

async function loadLocal(){
  const t = await LocalDB.loadAll();
  meta.tienda = t.meta.tienda || null; meta.device = t.meta.device || null; meta.demo = !!t.meta.demo; meta.pending = t.pending; meta.servidor = t.meta.servidor || ""; meta.prefs = t.meta.prefs || null; meta.cuenta = t.meta.cuenta || null;
  if (meta.device) LocalDB.clock.device = meta.device.id;
  const aj = Object.fromEntries(t.ajustes.map(a => [a.clave, a.valor]));
  const clients = t.clients.map(c => Object.assign({ id:c.id, name:c.name, phone:c.phone || "", items:[] }, c.eliminado ? { eliminado:true } : {})), byId = Object.fromEntries(clients.map(c => [c.id, c]));
  t.fiados.sort((a, b) => a.at - b.at).forEach(f => byId[f.cid]?.items.push(Object.assign({ id:f.id, type:f.type, amount:f.amount, note:f.note, at:f.at }, f.quien ? { quien:f.quien } : {})));
  const strip = o => { const { _v, ...rest } = o; return rest; };
  // Un producto eliminado sale de todas las listas (S.gone), pero sus ventas y movimientos siguen en el historial
  const prods = t.products.map(strip).sort((a, b) => a.name.localeCompare(b.name, "es"));
  S = { products: prods.filter(p => !p.eliminado), gone: prods.filter(p => p.eliminado), movs: t.movs.map(strip).sort((a, b) => a.at - b.at),
    clients, reservas: t.reservas.map(strip), panMsg: aj.mensaje_pan ?? "", ajustes: aj };
  for (const k of EXT_TABLAS) S[k] = (t[k] || []).map(strip);
  meta.persona = t.meta.persona || "";
}
const EXT_TABLAS = ["vencimientos","cajas","proveedores","provmovs","ofertas","personas","encargos"];
// Guarda en la base local y actualiza el contador de cambios por enviar
async function commit(list){ await LocalDB.apply(list); meta.pending = await LocalDB.pendingCount(); Sync.syncSoon(); }

// Crea la tienda en este dispositivo. inicio: "catalogo" | "vacio" | "ejemplo"
async function createStore(nombre, persona, inicio, extensiones, tipo){
  const device = newDevice();
  const tienda = { id: uid(), nombre, persona, creada: Date.now() };
  let data;
  if (inicio === "ejemplo") data = buildSeed();
  else data = { products: inicio === "catalogo" ? catalogoNegocio(tipo || "almacen") : [], movs:[], clients:[], reservas:[],
    panMsg: "🍞 ¡Llegó el pan calentito! Los esperamos en " + nombre + "." };
  data.products.forEach(p => { delete p.pop; if (inicio !== "ejemplo") delete p.prov; });
  // Los datos de ejemplo quedan solo en este dispositivo: no se envían al servidor
  const local = inicio === "ejemplo";
  const list = [...ops("products", data.products), ...ops("movs", data.movs), ...ops("clients", data.clients.map(clientRow)),
    ...data.clients.flatMap(c => ops("fiados", c.items.map(i => fiadoRow(c, i)))), ...ops("reservas", data.reservas),
    ...EXT_TABLAS.flatMap(k => ops(k, data[k] || [])),
    { store:"ajustes", value:{ clave:"tienda_nombre", valor:nombre } }, { store:"ajustes", value:{ clave:"mensaje_pan", valor:data.panMsg } }];
  if (extensiones) list.push({ store:"ajustes", value:{ clave:"extensiones", valor:extensiones } });
  if (tipo) list.push({ store:"ajustes", value:{ clave:"tipo_negocio", valor:tipo } });
  list.forEach(o => o.local = local);
  await LocalDB.wipe();
  LocalDB.clock.device = device.id;
  await LocalDB.setMeta("device", device);
  await LocalDB.setMeta("tienda", tienda);
  await LocalDB.setMeta("demo", local);
  if (!local && meta.servidor) await LocalDB.setMeta("servidor", meta.servidor);
  await commit(list);
  await LocalDB.persist();
}
const newDevice = () => ({ id: uid().replace(/-/g, "").slice(0, 8), nombre: /Android|iPhone|iPad/i.test(navigator.userAgent) ? "Celular" : "Computador", creado: Date.now() });

// Une este dispositivo a una tienda que ya existe en el servidor y descarga todos sus datos
async function joinStore(servidor, tiendaId, cuenta){
  if (!(await Sync.probe(servidor))) throw new Error("No se encontró el servidor en " + servidor);
  const device = newDevice();
  await LocalDB.wipe();
  LocalDB.clock.device = device.id;
  await LocalDB.setMeta("device", device);
  await LocalDB.setMeta("servidor", servidor);
  await LocalDB.setMeta("demo", false);
  if (cuenta) await LocalDB.setMeta("cuenta", cuenta);
  Sync.state.token = cuenta?.token || "";
  Sync.start(servidor, tiendaId);
  await Sync.syncNow();
  if (Sync.state.status === "cuenta") throw Object.assign(new Error(Sync.state.error), { code:"cuenta" });
  if (Sync.state.status === "error") throw new Error(Sync.state.error);
  await loadLocal();
  if (!S.ajustes.tienda_nombre && !S.products.length) throw new Error("El servidor no tiene datos de esa tienda. Revisa el código.");
  await LocalDB.setMeta("tienda", { id:tiendaId, nombre:S.ajustes.tienda_nombre || "Tienda", persona:"", unida:Date.now() });
  await LocalDB.persist();
}

function stockOf(p){
  if (p.countAt == null) return null;
  let s = p.countQty;
  for (const m of S.movs){ if (m.pid !== p.id || m.at <= p.countAt) continue;
    if (m.type === "compra") s += m.qty; else if (m.type === "venta") s -= m.qty; }
  return r3(s);
}
// Cuántas ventas tiene el producto (no cuántas unidades: el pan por kilo sumaba kilos)
function ventasDe(p){ return S.movs.filter(m => m.pid === p.id && m.type === "venta").length; }
function ago(t){
  const d0 = new Date(); d0.setHours(0,0,0,0);
  const hm = new Date(t).toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
  if (t >= d0.getTime()) return "hoy " + hm;
  if (t >= d0.getTime() - D) return "ayer " + hm;
  if (t >= d0.getTime() - 6*D) return new Date(t).toLocaleDateString("es-CL",{weekday:"long"}) + " " + hm;
  return new Date(t).toLocaleDateString("es-CL",{day:"numeric",month:"short"}) + " " + hm;
}
function stockPill(p){
  if (!p.has) return '<span class="pill none">No lo tenemos</span>';
  if (sectorOff(p.cat)) return '<span class="pill none">Sector apagado</span>';
  const s = stockOf(p);
  if (s == null) return '<span class="pill none">Sin contar</span>';
  const est = p.estimated ? " aprox." : "";
  if (s <= 0) return `<span class="pill bad">Agotado</span>`;
  if (s <= p.min) return `<span class="pill warn">Quedan ${fq(p, s)}${est}</span>`;
  return `<span class="pill ok">${fq(p, s)}${est} en stock</span>`;
}
function toast(msg){ document.querySelectorAll(".toast").forEach(x => x.remove()); const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }
function friendly(e){
  const m = (e && e.message) || String(e || "");
  if (e?.name === "QuotaExceededError") return "El dispositivo se quedó sin espacio. Libera espacio y vuelve a intentar.";
  return m || "Algo salió mal";
}
// Celular chileno: 9 números (se acepta con +56 delante). Vacío es válido porque es opcional.
const phoneOk = v => { const d = String(v || "").replace(/\D/g, ""); return !d || d.length === 9 || (d.length === 11 && d.startsWith("56")); };
const PHONE_MSG = "El celular debe tener 9 números, por ejemplo 9 1234 5678";
// Mientras se escribe solo deja números, espacios y el + del comienzo
function phoneInput(el){ if (el) el.addEventListener("input", () => { const v = el.value.replace(/[^\d +]/g, "").replace(/(?!^)\+/g, ""); if (v !== el.value) el.value = v; }); }
// Unidades por caja: vacío = sin dato (0); si no, un número entero entre 2 y 1000
const CAJA_MSG = "Las unidades por caja deben ser un número entero entre 2 y 1000. Déjalo vacío si no viene en caja.";
const cajaVal = v => { v = String(v ?? "").trim(); if (!v) return 0; const n = +v; return Number.isInteger(n) && n >= 2 && n <= 1000 ? n : undefined; };
// Lo que se vende por unidad va en números enteros (los decimales son solo para lo que va por kilo)
const enteroOk = (p, v) => p?.kg || v === "" || v == null || Number.isInteger(num(v));
const MAX_FIADO = 1000000;
let busy = false;
async function run(fn){ if (busy) return; busy = true; try { return await fn(); } catch(e){ console.error(e); toast(friendly(e)); } finally { busy = false; } }

const ui = { view:"inicio", cart:[], recv:{ supplier:"", items:[], debe:false }, sector:null, draft:{}, prodFilter:"Todos", prodQuery:"", histFilter:"todos", histWho:"",
  pago:"efectivo", pagaCon:"", lastSale:null, compras:{ qty:{}, quitar:{}, extra:{} }, venc:{}, caja:{} };


// Base de datos local del dispositivo (IndexedDB).
//
// Todo lo que pasa en la tienda se guarda primero aquí, en el mismo celular o
// computador, así la app funciona sin internet. Cada cambio queda además en la
// "bandeja de salida" (outbox): la lista de cambios que este dispositivo todavía
// no ha enviado al servidor. sync.js la envía cuando hay conexión, y solo la
// vacía cuando el servidor confirma que los guardó, así nada se pierde.
//
// Orden de los cambios entre dispositivos: cada cambio lleva un sello "hlc"
// (reloj lógico híbrido). Es la hora del dispositivo, pero nunca retrocede y
// lleva el id del dispositivo para desempatar. Así, al juntar los cambios de
// varios celulares, todos quedan en el mismo orden aunque sus relojes difieran.
(function(){
"use strict";
const NAME = "mi-almacen", VERSION = 2;
// Tablas: clave primaria de cada una
// Versión 2 suma las tablas de las extensiones (vencimientos, caja, proveedores, ofertas, personas y encargos)
const STORES = { products:"id", movs:"id", clients:"id", fiados:"id", reservas:"id", ajustes:"clave", meta:"key",
  vencimientos:"id", cajas:"id", proveedores:"id", provmovs:"id", ofertas:"id", personas:"id", encargos:"id" };
let dbp = null;

function req(r){ return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
function done(tx){ return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error("Se canceló el guardado")); }); }

function open(){
  if (dbp) return dbp;
  return dbp = new Promise((res, rej) => {
    const r = indexedDB.open(NAME, VERSION);
    r.onupgradeneeded = e => {
      const db = r.result;
      for (const [s, key] of Object.entries(STORES)) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath:key });
      if (!db.objectStoreNames.contains("outbox")) db.createObjectStore("outbox", { keyPath:"seq", autoIncrement:true });
      // La versión anterior se saltaba los cambios de las tablas que no conocía: se vuelve a pedir todo al servidor
      if (e.oldVersion > 0 && e.oldVersion < 2) r.transaction.objectStore("meta").put({ key:"cursor", value:0 });
    };
    r.onsuccess = () => { const db = r.result; db.onversionchange = () => db.close(); res(db); };
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error("Cierra las otras pestañas de la app y vuelve a abrirla"));
  });
}

function uuid(){
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = b[6] & 15 | 64; b[8] = b[8] & 63 | 128;
  const h = [...b].map(x => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

// ---------- Reloj lógico híbrido ----------
// offset: diferencia entre el reloj del servidor y el de este dispositivo (la calcula sync.js)
const clock = { ms:0, n:0, device:"", offset:0 };
const now = () => Date.now() + clock.offset;
function tick(){
  const now = Date.now() + clock.offset;
  if (now > clock.ms){ clock.ms = now; clock.n = 0; } else clock.n++;
  return `${String(clock.ms).padStart(13, "0")}-${String(clock.n).padStart(4, "0")}-${clock.device}`;
}
// Al recibir cambios de otro dispositivo (Fase 2), el reloj avanza hasta ellos
function seen(hlc){
  const [ms, n] = hlc.split("-"), m = +ms, k = +n;
  if (m > clock.ms || (m === clock.ms && k > clock.n)){ clock.ms = m; clock.n = k; }
}

// Carga todo al abrir la app. Devuelve las tablas como listas y meta como objeto.
async function loadAll(){
  const db = await open(), tx = db.transaction([...Object.keys(STORES), "outbox"], "readonly");
  const out = {};
  for (const s of Object.keys(STORES)) out[s] = await req(tx.objectStore(s).getAll());
  out.pending = await req(tx.objectStore("outbox").count());
  out.meta = Object.fromEntries(out.meta.map(m => [m.key, m.value]));
  if (out.meta.clock){ clock.ms = out.meta.clock.ms; clock.n = out.meta.clock.n; }
  if (typeof out.meta.offset === "number") clock.offset = out.meta.offset;
  return out;
}

// Guarda un grupo de cambios de una sola vez: o se guardan todos o ninguno.
// ops: [{ store, value }] para guardar, o [{ store, del:id }] para borrar.
// Cada cambio queda en la bandeja de salida, salvo los marcados local:true.
async function apply(ops){
  if (!ops.length) return;
  const db = await open(), tx = db.transaction([...new Set(ops.map(o => o.store)), "meta", "outbox"], "readwrite");
  const box = tx.objectStore("outbox");
  for (const o of ops){
    const st = tx.objectStore(o.store);
    if ("del" in o){ st.delete(o.del); if (!o.local) box.add({ hlc:tick(), device:clock.device, store:o.store, del:o.del }); continue; }
    const hlc = tick(), value = Object.assign({}, o.value, { _v:hlc });
    st.put(value);
    if (!o.local) box.add({ hlc, device:clock.device, store:o.store, value });
  }
  tx.objectStore("meta").put({ key:"clock", value:{ ms:clock.ms, n:clock.n } });
  await done(tx);
}

// ---------- Sincronización (la usa sync.js) ----------
// Los primeros n cambios de la bandeja de salida, en el orden en que se hicieron
async function outboxBatch(n){
  const db = await open(), st = db.transaction("outbox").objectStore("outbox"), out = [];
  return new Promise((res, rej) => { const r = st.openCursor(); r.onerror = () => rej(r.error);
    r.onsuccess = () => { const c = r.result; if (!c || out.length >= n) return res(out); out.push(c.value); c.continue(); }; });
}
// El servidor confirmó que guardó estos cambios: se sacan de la bandeja
async function ack(seqs){
  if (!seqs.length) return;
  const db = await open(), tx = db.transaction("outbox", "readwrite"), st = tx.objectStore("outbox");
  seqs.forEach(s => st.delete(s)); await done(tx);
}
// Aplica cambios que llegan del servidor. Para cada registro gana el cambio con el
// sello hlc más nuevo, así todos los dispositivos terminan con lo mismo sin importar
// en qué orden reciban los cambios. Devuelve cuántos registros cambiaron aquí.
async function applyRemote(changes){
  if (!changes.length) return 0;
  const db = await open(), names = [...new Set(changes.map(c => c.store))].filter(s => s in STORES && s !== "meta");
  if (!names.length) return 0;
  const tx = db.transaction(names, "readwrite"); let n = 0;
  for (const c of changes){
    if (!names.includes(c.store)) continue;
    seen(c.hlc);
    const st = tx.objectStore(c.store), id = c.del ?? c.value?.[STORES[c.store]];
    if (id == null) continue;
    const cur = await req(st.get(id));
    if (cur && cur._v && cur._v >= c.hlc) continue;
    if (c.del != null) { if (cur){ st.delete(id); n++; } }
    else { st.put(Object.assign({}, c.value, { _v:c.hlc })); n++; }
  }
  await done(tx);
  await setMeta("clock", { ms:clock.ms, n:clock.n });
  return n;
}

async function getMeta(key){ const db = await open(); return (await req(db.transaction("meta").objectStore("meta").get(key)))?.value; }
async function setMeta(key, value){ const db = await open(), tx = db.transaction("meta", "readwrite"); tx.objectStore("meta").put({ key, value }); await done(tx); }
async function pendingCount(){ const db = await open(); return req(db.transaction("outbox").objectStore("outbox").count()); }

// Respaldo: todas las tablas y la bandeja de salida en un solo objeto
async function exportAll(){
  const db = await open(), tx = db.transaction([...Object.keys(STORES), "outbox"], "readonly"), tablas = {};
  for (const s of [...Object.keys(STORES), "outbox"]) tablas[s] = await req(tx.objectStore(s).getAll());
  return { app:"mi-almacen", version:1, creado:new Date().toISOString(), tablas };
}
// Restaurar: reemplaza todo lo de este dispositivo por el contenido del respaldo
async function importAll(file){
  if (!file || file.app !== "mi-almacen" || !file.tablas) throw new Error("El archivo no es un respaldo de esta app");
  const db = await open(), names = [...Object.keys(STORES), "outbox"], tx = db.transaction(names, "readwrite");
  for (const s of names){
    // Los respaldos que manda el servidor no traen los datos del dispositivo (meta): quedan los de este
    if (s === "meta" && !file.tablas.meta) continue;
    const st = tx.objectStore(s); st.clear(); (file.tablas[s] || []).forEach(v => st.put(v)); }
  await done(tx);
}
// Restaurar sin borrar: los registros del respaldo que no existen aquí, listos para guardar con apply()
async function missing(file){
  if (!file || file.app !== "mi-almacen" || !file.tablas) throw new Error("El archivo no es un respaldo de esta app");
  const db = await open(), names = Object.keys(STORES).filter(s => s !== "meta"), tx = db.transaction(names, "readonly"), out = [];
  for (const s of names){
    const st = tx.objectStore(s);
    for (const v of file.tablas[s] || []){
      const k = v?.[STORES[s]]; if (k == null) continue;
      if (!(await req(st.get(k)))){ const { _v, ...value } = v; out.push({ store:s, value }); }
    }
  }
  return out;
}
async function wipe(){
  const db = await open(), names = [...Object.keys(STORES), "outbox"], tx = db.transaction(names, "readwrite");
  names.forEach(s => tx.objectStore(s).clear());
  await done(tx);
  clock.ms = 0; clock.n = 0;
}

// Pide al navegador que no borre estos datos cuando le falte espacio
async function persist(){
  try { if (navigator.storage?.persisted && await navigator.storage.persisted()) return true;
    return navigator.storage?.persist ? await navigator.storage.persist() : false; } catch(e){ return false; }
}

window.LocalDB = { open, uuid, tick, seen, clock, now, loadAll, apply, getMeta, setMeta, pendingCount, outboxBatch, ack, applyRemote, exportAll, importAll, missing, wipe, persist };
})();

// Base de datos local del dispositivo (IndexedDB).
//
// Todo lo que pasa en la tienda se guarda primero aquí, en el mismo celular o
// computador, así la app funciona sin internet. Cada cambio queda además en la
// "bandeja de salida" (outbox): la lista de cambios que este dispositivo todavía
// no ha enviado al servidor. El servidor y la sincronización llegan en la Fase 2;
// mientras tanto la bandeja solo se acumula, y nada se pierde.
//
// Orden de los cambios entre dispositivos: cada cambio lleva un sello "hlc"
// (reloj lógico híbrido). Es la hora del dispositivo, pero nunca retrocede y
// lleva el id del dispositivo para desempatar. Así, al juntar los cambios de
// varios celulares, todos quedan en el mismo orden aunque sus relojes difieran.
(function(){
"use strict";
const NAME = "mi-almacen", VERSION = 1;
// Tablas: clave primaria de cada una
const STORES = { products:"id", movs:"id", clients:"id", fiados:"id", reservas:"id", ajustes:"clave", meta:"key" };
let dbp = null;

function req(r){ return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
function done(tx){ return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error("Se canceló el guardado")); }); }

function open(){
  if (dbp) return dbp;
  return dbp = new Promise((res, rej) => {
    const r = indexedDB.open(NAME, VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      for (const [s, key] of Object.entries(STORES)) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath:key });
      if (!db.objectStoreNames.contains("outbox")) db.createObjectStore("outbox", { keyPath:"seq", autoIncrement:true });
    };
    r.onsuccess = () => res(r.result);
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
const clock = { ms:0, n:0, device:"" };
function tick(){
  const now = Date.now();
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
  for (const s of names){ const st = tx.objectStore(s); st.clear(); (file.tablas[s] || []).forEach(v => st.put(v)); }
  await done(tx);
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

window.LocalDB = { open, uuid, tick, seen, clock, loadAll, apply, setMeta, pendingCount, exportAll, importAll, wipe, persist };
})();

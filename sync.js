// Sincronización con el servidor (PocketBase con servidor/pb_hooks/sync.pb.js).
//
// Cada dispositivo guarda todo primero en su base local (local-db.js). Cuando hay
// conexión con el servidor, este archivo:
//   1. envía la bandeja de salida (los cambios hechos aquí),
//   2. recibe los cambios de los otros dispositivos desde la última vez,
//   3. corrige la diferencia de hora entre este dispositivo y el servidor.
// El servidor avisa al instante cuando otro dispositivo guarda algo (tiempo real),
// y además se revisa cada 30 segundos por si se cortó ese aviso.
(function(){
"use strict";
const BATCH = 200;
const state = { url:"", tienda:"", status:"off", last:0, error:"", running:false, current:null, again:false, es:null, timer:null, onChange:null, onStatus:null };

const api = path => state.url.replace(/\/+$/, "") + path;
const setStatus = (s, err = "") => { state.status = s; state.error = err; state.onStatus?.(s); };

async function post(path, body){
  const r = await fetch(api(path), { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.message || `El servidor respondió ${r.status}`);
  return j;
}

// Un ciclo completo: enviar lo pendiente y traer lo nuevo, hasta que no quede nada
// Si ya hay un ciclo en curso, se pide otra vuelta y se espera a que termine
function syncNow(){
  if (!state.url || !state.tienda) return Promise.resolve();
  if (state.running){ state.again = true; return state.current; }
  return state.current = cycle();
}
async function cycle(){
  state.running = true; setStatus("syncing");
  let changed = 0;
  try {
    do {
      state.again = false;
      for (;;){
        const batch = await LocalDB.outboxBatch(BATCH);
        const t0 = Date.now();
        const res = await post("/api/sync", { tienda:state.tienda, device:LocalDB.clock.device, desde:(await LocalDB.getMeta("cursor")) || 0,
          cambios: batch.map(c => ({ hlc:c.hlc, device:c.device, store:c.store, value:c.value, del:c.del })) });
        // La hora del servidor, corregida por lo que tardó la respuesta
        const offset = Math.round(res.hora - (t0 + Date.now()) / 2);
        if (Math.abs(offset - LocalDB.clock.offset) > 1000){ LocalDB.clock.offset = offset; await LocalDB.setMeta("offset", offset); }
        await LocalDB.ack(batch.map(c => c.seq));
        changed += await LocalDB.applyRemote(res.cambios || []);
        await LocalDB.setMeta("cursor", res.hasta);
        if (batch.length < BATCH && !res.mas) break;
      }
    } while (state.again);
    state.last = Date.now(); setStatus("ok");
  } catch(e){
    console.warn("Sincronización:", e);
    setStatus("error", navigator.onLine ? (e.message || "Sin conexión con el servidor") : "Sin internet");
  } finally { state.running = false; }
  if (changed) state.onChange?.(changed);
}
let soon = null;
function syncSoon(ms = 400){ clearTimeout(soon); soon = setTimeout(syncNow, ms); }

// Tiempo real: el servidor avisa en el canal "tienda/<id>" cada vez que alguien guarda algo
function listen(){
  state.es?.close(); state.es = null;
  if (!state.url || !state.tienda || !window.EventSource) return;
  const es = state.es = new EventSource(api("/api/realtime"));
  const topic = "tienda/" + state.tienda;
  es.addEventListener("PB_CONNECT", e => {
    let id; try { id = JSON.parse(e.data).clientId; } catch(err){ return; }
    post("/api/realtime", { clientId:id, subscriptions:[topic] }).then(() => syncSoon(0), () => {});
  });
  es.addEventListener(topic, () => syncSoon(150));
}

// ¿Responde un servidor de la app en esta dirección?
async function probe(url){
  try {
    const r = await fetch(url.replace(/\/+$/, "") + "/api/sync/estado", { cache:"no-store" });
    if (!r.ok) return false;
    const j = await r.json(); return j.app === "mi-almacen";
  } catch(e){ return false; }
}

// Arranca (o detiene, con url vacía) la sincronización para una tienda
function start(url, tienda){
  stop();
  state.url = url || ""; state.tienda = tienda || "";
  if (!state.url || !state.tienda){ setStatus("off"); return; }
  listen();
  state.timer = setInterval(() => { if (!document.hidden) syncNow(); }, 30e3);
  syncNow();
}
function stop(){ state.es?.close(); state.es = null; clearInterval(state.timer); state.timer = null; state.url = ""; setStatus("off"); }

window.addEventListener("online", () => syncSoon(0));
document.addEventListener("visibilitychange", () => { if (!document.hidden) syncSoon(0); });

window.Sync = { state, start, stop, syncNow, syncSoon, probe, api };
})();

// Service worker: guarda la app en el dispositivo para que abra sin internet.
//
// - Archivos de la app: se sirven desde la copia guardada y se actualizan en
//   segundo plano cuando hay internet (la versión nueva se ve al volver a abrir).
// - Archivos de otros sitios (lector de códigos de barras y tipografías): se
//   guardan la primera vez que se usan y desde ahí se sirven sin internet.
//
// Al cambiar cualquier archivo de la app, sube VERSION para que todos los
// dispositivos descarguen la copia nueva.
const VERSION = "v11";
const APP = "app-" + VERSION, EXT = "externos-v1";
const FILES = ["./", "local-db.js", "catalogos.js", "sync.js", "qr.js", "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(APP).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== APP && k !== EXT).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // El servidor (sincronización, tiempo real y panel de PocketBase) nunca se guarda en caché
  if (url.origin === location.origin && /\/(api|_)\//.test(url.pathname)) return;
  // La página pública de la tienda es para los clientes: siempre se pide al servidor
  if (url.origin === location.origin && url.pathname.endsWith("/tienda.html")) return;
  if (url.origin === location.origin){
    // Al abrir la app (cualquier dirección dentro de ella) se entrega la página principal.
    // Se guarda como "./" y no como "index.html" porque algunos servidores (PocketBase)
    // redirigen index.html a la raíz.
    const key = req.mode === "navigate" ? "./" : req;
    e.respondWith(caches.open(APP).then(async c => {
      const hit = await c.match(key, { ignoreSearch:true });
      const fresh = fetch(req).then(r => { if (r.ok && r.type === "basic") c.put(key, r.clone()); return r; }).catch(() => null);
      if (hit){ e.waitUntil(fresh); return hit; }
      return (await fresh) || new Response("Sin conexión", { status:503, headers:{ "Content-Type":"text/plain; charset=utf-8" } });
    }));
    return;
  }
  if (/^(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(url.hostname)){
    e.respondWith(caches.open(EXT).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok || r.type === "opaque") c.put(req, r.clone());
      return r;
    }));
  }
});

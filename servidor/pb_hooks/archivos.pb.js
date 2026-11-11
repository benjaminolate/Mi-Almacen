/// <reference path="../pb_data/types.d.ts" />
// El servidor sirve la carpeta del repo como sitio (--publicDir=..), pero de ella solo entrega
// los archivos de la app. Así no se pueden descargar las notas, el historial de git, las pruebas
// ni un respaldo que alguien haya guardado ahí, ni desde el wifi ni desde internet.

routerUse((e) => {
  const path = String(e.request.url.path || "/");
  if (path.indexOf("/api/") === 0 || path.indexOf("/_/") === 0) return e.next();
  // La lista va aquí dentro porque en PocketBase cada pedido corre por separado
  const APP = ["/", "/index.html", "/tienda.html", "/sw.js", "/local-db.js", "/sync.js", "/catalogos.js", "/pagina.js", "/qr.js",
    "/manifest.webmanifest", "/icons/icon.svg", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-maskable-512.png"];
  if (APP.indexOf(path) >= 0) return e.next();
  throw new NotFoundError("No existe.");
});

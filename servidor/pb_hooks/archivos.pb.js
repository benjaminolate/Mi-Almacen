/// <reference path="../pb_data/types.d.ts" />
// Todo pedido al servidor pasa primero por aquí.
//
// 1. Encabezados de seguridad, en todas las respuestas (también en los errores):
//    - nosniff: el navegador no adivina el tipo de un archivo (un .json no se ejecuta como código);
//    - frame-ancestors y X-Frame-Options: ninguna otra página puede mostrar la app dentro de la suya
//      para engañar a quien atiende con clics falsos;
//    - Referrer-Policy: al abrir un link a WhatsApp o un mapa, no se manda la dirección de la tienda.
//    Van aquí y no en otro archivo porque la lista de abajo corta el pedido antes de que corra otro.
//
// 2. El servidor sirve la carpeta del repo como sitio (--publicDir=..), pero de ella solo entrega
//    los archivos de la app. Así no se pueden descargar las notas, el historial de git, las pruebas
//    ni un respaldo que alguien haya guardado ahí, ni desde el wifi ni desde internet.

routerUse((e) => {
  const h = e.response.header();
  h.set("X-Content-Type-Options", "nosniff");
  h.set("X-Frame-Options", "DENY");
  h.set("Content-Security-Policy", "frame-ancestors 'none'");
  h.set("Referrer-Policy", "same-origin");

  const path = String(e.request.url.path || "/");
  if (path.indexOf("/api/") === 0 || path.indexOf("/_/") === 0) return e.next();
  // La lista va aquí dentro porque en PocketBase cada pedido corre por separado
  const APP = ["/", "/index.html", "/estilos.css", "/app.js", "/tienda.html", "/sw.js", "/local-db.js", "/sync.js", "/catalogos.js", "/pagina.js", "/qr.js",
    "/manifest.webmanifest", "/icons/icon.svg", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-maskable-512.png"];
  if (APP.indexOf(path) >= 0) return e.next();
  throw new NotFoundError("No existe.");
});

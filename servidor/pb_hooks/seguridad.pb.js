/// <reference path="../pb_data/types.d.ts" />
// Encabezados de seguridad en todas las respuestas del servidor (app, página de la tienda y API):
// - nosniff: el navegador no adivina el tipo de un archivo (un .json no se ejecuta como código);
// - frame-ancestors y X-Frame-Options: ninguna otra página puede mostrar la app dentro de la suya
//   para engañar a quien atiende con clics falsos;
// - Referrer-Policy: al abrir un link a WhatsApp o un mapa, no se manda la dirección de la tienda.

routerUse((e) => {
  const h = e.response.header();
  h.set("X-Content-Type-Options", "nosniff");
  h.set("X-Frame-Options", "DENY");
  h.set("Content-Security-Policy", "frame-ancestors 'none'");
  h.set("Referrer-Policy", "same-origin");
  return e.next();
});

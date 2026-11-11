// El servidor manda encabezados de seguridad en todo: la app, la página de la tienda, la API y
// también en las respuestas de error.
const test = require("node:test");
const assert = require("node:assert/strict");
const h = require("./ayuda");

const falta = h.faltaPocketBase();
const ESPERADOS = { "x-content-type-options":"nosniff", "x-frame-options":"DENY",
  "content-security-policy":"frame-ancestors 'none'", "referrer-policy":"same-origin" };

test("el servidor manda los encabezados de seguridad", { skip:falta || false }, async () => {
  const pb = await h.prenderServidor(), browser = await h.navegador();
  try {
    for (const ruta of ["/", "/tienda.html", "/sw.js", "/api/sync/estado", "/no-existe", "/api/publico/noexiste12345"]){
      const r = await fetch(pb.url + ruta);
      for (const [k, v] of Object.entries(ESPERADOS)) assert.equal(r.headers.get(k), v, `${ruta}: ${k}`);
    }
    // La app sigue abriendo y creando una tienda con los encabezados puestos
    const { page } = await h.dispositivo(browser);
    await h.crearTienda(page, pb.url);
    await h.esperarSincronizado(page);
    assert.deepEqual(page.errores, []);
  } finally { await browser.close(); await pb.apagar(); }
});

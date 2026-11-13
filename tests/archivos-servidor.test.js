// El servidor solo entrega los archivos de la app: ni las notas, ni git, ni las pruebas, ni un
// respaldo guardado en la carpeta del repo.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const h = require("./ayuda");

const falta = h.faltaPocketBase();
const estado = async (url, ruta) => (await fetch(url + ruta)).status;

test("el servidor solo entrega los archivos de la app", { skip:falta || false }, async () => {
  // Un respaldo que alguien dejó en la carpeta del repo (está en .gitignore, nunca se sube)
  const respaldo = path.join(h.RAIZ, "respaldo-prueba-servidor.json");
  fs.writeFileSync(respaldo, JSON.stringify({ app:"mi-almacen", tablas:{} }));
  const pb = await h.prenderServidor(), browser = await h.navegador();
  try {
    for (const ruta of ["/", "/index.html", "/estilos.css",
      "/js/base.js", "/js/acciones.js", "/js/escaner.js", "/js/navegacion.js", "/js/vender.js", "/js/inventario.js", "/js/fiados.js",
      "/js/pan.js", "/js/vitrina.js", "/js/extras-venta.js", "/js/gestion.js", "/js/resumen.js", "/js/ayuda.js", "/js/ajustes.js",
      "/js/datos.js", "/js/render.js", "/js/abrir.js", "/js/cuentas.js", "/js/arranque.js",
      "/tienda.html", "/sw.js", "/local-db.js", "/sync.js", "/catalogos.js", "/pagina.js",
      "/qr.js", "/manifest.webmanifest", "/icons/icon.svg", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-maskable-512.png",
      "/api/sync/estado"])
      assert.equal(await estado(pb.url, ruta), 200, ruta);
    for (const ruta of ["/respaldo-prueba-servidor.json", "/.git/HEAD", "/.gitignore", "/CLAUDE.md", "/docs/ESTADO-Y-PLAN.md",
      "/servidor/INSTRUCCIONES.md", "/servidor/pb_hooks/comun.js", "/tests/package.json", "/tests/", "/docs/", "/no-existe"])
      assert.equal(await estado(pb.url, ruta), 404, ruta);
    // La app abre igual desde el servidor y crea una tienda
    const { page } = await h.dispositivo(browser);
    await h.crearTienda(page, pb.url);
    assert.deepEqual(page.errores, []);
  } finally { await browser.close(); await pb.apagar(); fs.rmSync(respaldo, { force:true }); }
});

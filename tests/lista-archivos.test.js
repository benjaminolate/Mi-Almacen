// Cada archivo que index.html necesita para abrir tiene que estar en la copia sin internet (FILES de
// sw.js) y en la lista de lo que entrega el servidor (APP de archivos.pb.js). Si falta en una, la app
// no abre sin internet o el servidor responde "No existe".
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const h = require("./ayuda");

const leer = f => fs.readFileSync(path.join(h.RAIZ, f), "utf8");
const lista = (texto, nombre) => JSON.parse("[" + texto.match(new RegExp(`const ${nombre} = \\[([^\\]]*)\\]`))[1].replace(/,\s*$/, "") + "]");

test("lo que carga index.html se guarda para abrir sin internet y lo entrega el servidor", () => {
  const html = leer("index.html");
  const propios = [...html.matchAll(/<(?:script src|link rel="stylesheet" href)="([^"]+)"/g)].map(m => m[1]).filter(u => !/^https?:/.test(u));
  assert.ok(propios.includes("js/arranque.js") && propios.includes("estilos.css"), "no se leyó bien index.html");
  // arranque.js abre la app: tiene que ir al final, con todo lo demás ya cargado
  assert.equal(propios[propios.length - 1], "js/arranque.js");
  const files = lista(leer("sw.js"), "FILES"), app = lista(leer("servidor/pb_hooks/archivos.pb.js"), "APP");
  for (const f of propios){
    assert.ok(files.includes(f), `${f} no está en FILES de sw.js`);
    assert.ok(app.includes("/" + f), `/${f} no está en APP de archivos.pb.js`);
    assert.ok(fs.existsSync(path.join(h.RAIZ, f)), `${f} no existe`);
  }
  // Y al revés: nada de la lista apunta a un archivo que ya no existe
  for (const f of files.filter(f => f !== "./")) assert.ok(fs.existsSync(path.join(h.RAIZ, f)), `${f} está en FILES pero no existe`);
});

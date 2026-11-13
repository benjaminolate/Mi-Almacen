// El panel de administración y la API interna no se abren desde internet, aunque quien pide escriba
// "localhost" en el encabezado Host (antes bastaba con eso). Lo que llega por un túnel o por Caddy
// entra por 127.0.0.1, así que eso cuenta como internet. Desde otro equipo del wifi el panel sí abre.
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const os = require("node:os");
const h = require("./ayuda");

const falta = h.faltaPocketBase();

// fetch no deja cambiar el encabezado Host; http.request sí
const pedir = (url, ruta, encabezados = {}) => new Promise((ok, mal) => {
  const u = new URL(url);
  const r = http.request({ host:u.hostname, port:u.port, path:ruta, headers:encabezados }, res => { res.resume(); ok(res.statusCode); });
  r.on("error", mal);
  r.end();
});

// Una IP de este equipo en una red privada (como la del wifi de la tienda)
const ipPrivada = () => Object.values(os.networkInterfaces()).flat()
  .find(i => i && i.family === "IPv4" && !i.internal && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(i.address))?.address;

const CERRADAS = ["/_/", "/api/collections/cambios/records", "/api/collections/_superusers/auth-with-password", "/api/backups"];

test("desde internet el panel y la API interna quedan cerrados, aunque digan ser localhost", { skip:falta || false }, async () => {
  const pb = await h.prenderServidor();
  try {
    const puerto = new URL(pb.url).port;
    for (const ruta of CERRADAS){
      assert.equal(await pedir(pb.url, ruta), 403, `${ruta} directo`);
      assert.equal(await pedir(pb.url, ruta, { Host:`localhost:${puerto}` }), 403, `${ruta} con Host localhost`);
      assert.equal(await pedir(pb.url, ruta, { Host:"127.0.0.1" }), 403, `${ruta} con Host 127.0.0.1`);
      assert.equal(await pedir(pb.url, ruta, { Host:"192.168.1.10:8090" }), 403, `${ruta} con Host del wifi`);
    }
    // Lo que usan la app y la página de la tienda sigue respondiendo
    for (const ruta of ["/", "/tienda.html", "/api/sync/estado", "/api/health"]) assert.equal(await pedir(pb.url, ruta), 200, ruta);
  } finally { await pb.apagar(); }
});

test("desde el wifi el panel abre, pero no si el pedido viene reenviado desde internet", { skip:falta || false }, async t => {
  const ip = ipPrivada();
  if (!ip) return t.skip("este equipo no tiene una IP de red privada para simular el wifi");
  const pb = await h.prenderServidor({ host:ip });
  try {
    assert.ok(await pedir(pb.url, "/_/") < 400, "el panel debería abrir desde el wifi");
    for (const enc of [{ "X-Forwarded-For":"203.0.113.7" }, { "Cf-Connecting-Ip":"203.0.113.7" }, { "X-Real-Ip":"203.0.113.7" }, { Forwarded:"for=203.0.113.7" }])
      assert.equal(await pedir(pb.url, "/_/", enc), 403, `con ${Object.keys(enc)[0]}`);
  } finally { await pb.apagar(); }
});

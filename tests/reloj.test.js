// Reloj de los cambios (sello hlc): un sello del futuro no arrastra el reloj del dispositivo, y
// el contador nunca pasa de 4 cifras, que es lo que acepta el servidor.
const test = require("node:test");
const assert = require("node:assert/strict");
const h = require("./ayuda");

const FORMATO = /^\d{13}-\d{4}-[0-9a-z]{1,16}$/;   // el mismo que revisa servidor/pb_hooks/sync.pb.js

test("un sello del futuro no arrastra el reloj y el contador no se desborda", async () => {
  const app = await h.servirApp(), browser = await h.navegador();
  try {
    const { page } = await h.dispositivo(browser);
    await h.crearTienda(page, app.url);
    const r = await page.evaluate(() => {
      const ahora = Date.now();
      LocalDB.seen(`${ahora + 365 * 864e5}-0005-otro`);       // un celular con la fecha un año adelantada
      const trasFuturo = LocalDB.tick();
      LocalDB.seen(`${ahora + 60e3}-0003-otro`);               // un minuto adelante: sí se sigue
      const trasMinuto = LocalDB.tick();
      // Muchos cambios en el mismo milisegundo (por ejemplo, con el reloj ya adelantado)
      LocalDB.clock.ms = ahora + 3600e3; LocalDB.clock.n = 9998;
      const sellos = [LocalDB.tick(), LocalDB.tick(), LocalDB.tick()];
      return { ahora, trasFuturo, trasMinuto, sellos };
    });
    assert.ok(+r.trasFuturo.split("-")[0] < r.ahora + 864e5, "siguió el sello del futuro: " + r.trasFuturo);
    assert.ok(+r.trasMinuto.split("-")[0] >= r.ahora + 60e3, "no siguió un sello cercano: " + r.trasMinuto);
    for (const s of [r.trasFuturo, r.trasMinuto, ...r.sellos]) assert.match(s, FORMATO);
    // Siempre en orden, aunque el contador vuelva a cero
    assert.deepEqual([...r.sellos].sort(), r.sellos);
    assert.equal(new Set(r.sellos).size, 3);

    // Después de todo eso, la app sigue vendiendo
    await h.venderUno(page, "arroz", 1500);
    assert.deepEqual(page.errores, []);
  } finally { await browser.close(); await app.cerrar(); }
});

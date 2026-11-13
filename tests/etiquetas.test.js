// Las etiquetas chicas de color ("Debe $X", "Al día", "Contado", "Hay", "Quedan pocos") se leen:
// al menos 4,5 a 1 en claro y en oscuro, en la app y en la página de la tienda.
const test = require("node:test");
const assert = require("node:assert/strict");
const h = require("./ayuda");

// Contraste de cada etiqueta visible contra su propio fondo
const medir = () => [...document.querySelectorAll(".pill")].filter(e => e.offsetParent).map(e => {
  const s = getComputedStyle(e), rgb = c => c.match(/\d+/g).slice(0, 3).map(Number);
  const lum = c => { const [r, g, b] = rgb(c).map(x => { x /= 255; return x <= .03928 ? x/12.92 : ((x+.055)/1.055) ** 2.4; }); return .2126*r + .7152*g + .0722*b; };
  const [x, y] = [lum(s.backgroundColor), lum(s.color)].sort((p, q) => q - p);
  return { texto:e.textContent.trim(), contraste:(x + .05) / (y + .05) };
});
const bajas = (lista, donde) => lista.filter(p => p.contraste < 4.5).map(p => `${donde}: "${p.texto}" ${p.contraste.toFixed(2)} a 1`);

test("las etiquetas de la app se leen en claro y oscuro", async () => {
  const app = await h.servirApp(), browser = await h.navegador();
  try {
    const { page } = await h.dispositivo(browser);
    await page.goto(app.url + "/");
    await page.click("#sdemo");
    await page.waitForSelector("#tabs [data-view]");
    const malas = [];
    let vistas = 0;
    for (const modo of ["claro", "oscuro"]){
      await page.evaluate(modo => { meta.prefs = Object.assign({}, meta.prefs, { modo }); applyTheme(); }, modo);
      for (const v of ["inicio", "contar", "fiados", "productos"]){
        await h.irA(page, v);
        const lista = await page.evaluate(medir);
        vistas += lista.length;
        malas.push(...bajas(lista, `${v} en ${modo}`));
        if (v === "fiados") await h.captura(page, `etiquetas-fiados-${modo}`);
      }
    }
    assert.ok(vistas > 0, "no se encontró ninguna etiqueta para medir");
    assert.deepEqual(malas, []);
    assert.deepEqual(page.errores, []);
  } finally { await browser.close(); await app.cerrar(); }
});

const VITRINA = { v:1, nombre:"Almacén Etiquetas", reservas:true, stock:true, diasMax:1, porPersona:3, links:[],
  productos:[{ id:"p1", n:"Marraqueta", c:"Pan", p:2400, r:1, s:"hay" }, { id:"p2", n:"Hallulla", c:"Pan", p:2400, r:1, s:"poco" },
    { id:"p3", n:"Leche", c:"Lácteos", p:1150, r:0, s:"no" }] };

test("las etiquetas de la página de la tienda se leen en claro y oscuro", async () => {
  const app = await h.servirApp(), browser = await h.navegador();
  try {
    const malas = [];
    for (const colorScheme of ["light", "dark"]){
      const { page } = await h.dispositivo(browser, { colorScheme });
      await page.route("**/api/publico/**", r => r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify(VITRINA) }));
      await page.goto(app.url + "/tienda.html?t=abcdefghij12");
      await page.waitForSelector(".pill");
      const lista = await page.evaluate(medir);
      assert.equal(lista.length, 3);
      malas.push(...bajas(lista, `tienda en ${colorScheme === "light" ? "claro" : "oscuro"}`));
      assert.deepEqual(page.errores, []);
    }
    assert.deepEqual(malas, []);
  } finally { await browser.close(); await app.cerrar(); }
});

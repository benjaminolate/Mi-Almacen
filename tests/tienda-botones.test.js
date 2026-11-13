// Página pública de la tienda: el botón de WhatsApp usa el color de texto de la página (no el azul de
// los links), y con un color de tienda claro la letra del botón de reservar se sigue leyendo.
const test = require("node:test");
const assert = require("node:assert/strict");
const h = require("./ayuda");

const VITRINA = { v:1, nombre:"Almacén Claro", whatsapp:"56912345678", color:"#4caf50", reservas:true, stock:true, diasMax:1, porPersona:3,
  links:[], productos:[{ id:"p1", n:"Marraqueta", c:"Pan", p:2400, r:1, s:"hay" }] };

const contrasteDe = sel => document.querySelectorAll(sel).length && (() => {
  const s = getComputedStyle(document.querySelector(sel)), rgb = c => c.match(/\d+/g).slice(0, 3).map(Number);
  const lum = c => { const [r, g, b] = rgb(c).map(x => { x /= 255; return x <= .03928 ? x/12.92 : ((x+.055)/1.055) ** 2.4; }); return .2126*r + .7152*g + .0722*b; };
  const [x, y] = [lum(s.backgroundColor), lum(s.color)].sort((p, q) => q - p);
  return (x + .05) / (y + .05);
})();

test("los botones de la página de la tienda se leen y no salen con el azul de los links", async () => {
  const app = await h.servirApp(), browser = await h.navegador();
  try {
    const { page } = await h.dispositivo(browser, { colorScheme:"light" });
    await page.route("**/api/publico/**", r => r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify(VITRINA) }));
    await page.goto(app.url + "/tienda.html?t=abcdefghij12");
    await page.waitForSelector("h1");

    const wa = page.locator("a.btn", { hasText:"Escribir por WhatsApp" });
    const [colorWa, colorTexto] = await Promise.all([wa.evaluate(a => getComputedStyle(a).color), page.locator("h1").evaluate(e => getComputedStyle(e).color)]);
    assert.equal(colorWa, colorTexto);

    await page.click('[data-inc="p1"]');
    await page.waitForSelector("#go:visible");
    const c = await page.evaluate(contrasteDe, "#go");
    assert.ok(c >= 4.5, `el botón de reservar tiene contraste ${c.toFixed(2)} a 1`);
    await h.captura(page, "tienda-botones");
    assert.deepEqual(page.errores, []);
  } finally { await browser.close(); await app.cerrar(); }
});

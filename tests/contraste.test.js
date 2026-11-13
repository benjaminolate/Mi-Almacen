// La letra de los botones principales tiene que leerse sobre el color de la tienda, con cada paleta y
// en claro y oscuro: al menos 4,5 a 1. En oscuro, los colores son más claros y la letra blanca no servía.
const test = require("node:test");
const assert = require("node:assert/strict");
const h = require("./ayuda");

test("la letra sobre el color de la tienda se lee en todas las paletas, en claro y oscuro", async () => {
  const app = await h.servirApp(), browser = await h.navegador();
  try {
    const { page } = await h.dispositivo(browser);
    await h.crearTienda(page, app.url);
    // Un producto en la venta, para que el botón "Confirmar venta" esté a la vista
    await h.irA(page, "vender");
    await page.fill("#q", "a");
    await page.click("#res [data-pick]");
    if (await page.locator("#ppr").count()){ await page.fill("#ppr", "1000"); await page.click("#pprok"); }
    await page.waitForSelector("#confirm:not([disabled])");

    const paletas = await page.evaluate(() => [...Object.keys(PALETAS), "propia"]);
    const malos = [];
    for (const paleta of paletas) for (const modo of ["claro", "oscuro"]){
      const r = await page.evaluate(({ paleta, modo }) => {
        // "Mis colores": un verde claro, de los que antes quedaban con letra blanca
        S.ajustes.apariencia = Object.assign({}, S.ajustes.apariencia, { paleta, brand:"#4caf50", accent:"#ffc107" });
        meta.prefs = Object.assign({}, meta.prefs, { modo });
        applyTheme();
        const b = getComputedStyle(document.querySelector("#confirm"));
        const rgb = c => c.match(/\d+/g).slice(0, 3).map(Number);
        const lumi = c => { const [r, g, b] = rgb(c).map(x => { x /= 255; return x <= .03928 ? x/12.92 : ((x+.055)/1.055) ** 2.4; }); return .2126*r + .7152*g + .0722*b; };
        const [x, y] = [lumi(b.backgroundColor), lumi(b.color)].sort((p, q) => q - p);
        return { fondo:b.backgroundColor, letra:b.color, contraste:(x + .05) / (y + .05) };
      }, { paleta, modo });
      if (r.contraste < 4.5) malos.push(`${paleta} en ${modo}: ${r.contraste.toFixed(2)} a 1 (${r.letra} sobre ${r.fondo})`);
      if (paleta === "verde") await h.captura(page, `contraste-verde-${modo}`);
    }
    assert.deepEqual(malos, []);
    assert.deepEqual(page.errores, []);
  } finally { await browser.close(); await app.cerrar(); }
});

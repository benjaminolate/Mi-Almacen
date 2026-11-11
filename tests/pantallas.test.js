// Pantallas en un celular chico (360 px): en claro, oscuro y letra grande, ninguna pantalla
// principal se sale hacia el costado ni tira errores. Deja capturas en tests/capturas/.
const test = require("node:test");
const assert = require("node:assert/strict");
const h = require("./ayuda");

const PANTALLAS = ["inicio", "vender", "recibir", "contar", "fiados", "resumen", "productos", "mas", "datos", "apariencia"];

async function revisar(page, modo){
  const malas = [];
  for (const v of PANTALLAS){
    await h.irA(page, v);
    await page.waitForTimeout(150);
    const ancho = await page.evaluate(() => ({ pagina:document.documentElement.scrollWidth, ventana:innerWidth }));
    if (ancho.pagina > ancho.ventana) malas.push(`${v}: mide ${ancho.pagina} px en una ventana de ${ancho.ventana} px`);
    await h.captura(page, `${modo}-${v}`);
  }
  return malas;
}

async function apariencia(page, modo, letra){
  await h.irA(page, "apariencia");
  await page.click(`[data-modo="${modo}"]`);
  await page.click(`[data-letra="${letra}"]`);
  await page.waitForFunction(l => (document.documentElement.dataset.letra || "normal") === l, letra);
}

test("las pantallas principales caben en 360 px en claro, oscuro y letra grande", async () => {
  const app = await h.servirApp(), browser = await h.navegador();
  try {
    const { page } = await h.dispositivo(browser);
    await h.crearTienda(page, app.url);
    await h.venderUno(page, "arroz", 1500);

    await apariencia(page, "claro", "normal");
    const malas = await revisar(page, "claro");
    await apariencia(page, "oscuro", "normal");
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "dark");
    malas.push(...await revisar(page, "oscuro"));
    await apariencia(page, "claro", "grande");
    malas.push(...await revisar(page, "letra-grande"));

    assert.deepEqual(malas, [], "pantallas que se salen del ancho del celular");
    assert.deepEqual(page.errores, []);
  } finally { await browser.close(); await app.cerrar(); }
});

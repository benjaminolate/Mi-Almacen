// Todo lo que se toca en las pantallas principales mide al menos 44 × 44 px, para no errar con el
// dedo en un celular chico. Una casilla cuenta con su texto (se toca el texto también).
const test = require("node:test");
const assert = require("node:assert/strict");
const h = require("./ayuda");

const chicos = () => {
  const vis = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && el.closest("[hidden]") == null; };
  const desc = el => (el.id ? "#" + el.id + " " : "") + (el.getAttribute("aria-label") || el.textContent || el.placeholder || el.tagName).trim().replace(/\s+/g, " ").slice(0, 40);
  const malos = [];
  for (const el of document.querySelectorAll("button, a[href], input:not([type=hidden]), select, textarea, [role=button]")){
    if (!vis(el) || el.type === "file") continue;
    let r = el.getBoundingClientRect();
    if (el.matches("input[type=checkbox], input[type=radio]") && el.closest("label")) r = el.closest("label").getBoundingClientRect();
    // Medio píxel de tolerancia por el redondeo de las letras
    if (r.height < 43.5 || r.width < 43.5) malos.push(`${desc(el)} (${Math.round(r.width)}×${Math.round(r.height)})`);
  }
  return malos;
};

async function revisar(page, donde, malos){ for (const m of await page.evaluate(chicos)) malos.push(`${donde}: ${m}`); }

async function agregarCoca(page){
  await page.fill("#q", "coca");
  await page.click("#res [data-pick] >> nth=0");
  if (await page.locator("#ppr").count()){ await page.fill("#ppr", "1990"); await page.click("#pprok"); }
}

test("lo que se toca en las pantallas principales mide al menos 44 px", async () => {
  const app = await h.servirApp(), browser = await h.navegador();
  try {
    const { page } = await h.dispositivo(browser);
    await page.goto(app.url + "/");
    await page.click("#sdemo");
    await page.waitForSelector("#tabs [data-view]");
    const malos = [];

    await h.irA(page, "vender");
    await agregarCoca(page);
    await page.waitForSelector("#confirm:not([disabled])");
    await revisar(page, "vender", malos);
    await h.captura(page, "tactil-vender");

    await h.irA(page, "recibir");
    await agregarCoca(page);
    await page.waitForSelector("[data-rcaja]");
    await revisar(page, "recibir", malos);
    await h.captura(page, "tactil-recibir");

    await h.irA(page, "contar");
    await revisar(page, "contar", malos);
    await page.click('[data-sector="Bebidas"]');
    await page.waitForSelector("[data-cq]");
    await revisar(page, "contar sector", malos);
    await h.captura(page, "tactil-contar");

    await h.irA(page, "fiados");
    await revisar(page, "fiados", malos);
    await h.irA(page, "resumen");
    await revisar(page, "resumen", malos);
    await h.captura(page, "tactil-resumen");

    assert.deepEqual(malos, []);
    assert.deepEqual(page.errores, []);
  } finally { await browser.close(); await app.cerrar(); }
});

const VITRINA = { v:1, nombre:"Almacén Táctil", whatsapp:"56912345678", reservas:true, stock:true, diasMax:1, porPersona:3,
  links:[{ tipo:"maps", titulo:"Cómo llegar", valor:"https://maps.google.com/?q=Los+Aromos+123" }],
  productos:[{ id:"p1", n:"Marraqueta", c:"Pan", p:2400, r:1, s:"hay", kg:1 }, { id:"p2", n:"Coca-Cola 1,5 L", c:"Bebidas", p:1990, r:1, s:"hay" }] };

test("lo que se toca en la página de la tienda mide al menos 44 px", async () => {
  const app = await h.servirApp(), browser = await h.navegador();
  try {
    const { page } = await h.dispositivo(browser);
    await page.route("**/api/publico/**", r => r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify(VITRINA) }));
    await page.goto(app.url + "/tienda.html?t=abcdefghij12");
    await page.waitForSelector("h1");
    await page.click('[data-inc="p2"]');
    await page.waitForSelector("#go:visible");
    const malos = [];
    await revisar(page, "tienda", malos);
    await h.captura(page, "tactil-tienda");
    assert.deepEqual(malos, []);
    assert.deepEqual(page.errores, []);
  } finally { await browser.close(); await app.cerrar(); }
});

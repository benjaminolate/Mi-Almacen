// Página pública de la tienda: lo que publica una tienda se muestra como texto, nunca como código,
// y solo se aceptan links web, de WhatsApp y de teléfono. La respuesta del servidor se simula.
const test = require("node:test");
const assert = require("node:assert/strict");
const h = require("./ayuda");

const MALO = `<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>"'><b>`;
const VITRINA = {
  v:1, nombre:MALO, mensaje:MALO, direccion:MALO, horario:"</p><svg onload=window.__xss=3>", whatsapp:"56912345678\"><img src=x onerror=window.__xss=4>",
  color:"red;}</style><script>window.__xss=5</script>", reservas:true, stock:true, diasMax:1, porPersona:3,
  foto:"data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9d2luZG93Ll9feHNzPTY+",
  links:[
    { tipo:"otro", titulo:MALO, valor:"javascript:window.__xss=7" },
    { tipo:"maps", titulo:"Mapa", valor:"data:text/html,<script>window.__xss=8</script>" },
    { tipo:"whatsapp", titulo:"WA", valor:"9 1234 5678\" onclick=\"window.__xss=9" },
    { tipo:"__proto__", titulo:"raro", valor:"https://ejemplo.cl" }
  ],
  productos:[
    { id:"p1", n:MALO, c:MALO, p:1000, r:1, s:"hay" },
    { id:"p2\"><img src=x onerror=window.__xss=10>", n:"Pan", c:"Pan", p:"<b>gratis</b>", r:1, s:"<i>x</i>" }
  ]
};

test("la página de la tienda muestra textos maliciosos como texto", async () => {
  const app = await h.servirApp(), browser = await h.navegador();
  try {
    const { page } = await h.dispositivo(browser);
    const dialogos = [];
    page.on("dialog", d => { dialogos.push(d.message()); d.dismiss(); });
    await page.route("**/api/publico/**", r => r.fulfill({ status:200, contentType:"application/json", body:JSON.stringify(VITRINA) }));
    await page.goto(app.url + "/tienda.html?t=abcdefghij12");
    await page.waitForSelector("h1");
    await page.fill("#q", "img");
    await page.fill("#q", "");
    await page.waitForTimeout(500);

    assert.equal(await page.evaluate(() => window.__xss), undefined, "se ejecutó código de la vitrina");
    assert.deepEqual(dialogos, []);
    // El nombre se ve tal cual, como texto
    assert.equal((await page.textContent("h1")).trim(), MALO);
    assert.equal(await page.locator("#app img[src='x'], #app script, #app svg[onload]").count(), 0);
    // Solo links seguros, y la foto que no es una imagen permitida no se muestra
    const hrefs = await page.$$eval("#app a[href]", as => as.map(a => a.getAttribute("href")));
    for (const href of hrefs) assert.match(href, /^(https:\/\/|tel:\+)/, "link no permitido: " + href);
    assert.equal(await page.locator(".avatar img").count(), 0);
    // El color malicioso no se aplica
    assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue("--brand")), "");
    assert.deepEqual(page.errores, []);
  } finally { await browser.close(); await app.cerrar(); }
});

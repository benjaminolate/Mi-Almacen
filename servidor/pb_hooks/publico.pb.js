/// <reference path="../pb_data/types.d.ts" />
// Página pública de la tienda (tienda.html) y reservas por internet.
//
// POST /api/publico/publicar             la app de la tienda sube lo que se muestra (con el código de la tienda)
// GET  /api/publico/{pid}                los clientes leen la vitrina (sin el código de la tienda)
// POST /api/publico/{pid}/reserva        un cliente reserva; llega a la app como una reserva más
// GET  /api/publico/{pid}/reserva/{id}   el cliente revisa si su reserva fue confirmada
//
// Además, lo que llega por internet (por el túnel) solo puede usar la app, la página pública
// y la sincronización: el panel de administración y el resto de la API quedan solo para el wifi.

routerUse((e) => {
  const c = require(`${__hooks}/comun.js`);
  if (!c.desdeInternet(e)) return e.next();
  const path = String(e.request.url.path || "/");
  const permitido = path.indexOf("/api/") !== 0 && path.indexOf("/_/") !== 0 && path.indexOf("/servidor/") !== 0 && path.indexOf("/.") < 0;
  if (permitido || /^\/api\/(publico\/|sync$|sync\/estado$|realtime$|health$)/.test(path)) return e.next();
  throw new ForbiddenError("Esto solo se puede abrir desde el wifi de la tienda.");
});

routerAdd("POST", "/api/publico/publicar", (e) => {
  const c = require(`${__hooks}/comun.js`);
  const body = e.requestInfo().body || {};
  const tienda = String(body.tienda || ""), pid = String(body.pid || "");
  if (!c.UUID.test(tienda) || !c.PID.test(pid)) throw new BadRequestError("Datos no válidos");
  if (JSON.stringify(body.data || {}).length > 450000) throw new BadRequestError("La vitrina es demasiado grande");
  if ($app.countRecords("cambios", $dbx.hashExp({ tienda: tienda })) === 0) throw new BadRequestError("El servidor no tiene datos de esa tienda");

  let r = null;
  try { r = $app.findFirstRecordByData("vitrinas", "pid", pid); } catch (err) { r = null; }
  if (r && r.getString("tienda") !== tienda) throw new ForbiddenError("Ese link es de otra tienda");
  if (!r) r = new Record($app.findCollectionByNameOrId("vitrinas"));
  r.set("pid", pid);
  r.set("tienda", tienda);
  r.set("activo", !!body.activo);
  r.set("data", body.data || {});
  r.set("privado", body.privado || {});
  $app.save(r);
  // Si la tienda cambió su link, el anterior deja de funcionar
  for (const v of $app.findRecordsByFilter("vitrinas", "tienda = {:t} && pid != {:p}", "", 50, 0, { t: tienda, p: pid })) $app.delete(v);
  return e.json(200, { ok: true });
});

routerAdd("GET", "/api/publico/{pid}", (e) => {
  let r = null;
  try { r = $app.findFirstRecordByData("vitrinas", "pid", e.request.pathValue("pid")); } catch (err) { r = null; }
  if (!r || !r.getBool("activo")) throw new NotFoundError("Esta tienda no tiene su página activa.");
  e.response.header().set("Cache-Control", "no-store");
  return e.json(200, Object.assign(JSON.parse(r.getString("data") || "{}"), { hora: Date.now() }));
});

routerAdd("POST", "/api/publico/{pid}/reserva", (e) => {
  const c = require(`${__hooks}/comun.js`);
  const ip = c.ipCliente(e);
  if (!c.limite("ip:" + ip, 20, 3600e3)) throw new TooManyRequestsError("Demasiados intentos. Espera un rato y vuelve a intentar.");
  let r = null;
  try { r = $app.findFirstRecordByData("vitrinas", "pid", e.request.pathValue("pid")); } catch (err) { r = null; }
  if (!r || !r.getBool("activo")) throw new NotFoundError("Esta tienda no tiene su página activa.");
  const data = JSON.parse(r.getString("data") || "{}"), priv = JSON.parse(r.getString("privado") || "{}");
  if (!data.reservas) throw new ForbiddenError("La tienda no está recibiendo reservas por ahora.");

  const b = e.requestInfo().body || {};
  // Trampa para robots: un campo escondido que una persona nunca llena
  if (b.web) throw new BadRequestError("No se pudo enviar la reserva.");
  // Una persona tarda más de unos segundos en elegir y llenar el formulario (ms: tiempo en la página, medido en su celular)
  const ahora = Date.now();
  if (!(+b.ms >= 3000)) throw new BadRequestError("Espera un momento y vuelve a intentar.");
  const nombre = String(b.nombre || "").replace(/\s+/g, " ").trim();
  if (nombre.length < 2 || nombre.length > 40) throw new BadRequestError("Escribe tu nombre.");
  let tel = String(b.telefono || "").replace(/\D/g, "");
  if (tel.length === 9 && tel[0] === "9") tel = "56" + tel;
  if (tel.length === 8) tel = "569" + tel;
  if (!/^569\d{8}$/.test(tel)) throw new BadRequestError("Escribe un celular válido, por ejemplo 9 1234 5678.");
  if ((priv.bloqueados || []).indexOf(tel) >= 0) throw new ForbiddenError("La tienda no está recibiendo reservas de este número.");

  // Fecha: entre ayer y los días de anticipación que permite la tienda (el día exacto lo calcula el celular del cliente)
  const para = String(b.para || ""), dias = Math.max(0, Math.min(7, +data.diasMax || 0));
  const fechas = [];
  for (let d = -1; d <= dias + 1; d++) fechas.push(new Date(ahora + d * 864e5).toISOString().slice(0, 10));
  if (fechas.indexOf(para) < 0) throw new BadRequestError("Elige para qué día es la reserva.");
  const hora = String(b.hora || "").slice(0, 20), nota = String(b.nota || "").replace(/\s+/g, " ").trim().slice(0, 140);

  const prods = {};
  for (const p of data.productos || []) if (p.r) prods[p.id] = p;
  const items = [];
  for (const it of Array.isArray(b.items) ? b.items.slice(0, 15) : []) {
    const p = prods[it.id], q = Math.round((+it.q || 0) * 2) / 2;
    if (!p || q <= 0) continue;
    if (q > (p.kg ? 5 : 30) || (!p.kg && q !== Math.round(q))) throw new BadRequestError("Revisa la cantidad de " + p.n + ".");
    items.push({ pid: p.id, q: q });
  }
  if (!items.length) throw new BadRequestError("Elige qué quieres reservar.");

  if (!c.limite("tel:" + r.getString("pid") + ":" + tel, 3, 864e5)) throw new TooManyRequestsError("Ya hiciste varias reservas hoy. Si necesitas otra, escríbele a la tienda.");
  if (!c.limite("pid:" + r.getString("pid"), Math.max(1, +priv.maxDia || 40), 864e5)) throw new TooManyRequestsError("La tienda ya recibió todas las reservas que puede atender hoy.");

  const cant = (p, q) => String(q).replace(".", ",") + (p.kg ? " kg" : "");
  const detail = items.map((i) => cant(prods[i.pid], i.q) + " " + prods[i.pid].n.toLowerCase()).join(", ");
  const id = $security.randomStringWithAlphabet(20, "0123456789abcdef"), k = $security.randomString(16);
  c.guardarCambio(r.getString("tienda"), "reservas", { id: id, name: nombre, detail: detail, at: ahora, done: false, origen: "web", tel: tel, para: para, hora: hora, nota: nota, items: items, estado: "nueva", k: k });
  return e.json(200, { id: id, k: k, detail: detail });
});

routerAdd("GET", "/api/publico/{pid}/reserva/{id}", (e) => {
  let r = null;
  try { r = $app.findFirstRecordByData("vitrinas", "pid", e.request.pathValue("pid")); } catch (err) { r = null; }
  if (!r) throw new NotFoundError("Esta tienda no tiene su página activa.");
  const id = e.request.pathValue("id"), k = String(e.request.url.query().get("k") || "");
  const rows = $app.findRecordsByFilter("cambios", "tienda = {:t} && store = 'reservas' && (value.id = {:id} || del = {:id})", "-seq", 1, 0, { t: r.getString("tienda"), id: id });
  if (!rows.length) throw new NotFoundError("No encontramos esa reserva.");
  if (rows[0].getString("del")) return e.json(200, { estado: "cerrada" });
  const v = JSON.parse(rows[0].getString("value") || "{}");
  if (!k || v.k !== k) throw new NotFoundError("No encontramos esa reserva.");
  e.response.header().set("Cache-Control", "no-store");
  return e.json(200, { estado: v.done ? "entregada" : v.estado || "nueva", detail: v.detail, para: v.para, hora: v.hora, name: v.name });
});

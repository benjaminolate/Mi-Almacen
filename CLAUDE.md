# CLAUDE.md — Mi Almacén

App de inventario y ventas para negocios de barrio. Se instala desde el navegador (PWA), guarda
todo en el propio dispositivo (IndexedDB), funciona sin internet y se sincroniza con un servidor
PocketBase. El dueño del proyecto es Benjamin; no programa, así que todo lo que se le escribe va
en **español simple**.

- Repositorio oficial: `benjaminolate/Mi-Almacen`, rama `main`.
- `benjaminolate/Inventario_almacen_VD` es solo referencia: se lee, **nunca se modifica**.
- Estado y plan del proyecto: `docs/ESTADO-Y-PLAN.md`.

## Mapa del código

| Archivo | Qué hace |
|---|---|
| `index.html` | La página principal: carga los estilos y los scripts, en orden. |
| `js/*.js` | La app, repartida por tema. `base.js` (datos en memoria `S`, utilidades, catálogo), `acciones.js` (`act.*`: todo cambio pasa por `commit()` → `LocalDB.apply()`), un archivo por grupo de pantallas (`view*`), `render.js` (dibuja la pantalla actual) y `arranque.js` (abre la app; siempre al final). Cada archivo empieza con una línea que dice qué contiene. |
| `estilos.css` | Los estilos de la app (los colores de cada paleta se ponen aparte, en `<style id="tema">`). |
| `local-db.js` | `window.LocalDB`: IndexedDB `mi-almacen` (versión 2), bandeja de salida (`outbox`), reloj lógico `hlc`, respaldo (`exportAll`/`importAll`/`missing`). |
| `sync.js` | `window.Sync`: envía la bandeja a `POST /api/sync`, aplica lo recibido, tiempo real por `/api/realtime` y revisión cada 30 s. |
| `catalogos.js` | Productos típicos por tipo de negocio, sin precio. |
| `tienda.html` + `pagina.js` | Página pública de la tienda (lee `/api/publico/<pid>`). `pagina.js` valida los links (`PAGINA.href`). |
| `qr.js` | Generador de códigos QR (biblioteca externa copiada; no editar a mano). |
| `sw.js` | Service worker. `VERSION` (la versión de la copia guardada) y la lista `FILES` de lo que se guarda para abrir sin internet. |
| `servidor/pb_hooks/*.pb.js` | Rutas del servidor: `sync`, `cuentas`, `publico` (incluye el bloqueo de lo que llega por internet), `respaldo` (correo diario), `archivos` (encabezados de seguridad y la lista de archivos de la app que el servidor entrega). |
| `servidor/pb_hooks/comun.js`, `cuentas.js`, `respaldo.js` | Funciones compartidas. Las reglas de permisos (`permite`) y de valores (`valido`) están en `comun.js`. |
| `servidor/pb_migrations/` | Tablas `cambios`, `vitrinas`, `usuarios`, `miembros` y el respaldo automático. |
| `servidor/iniciar.bat`, `iniciar.sh` | Prenden PocketBase con datos en `../../mi-almacen-datos` (fuera del repo) y sirven la carpeta del repo como sitio. |

## Cómo funcionan los datos (no romper)

- **Todo se guarda primero en el dispositivo.** Cada cambio queda en la bandeja de salida y solo
  se saca cuando el servidor responde bien (`LocalDB.ack`).
- **Gana el sello `hlc` más nuevo** por registro (`applyRemote`). Formato:
  `13 dígitos de ms - 4 dígitos de contador - id del dispositivo`. El servidor valida ese formato
  con una expresión regular; si cambias el formato, cambia los dos lados.
- **El servidor guarda una lista que solo crece** (tabla `cambios`, con `seq` por tienda). No se
  editan ni se borran filas de `cambios`.
- **Productos y clientes no se borran:** se marcan `eliminado:true`. Las ventas y los fiados de un
  cliente eliminado se conservan.
- **Movimientos (`movs`) no se editan.** La app solo los crea.
- Permisos: dueño, encargado y vendedor, más permisos extra (`precios`, `costos`, `inventario`,
  `reportes`, `config`). La regla que vale es la de `permite()` en el servidor; `data-perm` y
  `puede()` en `js/cuentas.js` solo ordenan la pantalla.
- En `pb_hooks`, cada pedido corre aparte: las funciones compartidas se cargan con
  `require(\`${__hooks}/archivo.js\`)` dentro de cada ruta. El código del servidor corre en el motor
  JavaScript de PocketBase (no es Node ni el navegador): antes de usar una función, revisa que exista
  en la documentación de PocketBase de la versión que se usa (0.40.5).

## Reglas que no se rompen

1. **Offline primero:** ninguna función de uso diario puede exigir internet.
2. **Nunca perder datos:** los movimientos no se editan, nada se borra sin dejar constancia, y un
   cambio rechazado por el servidor jamás debe borrar datos locales.
3. **Los permisos se validan en el servidor.** Ocultar un dato en pantalla no lo protege.
4. **Si cambias un archivo que guarda `sw.js`** (los de `FILES` y la página principal `./`), sube
   `VERSION` en `sw.js` y comprueba que la app abre sin internet. Si agregas un archivo que la app
   necesita para abrir, súmalo a `FILES` y a la lista `APP` de `servidor/pb_hooks/archivos.pb.js`.
5. **Los datos del servidor viven en `mi-almacen-datos`, fuera del repo.** Nunca subas datos,
   respaldos (`respaldo-*.json`), claves ni archivos `.env`. Revisa el diff antes de cada commit.
6. `Inventario_almacen_VD` es solo referencia: leer, nunca modificar.
7. **Nada está terminado sin correr las pruebas.** Si algo no se pudo probar, dilo de forma
   explícita; no escribas "debería funcionar".
8. **Un tema por rama y por PR.** No mezcles refactor con funciones nuevas.
9. **Lo más simple que funcione.** No agregues frameworks ni dependencias sin que Benjamin lo pida.
   (La app no usa npm: es HTML y JavaScript sin compilar.)
10. **No gastes dinero ni toques infraestructura real** (VPS, dominio, DNS) sin aprobación explícita.

Decisiones que son de Benjamin (preguntar, no resolver): quién puede borrar clientes con deuda,
cómo poner el servidor en internet (Tailscale Funnel, Cloudflare Tunnel u Oracle Cloud) y cualquier gasto.

## Pruebas

Las pruebas están en `tests/` y corren solas en cada PR (`.github/workflows/pruebas.yml`).
Usan Playwright (un navegador automático) solo para probar; la app no lo usa ni lo carga.

```sh
cd tests
npm ci && npx playwright install chromium      # la primera vez
PB_BIN=/ruta/a/pocketbase npm test             # PocketBase 0.40.5
```

- Sin `PB_BIN`, las pruebas que necesitan el servidor (dos dispositivos y permisos) se saltan
  y lo dicen. En GitHub no se pueden saltar (`PB_OBLIGATORIO=1`).
- Cada prueba prende su propio PocketBase con datos temporales; nunca usa `mi-almacen-datos`.
- `tests/ayuda.js` tiene lo compartido: servir la app, crear una tienda, vender, sincronizar.
  Las pruebas manejan la app con clics y leen los datos con `window.LocalDB` y `window.Sync`.
- Los archivos de `js/` comparten sus nombres (no hay función cerrada). Ninguno puede llamarse
  como algo del navegador (`print`, `open`, `close`…): lo revisa `globales.test.js`.
- Un archivo nuevo de la app va en `index.html` (antes de `arranque.js`), en `FILES` de `sw.js` y en
  `APP` de `archivos.pb.js`: lo revisa `lista-archivos.test.js`. Un archivo no puede usar, al cargarse,
  algo de un archivo que se carga después (sí dentro de funciones que corren más tarde).
- Las capturas quedan en `tests/capturas/` (no se suben; en GitHub se guardan como artefacto).
- Toda función nueva o arreglo trae su prueba. Ninguna prueba se desactiva para que pase.

Ojo: el service worker, la cámara y la instalación solo funcionan en `localhost`, `127.0.0.1` o
con `https`. En `http://192.168.x.x` (un celular en el wifi) no hay modo sin conexión.

## Calidad del código

- Funciones chicas, con un solo trabajo y un nombre claro. Mantén el idioma (español) y el estilo
  del repo: nombres cortos en español (`act`, `commit`, `viewRecibir`, `puede`), sin punto y coma
  sobrante, plantillas de texto para el HTML.
- Todo texto que venga del usuario o del servidor pasa por `esc()` antes de ir a `innerHTML`.
  Los links de la página pública pasan por `PAGINA.href()`.
- Reutiliza antes de crear (`esc`, `clp`, `toast`, `run`, `openModal`, `commit`, `ops`); no dupliques
  lógica ni dejes código muerto.
- Valida toda entrada: textos maliciosos en la página pública, números, tildes. Si una regla de
  valores cambia en la app, cámbiala también en `valido()` del servidor, y al revés.
- Los errores se muestran al usuario con un mensaje claro (`toast` o la pantalla de error); no se tragan.
- Comenta solo el porqué, no el qué. Los comentarios van en español.

## Calidad visual (dueños de negocio en celulares básicos)

- Celular primero: probar a 360 px de ancho, en claro, oscuro y letra grande.
- Zonas táctiles de al menos 44 px. Contraste de al menos 4.5:1 (3:1 en letra grande).
- Usar las variables de color de las paletas (`var(--brand)`, `var(--bad)`, `var(--warn)`…), no
  colores sueltos. Un solo estilo de botones (`.btn`, `.btn.primary`, `.btn.ghost`, `.btn.sm`).
- Cada pantalla tiene estado vacío, cargando y error.
- Textos en español simple, sin jerga.
- No cambiar paletas ni estilos existentes sin que Benjamin lo pida: auditar y proponer.

## Cómo trabajar

- Una rama y un PR por tema. El PR dice qué cambió, cómo se probó y qué no se pudo verificar.
- Antes de afirmar algo sobre el código, revísalo. Si depende del computador o del celular de
  Benjamin y no se pudo probar, dilo.
- Cuando el plan no calce con el código, dilo y propone una alternativa en vez de forzarlo.

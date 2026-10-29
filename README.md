# Mi Almacén

App de inventario y ventas para negocios de barrio (almacenes, panaderías, minimarkets). Se instala en el celular o el computador desde el navegador, **guarda todo en el mismo dispositivo y funciona sin internet**.

Va en la **Fase 2** del plan: cada dispositivo guarda todo en su base local y, cuando hay conexión, se sincroniza con un servidor PocketBase que corre en tu propio computador. Las cuentas de usuario y la página pública de reservas llegan en las fases siguientes.

Parte del código de [Inventario_almacen_VD](https://github.com/benjaminolate/Inventario_almacen_VD), que sigue igual por su lado.

## Qué hace

- **Tipo de negocio al crear la tienda:** almacén, minimarket, panadería, carnicería, verdulería, botillería u otro. Cada uno trae sus productos típicos sin precio (el almacén suma unos 390, incluidos 357 de un almacén real) y las extensiones que más le sirven. Lo que no se venda se apaga por producto o por sector completo, y se pueden sumar después los productos de otro tipo de negocio.
- **Vender, recibir mercadería y contar por sectores**, con escaneo de códigos de barras con la cámara o con **pistola USB o Bluetooth**. La búsqueda aguanta tildes, guiones y una letra mal escrita. Si un producto no tiene precio, se pregunta la primera vez que se vende.
- **Cajas:** contar como "4 cajas × 12 + 3 sueltas", recibir por caja (la app calcula unidades y costo unitario) y unidades por caja en cada producto.
- **Stock calculado por producto:** `último conteo + compras − ventas desde ese conteo`. Se puede contar un sector por día sin cerrar el negocio.
- **Fiados** por cliente con recordatorio por WhatsApp, **aviso de que llegó el pan** y **reservas** anotadas por la tienda.
- **Funciona sin internet:** la app queda guardada en el dispositivo (service worker) y los datos en su base local (IndexedDB).
- **Instalable** como app (PWA), sin pasar por Play Store.
- **Respaldo** en un archivo y restauración desde él, reemplazando todo o **agregando solo lo que falta**. El servidor además guarda una copia automática cada día y puede mandarla **por correo** cada noche, para que quede fuera del computador.
- **Resumen de ventas** de hoy, 7 días, este mes, mes pasado, este año y año pasado, con descarga a **Excel**.
- **Página de la tienda** con link y código QR: productos, precios, si hay o no, y **reservas por internet** que se confirman desde la app.
- **Cuentas y permisos:** usuario y contraseña para cada persona, con roles de dueño, encargado y vendedor, y permisos que elige el dueño.
- **Tutorial** la primera vez y un botón **?** en cada pantalla que explica cómo usarla.
- **Extensiones:** cada tienda activa solo lo que usa, en Más > Extensiones. Al quitar una, sus datos no se borran.
  - Inventario: conteo por sectores, recibir mercadería, **stock bajo y lista de compras** (pedido por WhatsApp a cada proveedor), **vencimientos**, **proveedores** (días de visita, deuda, productos asignados en lote y ganancia por producto) y **venta a granel** (por kilo o gramos).
  - Ventas: **cierre de caja** (efectivo, tarjeta y transferencia, con vuelto), **ofertas y packs** ("3 por $1.000" o % por día y horario), **comprobante** por WhatsApp o impreso (sin valor tributario) y **quién atiende**.
  - Clientes y pan: fiados, pan (aviso, reservas y **tipos de pan**, cada uno por unidad o por kilo) y **encargos** para otro día con abono.
- **Botones rápidos** en Vender para el pan o cualquier producto, y catálogo inicial con pan y verduras a granel.
- **Navegación:** Más ordenado en Logística, Clientes y pan, y Configuración; todas las pantallas tienen "← Regresar" y el botón atrás del celular vuelve a la anterior.
- **Apariencia:** 6 paletas de colores o colores propios, estilo (redondeado, suave, recto) y 5 tipos de letra, con botón para volver a la original, para toda la tienda; modo claro u oscuro y letra grande, por dispositivo.

## Cómo se guardan los datos

```
Pantalla ──> act (acciones) ──> LocalDB.apply()  ──> IndexedDB del dispositivo
                                      │                 ├─ products, movs, clients, fiados, reservas, ajustes
                                      │                 ├─ vencimientos, cajas, proveedores, provmovs, ofertas, personas, encargos
                                      │                 └─ outbox: cambios por enviar al servidor
                                      └─ cada cambio lleva un sello "hlc" (reloj lógico híbrido)
```

- Cada acción se guarda **en una sola transacción**: los datos y su entrada en la bandeja de salida (`outbox`) se escriben juntos o no se escribe nada.
- Las ventas, compras y conteos **nunca se editan**, solo se agregan. Así, cuando existan varios dispositivos, juntar sus datos no produce conflictos.
- Todos los registros usan identificadores únicos (UUID), para que dos celulares nunca generen el mismo.
- El sello `hlc` ordena los cambios de distintos dispositivos aunque sus relojes no coincidan. Lo usará la sincronización de la Fase 2.
- Los datos de ejemplo quedan solo en el dispositivo y no entran a la bandeja de salida.

## Sincronización (Fase 2)

```
Dispositivo A ─┐   POST /api/sync: envía su bandeja y recibe lo nuevo     ┌─ Dispositivo B
               ├──────────────────> PocketBase (tabla "cambios") <─────────┤
               └── aviso en tiempo real (canal "tienda/<código>") ─────────┘
```

- El servidor guarda cada cambio una sola vez (por su sello `hlc`) y le asigna un número de orden (`seq`). Cada dispositivo pide "lo nuevo desde el número X".
- Al recibir un cambio, cada registro se queda con la versión de sello `hlc` más nuevo. Ventas, compras y conteos nunca chocan porque solo se agregan.
- La bandeja de salida solo se vacía cuando el servidor confirma que guardó los cambios.
- El servidor rechaza valores fuera de rango (precios negativos, fiados de más de $1.000.000, unidades por caja fuera de 2 a 1000, celulares mal escritos) y vuelve a mandar lo que había. Solo revisa los campos que cambian, así que los registros antiguos se pueden seguir editando.
- El servidor también devuelve su hora: el dispositivo corrige su reloj si está desfasado.
- Un dispositivo nuevo se une con un link de invitación (`?unirse=<código>&servidor=<dirección>`) y descarga todo.
- Sin cuentas, el código de la tienda (un UUID) es la llave de acceso. Con cuentas, además se necesita un usuario de la tienda.

## Página de la tienda y reservas por internet (Fase 3)

- `tienda.html?t=<pid>` muestra los productos con precio de una tienda y deja reservar. El `pid` es un código aparte del de la tienda: el link público no da acceso a los datos.
- La app publica la vitrina en `POST /api/publico/publicar` cuando algo cambia (tabla `vitrinas`). Los clientes la leen en `GET /api/publico/<pid>`.
- Una reserva (`POST /api/publico/<pid>/reserva`) entra a la tabla `cambios` como si viniera de un dispositivo más, así que llega sola a la app. El cliente consulta su estado con un código que solo tiene él.
- Contra abusos: campo trampa para robots, tiempo mínimo en la página, celular chileno obligatorio, hasta 3 reservas por celular al día, máximo diario por tienda, límite por IP y números bloqueados.
- Por internet (Tailscale Funnel o Cloudflare) solo responden la app, la página, las reservas y la sincronización; el panel de PocketBase queda para el wifi.

## Cuentas y permisos (Fase 4)

- Son opcionales: el dueño las activa en Más > Cuentas y permisos. Desde ahí, cada dispositivo entra con usuario y contraseña (colección `usuarios` de PocketBase, sesión de 30 días que se renueva sola) y el código de la tienda ya no basta para sincronizar.
- La colección `miembros` dice quién pertenece a qué tienda, con qué rol (dueño, encargado o vendedor) y qué permisos extra tiene un vendedor: precios, costos, inventario, reportes y ajustes.
- `/api/sync` revisa cada cambio contra los permisos de quien lo manda. Un cambio sin permiso no se guarda y el servidor vuelve a mandar lo que había, para que ese dispositivo quede igual que los demás.
- Funciona sin internet como antes: la sesión queda guardada en el dispositivo.
- La app esconde lo que cada persona no puede usar. Los costos se ocultan en pantalla, pero llegan al dispositivo con el resto de los datos.

Cómo prenderlo: [servidor/INSTRUCCIONES.md](servidor/INSTRUCCIONES.md).

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | Toda la app: estilos, pantallas y acciones |
| `catalogos.js` | Productos típicos de cada tipo de negocio (sin precios) |
| `tienda.html` | Página pública de la tienda, para los clientes |
| `qr.js` | Generador de códigos QR (Kazuhiko Arase, licencia MIT) |
| `local-db.js` | Base local (IndexedDB), bandeja de salida, reloj lógico y respaldos |
| `sync.js` | Envía y recibe cambios con el servidor, y escucha los avisos en tiempo real |
| `servidor/pb_migrations/` | Crea la tabla `cambios` en PocketBase y activa el respaldo diario |
| `servidor/pb_hooks/sync.pb.js` | El punto de sincronización `/api/sync` |
| `servidor/pb_hooks/cuentas.pb.js` | Cuentas, entrar, y quién tiene acceso a cada tienda |
| `servidor/pb_hooks/publico.pb.js` | Página pública, reservas y lo que se puede abrir desde internet |
| `servidor/pb_hooks/respaldo.pb.js` | Respaldo diario por correo de cada tienda |
| `servidor/iniciar.bat`, `iniciar.sh` | Prenden el servidor con un doble clic |
| `sw.js` | Guarda la app en el dispositivo para que abra sin internet |
| `manifest.webmanifest`, `icons/` | Lo que permite instalarla como app |

## Probarla en tu computador (gratis)

```bash
python3 -m http.server 8000
# abre http://localhost:8000
```

La cámara y la instalación solo funcionan en `localhost` o en HTTPS (por ejemplo, GitHub Pages).

## Publicarla gratis con GitHub Pages

En el repositorio: **Settings → Pages → Source: Deploy from a branch → main / (root) → Save**. Queda en `https://<usuario>.github.io/<repositorio>/`.

Al cambiar cualquier archivo, sube `VERSION` en `sw.js` para que los dispositivos descarguen la versión nueva.

## Licencia

MIT. Ver [LICENSE](LICENSE).

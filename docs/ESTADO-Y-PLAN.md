# Mi Almacén: estado completo y plan a seguir

*Actualizado el 10 de noviembre de 2026.*

Este documento junta en un solo lugar **qué tenemos, qué hemos hecho, qué falta y cuál es el plan**. Está escrito para leerlo sin saber programar.

---

## 1. En una frase

Mi Almacén es una app de inventario y ventas para negocios de barrio que **se instala desde el navegador, guarda todo en el mismo celular o computador y funciona sin internet**. Cuando hay conexión, los dispositivos de una tienda se ponen al día entre ellos a través de un servidor gratis (PocketBase) que hoy corre en tu computador.

**Dónde estamos:** la app está completa para usarla en una tienda y ya pasó una ronda grande de pruebas. **Lo que falta para que una tienda real la use todos los días es tener el servidor siempre prendido y en internet**, y después probarla con 2 o 3 negocios.

---

## 2. Lo que tenemos

### 2.1 Dónde está cada cosa

| Qué | Dónde |
|---|---|
| Código de la app y del servidor | Repositorio de GitHub `benjaminolate/Mi-Almacen` (rama `main`). Es la versión oficial. |
| Copia de la app en el proyecto | Carpeta `app/mi-almacen/` y `app/mi-almacen.zip` en los archivos del proyecto (puede quedar algo atrás del repositorio). |
| Propuestas y planes | Carpeta `propuesta/` en los archivos del proyecto: viabilidad, VPS y alojamiento local, plan paso a paso y Plan 1 detallado. |
| App de tu vecina (referencia) | `benjaminolate/Inventario_almacen_VD`. Solo se mira, nunca se modifica. |
| Informe de la última ronda de pruebas | [Informe de QA](https://claude.ai/artifact/EnZBJ8vmNEBkqD4kucsa9T) |
| Comparación con Inventario VD | [Comparativa](https://claude.ai/artifact/V3EWda3hWCoWQXN64VB9mT) |

### 2.2 Archivos de la app

| Archivo | Qué es |
|---|---|
| `index.html` | Toda la app: pantallas, estilos y acciones (unas 3.000 líneas). |
| `local-db.js` | La base de datos dentro del dispositivo (IndexedDB), la bandeja de salida y los respaldos. |
| `sync.js` | Envía y recibe cambios con el servidor y escucha los avisos al instante. |
| `catalogos.js` | Productos típicos de cada tipo de negocio, sin precio. |
| `tienda.html` | La página pública de la tienda, para los clientes (tipo "link en bio"). |
| `pagina.js` | Tipos e íconos de los links de esa página. |
| `qr.js` | Genera los códigos QR. |
| `sw.js` | Deja la app guardada en el dispositivo para que abra sin internet (versión actual: `v13`). |
| `manifest.webmanifest`, `icons/` | Lo que permite instalarla como app. |

### 2.3 El servidor (carpeta `servidor/`)

PocketBase es un programa gratis de un solo archivo. Se prende con doble clic en `iniciar.bat` (Windows) o `iniciar.sh` (Mac/Linux). Las instrucciones paso a paso están en `servidor/INSTRUCCIONES.md`. Probado con PocketBase 0.40.5.

| Pieza | Qué hace |
|---|---|
| `pb_hooks/sync.pb.js` | El punto de sincronización `/api/sync`: recibe y reparte los cambios de cada dispositivo. |
| `pb_hooks/cuentas.pb.js`, `cuentas.js` | Cuentas con usuario y contraseña, y quién pertenece a qué tienda. |
| `pb_hooks/publico.pb.js` | Página pública, reservas por internet y qué se puede abrir desde afuera. |
| `pb_hooks/respaldo.pb.js`, `respaldo.js` | Respaldo diario por correo de cada tienda. |
| `pb_hooks/comun.js` | Reglas compartidas: permisos, validaciones y bloqueo del panel desde internet. |
| `pb_migrations/` | Crean las tablas: `cambios`, respaldos automáticos, `vitrinas` y cuentas (`usuarios`, `miembros`). |

Los datos del servidor quedan en la carpeta `mi-almacen-datos`, **fuera** del proyecto, para que nunca se suban a GitHub. Se guarda una copia automática cada día a las 3 de la mañana (las últimas 14).

### 2.4 Lo que la app ya hace

- **Tipo de negocio al crear la tienda** (almacén, minimarket, panadería, carnicería, verdulería, botillería u otro), con sus productos típicos ya cargados sin precio. El almacén trae unos 390, incluidos 357 de un almacén real. El precio se pregunta la primera vez que se vende.
- **Vender, recibir mercadería y contar por sectores**, con cámara o con pistola USB/Bluetooth. Búsqueda que aguanta tildes, errores de una letra y palabras que suenan parecido.
- **Cajas:** contar y recibir por caja ("4 cajas × 12 + 3 sueltas").
- **Stock calculado:** último conteo + compras − ventas desde ese conteo. Se puede contar un sector por día sin cerrar.
- **Fiados** por cliente con recordatorio por WhatsApp, **aviso de pan**, **reservas** y **encargos** con abono.
- **Funciona sin internet** y se **instala** como app sin pasar por Play Store.
- **Varios dispositivos sincronizados:** lo que se vende en uno aparece en los otros al instante; sin internet se guarda y se envía después.
- **Respaldos:** descargar un archivo, restaurarlo (todo o solo lo que falta), copia diaria del servidor y **copia diaria por correo**.
- **Resumen de ventas** por día, semana, mes y año, con descarga a Excel.
- **Página de la tienda** con link y QR: foto o logo, botones a reseñas de Google, WhatsApp, cómo llegar y redes, productos y precios, y **reservas por internet** con protección contra abusos.
- **Cuentas y permisos** (opcionales): dueño, encargado y vendedor, con permisos que elige el dueño.
- **Extensiones** que cada tienda prende o apaga: stock bajo y lista de compras, vencimientos, proveedores, venta a granel, cierre de caja, ofertas y packs, comprobante, quién atiende, fiados, pan, encargos.
- **Eliminar productos y clientes** (traído de Inventario VD).
- **Tutorial** la primera vez y botón **?** en cada pantalla.
- **Apariencia:** paletas de colores, estilos, tipos de letra, modo oscuro y letra grande.

---

## 3. Lo que hemos hecho (en orden)

### 3.1 La idea y el plan
1. **Viabilidad:** se revisó la app de tu vecina y se confirmó que su forma de guardar los datos (movimientos que nunca se editan) encaja perfecto con una app que funciona sin internet. (`propuesta/viabilidad-app-negocios.md`)
2. **VPS y alojamiento local:** qué es un servidor arrendado, cuánto cuesta y cómo podría cada tienda tener sus datos en su local. (`propuesta/vps-y-alojamiento-local.md`)
3. **Dos caminos:** Plan 1 (primero un servidor tuyo para todas, después local) y Plan 2 (directo a local). **Elegimos el Plan 1.** (`propuesta/plan-paso-a-paso.md`, `propuesta/plan-1-detallado.md`)

### 3.2 La construcción
| Paso | Qué se hizo |
|---|---|
| Base local | App instalable, datos en el dispositivo, bandeja de salida y reloj lógico para ordenar cambios. |
| Sincronización | Servidor PocketBase en tu computador; varios dispositivos al día entre ellos por wifi. |
| Extensiones y apariencia | Cada tienda elige qué usa y cómo se ve; nueve extensiones nuevas para el almacén. |
| Pan y menú | Tipos de pan (por unidad o por kilo), botones rápidos, menú por secciones, botón atrás del celular. |
| Tipo de negocio | Catálogo inicial por tipo, cajas, pistola, resumen de ventas, tutorial. |
| Página de la tienda | Link y QR públicos con productos, precios y reservas por internet. |
| Cuentas y permisos | Usuario y contraseña por persona, roles y permisos revisados por el servidor. |

### 3.3 Mejoras traídas de Inventario VD (todas unidas a `main`)
| PR | Qué trajo |
|---|---|
| #1 | Validaciones sacadas de las rondas de prueba de Inventario VD. |
| #2 | Eliminar productos y clientes, búsqueda "por cómo suena" y validación de valores en el servidor. |
| #3 | Respaldo diario por correo, para tener una copia fuera del computador. |
| #4 | Arreglos de pantallas y límite de reservas por celular. |
| #5 | Página de la tienda tipo "link en bio" con foto o logo y links. |

### 3.4 Ronda de pruebas (QA)
- Se probó todo sobre `main`: **162 de 162 comprobaciones pasaron**. Incluyó dos dispositivos sincronizando, permisos de un vendedor, pantallas en celular (claro y oscuro), sin internet, textos maliciosos en la página y respaldo/restauración.
- **PR #6:** arregló tres problemas chicos (nombre del archivo de respaldo con tildes, respaldo dañado y el WhatsApp de la página de la tienda).
- **PR #7:** el servidor ya no rechaza números de celular; se revisan solo en la app. Así un cambio rechazado nunca borra un cliente con fiados.

---

## 4. Lo que falta

### 4.1 Decisiones tuyas pendientes
1. **Borrar clientes que deben plata.** Hoy cualquier usuario puede marcar como eliminado a un cliente con deuda. Propuesta: que solo pueda hacerlo quien tenga permiso de ajustes. Es un cambio chico; basta con que digas que sí.
2. **Cómo poner el servidor en internet para probar** (ver sección 5, paso 1): Tailscale Funnel, Cloudflare Tunnel u Oracle Cloud gratis.

### 4.2 Riesgos conocidos
- **El respaldo por correo crece sin límite.** Con mucho tiempo de uso podría pasar los 25 MB que acepta Gmail. Hay que comprimirlo o mandar solo lo nuevo antes de que una tienda real lleve meses.
- **Los costos se esconden en pantalla, pero llegan igual al celular del vendedor.** Para alguien que sepa revisar el navegador no son secretos.
- **El servidor depende de tu computador:** si se apaga, las tiendas siguen vendiendo, pero no se sincronizan ni entran reservas.
- **El acceso por internet con Tailscale Funnel está documentado pero no lo hemos probado** de verdad.

### 4.3 Pendientes de la comparación con Inventario VD
- Marcar un vencimiento como **"revisado"**.
- **Cuenta maestra** (alguien que administre varias tiendas).
- **Tutorial guiado por pantalla** (hoy hay tutorial inicial y el botón ?).
- **Encabezados de seguridad** en el servidor (protecciones extra del navegador).
- **Pruebas automáticas dentro del repositorio.** Las pruebas que hicimos vivían en sesiones temporales y se perdieron; conviene guardarlas en el repo para repetirlas cada vez que cambie algo.

### 4.4 Del plan original, lo que no está hecho
- Servidor siempre prendido, con dominio y candado HTTPS.
- Monitoreo que avise si el servidor se cae.
- Probar una restauración completa del servidor desde un respaldo.
- Agregar dispositivo con **QR** (hoy se hace con link de invitación por WhatsApp).
- Registro de tiendas por su cuenta, sin tu ayuda.
- Reservas de servicios (horas) además de productos.
- Anular una venta dejando constancia de quién y cuándo.
- Piloto con tiendas reales, página web propia y Play Store.

---

## 5. El plan a seguir

Seguimos el **Plan 1**. Los números de fase son los del documento `propuesta/plan-1-detallado.md`.

| Fase | Qué es | Estado |
|---|---|---|
| 0 | Preparación: nombre, repositorio, GitHub Pages | ✓ Hecha |
| 1 | La app guarda todo en el dispositivo | ✓ Hecha |
| 2 | El servidor que junta los datos | ✓ Hecha |
| 3 | Poner el servidor en internet | **Siguiente** (documentado, sin probar) |
| 4 | Cuentas, tiendas y dispositivos | ✓ Hecha en lo principal (falta QR y registro solo) |
| 5 | Página pública de cada tienda | ✓ Hecha (falta reservas de servicios) |
| 6 | Piloto con 2 o 3 tiendas | Pendiente |
| 7 | Servidor dentro de la tienda (opcional) | Solo si el piloto lo pide |
| 8 | Crecer: reportes, anular ventas, cobro | Pendiente |
| 9 | Página web propia y Play Store | Pendiente |

> En el repositorio, los commits llaman "Fase 3" a la página de la tienda y "Fase 4" a las cuentas. Es el mismo trabajo; solo se hizo en otro orden.

### Paso 1. Cerrar lo chico (gratis, unos días)
1. Decidir lo de borrar clientes con deuda y aplicarlo.
2. Achicar el respaldo por correo para que nunca pase los 25 MB.
3. Guardar las pruebas automáticas en el repositorio.
4. Agregar los encabezados de seguridad y el "revisado" de vencimientos.

### Paso 2. Servidor en internet para probar (Fase 3, gratis)
1. Elegir la opción: **Tailscale Funnel** en tu computador (la más fácil), Cloudflare Tunnel u Oracle Cloud gratis.
2. Probar que un celular con **datos móviles** (sin wifi) se sincroniza y que la página de la tienda abre desde afuera.
3. Hacer una restauración completa desde un respaldo, para estar seguros de que funciona.

**Lista cuando:** un celular fuera de tu casa vende y tú lo ves aparecer en tu computador.

### Paso 3. Preparar el piloto (Fase 6, aquí se empieza a gastar)
1. Arrendar un **VPS** (unos US$4–6 al mes; Oracle gratis también sirve) y comprar el **dominio** (por ejemplo `mialmacen.cl`, unos $10.000 al año). Revisamos precios del momento antes de pagar.
2. Mudar el servidor al VPS con **Caddy** (candado HTTPS automático) y respaldo nocturno a otro lugar.
3. Agregar un aviso si el servidor se cae.
4. Sumar dispositivo por **QR** para que sea más fácil en la tienda.

### Paso 4. Piloto con 2 o 3 negocios (Fase 6)
1. Buscar negocios distintos (un almacén, una panadería, ojalá uno de servicios).
2. Acompañarlos: crear la tienda, ajustar el catálogo, contar el primer sector, sumar sus celulares.
3. Anotar dónde se traban y corregirlo.

**Lista cuando:** usan la app todos los días por algunas semanas, sin perder datos y sin llamarte para preguntar cómo se hace algo.

### Paso 5. Crecer (Fases 8 y 9)
- Reportes de ganancia, anular ventas, avisos de stock bajo, pedido sugerido.
- Cuenta maestra para quien tenga varias tiendas.
- Página web propia (vitrina) y publicar en Play Store (US$25 una vez; pide dominio propio y 12 personas probando 14 días).
- Si se ofrece a más negocios, un plan gratis y uno pagado.
- Fase 7 (servidor dentro de la tienda) solo si las tiendas lo piden.

---

## 6. Cuánto cuesta

| Etapa | Costo |
|---|---|
| Hasta el Paso 2 (todo lo de arriba) | **$0** |
| Piloto (Paso 3 y 4) | VPS ~US$4–6 al mes + dominio ~$10.000 al año |
| Play Store | US$25 una sola vez |
| App Store (opcional) | US$99 al año |

---

## 7. Lo que necesito de ti ahora

1. **Sí o no** a que solo quien tenga permiso de ajustes pueda borrar clientes con deuda.
2. **Elegir** cómo ponemos el servidor en internet para probar (recomiendo Tailscale Funnel en tu computador).
3. Ir pensando en **2 o 3 negocios** del barrio que quieran probarla.

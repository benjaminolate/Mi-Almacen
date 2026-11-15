# Mi Almacén: todo lo que hay, cómo funciona y lo que falta

*Actualizado el 15 de noviembre de 2026, sobre la versión de `main` con los PR #1 a #32 unidos.*

Este documento junta en un solo lugar **qué hace la app, qué no hace, cómo funciona por dentro, qué se ha hecho, qué falta y cuál es el plan**. Está escrito para leerlo sin saber programar.

La revisión a fondo de problemas y riesgos (seguridad, diseño, lo que puede fallar más adelante) está aparte, en la [**Auditoría de noviembre de 2026**](https://claude.ai/artifact/YbHxnFAKs3f4NwaaYoeUXQ). Aquí va solo el resumen de lo que encontró (sección 8).

---

## 1. En pocas palabras

Mi Almacén es una app de inventario y ventas para negocios de barrio. **Se instala desde el navegador, guarda todo en el mismo celular o computador y funciona sin internet.** Cuando hay conexión, los dispositivos de una tienda se ponen al día entre ellos a través de un servidor (PocketBase), que hoy corre en tu computador.

**Dónde estamos:**

- La app está completa para usarla en una tienda.
- Tiene 43 pruebas automáticas que corren solas cada vez que se cambia algo.
- Los tres arreglos de seguridad que había que hacer antes de salir a internet están unidos (PR #30, #31 y #32).
- **Todavía no está en internet.** El servidor vive en tu computador y solo se ve en tu wifi.
- La auditoría encontró **7 cosas que conviene arreglar antes de salir a internet** y un problema de velocidad que aparece cuando una tienda junta cerca de un año de ventas. Ninguna cuesta plata.
- Ninguna tienda real la usa todavía.

---

## 2. Qué hace la app hoy

### Lo de todos los días

- **Vender:** buscar el producto por nombre (aguanta tildes, una letra equivocada y palabras que suenan parecido), con la cámara o con una pistola de códigos. Calcula el total y el vuelto.
- **Recibir mercadería:** anota lo que llega, la cantidad (también por caja: "4 cajas de 12 y 3 sueltas") y lo que costó.
- **Contar por sectores:** se cuenta un sector por día, sin cerrar la tienda. La app dice la diferencia con lo que esperaba.
- **Stock calculado solo:** último conteo, más lo recibido, menos lo vendido desde ese conteo.
- **Fiados:** cuaderno por cliente, con pagos y recordatorio por WhatsApp.
- **Historial** de todo lo que entra, sale y se cuenta, y **resumen de ventas** por día, semana, mes y año, con descarga a Excel.

### Al crear la tienda

- Se elige el **tipo de negocio**: almacén, minimarket, panadería, carnicería, verdulería, botillería u otro.
- Cada tipo trae sus **productos típicos ya cargados** (el almacén trae 391) y las funciones que suele usar.
- Si hay servidor, el dueño crea ahí mismo su **usuario y contraseña**.

### Extensiones (cada tienda prende solo lo que usa)

| Grupo | Extensiones |
|---|---|
| Inventario | Conteo por sectores, recibir mercadería, stock bajo y lista de compras, vencimientos, proveedores, venta a granel |
| Ventas | Cierre de caja, ofertas y packs, comprobante de venta, quién atiende |
| Clientes | Fiados, aviso del pan y reservas, página de la tienda, encargos y pedidos |

### Varios celulares y varias personas

- **Sincronización:** lo que se vende en un celular aparece en los otros al instante. Sin internet se guarda y se envía después.
- **Cuentas y permisos:** dueño, encargado y vendedor. Al vendedor se le pueden dar permisos extra: precios, costos, inventario, reportes y ajustes.
- **Invitaciones:** el dueño manda un link que sirve una sola vez y vence en 48 horas. La persona elige su propio usuario y contraseña.
- **Costos privados:** quien no tiene el permiso de costos no los recibe en su celular.

### Página de la tienda (para los clientes)

- Una página con link y código QR: foto o logo, WhatsApp, cómo llegar, redes, productos y precios.
- **Reservas por internet**, con protección contra abusos (límite por celular, por día y por tienda, y números bloqueados).

### Respaldos

- Descargar un archivo con todo y restaurarlo (todo, o solo lo que falta).
- Copia automática del servidor cada día a las 3 de la mañana (guarda las últimas 14).
- **Copia diaria por correo**, para que quede algo fuera del computador.

### Apariencia y ayuda

- 6 paletas de colores y una propia, 3 estilos, 5 tipos de letra, modo oscuro y letra grande.
- Tutorial la primera vez y botón **?** en cada pantalla.

---

## 3. Qué NO tiene (para no llevarse sorpresas)

| No tiene | Qué significa |
|---|---|
| Servidor en internet | Hoy los celulares solo se sincronizan en tu wifi. Fuera de tu casa no hay sincronización ni reservas. |
| Boleta electrónica | El comprobante no tiene valor tributario. La app no reemplaza la boleta del SII. |
| Cobro con tarjeta | Solo anota si pagaron con efectivo, tarjeta o transferencia. No cobra. |
| Anular una venta | No hay botón para anular dejando constancia. Los movimientos no se editan. |
| PIN o bloqueo de la app | Quien toma el celular desbloqueado ve todo. |
| Sacar un celular a distancia | Se le puede quitar el acceso a una persona, pero los datos ya descargados quedan en su celular. |
| Lista de celulares conectados | El dueño no ve qué celulares tienen sesión abierta. |
| Cuenta para varias tiendas | Un usuario puede ser de varias tiendas, pero no hay un panel que las junte. |
| Registro de tiendas controlado | Con el servidor en internet, cualquiera podría crear una tienda en él (ver sección 8). |
| Planes de pago | No hay cobro ni límites por plan. |
| Play Store o App Store | Se instala desde el navegador. |
| Modo sin internet en el wifi | Por `http://192.168…` el celular no guarda la app para abrirla sin conexión. Con una dirección con candado (https) sí. |
| Aviso si el servidor se cae | Nadie se entera hasta que alguien lo nota. |
| Política de privacidad y condiciones | No están escritas. |
| Aspecto distinto por tipo de negocio | Los 7 tipos se ven con el mismo verde. |
| Reservas de horas (servicios) | Solo reservas de productos. |

---

## 4. Cómo funciona por dentro

### 4.1 Los datos viven primero en el celular

1. Cada cosa que se hace (una venta, un conteo, un fiado) **se guarda en el mismo dispositivo**, en una base de datos del navegador llamada IndexedDB.
2. Además queda una copia en la **bandeja de salida**: la lista de cambios que ese dispositivo todavía no manda al servidor.
3. Cuando hay conexión, la app manda la bandeja al servidor. **Un cambio solo sale de la bandeja cuando el servidor confirma que lo guardó.** Por eso no se pierde nada si se corta el internet a la mitad.

### 4.2 Cómo se ponen de acuerdo varios celulares

- Cada cambio lleva un **sello** con la hora y el nombre del dispositivo.
- Cuando dos celulares cambian lo mismo, **gana el sello más nuevo**. Así todos terminan con lo mismo, sin importar en qué orden reciban los cambios.
- El servidor además manda su hora, y cada celular corrige su reloj si está desfasado.
- **Ojo:** gana el registro completo, no cada dato por separado. Si una persona cambia el precio de un producto y otra lo cuenta al mismo tiempo sin conexión, queda solo lo del último (ver sección 8).

### 4.3 El servidor

- Es **PocketBase**, un programa gratis de un solo archivo. Se prende con doble clic en `servidor/iniciar.bat`.
- Guarda **una lista que solo crece**: cada cambio de cada tienda, en el orden en que llegó. Nunca edita ni borra filas de esa lista.
- Revisa cada cambio antes de guardarlo:
  - que quien lo manda sea de esa tienda y tenga permiso;
  - que los números tengan sentido (sin precios negativos, sin fiados de más de $1.000.000);
  - que no edite una venta ya guardada.
- **Un cambio rechazado no borra nada en el celular.** Queda una copia aparte.
- Avisa al instante a los otros celulares de la tienda que hay algo nuevo.

### 4.4 Quién puede entrar

- **Toda tienda en el servidor tiene un dueño con usuario y contraseña.** Saber el código de la tienda no basta para ver ni cambiar nada.
- La sesión dura 30 días y se renueva sola. Al cambiar la contraseña, las sesiones anteriores dejan de servir.
- Los permisos se revisan **en el servidor**. Que un botón no aparezca en pantalla es solo orden: lo que protege es el servidor.
- El **panel de administración** del servidor solo abre desde el wifi, con la IP del computador (no con `localhost`).

### 4.5 Qué se puede abrir desde internet (cuando haya internet)

Solo la app, la página de la tienda, las reservas, las cuentas y la sincronización. El panel de administración y el resto del servidor quedan cerrados.

### 4.6 Sin internet

Un "service worker" guarda una copia de la app en el dispositivo, para que abra sin conexión. Cada vez que cambia un archivo de la app se sube su número de versión (hoy `v33`) y los celulares bajan la copia nueva la próxima vez que abren con conexión.

---

## 5. Dónde se guardan los datos

| Dato | Dónde está | Quién lo puede ver |
|---|---|---|
| Productos, ventas, fiados, clientes | En cada celular de la tienda (IndexedDB), sin cifrar | Quien tenga el celular desbloqueado |
| La misma información, de todas las tiendas | En el servidor, carpeta `mi-almacen-datos`, **fuera** del repositorio | Quien administre el servidor (hoy, tú) |
| Usuarios y contraseñas | En el servidor. Las contraseñas se guardan cifradas de forma que no se pueden leer | Nadie las puede leer, ni tú |
| Copias diarias del servidor | `mi-almacen-datos/backups`, en el mismo disco | Quien administre el servidor |
| Respaldo por correo | En el Gmail que eligió cada tienda | Quien entre a ese correo |
| Respaldo descargado | Donde el dueño guarde el archivo | Quien tenga el archivo (**hoy incluye la sesión del dueño**, ver sección 8) |
| Código de la app | GitHub, `benjaminolate/Mi-Almacen`, rama `main` | Público o privado según el repositorio |

Nunca se suben a GitHub datos, respaldos, claves ni archivos `.env`.

---

## 6. Cómo está montado el proyecto

| Archivo o carpeta | Qué es |
|---|---|
| `index.html` | La página principal: carga los estilos y los archivos de la app, en orden. |
| `js/` (19 archivos) | La app, repartida por tema: vender, inventario, fiados, cuentas, etc. |
| `estilos.css` | Cómo se ve la app. |
| `local-db.js` | La base de datos del dispositivo, la bandeja de salida, el reloj de los cambios y los respaldos. |
| `sync.js` | Envía y recibe cambios con el servidor. |
| `catalogos.js` | Los productos típicos de cada tipo de negocio. |
| `tienda.html`, `pagina.js` | La página pública de la tienda. |
| `qr.js` | Genera los códigos QR. |
| `sw.js` | Guarda la app en el dispositivo para abrirla sin internet. |
| `servidor/pb_hooks/` | Las reglas del servidor: sincronización, cuentas e invitaciones, página pública, respaldo por correo, archivos que se entregan y bloqueo de internet. |
| `servidor/pb_migrations/` | Crean las tablas: `cambios`, `vitrinas`, `usuarios`, `miembros`, `invitaciones`. |
| `servidor/INSTRUCCIONES.md` | Cómo prender el servidor, paso a paso. |
| `tests/` | 43 pruebas automáticas. Corren solas en GitHub en cada cambio. |
| `CLAUDE.md` | Las reglas del proyecto y el mapa del código. |

**Sin frameworks ni dependencias:** la app es HTML y JavaScript sin compilar. Solo las pruebas usan una herramienta externa (Playwright), y la app no la carga.

**Cosas de afuera que la app sí carga hoy:** las letras (Google Fonts) y el lector de códigos de barras (desde jsDelivr). La auditoría recomienda copiarlas al repositorio.

---

## 7. Lo que se ha hecho

| Etapa | Qué se hizo | PR |
|---|---|---|
| Construcción | App instalable, base local, sincronización, extensiones, tipos de negocio, página de la tienda, cuentas | antes del #1 |
| Mejoras de Inventario VD | Validaciones, eliminar productos y clientes, respaldo por correo, página tipo "link en bio", ronda de pruebas (162 de 162) | #1 a #8 |
| Etapa 0: pruebas | Pruebas automáticas en el repositorio y en GitHub | #9 |
| Etapa 1: no perder datos | Clientes con deuda, vencimiento "revisado", ventas que no se editan, reloj de cambios, ids maliciosos, archivos que entrega el servidor, cambios rechazados sin borrar, respaldo en partes, encabezados de seguridad | #10 a #18 |
| Etapa 2: costos privados | El servidor solo manda los costos a quien tiene el permiso | #19, #20 |
| Etapa 3: orden del código | La app pasó de un archivo de 3.000 líneas a 19 archivos por tema | #21 a #24 |
| Etapa 4: calidad visual | Contraste en modo oscuro, pantalla Contar, página de la tienda, etiquetas más legibles, botones de 44 px | #25 a #29 |
| Seguridad antes de internet | Panel cerrado a internet, toda tienda con dueño, invitaciones de un solo uso | #30 a #32 |

---

## 8. Lo que encontró la auditoría (resumen)

El detalle, las pruebas y cómo arreglar cada cosa están en la [Auditoría de noviembre de 2026](https://claude.ai/artifact/YbHxnFAKs3f4NwaaYoeUXQ).

### Para arreglar antes de salir a internet (gratis)

| # | Problema | Por qué importa |
|---|---|---|
| 1 | Si se pierde el servidor, **el respaldo del correo no sirve para levantar la tienda en un servidor nuevo**: la app pide un usuario que ese servidor no tiene. Probado. | Es justo el caso para el que existe ese respaldo. |
| 2 | **El respaldo que se descarga incluye la sesión del dueño.** Quien tenga el archivo puede entrar a la tienda hasta por 30 días. Probado. | La app recomienda mandarse ese archivo por WhatsApp. |
| 3 | **El servidor se pone lento a medida que una tienda crece.** Con 10.000 ventas guardadas, recibir 500 ventas tarda 9 segundos en vez de medio. Probado. | Restaurar una tienda grande tomaría horas. |
| 4 | **Cualquiera puede crear tiendas en el servidor** y llenarle el disco: no hay límite de tamaño ni de pedidos. Probado: aceptó 27 MB en un solo pedido. | En internet, un extraño puede botar el servidor de todas las tiendas. |
| 5 | **Un extraño puede dejar al dueño sin poder entrar** con solo fallar 10 veces su contraseña (15 minutos, y se puede repetir). Probado. | Molestia fácil de provocar. |
| 6 | El lector de códigos se baja de otro sitio sin revisar que no lo cambiaron, y no hay regla que limite qué código corre la página. | Si ese sitio falla o lo atacan, afecta a todas las tiendas. |
| 7 | En un VPS no habrá forma de abrir el panel de administración: hoy solo abre desde el wifi. | Sin panel no se restaura un respaldo ni se cambia una contraseña olvidada. |

### Para arreglar antes del piloto

- **La app se pone lenta con cerca de un año de ventas.** En un celular lento, con 60.000 ventas la pantalla Contar tarda unos 5 segundos y abrir la app otros 5. Con 150.000, entre 10 y 16 segundos. Vender sigue siendo instantáneo. Probado.
- **Un cambio demasiado grande deja trabado el envío de ese celular:** el servidor rechaza el envío completo y la app lo reintenta para siempre. Probado el rechazo.
- Un cambio con la fecha muy adelantada deja "congelado" ese producto para los demás celulares: el servidor no revisa la fecha.
- Contraseña mínima de 6 caracteres (subir a 8).
- Si el dueño olvida su contraseña, solo se arregla desde el panel de administración.
- Quitar un permiso no borra del celular lo que ya se había descargado (por ejemplo, los costos).
- Los avisos de "hay cambios nuevos" los puede escuchar cualquiera que sepa el código de la tienda (no traen datos).
- Cuando dos personas cambian el mismo producto sin conexión, se pierde el cambio de una.
- PIN de la app, lista de celulares y sacar un celular a distancia.
- Política de privacidad y condiciones de uso.

### Diseño

- No se encontró ningún texto con contraste bajo ni pantalla que se salga del ancho, en 22 pantallas en claro, oscuro y letra grande.
- Lo que sí: el Inicio tiene muchas tarjetas y ninguna manda; los títulos se parten en dos líneas; los filtros se ven cortados ("Apaga", "Verdu"); las letras de la barra de abajo miden 11 px y no crecen con la letra grande; todos los tipos de negocio se ven iguales.

---

## 9. El plan

Cada paso va en su propio PR, con pruebas. Los primeros tres pasos no cuestan plata.

### Paso 1. Cerrar lo que encontró la auditoría antes de internet (gratis)

1. Poder levantar una tienda en un servidor nuevo desde el respaldo del correo.
2. Sacar la sesión del respaldo descargado.
3. Hacer rápido al servidor con tiendas grandes.
4. Límites en el servidor: tamaño por pedido, espacio por tienda y cantidad de pedidos. Crear tiendas nuevas solo con un código que das tú.
5. Que fallar la contraseña no bloquee al dueño.
6. Copiar el lector de códigos y las letras al repositorio, y limitar qué código puede correr la página.
7. Dejar lista la forma de abrir el panel en un VPS.

**Listo cuando:** las pruebas nuevas pasan, incluida una que pierde el servidor y levanta la tienda en otro.

### Paso 2. Que la app aguante años de ventas (gratis)

1. Calcular el stock de todos los productos de una sola pasada.
2. Prueba automática con un año de ventas, para que no vuelva a pasar.
3. Más adelante: guardar aparte las ventas antiguas.

**Listo cuando:** con 150.000 ventas, ninguna pantalla tarda más de un segundo en un celular lento.

### Paso 3. Probar por internet sin gastar (opcional, gratis)

Túnel desde tu computador, para ver un celular con datos móviles sincronizando. Sirve para probar, no para una tienda real, porque depende de que tu computador esté prendido.

### Paso 4. Servidor de verdad (aquí se empieza a gastar: necesita tu aprobación)

1. Arrendar un VPS (unos US$4 a 6 al mes) y comprar el dominio (unos $10.000 al año). Se revisan los precios del momento antes de pagar.
2. Instalar con candado https automático, cortafuegos y el servidor escondido detrás.
3. Respaldo de cada noche a otro lugar, y **probar una restauración completa**.
4. Aviso al celular si el servidor se cae o el disco se llena.
5. Rutina de actualizaciones.

**Listo cuando:** un celular fuera de tu casa vende y lo ves en tu computador, y se restauró el servidor desde cero al menos una vez.

### Paso 5. Preparar el piloto

1. Arreglos chicos de seguridad: contraseña de 8, fecha adelantada, avisos solo con sesión, y que un cambio gigante no trabe el envío.
2. PIN de la app, lista de celulares y sacar un celular a distancia.
3. Código de recuperación para la contraseña del dueño, y borrar del celular lo que un permiso ya no deja ver.
4. Inicio nuevo: panel del dueño con sus números, e inicio simple para el vendedor.
5. Aspecto por tipo de negocio y guía visual (`docs/GUIA-VISUAL.md`).
6. Sumar un celular con código QR.
7. Aviso de versión nueva de la app.
8. Política de privacidad, condiciones de uso y una forma de borrar los datos personales de un cliente.
9. Arreglos de diseño chicos (títulos, filtros, barra de abajo).

### Paso 6. Piloto con 2 o 3 negocios

Acompañarlos a crear la tienda, ajustar el catálogo, contar el primer sector y sumar sus celulares. Anotar dónde se traban.

**Listo cuando:** la usan todos los días por algunas semanas, sin perder datos y sin llamarte para preguntar cómo se hace algo.

### Paso 7. Crecer

- Planes básico, medio y pro (cobrar por celulares y funciones, nunca reteniendo datos).
- Anular ventas dejando constancia, reportes de ganancia, cuenta para varias tiendas.
- Play Store (US$25 una vez; pide dominio propio).
- Reservas de horas para negocios de servicios.

---

## 10. Cuánto cuesta

| Etapa | Costo |
|---|---|
| Pasos 1, 2 y 3 | **$0** |
| Paso 4 en adelante | VPS unos US$4 a 6 al mes + dominio unos $10.000 al año |
| Play Store | US$25 una sola vez |
| App Store (opcional) | US$99 al año |

Los precios son de referencia y se revisan antes de pagar. Nada se compra sin tu aprobación.

---

## 11. Decisiones que son tuyas

1. **Con qué seguimos:** recomiendo el Paso 1 completo, después el Paso 2.
2. **VPS o túnel** para salir a internet, y cuándo gastar.
3. **Cómo se crean tiendas nuevas** en tu servidor: solo con un código que das tú (recomendado) o libre.
4. **Aspecto por tipo de negocio** e **Inicio nuevo**: te muestro capturas antes de cambiar nada.
5. **Planes de pago:** qué incluye cada uno y cuánto cuesta, con lo que se aprenda en el piloto.

---

## 12. Reglas del proyecto (las que no se rompen)

1. Sin internet primero: nada de uso diario puede exigir conexión.
2. Nunca perder datos: los movimientos no se editan y nada se borra sin dejar constancia.
3. Los permisos se revisan en el servidor.
4. Si cambia un archivo de la app, se sube la versión de `sw.js`.
5. Los datos del servidor viven fuera del repositorio. Nunca se suben datos, respaldos ni claves.
6. `Inventario_almacen_VD` solo se lee.
7. Nada está terminado sin correr las pruebas. Lo que no se pudo probar, se dice.
8. Un tema por rama y por PR.
9. Lo más simple que funcione, sin frameworks ni dependencias nuevas.
10. No se gasta plata ni se toca infraestructura real sin tu aprobación.

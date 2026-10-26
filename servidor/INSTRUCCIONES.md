# Cómo prender el servidor en tu computador (Fase 2)

El servidor es **PocketBase**, un programa gratis de un solo archivo. Guarda el "cuaderno maestro" de la tienda y mantiene a todos los dispositivos al día. Mientras probamos, corre en tu computador y lo ven los celulares que están **en el mismo wifi**.

## 1. Descargar el proyecto

En [github.com/benjaminolate/Mi-Almacen](https://github.com/benjaminolate/Mi-Almacen) toca **Code → Download ZIP** y descomprímelo, por ejemplo en `Documentos`. Te queda una carpeta `Mi-Almacen-main`.

(Si usas git: `git clone https://github.com/benjaminolate/Mi-Almacen.git`.)

## 2. Poner PocketBase en la carpeta `servidor`

1. Descarga PocketBase desde [pocketbase.io/docs](https://pocketbase.io/docs/). En Windows elige **Windows x64**. Probé la app con la versión **0.40.5**; una más nueva debería funcionar igual.
2. Descomprime el ZIP.
3. Copia `pocketbase.exe` (en Mac o Linux: `pocketbase`) dentro de la carpeta **`servidor`** del proyecto, al lado de `iniciar.bat`.

## 3. Prenderlo

- **Windows:** doble clic en `servidor/iniciar.bat`. Se abre una ventana negra; déjala abierta mientras uses la app.
  - La primera vez, Windows pregunta si permites que PocketBase use la red: marca **Redes privadas** y acepta. Sin eso, los celulares no lo van a encontrar.
- **Mac o Linux:** en una terminal, `servidor/iniciar.sh`.

La primera vez PocketBase puede abrir el navegador para crear una cuenta de **administrador** del servidor. Es opcional: la app no la necesita. Si la creas, desde `http://localhost:8090/_/` puedes ver los datos guardados en la tabla `cambios`.

Los datos quedan en una carpeta **`mi-almacen-datos`**, al lado de la carpeta del proyecto (fuera de ella, para que nunca se suban a GitHub).

## 4. Abrir la app en el computador

Abre **http://localhost:8090** en el navegador.

- Si ya tenías una tienda creada en esta dirección, se conecta sola al servidor.
- Si no, crea la tienda. Arriba a la derecha tiene que decir **"Sincronizado"**.

> La app de GitHub Pages (`benjaminolate.github.io/Mi-Almacen`) es otra dirección y tiene sus propios datos. Solo puede conectarse al servidor cuando este tiene dirección con candado (https): ver el paso 7.

## 5. Sumar un celular

1. Averigua la **IP de tu computador** en el wifi:
   - Windows: abre "Símbolo del sistema", escribe `ipconfig` y busca **Dirección IPv4** (algo como `192.168.1.20`).
   - Mac: Preferencias del Sistema → Red.
2. En el computador, en la app: **Más → Tienda y datos → Sincronización**. En **Dirección del servidor** cambia `localhost` por la IP, por ejemplo `http://192.168.1.20:8090`, y toca **Guardar**. Así el link de invitación sirve para los celulares.
3. Toca **Enviar por WhatsApp** (o **Copiar link**) y ábrelo en el celular, conectado al **mismo wifi**.
4. En el celular toca **Unirme y descargar los datos**. En unos segundos tiene todos los productos.

Desde ahí, lo que se venda en uno aparece en el otro al instante.

## 6. Qué probar

- Vende en el celular y mira cómo aparece en el computador (y al revés).
- Apaga el wifi del celular, vende algo y vuelve a prenderlo: la venta llega sola al computador. Mientras no hay conexión, arriba dice **"Sin internet · N por enviar"**.
- Cierra la ventana del servidor, sigue vendiendo en los dos, y vuelve a prenderlo: todo se junta.
- Cambia el precio de un mismo producto en los dos: queda el último que se cambió.

## Respaldos automáticos

El servidor guarda solo una copia de todo **cada día a las 3 de la mañana** (si el computador está prendido) y mantiene las últimas 14. Quedan en `mi-almacen-datos/backups`.

Para volver a una copia: entra a `http://localhost:8090/_/` con la cuenta de administrador → **Settings → Backups** → elige la fecha → **Restore**. Ahí mismo puedes hacer una copia a mano con **Initialize new backup**.

Aparte, desde la app (**Más → Tienda y datos**) puedes descargar un respaldo a tu teléfono. Al restaurarlo puedes elegir **Agregar lo que falta**, que no borra nada de lo que ya hay.

## 7. Conectar el servidor a internet (gratis, con candado)

Sirve para tres cosas: que tus clientes abran la **página de la tienda** desde su casa, que los celulares de la tienda sincronicen **fuera del wifi**, y que en el celular funcionen la **cámara en vivo** y la **instalación** de la app (necesitan candado, https).

Se usa **Tailscale Funnel**, que es gratis y le da a tu computador una dirección fija con candado, por ejemplo `https://mi-pc.tu-red.ts.net`. Tu computador tiene que estar prendido con el servidor abierto, como siempre.

1. Crea una cuenta en [tailscale.com](https://tailscale.com) (puedes entrar con Google) e instala Tailscale en el computador del servidor.
2. Abre "Símbolo del sistema" y escribe:

   ```
   tailscale funnel --bg 8090
   ```

   La primera vez te muestra un link para permitir Funnel en tu cuenta: ábrelo, acepta y vuelve a escribir el comando. Al final te muestra la dirección, algo como `https://mi-pc.tu-red.ts.net`. Queda guardado: no hay que repetirlo cada vez que prendes el computador.
3. Abre esa dirección en el navegador: tiene que aparecer la app.
4. En la app, en **Más → Tienda y datos → Sincronización**, cambia la **Dirección del servidor** por la nueva (`https://...ts.net`) y toca **Guardar**. Desde ahí, el link para sumar un celular sirve desde cualquier lugar.
5. En **Más → Página de la tienda**, anota la misma dirección en **Dirección en internet**.

Para apagarlo: `tailscale funnel --bg 8090 off`.

> ¿Solo quieres probar sin crear una cuenta? Con [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/) y el comando `cloudflared tunnel --url http://localhost:8090` obtienes una dirección `https://...trycloudflare.com` al instante, pero cambia cada vez que lo abres, así que no sirve para un código QR impreso.

### Qué queda abierto a internet

Solo la app, la página de la tienda, las reservas y la sincronización. El panel de administración (`/_/`) y el resto del servidor responden únicamente en el wifi de la tienda. Los datos de una tienda solo los puede leer quien tenga su código (el link de invitación), así que no lo compartas fuera del equipo.

## 8. La página de la tienda

En la app, activa la extensión **Página de la tienda** (Más → Extensiones) y entra a **Más → Página de la tienda**:

- Prende **Página activa**. Aparecen el link, el código QR, **Descargar QR** e **Imprimir cartel** para pegar en el mostrador.
- Elige si muestra todos los productos con precio o solo el pan, y si muestra cuando algo está agotado.
- Con **Reservas por internet**, los clientes reservan con su nombre y celular. La reserva llega sola a todos los dispositivos de la tienda (suena) y aparece en **Reservas**: ahí la confirmas o la rechazas y le avisas por WhatsApp. El cliente ve en la misma página si su reserva fue confirmada.
- Para evitar abusos: cada celular puede hacer hasta 3 reservas al día, hay un máximo de reservas por día que eliges tú, y puedes bloquear un número desde cualquiera de sus reservas.
- **Cambiar el link** hace que el anterior y su QR dejen de funcionar.

La página muestra lo que la app publicó la última vez que estuvo conectada al servidor; si cambias un precio, se actualiza en unos segundos.

## 9. Cuentas y permisos

Sin cuentas, cualquiera con el link de invitación entra a la tienda y puede hacer de todo. Con cuentas, cada persona entra con su usuario y contraseña.

1. En la app del dueño: **Más → Cuentas y permisos**. Escribe tu nombre, un usuario y una contraseña (al menos 6 caracteres) y toca **Activar las cuentas**. Necesita conexión con el servidor.
2. Toca **+ Agregar** por cada persona que atiende: nombre, usuario, contraseña y rol.
   - **Vendedor:** vende, anota fiados, reservas y encargos, y cierra la caja. Puedes marcarle permisos extra: cambiar precios, ver costos, contar y recibir, ver reportes o cambiar ajustes.
   - **Encargado:** todo menos crear cuentas.
   - **Dueño:** todo, y administra las cuentas.
3. Los dispositivos que ya estaban unidos piden usuario y contraseña en la próxima sincronización. Un celular nuevo abre la app, toca **Entrar con mi usuario**, escribe la dirección del servidor, su usuario y contraseña, y descarga la tienda.
4. Si alguien deja de trabajar contigo, entra a su nombre y toca **Quitarle el acceso**: su celular deja de recibir y enviar datos.

Si olvidas tu contraseña de dueño, entra al panel `http://localhost:8090/_/` desde el computador del servidor → tabla **usuarios** → tu usuario → cambia la contraseña.

## Si algo falla

| Problema | Qué hacer |
|---|---|
| La ventana dice "Falta pocketbase.exe" | Copia `pocketbase.exe` dentro de la carpeta `servidor`. |
| El celular no abre `http://192.168...:8090` | Revisa que esté en el mismo wifi, que la IP sea la correcta y que Windows haya dado permiso a PocketBase (Panel de control → Firewall de Windows → Permitir una aplicación → PocketBase → Privada). |
| Arriba dice "Sin servidor" | La ventana del servidor está cerrada o el computador cambió de IP. Préndelo de nuevo; los cambios se envían solos. |
| "El servidor no tiene datos de esa tienda" al unirse | El link se copió incompleto. Vuelve a enviarlo desde el computador. |
| Los clientes ven "No se pudo conectar con la tienda" | El computador o el servidor están apagados, o Tailscale está cerrado. |
| La dirección `https://...ts.net` no abre | Revisa que Tailscale esté conectado en el computador y vuelve a escribir `tailscale funnel --bg 8090`. |

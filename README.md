# Mi Almacén

App de inventario y ventas para negocios de barrio (almacenes, panaderías, minimarkets). Se instala en el celular o el computador desde el navegador, **guarda todo en el mismo dispositivo y funciona sin internet**.

Va en la **Fase 2** del plan: cada dispositivo guarda todo en su base local y, cuando hay conexión, se sincroniza con un servidor PocketBase que corre en tu propio computador. Las cuentas de usuario y la página pública de reservas llegan en las fases siguientes.

Parte del código de [Inventario_almacen_VD](https://github.com/benjaminolate/Inventario_almacen_VD), que sigue igual por su lado.

## Qué hace

- **Vender, recibir mercadería y contar por sectores**, con escaneo de códigos de barras con la cámara.
- **Stock calculado por producto:** `último conteo + compras − ventas desde ese conteo`. Se puede contar un sector por día sin cerrar el negocio.
- **Fiados** por cliente con recordatorio por WhatsApp, **aviso de que llegó el pan** y **reservas** anotadas por la tienda.
- **Funciona sin internet:** la app queda guardada en el dispositivo (service worker) y los datos en su base local (IndexedDB).
- **Instalable** como app (PWA), sin pasar por Play Store.
- **Respaldo** en un archivo y restauración desde él.

## Cómo se guardan los datos

```
Pantalla ──> act (acciones) ──> LocalDB.apply()  ──> IndexedDB del dispositivo
                                      │                 ├─ products, movs, clients, fiados, reservas, ajustes
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
- El servidor también devuelve su hora: el dispositivo corrige su reloj si está desfasado.
- Un dispositivo nuevo se une con un link de invitación (`?unirse=<código>&servidor=<dirección>`) y descarga todo.
- Por ahora el código de la tienda (un UUID) es la llave de acceso. Las cuentas llegan en la Fase 4.

Cómo prenderlo: [servidor/INSTRUCCIONES.md](servidor/INSTRUCCIONES.md).

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | Toda la app: estilos, pantallas y acciones |
| `local-db.js` | Base local (IndexedDB), bandeja de salida, reloj lógico y respaldos |
| `sync.js` | Envía y recibe cambios con el servidor, y escucha los avisos en tiempo real |
| `servidor/pb_migrations/` | Crea la tabla `cambios` en PocketBase |
| `servidor/pb_hooks/sync.pb.js` | El punto de sincronización `/api/sync` |
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

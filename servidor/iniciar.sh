#!/bin/sh
# Inicia el servidor de Mi Almacén en este computador (Mac o Linux).
# Los datos quedan en la carpeta "mi-almacen-datos", al lado de la carpeta del proyecto.
cd "$(dirname "$0")" || exit 1
if [ ! -x ./pocketbase ]; then
  echo "Falta el programa pocketbase en $(pwd)"
  echo "Descárgalo desde https://pocketbase.io/docs/, descomprímelo y copia el archivo pocketbase aquí."
  exit 1
fi
echo ""
echo " Servidor de Mi Almacén"
echo " - En este computador abre:  http://localhost:8090"
echo " - En los celulares (mismo wifi) abre:  http://IP-DE-ESTE-COMPUTADOR:8090"
echo " Para apagarlo, presiona Ctrl+C."
echo ""
exec ./pocketbase serve --http=0.0.0.0:8090 --dir=../../mi-almacen-datos --publicDir=.. --hooksDir=pb_hooks --migrationsDir=pb_migrations

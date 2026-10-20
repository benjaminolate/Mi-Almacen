@echo off
rem Inicia el servidor de Mi Almacen en este computador (Windows).
rem Los datos quedan en la carpeta "mi-almacen-datos", al lado de la carpeta del proyecto.
cd /d "%~dp0"
if not exist pocketbase.exe (
  echo.
  echo Falta pocketbase.exe en esta carpeta:
  echo %~dp0
  echo Descargalo desde https://pocketbase.io/docs/ ^(Windows x64^), descomprimelo y copia pocketbase.exe aqui.
  echo.
  pause
  exit /b 1
)
echo.
echo  Servidor de Mi Almacen
echo  - En este computador abre:  http://localhost:8090
echo  - En los celulares (mismo wifi) abre:  http://IP-DE-ESTE-COMPUTADOR:8090
echo  Para apagarlo, cierra esta ventana.
echo.
pocketbase.exe serve --http=0.0.0.0:8090 --dir="%~dp0..\..\mi-almacen-datos" --publicDir=.. --hooksDir=pb_hooks --migrationsDir=pb_migrations
pause

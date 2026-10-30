@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo             WINE WEB 0.2.1
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERRO: Node.js nao foi encontrado.
  echo Instale Node.js 20 ou superior em https://nodejs.org/
  pause
  exit /b 1
)

node -e "const n=Number(process.versions.node.split('.')[0]); if(n<20){console.error('Node.js 20 ou superior e necessario.');process.exit(1)}"
if errorlevel 1 (
  pause
  exit /b 1
)

if not exist "engine-assets.json" goto sync_engine
if not exist "wine64-launcher.js" goto sync_engine
if not exist "boxedwine64.js" goto sync_engine
if not exist "boxedwine64.wasm" goto sync_engine
if not exist "coi-serviceworker.js" goto sync_engine
if not exist "engine\boxedwine64\glibc-rootfs64.zip" goto sync_engine
if not exist "engine\boxedwine64\prefix64.zip" goto sync_engine
if not exist "engine\boxedwine64\wine64.zip.manifest.json" if not exist "engine\boxedwine64\wine64.zip" goto sync_engine
goto start_server

:sync_engine
echo O motor Windows ainda nao esta instalado.
echo Baixando Boxedwine64 e os arquivos do Wine.
echo ATENCAO: o download e grande e requer internet.
echo.
npm run sync-engine
if errorlevel 1 (
  echo.
  echo FALHA ao baixar o motor. Verifique sua internet e tente novamente.
  echo O Wine Web nao executa EXE sem esses arquivos.
  pause
  exit /b 1
)

:start_server
echo.
echo Abrindo Wine Web em http://127.0.0.1:4173/
echo IMPORTANTE: mantenha esta janela aberta enquanto usar o Wine Web.
echo Para encerrar, pressione Ctrl+C.
echo.
start "Wine Web" http://127.0.0.1:4173/
npm start
pause

@echo off
REM ==========================================================
REM  Gera o APK do app Music
REM  O projeto do Music fica em ..\site-music (pasta propria)
REM  O APK sai em ..\site-music\APK\Music.apk
REM ==========================================================
setlocal
cd /d "%~dp0..\site-music"

if not exist "package.json" (
  echo [ERRO] Nao achei a pasta ..\site-music
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [0/3] Instalando dependencias ^(npm install^)...
  call npm.cmd install
  if errorlevel 1 goto :erro
)

echo.
echo [1/3] Sincronizando o site para a pasta www...
if not exist www mkdir www
copy /Y index.html  www\index.html  >nul
copy /Y app.js      www\app.js      >nul
copy /Y lyrics.js   www\lyrics.js   >nul
copy /Y catalog.js  www\catalog.js  >nul
copy /Y styles.css  www\styles.css  >nul
copy /Y logo.svg    www\logo.svg    >nul
if exist icone-192.png copy /Y icone-192.png www\icone-192.png >nul
if exist icone-512.png copy /Y icone-512.png www\icone-512.png >nul
if exist manifest.json copy /Y manifest.json www\manifest.json >nul

echo [2/3] Sincronizando com o Android...
call npx.cmd cap sync android
if errorlevel 1 goto :erro

echo [3/3] Gerando o APK (pode demorar 1-2 minutos)...
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "ANDROID_SDK_ROOT=%ANDROID_HOME%"
pushd android
call gradlew.bat assembleDebug --no-daemon
if errorlevel 1 (popd & goto :erro)
popd

if not exist "APK" mkdir "APK"
copy /Y "android\app\build\outputs\apk\debug\app-debug.apk" "APK\Music.apk" >nul

echo.
echo ==========================================================
echo  PRONTO! O APK esta em:  site-music\APK\Music.apk
echo ==========================================================
echo.
start "" "APK"
endlocal
exit /b 0

:erro
echo.
echo ==========================================================
echo  FALHOU. Veja as mensagens acima.
echo ==========================================================
pause
endlocal
exit /b 1

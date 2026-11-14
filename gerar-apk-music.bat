@echo off
REM ==========================================================
REM  Gera o APK do app Music
REM  Clique duas vezes neste arquivo.
REM ==========================================================
setlocal
cd /d "%~dp0site-music"

echo.
echo [1/3] Sincronizando o site para a pasta www...
if not exist www mkdir www
copy /Y index.html  www\index.html  >nul
copy /Y app.js      www\app.js      >nul
copy /Y catalog.js  www\catalog.js  >nul
copy /Y styles.css  www\styles.css  >nul
copy /Y logo.svg    www\logo.svg    >nul
if exist icone-192.png copy /Y icone-192.png www\icone-192.png >nul
if exist icone-512.png copy /Y icone-512.png www\icone-512.png >nul
if exist manifest.json copy /Y manifest.json www\manifest.json >nul

echo [2/3] Sincronizando com o Android...
call npx.cmd cap sync android

echo [3/3] Gerando o APK (pode demorar 1-2 minutos)...
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "ANDROID_SDK_ROOT=%ANDROID_HOME%"
pushd android
call gradlew.bat assembleDebug --no-daemon
popd

if not exist "..\APK" mkdir "..\APK"
copy /Y "android\app\build\outputs\apk\debug\app-debug.apk" "..\APK\Music.apk" >nul

echo.
echo ==========================================================
echo  PRONTO! O APK esta em:  APK\Music.apk
echo ==========================================================
echo.
start "" "..\APK"
endlocal
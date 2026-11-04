@echo off
REM ---------------------------------------------------------------------------
REM Abre UNA ventana de Chrome por cada usuario bot, cada una con su perfil y
REM su puerto fijo, para poder manejarlas todas a la vez desde Claude Code.
REM
REM   abrir-todos.cmd
REM
REM El puerto de cada quien NO cambia, para que el chat y el codigo puedan
REM referirse a "el 9224" y sea siempre Diego:
REM
REM   9222  MATEO    Agente     ccjimenez+agente1@jiro.com.mx
REM   9223  VALERIA  Agente     ccjimenez+agente2@jiro.com.mx
REM   9224  DIEGO    Empleado   ccjimenez+empleado1@jiro.com.mx
REM   9225  SOFIA    Empleado   ccjimenez+empleado2@jiro.com.mx
REM   9226  LAURA    Gerente    ccjimenez+gerente@jiro.com.mx
REM
REM La sesion de cada una se inicia A MANO y queda guardada en su perfil, en
REM %LOCALAPPDATA%\movi-qa\perfiles\<nombre>, FUERA del repo. La contrasena
REM nunca pasa por el chat ni queda escrita en ningun archivo.
REM
REM Si una ventana ya esta abierta en ese puerto, Chrome la reutiliza en vez
REM de abrir otra: correr esto dos veces no hace dano.
REM ---------------------------------------------------------------------------
setlocal
REM Van de una en una con pausa: lanzar las cinco de golpe NO funciona,
REM Chrome se pisa a si mismo y solo arranca una. Probado el 04/11.
call :uno mateo   9222
call :uno valeria 9223
call :uno diego   9224
call :uno sofia   9225
call :uno laura   9226
echo.
echo Cinco ventanas abiertas. Inicia sesion en cada una; la contrasena no
echo pasa por el chat. El puerto de cada quien esta en el titulo de arriba.
endlocal
exit /b 0

:uno
set "PERFIL=%LOCALAPPDATA%\movi-qa\perfiles\%~1"
if not exist "%PERFIL%" mkdir "%PERFIL%"
echo %~1 -^> puerto %~2
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=%~2 --user-data-dir="%PERFIL%" --no-first-run --no-default-browser-check --window-size=1280,900 https://beta.movi.digital/login
timeout /t 4 /nobreak
exit /b 0

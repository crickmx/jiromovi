@echo off
REM ---------------------------------------------------------------------------
REM Abre una ventana de Chrome AISLADA y con depuracion remota, para que Claude
REM Code pueda manejarla desde el chat.
REM
REM   abrir.cmd <perfil> [puerto]
REM   abrir.cmd ricardo
REM   abrir.cmd diego 9223
REM
REM El perfil vive en %LOCALAPPDATA%\movi-qa\perfiles\<perfil>, FUERA del repo:
REM ahi queda la sesion iniciada, y son tokens de Supabase. No se versionan.
REM Para dos sesiones a la vez, usa puertos distintos (9222, 9223, ...).
REM ---------------------------------------------------------------------------
setlocal
if "%~1"=="" (
  echo Falta el perfil.  Ejemplo:  abrir.cmd ricardo
  exit /b 1
)
set "PUERTO=%~2"
if "%PUERTO%"=="" set "PUERTO=9222"
set "PERFIL=%LOCALAPPDATA%\movi-qa\perfiles\%~1"
if not exist "%PERFIL%" mkdir "%PERFIL%"
echo Perfil : %PERFIL%
echo Puerto : %PUERTO%
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=%PUERTO% --user-data-dir="%PERFIL%" --no-first-run --no-default-browser-check https://beta.movi.digital/login
endlocal

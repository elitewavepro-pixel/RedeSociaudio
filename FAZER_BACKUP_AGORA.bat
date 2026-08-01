@echo off
chcp 65001 >nul
set "ORIGEM=%LOCALAPPDATA%\RedeSociaudio\data\sociaudio.db"
set "DESTINO=%LOCALAPPDATA%\RedeSociaudio\backups"
if not exist "%ORIGEM%" (
  echo O banco permanente ainda nao existe. Abra a Rede Sociaudio primeiro.
  pause
  exit /b 1
)
if not exist "%DESTINO%" mkdir "%DESTINO%"
for /f "tokens=1-4 delims=/ " %%a in ('date /t') do set DATA=%%d-%%c-%%b
for /f "tokens=1-2 delims=: " %%a in ('time /t') do set HORA=%%a-%%b
copy /y "%ORIGEM%" "%DESTINO%\sociaudio-backup-%DATA%-%HORA%.db" >nul
echo Backup criado em:
echo %DESTINO%
pause

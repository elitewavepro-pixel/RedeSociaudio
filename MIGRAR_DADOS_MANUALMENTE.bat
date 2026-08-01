@echo off
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>nul && (py migrar_dados.py & goto :end)
where python >nul 2>nul && (python migrar_dados.py & goto :end)
echo Python nao encontrado.
pause
:end

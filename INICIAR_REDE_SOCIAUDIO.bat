@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Rede Sociaudio V20.2 - Busca de contatos aprimorada

echo ===============================================
echo       REDE SOCIAUDIO V20.2 - INICIANDO
echo ===============================================
echo.

where py >nul 2>nul
if %errorlevel%==0 (
    py server.py
    goto :server_end
)

where python >nul 2>nul
if %errorlevel%==0 (
    python server.py
    goto :server_end
)

where python3 >nul 2>nul
if %errorlevel%==0 (
    python3 server.py
    goto :server_end
)

echo ERRO: Python nao foi encontrado.
echo Instale o Python e marque a opcao para adicionar ao PATH.
echo.
pause
exit /b 1

:server_end
set EXIT_CODE=%errorlevel%
echo.
if not "%EXIT_CODE%"=="0" (
    echo O servidor foi encerrado com erro. Codigo: %EXIT_CODE%
    echo Tire uma foto desta tela e envie para analise.
) else (
    echo O servidor foi encerrado.
)
echo.
pause
exit /b %EXIT_CODE%

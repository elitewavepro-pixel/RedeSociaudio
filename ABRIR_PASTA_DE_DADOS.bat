@echo off
set "PASTA=%LOCALAPPDATA%\RedeSociaudio"
if not exist "%PASTA%" mkdir "%PASTA%"
explorer "%PASTA%"

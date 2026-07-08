@echo off
chcp 65001 > nul
set /p URL=Worker health URL 입력(엔터 시 https://guis-arc-os-api.workers.dev/health): 
if "%URL%"=="" set URL=https://guis-arc-os-api.workers.dev/health
curl "%URL%"
pause

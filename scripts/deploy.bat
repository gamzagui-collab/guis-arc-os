@echo off
chcp 65001 > nul
title GUI's Arc OS - Deploy
set /p MSG=커밋 메시지를 입력하세요: 
if "%MSG%"=="" set MSG=Update GUI's Arc OS
git add .
git commit -m "%MSG%"
git push
wrangler deploy backend/src/index.js --name guis-arc-os-api
wrangler pages deploy frontend --project-name=guis-arc-os
pause

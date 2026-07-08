@echo off
chcp 65001 > nul
title GUI's Arc OS - Deploy
echo ==========================================
echo GUI's Arc OS Deploy
echo ==========================================
set /p MSG=Commit message: 
if "%MSG%"=="" set MSG=Update GUI's Arc OS
echo [1/4] Git commit
git add .
git commit -m "%MSG%"
echo [2/4] Git push
git push
echo [3/4] Worker deploy
wrangler deploy backend/src/index.js --name guis-arc-os-api
echo [4/4] Pages deploy
wrangler pages deploy frontend --project-name=guis-arc-os
pause

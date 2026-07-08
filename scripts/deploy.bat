@echo off
chcp 65001 > nul
title GUI's Arc OS - Deploy

echo ==========================================
echo GUI's Arc OS Deploy
echo ==========================================
echo.

set /p MSG=Commit message: 
if "%MSG%"=="" set MSG=Update GUI's Arc OS

echo [1/5] Git status
git status

echo [2/5] Git commit
git add .
git commit -m "%MSG%"
if errorlevel 1 (
  echo No commit or commit failed. Continue...
)

echo [3/5] Git push
git push

echo [4/5] Worker deploy
wrangler deploy --config wrangler.worker.toml

echo [5/5] Pages deploy
wrangler pages deploy frontend --project-name=guis-arc-os-enterprise

echo Done.
pause

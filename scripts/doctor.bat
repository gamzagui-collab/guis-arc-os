@echo off
chcp 65001 > nul
title GUI's Arc OS - Doctor

echo ==========================================
echo GUI's Arc OS Environment Doctor
echo ==========================================
echo.

echo [Git]
git --version
echo.

echo [Node]
node -v
echo.

echo [npm]
npm -v
echo.

echo [Wrangler]
wrangler --version
echo.

echo [Cloudflare Account]
wrangler whoami
echo.

echo [Pages Projects]
wrangler pages project list
echo.

echo [Git Remote]
git remote -v
echo.

echo [Git Status]
git status
echo.

echo Doctor complete.
pause

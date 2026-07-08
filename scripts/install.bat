@echo off
chcp 65001 > nul
title GUI's Arc OS - Install Check
echo ==========================================
echo   GUI's Arc OS 설치 점검
echo ==========================================
where git >nul 2>nul || (echo [필요] Git 설치 필요: https://git-scm.com/download/win & pause & exit /b 1)
echo [OK] Git 확인
where node >nul 2>nul || (echo [필요] Node.js LTS 설치 필요: https://nodejs.org & pause & exit /b 1)
echo [OK] Node 확인
node -v
where npm >nul 2>nul || (echo [필요] npm 확인 실패 & pause & exit /b 1)
echo [OK] npm 확인
npm -v
where wrangler >nul 2>nul || npm install -g wrangler
echo [OK] Wrangler 확인
wrangler --version
wrangler whoami
pause

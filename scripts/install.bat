@echo off
chcp 65001 > nul
title GUI's Arc OS - Install Check
where git >nul 2>nul || (echo Install Git: https://git-scm.com/download/win & pause & exit /b 1)
where node >nul 2>nul || (echo Install Node LTS: https://nodejs.org & pause & exit /b 1)
where npm >nul 2>nul || (echo npm missing & pause & exit /b 1)
where wrangler >nul 2>nul || npm install -g wrangler
git --version
node -v
npm -v
wrangler --version
wrangler whoami
pause

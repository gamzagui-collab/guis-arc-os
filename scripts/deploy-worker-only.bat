@echo off
chcp 65001 > nul
wrangler deploy backend/src/index.js --name guis-arc-os-api
pause

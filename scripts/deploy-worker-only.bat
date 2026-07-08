@echo off
chcp 65001 > nul
title GUI's Arc OS - Worker Deploy
echo Deploying Worker: guis-arc-os-api
wrangler deploy --config wrangler.worker.toml
pause

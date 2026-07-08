@echo off
chcp 65001 > nul
title GUI's Arc OS - Pages Deploy
echo Deploying Pages: guis-arc-os-enterprise
wrangler pages deploy frontend --project-name=guis-arc-os-enterprise
pause

@echo off
chcp 65001 > nul
wrangler pages deploy frontend --project-name=guis-arc-os
pause

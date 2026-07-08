@echo off
chcp 65001 > nul
title GUI's Arc OS - Update
git status
git pull --rebase origin main
pause

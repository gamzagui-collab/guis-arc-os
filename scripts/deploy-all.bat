@echo off
echo GUI's Arc OS v7 deploy helper
git add .
git commit -m "Update GUI's Arc OS v7"
git push
npx wrangler deploy backend/src/index.js --name guis-arc-os-api
npx wrangler pages deploy frontend --project-name=guis-arc-os-enterprise
pause

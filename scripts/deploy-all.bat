@echo off
echo GUI's Arc Enterprise v7 deploy helper
git add .
git commit -m "Update GUI's Arc Enterprise v7"
git push
npx wrangler deploy backend/src/index.js --name guis-arc-api
npx wrangler pages deploy frontend --project-name=guis-arc-enterprise
pause

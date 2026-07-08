@echo off
chcp 65001 > nul
echo 주의: schema.sql은 DROP TABLE을 포함합니다. 기존 D1 데이터가 삭제될 수 있습니다.
set /p OK=정말 진행할까요? YES 입력: 
if /I not "%OK%"=="YES" exit /b 0
wrangler d1 execute guis_arc_os --remote --file=database/d1/schema.sql
wrangler d1 execute guis_arc_os --remote --file=database/d1/seed.sql
pause

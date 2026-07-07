@echo off
echo Applying GUI's Arc OS D1 schema...
wrangler d1 execute guis_arc_os --remote --file=database/d1/schema.sql
wrangler d1 execute guis_arc_os --remote --file=database/d1/seed.sql
pause

import fs from "node:fs";
import {unzipSync} from "fflate";
import {IMPORT_REQUIRED_SHEETS,SIMPLE_LOCATION_HEADERS,SIMPLE_LOCATION_SHEET,TEMPLATE_SHEETS} from "../worker/modules/site-location-import/contracts.js";
import {parseSiteLocationWorkbook} from "../worker/modules/site-location-import/xlsx-parser.js";
const read=file=>fs.readFileSync(file,"utf8");
const required=["AGENTS.md","DEVELOPMENT_RULES.md","VERSION.md","README.md","CHANGELOG.md","BASELINE.json","build-metadata.json","AIOS/PROJECT_STATE.md","AIOS/NEXT_TASK.md",".agents/skills/guis-arc-review/SKILL.md",".agents/skills/guis-arc-implement/SKILL.md",".agents/skills/guis-arc-verify/SKILL.md",".agents/skills/guis-arc-deploy/SKILL.md",".agents/skills/guis-arc-package/SKILL.md","docs/00_CONSTITUTION.md","docs/01_ARCHITECTURE.md","docs/02_MODULE_BOUNDARIES.md","docs/03_DATA_OWNERSHIP.md","docs/05_PERMISSION_MODEL.md","docs/08_VERSION_MATRIX.json","docs/21_WORKFORCE_MODULE_CONTRACT.md","docs/22_WORKFORCE_QR_CONTRACT.md","docs/23_WORKFORCE_ATTENDANCE_POLICY.md","docs/24_WORKFORCE_PRIVACY.md","docs/31_CONSTRUCTION_EXCEL_AND_OUTPUT_ARCHIVE_CONTRACT.md","docs/38_ENGINE_CONSTITUTION_V1.md","docs/98_NEXT_CHAT_HANDOFF.md","docs/99_START_NEXT_CHAT.md","docs/30_MINIMAL_CHANGE_WORKFLOW.md","scripts/task-scope.mjs"];
for(const file of required)if(!fs.existsSync(file))throw new Error(`Missing ${file}`);
for(const [file,token] of[["package.json",'"version": "0.27.1"'],["package-lock.json",'"version": "0.27.1"'],["wrangler.integration.toml",'APP_VERSION = "0.27.1"'],["worker/version.js",'VERSION="0.27.1"'],["apps/web/assets/version.js",'VERSION="0.27.1"'],["apps/web/assets/app.js","issues.js?v=0.27.1-r24"],["apps/web/index.html","v0.27.1"],["apps/web/service-worker.js","v0.27.1-r24-shell"]])if(!read(file).includes(token))throw new Error(`Version surface mismatch: ${file}`);
if(JSON.parse(read("apps/web/manifest.webmanifest")).version!=="0.27.1")throw new Error("PWA manifest version mismatch");
const matrix=JSON.parse(read("docs/08_VERSION_MATRIX.json")),baseline=JSON.parse(read("BASELINE.json")),worker=read("worker/modules/workforce.js"),construction=read("worker/modules/construction.js"),migration=read("database/migrations/0004_workforce_foundation.sql"),coreMigration=read("database/migrations/0014_workforce_core_flow.sql"),constructionMigration=read("database/migrations/0015_construction_daily_report.sql");
if(matrix.version!=="0.27.1"||matrix.modules.today!=="READY"||matrix.modules.issue!=="READY"||matrix.modules.workforce!=="READY"||matrix.modules.construction!=="READY"||matrix.modules.safety!=="READY")throw new Error("Version Matrix mismatch");
if(baseline.version!=="0.27.1"||baseline.baselineVersion!=="0.24.4"||baseline.baselineSha256!=="455A993C035AD55722DEC5D71324158894159E11BEB3860BD3F98BDBD5560BA8"||!["PENDING","DEPLOYED","FIELD_USABLE"].includes(baseline.integrationStatus)||baseline.productionChanged!==false)throw new Error("BASELINE contract mismatch");
for(const token of ["workforce_profiles","workforce_site_enrollments","workforce_devices","workforce_qr_sessions","workforce_attendance","workforce_attendance_events","UNIQUE(user_id,site_id,work_date)"])if(!migration.includes(token))throw new Error(`Schema contract missing ${token}`);
for(const token of ["workforce_teams","daily_output_reports","daily_output_report_workers","daily_output_report_revisions","WORKFORCE_APPROVAL"])if(!coreMigration.includes(token))throw new Error(`Workforce core schema contract missing ${token}`);
for(const token of ["construction_daily_reports","construction_daily_report_items","construction_daily_report_materials","construction_daily_report_equipment","construction_daily_report_media","construction_daily_report_revisions","CONSTRUCTION_DAILY_REPORT","CONSTRUCTION_OUTPUT_STATUS"])if(!constructionMigration.includes(token))throw new Error(`Construction schema contract missing ${token}`);
for(const token of ["WORKFORCE_QR_SECRET_MISSING","QR_TAMPERED","QR_WRONG_SITE","QR_EXPIRED","IDEMPOTENCY_PAYLOAD_MISMATCH","Asia/Seoul","workforce_attendance_events"])if(!worker.includes(token))throw new Error(`Workforce contract missing ${token}`);
for(const token of ["CONSTRUCTION_OUTPUT_STALE","CONSTRUCTION_FINALIZED_LOCKED","CONSTRUCTION_PHOTO_UPLOAD_FAILED","source_output_revision","workforce_snapshot_json","output_snapshot_json"])if(!construction.includes(token))throw new Error(`Construction contract missing ${token}`);
if(/production/i.test(read("wrangler.integration.toml")))throw new Error("Production reference is forbidden");
for(const [name,status] of Object.entries(matrix.modules))if(!["today","issue","workforce","construction","safety","quality","admin"].includes(name)&&status!=="PLANNED")throw new Error(`${name} must remain PLANNED`);
for(const token of ["safety_cases","safety_risk_assessments","safety_corrective_actions","periodic_task_definitions","periodic_task_instances","QUALITY_PERIODIC_TASK"])if(!read("database/migrations/0016_safety_core_and_periodic.sql").includes(token))throw new Error(`Safety contract missing ${token}`);
for(const token of ["completion_note","evidence_exception_reason","RECHECK","scheduled_period","uq_periodic_instance_period"])if(!read("database/migrations/0017_safety_final_stabilization.sql").includes(token))throw new Error(`Safety final stabilization contract missing ${token}`);
for(const token of ["최소 범위 수정","관련된 파일만","Production"])if(!read("DEVELOPMENT_RULES.md").includes(token))throw new Error(`Development rule missing ${token}`);
if(!read("AGENTS.md").includes("VERSION.md")||!read("AGENTS.md").includes("DEVELOPMENT_RULES.md"))throw new Error("AGENTS startup contract missing");
for(const token of ["construction_daily_report_uploads","construction_daily_report_imported_items","construction_output_sheet_documents","construction_output_sheet_media"])if(!read("database/migrations/0018_construction_excel_and_output_archive.sql").includes(token))throw new Error(`Construction Excel schema contract missing ${token}`);
for(const token of ["construction_departments","construction_department_rules","issue_department_recommendations"])if(!read("database/migrations/0026_construction_department_engine.sql").includes(token))throw new Error(`Construction Engine schema missing ${token}`);
const phaseAMigration="database/migrations/0036_site_location_master_import.sql",phaseATemplate="apps/web/templates/GUI_Arc_현장위치목록_기본서식_v2.xlsx";
for(const file of [phaseAMigration,phaseATemplate])if(!fs.existsSync(file))throw new Error(`Phase A artifact missing ${file}`);
for(const token of ["canonical_key TEXT","source TEXT NOT NULL DEFAULT 'LEGACY'","SITE_LOCATION_IMPORT_CANONICAL_KEY_REQUIRED","CREATE TABLE site_location_aliases","UNIQUE(site_id,normalized_alias)","CREATE TABLE site_location_imports","artifact_object_key","base_master_revision","post_master_fingerprint","CREATE TABLE site_location_import_idempotency","FOREIGN KEY(site_id,location_id) REFERENCES site_locations(site_id,id)"])if(!read(phaseAMigration).includes(token))throw new Error(`Phase A schema contract missing ${token}`);
const phaseAWorkbook=await parseSiteLocationWorkbook(fs.readFileSync(phaseATemplate));
if(JSON.stringify(phaseAWorkbook.workbookMeta.sheetNames)!==JSON.stringify(TEMPLATE_SHEETS)||TEMPLATE_SHEETS.length!==3)throw new Error("Phase A template exact sheet contract mismatch");
if(JSON.stringify(IMPORT_REQUIRED_SHEETS)!==JSON.stringify([SIMPLE_LOCATION_SHEET]))throw new Error("Phase A runtime import sheet contract mismatch");
if(JSON.stringify(SIMPLE_LOCATION_HEADERS)!==JSON.stringify(["동/구역","층","호/공간","세부위치"]))throw new Error("Phase A exact header contract mismatch");
const phaseAOpenXml=Object.values(unzipSync(fs.readFileSync(phaseATemplate))).map(bytes=>Buffer.from(bytes).toString("utf8")).join("\n");
for(const header of SIMPLE_LOCATION_HEADERS)if(!phaseAOpenXml.includes(header))throw new Error(`Phase A template header missing ${header}`);
for(const forbidden of ["location_id","parent_location_id","canonical_key","location_type","sort_order","alias_id"])if(phaseAOpenXml.includes(forbidden))throw new Error(`Phase A template leaks internal field ${forbidden}`);
const adminApp=read("apps/web/assets/integrated-admin.js"),workerIndex=read("worker/index.js"),locationImportHandler=read("worker/modules/site-location-import.js");
for(const token of ['/admin/site-locations','site-location-import.js','renderSiteLocationImportPage'])if(!adminApp.includes(token))throw new Error(`Phase A admin route wiring missing ${token}`);
for(const token of ['handleSiteLocationImportRequest','./modules/site-location-import.js'])if(!workerIndex.includes(token))throw new Error(`Phase A Worker dispatch wiring missing ${token}`);
for(const token of ['/api/v1/admin/site-locations','upload-sessions','/apply'])if(!locationImportHandler.includes(token))throw new Error(`Phase A Worker route contract missing ${token}`);
const PHASE_A_SOURCE_FILES=[
  "worker/modules/site-location-import.js",
  ...fs.readdirSync("worker/modules/site-location-import").filter(name=>name.endsWith(".js")).map(name=>`worker/modules/site-location-import/${name}`),
  "apps/web/assets/site-location-import.js"
];
const PHASE_A_FORBIDDEN_IMPLEMENTATION=[
  ["Issue location lookup-only",/\b(?:ISSUE_LOCATION_LOOKUP_ONLY|lookupOnlyLocation|enforceLocationLookupOnly)\b/],
  ["Location Resolver",/\b(?:SiteLocationResolver|resolveSiteLocation|resolveLocationAlias|resolveLocation)\s*\(/],
  ["PDF, OCR, or AI import",/(?:\b(?:PDFDocument|pdfParse|pdfjsLib|Tesseract|createLocationDraftFromPdf|AI_LOCATION_DRAFT)\b|from\s+["'][^"']*(?:pdf|tesseract|openai)[^"']*["'])/i]
];
for(const file of PHASE_A_SOURCE_FILES){
  if(!fs.existsSync(file))throw new Error(`Phase A source missing ${file}`);
  if(fs.statSync(file).size>256*1024)throw new Error(`Phase A source validation bound exceeded ${file}`);
  const source=read(file);
  for(const [label,pattern] of PHASE_A_FORBIDDEN_IMPLEMENTATION)if(pattern.test(source))throw new Error(`Phase A scope violation (${label}): ${file}`);
}
console.log("Integrated v0.27.1 Quality validation passed.");

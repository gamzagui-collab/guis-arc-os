import test from"node:test";
import assert from"node:assert/strict";
import fs from"node:fs";
import {DatabaseSync} from"node:sqlite";

const read=file=>fs.readFileSync(file,"utf8"),api=read("worker/modules/construction.js"),ui=read("apps/web/assets/construction.js"),today=read("worker/modules/today/providers/construction-provider.js");
function database(){const db=new DatabaseSync(":memory:");for(const name of fs.readdirSync("database/migrations").sort())db.exec(read(`database/migrations/${name}`));return db}

test("v0.9 Construction schema owns daily reports and revision snapshots",()=>{
 const db=database();
 for(const table of["construction_daily_reports","construction_daily_report_items","construction_daily_report_materials","construction_daily_report_equipment","construction_daily_report_media","construction_daily_report_revisions","construction_daily_report_revision_requests"])assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table));
 for(const key of["CONSTRUCTION_DAILY_REPORT","CONSTRUCTION_OUTPUT_STATUS"])assert.ok(db.prepare("SELECT 1 FROM board_definitions WHERE board_key=? AND is_active=1").get(key));
 assert.throws(()=>db.prepare("INSERT INTO construction_daily_reports(id,site_id,work_date_kst,created_by_user_id) VALUES('x','missing','2026-07-27','missing')").run());
 db.close();
});

test("daily report imports canonical output references instead of manual company trade people",()=>{
 for(const token of["source_output_report_id","source_output_revision","daily_output_reports","daily_output_report_workers","workforce_attendance","importStatements","CONSTRUCTION_OUTPUT_STALE"])assert.ok(api.includes(token));
 assert.doesNotMatch(ui,/name="tradeId"|name="workforceCount"|data-item-company|data-item-trade/);
 for(const token of["출력일보 원문","공사일보 정리 문구","최신 출력일보 반영","변경되었습니다"])assert.ok(ui.includes(token));
});

test("Construction state machine preserves submit revision request resubmit finalize and reopen",()=>{
 for(const token of["DRAFT","SUBMITTED","REVISION_REQUESTED","RESUBMITTED","FINALIZED","CANCELLED","construction_daily_report_revisions","CONSTRUCTION_FINALIZED_LOCKED"])assert.ok(api.includes(token));
 for(const token of["제출","수정 요청","보완 재제출","확정","재개방"])assert.ok(ui.includes(token));
});

test("Construction supports status, materials equipment notes media and mobile contracts",()=>{
 for(const token of["outputStatus","missing_output_reason","difference_reason","construction_daily_report_materials","construction_daily_report_equipment","construction_daily_report_media","CONSTRUCTION_PHOTO_UPLOAD_FAILED"])assert.ok(api.includes(token));
 for(const token of["사진 촬영","파일 선택","자재 추가","장비 추가","공사 특이사항","Materials 정식 모듈","Equipment 정식 모듈"])assert.ok(ui.includes(token));
 assert.match(read("apps/web/assets/construction.css"),/@media\(max-width:760px\)/);
});

test("Today Construction provider is permission scoped and uses confirmed Excel imports",()=>{
 for(const token of["CONSTRUCTION_DAILY_REPORT","CONSTRUCTION_OUTPUT_STATUS","construction_daily_report_uploads","construction_daily_report_imported_items","parse_status","implementationStatus:\"IMPLEMENTED\""])assert.ok(today.includes(token));
 assert.doesNotMatch(today,/daily_output_reports|workforce_attendance/);
});

test("Construction API validates board access, context, site and Korean field errors",()=>{
 for(const token of["requireBoardAccess","x-context-version","CONSTRUCTION_SITE_SCOPE_DENIED","CONSTRUCTION_CONTRACTOR_EDIT_DENIED","CONSTRUCTION_TODAY_WORK_REQUIRED","CONSTRUCTION_MISSING_OUTPUT_REASON_REQUIRED","CONSTRUCTION_DIFFERENCE_REASON_REQUIRED"])assert.ok(api.includes(token));
 assert.doesNotMatch(api,/latitude|longitude|geolocation/i);
});

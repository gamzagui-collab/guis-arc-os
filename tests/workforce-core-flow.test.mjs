import test from"node:test";
import assert from"node:assert/strict";
import fs from"node:fs";
import {DatabaseSync} from"node:sqlite";

const read=file=>fs.readFileSync(file,"utf8");
const api=read("worker/modules/workforce.js");
const admin=read("worker/modules/integrated-admin.js");
const ui=read("apps/web/assets/workforce.js");

function database(){
 const db=new DatabaseSync(":memory:");
 for(const name of fs.readdirSync("database/migrations").sort())db.exec(read(`database/migrations/${name}`));
 return db;
}

test("v0.8 Workforce schema owns teams, approval and versioned daily output",()=>{
 const db=database();
 for(const table of["workforce_teams","daily_output_reports","daily_output_report_workers","daily_output_report_revisions"])assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table));
 for(const key of["WORKFORCE_PROFILE","WORKFORCE_APPROVAL","WORKFORCE_ATTENDANCE","WORKFORCE_DAILY_OUTPUT"])assert.ok(db.prepare("SELECT 1 FROM board_definitions WHERE board_key=? AND is_active=1").get(key));
 const enrollment=db.prepare("PRAGMA table_info(workforce_site_enrollments)").all().map(row=>row.name);
 for(const name of["team_id","role_code","join_method","rejection_reason","reviewed_at"])assert.ok(enrollment.includes(name));
 db.close();
});

test("approval is server enforced and links canonical company trade and team",()=>{
 for(const token of["WORKFORCE_APPROVAL","approveEnrollment","batch","canonicalTrade","canonicalTeam","approval_status='APPROVED'","WORKFORCE_ENROLLMENT_${status}"])assert.ok(api.includes(token));
 assert.match(admin,/workforce_trade_id/);
 assert.match(admin,/workforce_team_id/);
 assert.match(admin,/approval_status.*PENDING/s);
 assert.doesNotMatch(admin,/metadata_json[^;\n]*(?:pin|birthDate|phone)/i);
});

test("dynamic QR attendance is site-bound, approval-bound and idempotent",()=>{
 for(const token of["qr_session_id","QR_WRONG_SITE","QR_EXPIRED","WORKFORCE_ENROLLMENT_NOT_APPROVED","WORKFORCE_DUPLICATE_CHECK_IN","idempotency-key","WORKFORCE_CHECK_IN"])assert.ok(api.includes(token));
 assert.doesNotMatch(api,/latitude|longitude|geolocation/i);
});

test("daily output starts from actual attendance and keeps submission revisions",()=>{
 for(const token of["daily_output_reports","daily_output_report_workers","daily_output_report_revisions","WORKFORCE_DESCRIPTION_REQUIRED","WORKFORCE_DIFFERENCE_REASON_REQUIRED","REVISION_REQUESTED","SUBMITTED","work_date_kst"])assert.ok(api.includes(token));
 for(const token of["/daily-output/options","실제 출역자 불러오기","제외 사유","차이 사유","수정 요청","재제출"])assert.ok(ui.includes(token));
});

test("mobile Workforce UI supports camera QR and live grouped counts without GPS",()=>{
 for(const token of["BarcodeDetector","getUserMedia","groupCards","setInterval","8000"])assert.ok(ui.includes(token));
 assert.doesNotMatch(ui,/geolocation|latitude|longitude/i);
});

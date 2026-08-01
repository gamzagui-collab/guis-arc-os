import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {DatabaseSync} from "node:sqlite";
const read=p=>fs.readFileSync(p,"utf8");
const migration=read("database/migrations/0020_document_work_and_inspection_boundaries.sql");
const worker=read("worker/modules/construction-inspections.js");
const quality=read("worker/modules/quality.js");
const inspectionUi=read("apps/web/assets/construction-inspections.js");
const qualityUi=read("apps/web/assets/quality.js");

test("boundary migration preserves periodic data and owns construction inspection and quality legal masters",()=>{
 const db=new DatabaseSync(":memory:");for(const file of fs.readdirSync("database/migrations").filter(v=>v.endsWith(".sql")).sort())db.exec(read(`database/migrations/${file}`));
 const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(v=>v.name);
 for(const name of["construction_inspections","construction_inspection_items","construction_inspection_media","construction_inspection_reviews","quality_legal_obligations","quality_site_obligations","quality_work_basis_records","legacy_work_classification_reports"])assert.ok(tables.includes(name),name);
 assert.equal(db.prepare("SELECT display_name FROM board_definitions WHERE board_key='CONSTRUCTION_INSPECTION'").get().display_name,"공정별 시공 검측");
 assert.equal(db.prepare("SELECT COUNT(*) count FROM quality_legal_obligations").get().count,0);
});
test("construction inspection has the canonical request review revision resubmit approval flow",()=>{for(const token of["DRAFT","REQUESTED","UNDER_REVIEW","REVISION_REQUESTED","RESUBMITTED","APPROVED","CANCELLED","CONSTRUCTION_INSPECTION_APPROVAL_BLOCKED","CONSTRUCTION_INSPECTION_STATE_INVALID"])assert.ok(worker.includes(token));for(const token of["공정별 시공 검측","품질시험·검사 기록이 아닙니다","검측 요청","보완 요청","재검측 요청","검측 완료"])assert.ok(inspectionUi.includes(token))});
test("quality is CSI preparation and never claims automatic national submission",()=>{for(const token of["SCHEDULED","COLLECTING","TEST_COMPLETED","REVIEW_PENDING","REVISION_REQUIRED","READY_FOR_CSI","CSI_RECORDED","QUALITY_CSI_DATE_REQUIRED","QUALITY_CSI_REFERENCE_REQUIRED","QUALITY_CSI_PACKAGE_INCOMPLETE"])assert.ok(quality.includes(token));for(const token of["CSI 입력 전","자동 로그인·업로드·제출하지 않습니다","CSI 입력 준비 완료 승인","CSI 입력 완료 사실 기록","GUI’s Arc가 자동 제출한 기록이 아닙니다"])assert.ok(qualityUi.includes(token));for(const forbidden of["CSI_PASSWORD","CSI_AUTO_SUBMIT","CSI_LOGIN_SECRET"])assert.ok(!quality.includes(forbidden));assert.ok(!qualityUi.includes("공정 검측</h1>"))});
test("quality CSI migration owns test evidence nonconformance calibration and submission records",()=>{const m=read("database/migrations/0022_quality_csi_preparation.sql");for(const name of["quality_test_inspections","quality_test_results","quality_test_reports","quality_test_report_links","quality_test_media","quality_nonconformances","quality_corrective_actions","quality_test_equipment","quality_calibration_records","quality_csi_submission_records"])assert.ok(m.includes(`CREATE TABLE ${name}`),name);for(const board of["QUALITY_CSI_PREPARATION","QUALITY_TEST_INSPECTION","QUALITY_NONCONFORMANCE","QUALITY_CALIBRATION"])assert.ok(m.includes(board))});
test("quality package links canonical daily reports and reuses uploaded reports",()=>{const references=read("database/migrations/0023_quality_package_references.sql");for(const token of["material_reference","construction_daily_report_id"])assert.ok(references.includes(token));for(const token of["QUALITY_TEST_REPORT_LINKED","link-report","INSERT OR IGNORE INTO quality_test_report_links"])assert.ok(quality.includes(token))});
test("existing data moves only through a classification report after administrator confirmation",()=>{for(const token of["CONSTRUCTION_INSPECTION","QUALITY_LEGAL_WORK","CONFIRMATION_REQUIRED","DISPOSAL_CANDIDATE","confirmed_by_user_id"])assert.ok(migration.includes(token))});

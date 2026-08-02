import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {departmentLabel,issueHistoryReasonLabel} from "../apps/web/assets/i18n/ko.js";

const read=file=>fs.readFileSync(file,"utf8");

test("v0.24.15 부서 표시는 canonical enum을 바꾸지 않고 한국어로 변환한다",()=>{
 const expected={CONSTRUCTION:"공사",SAFETY:"안전",QUALITY:"품질",ADMINISTRATION:"관리",UNCLASSIFIED:"미분류"};
 for(const [code,label] of Object.entries(expected))assert.equal(departmentLabel(code),label);
 assert.equal(departmentLabel(null),"미분류");
 assert.equal(departmentLabel("FUTURE_DEPARTMENT"),"FUTURE_DEPARTMENT");
 const worker=read("worker/modules/construction-engine.js");
 for(const code of Object.keys(expected))assert.match(worker,new RegExp(`\\b${code}\\b`));
});

test("v0.24.15 기존 상태 이력 원문과 reason code를 한국어로 표시한다",()=>{
 const unassigned="담당자 미배정 상태로 이슈가 등록되었습니다.";
 assert.equal(issueHistoryReasonLabel("Issue created without assignment"),unassigned);
 assert.equal(issueHistoryReasonLabel("ISSUE_CREATED_WITHOUT_ASSIGNMENT"),unassigned);
 assert.equal(issueHistoryReasonLabel("Issue created and assigned"),"담당자가 배정된 상태로 이슈가 등록되었습니다.");
 assert.equal(issueHistoryReasonLabel("ISSUE_CREATED_AND_ASSIGNED"),"담당자가 배정된 상태로 이슈가 등록되었습니다.");
 assert.equal(issueHistoryReasonLabel(null),"상세 사유 없음");
 assert.equal(issueHistoryReasonLabel(""),"상세 사유 없음");
 assert.equal(issueHistoryReasonLabel("기존 사용자 입력"),"기존 사용자 입력");
 assert.equal(issueHistoryReasonLabel("Error: secret\n at handler (worker.js:1)"),"상세 사유를 표시할 수 없습니다.");
});

test("v0.24.15 Issue 화면은 공통 표시 함수와 공식 Board Access 판정을 사용한다",()=>{
 const ui=read("apps/web/assets/issues.js");
 assert.match(ui,/departmentLabel\(issue\.category\)/);
 assert.doesNotMatch(ui,/CATEGORY\[issue\.category\]\|\|issue\.category/);
 assert.match(ui,/issueHistoryReasonLabel\(history\.note\)/);
 assert.match(ui,/canAssign=optionData\.canBulkManage/);
 assert.match(ui,/canManageDepartment=siteManager&&optionData\.canBulkManage/);
 assert.doesNotMatch(ui,/canAssign=manage\|\|permissions\.has\("issue\.assign"\)/);
 assert.doesNotMatch(ui,/canManageDepartment=siteManager&&\(permissions\.has\("issue\.assign"\)/);
});

test("v0.24.15 API와 DB 원본 계약은 변경하지 않는다",()=>{
 const worker=read("worker/modules/issues.js");
 assert.match(worker,/Issue created without assignment/);
 assert.match(worker,/history:history\.results/);
 assert.match(worker,/canBulkManage:auth\.scope===ISSUE_SCOPE\.SITE&&\["EDIT","MANAGE"\]\.includes\(access\)/);
 assert.equal(fs.readdirSync("database/migrations").filter(name=>/^0032_/.test(name)).length,0);
});

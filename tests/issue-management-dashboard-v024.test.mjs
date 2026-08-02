import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const worker=await readFile(new URL("../worker/modules/issues.js",import.meta.url),"utf8");
const ui=await readFile(new URL("../apps/web/assets/issues.js",import.meta.url),"utf8");
const css=await readFile(new URL("../apps/web/assets/issues.css",import.meta.url),"utf8");

test("v0.24.0 PC dashboard keeps mobile photo viewer and adds dense selectable rows",()=>{
 assert.match(ui,/matchMedia\("\(max-width:760px\)"\).*listBaseV23/);
 assert.match(ui,/현재 페이지 전체 선택/);
 assert.match(ui,/event\.shiftKey/);
 assert.match(ui,/issue-selected-count/);
 assert.match(css,/pc-issue-row/);
});

test("v0.24.0 dashboard filters canonical status department trade and unassigned fields",()=>{
 for(const value of ["status","department","tradeId","assignment"])assert.match(ui,new RegExp(`name=\\"${value}\\"`));
 assert.match(worker,/confirmed_department_code IS NULL/);
 assert.match(worker,/i\.trade_id=\?3/);
});

test("v0.24.0 bulk API is site-only revision checked idempotent audited and atomic",()=>{
 assert.match(worker,/ISSUE_BULK_SCOPE_DENIED/);
 assert.match(worker,/ISSUE_STALE_REVISION/);
 assert.match(worker,/ISSUE_BULK_UPDATE/);
 assert.match(worker,/ISSUE_BULK_UPDATED/);
 assert.match(worker,/await env\.DB\.batch\(statements\)/);
 assert.match(worker,/items\.length>50/);
});

test("v0.24.0 bulk API validates contractor trades and company members before mutation",()=>{
 assert.match(worker,/company\?\.trades\.find/);
 assert.match(worker,/member\.company_id!==companyId/);
 assert.match(worker,/ISSUE_BULK_TRADE_CONFLICT/);
 assert.match(worker,/ISSUE_BULK_ASSIGNEE_CONFLICT/);
});

test("v0.24.2 bulk candidates follow same mixed and unassigned company rules",()=>{
 assert.match(ui,/contractorCompanyId/);
 assert.match(ui,/originalCompanies/);
 assert.match(ui,/intersectTrades/);
 assert.match(ui,/kind:\"UNASSIGNED\"/);
 assert.match(ui,/선택한 이슈의 업체가 서로 달라 공통으로 지정할 수 있는 공종이 없습니다/);
 assert.match(ui,/업체 미배정 이슈가 포함되어 있습니다/);
 assert.match(ui,/활성 계약 공종을 선택할 수 있습니다/);
});

test("v0.24.2 company changes refresh canonical trades and assignees safely",()=>{
 assert.match(ui,/company\.onchange=refreshCandidates/);
 assert.match(ui,/candidateRequest/);
 assert.match(ui,/request!==candidateRequest/);
 assert.match(ui,/value\.displayName,value\.id/);
 assert.match(ui,/value\.display_name,value\.id/);
 assert.match(ui,/계약 공종을 불러오는 중/);
 assert.match(ui,/담당자를 불러오는 중/);
 assert.match(ui,/공종 정보를 불러오지 못했습니다/);
 assert.match(ui,/tradeRetry\.onclick=refreshCandidates/);
 assert.match(worker,/ct\.status='ACTIVE'/);
 assert.match(worker,/tm\.status='ACTIVE'/);
 assert.match(worker,/tm\.is_selectable=1/);
});

test("v0.24.2 cleanup checkbox and dialog controls keep accessible aligned layout",()=>{
 assert.match(ui,/class=\"bulk-cleanup-option\"/);
 assert.match(ui,/class=\"bulk-clear-option\"/);
 assert.match(ui,/aria-describedby=\"issue-bulk-trade-status\"/);
 assert.match(ui,/aria-live=\"polite\"/);
 assert.match(css,/\.bulk-cleanup-option.*display:grid/);
 assert.match(css,/grid-template-columns:20px minmax\(0,1fr\)/);
 assert.match(css,/\.bulk-field select\{display:block;width:100%;min-width:0/);
 assert.match(css,/@media\(max-width:800px\) and \(min-width:761px\)/);
});

test("v0.24.10 construction manager bulk capability matches the server board contract and gives actionable feedback",()=>{
 assert.match(worker,/canBulkManage:auth\.scope===ISSUE_SCOPE\.SITE&&\["EDIT","MANAGE"\]\.includes\(access\),assignmentTypes/);
 assert.doesNotMatch(worker,/canBulkManage:[^,]+permissions\.includes\("issue\.assign"\)/);
 assert.match(worker,/authorize\(request,env,"issue\.assign",\{write:true\}\)/);
 assert.match(ui,/open\.disabled=!options\.canBulkManage/);
 assert.doesNotMatch(ui,/open\.disabled=!options\.canBulkManage\|\|!selected\.size/);
 assert.match(ui,/open\.onclick=\(\)=>\{if\(!selected\.size\)/);
 assert.match(ui,/일괄 변경할 항목을 먼저 선택해 주세요\./);
 assert.match(ui,/company\.value==="__DIRECT__".*options\.directAssignment/);
 assert.match(ui,/checks\.forEach\(\(check,index\)=>check\.onchange=/);
 assert.match(ui,/form\.onsubmit=async event=>/);
});

import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {assignmentPayload,assignmentTypeForCompany} from "../apps/web/assets/issue-assignment.js";
import {inferIssueAssignmentType,issueStatusForAssignment} from "../worker/core/issue-assignment-policy.js";

const worker=await readFile(new URL("../worker/modules/issues.js",import.meta.url),"utf8");
const ui=await readFile(new URL("../apps/web/assets/issues.js",import.meta.url),"utf8");

test("v0.24.13 single and bulk UI infer one explicit assignment contract",()=>{
 assert.equal(assignmentTypeForCompany("contractor-a"),"CONTRACTOR");
 assert.equal(assignmentTypeForCompany("__DIRECT__"),"DIRECT");
 assert.equal(assignmentTypeForCompany("__UNASSIGNED__"),"UNASSIGNED");
 assert.deepEqual(assignmentPayload({companyId:"contractor-a",tradeId:"trade-a",assigneeUserId:"user-a",revision:2}),{revision:2,assignmentType:"CONTRACTOR",contractorCompanyId:"contractor-a",tradeId:"trade-a",assigneeUserId:"user-a"});
 assert.deepEqual(assignmentPayload({companyId:"__UNASSIGNED__",tradeId:"trade-a",assigneeUserId:"user-a",revision:3}),{revision:3,assignmentType:"UNASSIGNED",contractorCompanyId:null,tradeId:"trade-a",assigneeUserId:null});
 assert.match(ui,/assignmentPayload\(/);
 assert.match(ui,/selectedType=assignmentTypeForCompany/);
 assert.match(ui,/issue\.assignmentType==="DIRECT"/);
 assert.match(ui,/issue\.assignmentType==="UNASSIGNED"/);
 assert.match(ui,/trade\.required=false;assignee\.required=false/);
});

test("v0.24.13 Worker infers legacy payloads and aligns status with assignment type",()=>{
 assert.equal(inferIssueAssignmentType({contractorCompanyId:"contractor-a"},"UNASSIGNED"),"CONTRACTOR");
 assert.equal(inferIssueAssignmentType({contractorCompanyId:"__DIRECT__"},"UNASSIGNED"),"DIRECT");
 assert.equal(inferIssueAssignmentType({contractorCompanyId:null},"CONTRACTOR"),"UNASSIGNED");
 assert.equal(inferIssueAssignmentType({},"DIRECT"),"DIRECT");
 assert.equal(issueStatusForAssignment("UNASSIGNED"),"OPEN");
 assert.equal(issueStatusForAssignment("DIRECT"),"ASSIGNED");
 assert.equal(issueStatusForAssignment("CONTRACTOR"),"ASSIGNED");
});

test("v0.24.13 Worker rejects invalid combinations before atomic batch writes",()=>{
 for(const code of ["ISSUE_ASSIGNMENT_TYPE_INVALID","ISSUE_COMPANY_SCOPE_DENIED","ISSUE_CONTRACT_SCOPE_DENIED","ISSUE_ASSIGNEE_SCOPE_DENIED","ISSUE_DIRECT_TRADE_INVALID","ISSUE_DIRECT_ASSIGNEE_INVALID","ISSUE_ASSIGNMENT_STATE_INVALID","ISSUE_STALE_REVISION"])assert.ok(worker.includes(code),code);
 assert.match(worker,/if\(has\("contractorCompanyId"\)\|\|body\.clearInvalidAssignee===true\)assigneeId=null/);
 assert.match(worker,/await env\.DB\.batch\(statements\)/);
 assert.match(worker,/status=\?9,revision=revision\+1/);
 assert.match(worker,/issue_status_history/);
});

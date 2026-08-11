import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as issuesModule from "../worker/modules/issues.js";

const read=file=>fs.readFileSync(file,"utf8");
const worker=read("worker/modules/issues.js");
const ui=read("apps/web/assets/issues.js");
const css=read("apps/web/assets/issues.css");

test("creator can delete only within ten server minutes",()=>{
 assert.equal(typeof issuesModule.issueDeleteDecision,"function");
 const decide=issuesModule.issueDeleteDecision;
 assert.deepEqual(decide({roleCodes:[],userId:"creator",createdByUserId:"creator",withinWindow:true}),{allowed:true,reason:"USER_WITHIN_10_MINUTES",role:null});
 assert.equal(decide({roleCodes:[],userId:"creator",createdByUserId:"creator",withinWindow:false}).allowed,false);
 assert.equal(decide({roleCodes:[],userId:"other",createdByUserId:"creator",withinWindow:true}).allowed,false);
});

test("only integrated and platform owners bypass the delete window",()=>{
 const decide=issuesModule.issueDeleteDecision;
 for(const role of ["INTEGRATED_OWNER","PLATFORM_OWNER"]){const result=decide({roleCodes:[role],userId:"other",createdByUserId:"creator",withinWindow:false});assert.equal(result.allowed,true);assert.equal(result.reason,"MASTER_DELETE");assert.equal(result.role,role)}
 assert.equal(decide({roleCodes:["SITE_MANAGER"],userId:"other",createdByUserId:"creator",withinWindow:false}).allowed,false);
});

test("DELETE API uses server time, atomic relational cleanup, minimal audit, and R2 keys",()=>{
 assert.match(worker,/method==="DELETE"&&!suffix/);
 assert.match(worker,/datetime\(created_at\)>=datetime\('now','-10 minutes'\)/);
 assert.match(worker,/UPDATE safety_cases SET primary_issue_id=NULL/);
 assert.match(worker,/UPDATE periodic_task_findings SET issue_id=NULL/);
 assert.match(worker,/DELETE FROM issue_idempotency/);
 assert.match(worker,/DELETE FROM issue_items WHERE id=\?1 AND site_id=\?2/);
 assert.match(worker,/ISSUE_HARD_DELETED/);
 assert.match(worker,/env\.DB\.batch\(statements\)/);
 assert.match(worker,/env\.FILES\.delete/);
 assert.match(worker,/ISSUE_HARD_DELETED","ALLOWED",requestId\(request\),\{issueId:id,siteId:auth\.siteId,deletedByUserId:auth\.userId,role:decision\.role,reason:decision\.reason\}/);
 assert.match(worker,/failedObjectKeys=cleanup\.flatMap/);
 assert.match(worker,/ISSUE_MEDIA_CLEANUP_PENDING","DENIED"/);
 assert.match(worker,/\{issueId:id,siteId:auth\.siteId,failedObjectKeys,failedCount:cleanupPending,deletedByUserId:auth\.userId\}/);
});

test("detail and expanded Photo Work require confirmation and remove deleted issues",()=>{
 assert.match(ui,/이 이슈를 삭제할까요\?/);
 assert.match(ui,/삭제하면 이 이슈와 관련 사진을 다시 복구할 수 없습니다\./);
 assert.match(ui,/class="danger issue-delete"/);
 assert.match(ui,/issue\.canDelete/);
 assert.match(ui,/method:"DELETE"/);
 assert.match(ui,/currentIssues=currentIssues\.filter\(value=>value\.id!==deletedId\)/);
 assert.match(ui,/dialog\.close\(\)/);
 assert.match(css,/\.danger/);
 assert.match(css,/\.issue-delete-dialog/);
});

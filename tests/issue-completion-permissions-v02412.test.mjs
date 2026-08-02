import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {issueCompletionDecision} from "../apps/web/assets/issue-completion-policy.js";
import {issueActionVisibility} from "../apps/web/assets/issue-action-policy.js";

const decision=(overrides={})=>issueCompletionDecision({action:"confirm-completion",permissions:["issue.confirm_completion"],userId:"creator",assigneeUserId:"assignee",createdByUserId:"creator",status:"COMPLETION_REQUESTED",...overrides});
const visibility=({permissions,user="creator",creator="creator",assignee="assignee",status="COMPLETION_REQUESTED",access="EDIT"})=>issueActionVisibility({session:{context:{user:{id:user},selectedSiteId:"site-a",permissions,boardAccess:{ISSUE:{accessLevel:access}}}},issue:{siteId:"site-a",status,createdByUserId:creator,assigneeUserId:assignee},hasActionPhoto:true});

test("manager can confirm or rework regardless of creator",()=>{
 assert.deepEqual(decision({permissions:["issue.manage_all"],userId:"manager",createdByUserId:"other"}),{allowed:true,reason:null});
 const ui=visibility({permissions:["issue.manage_all"],user:"manager",creator:"other"});
 assert.equal(ui.showCompletionConfirm,true);
 assert.equal(ui.showRework,true);
});

test("creator capabilities allow confirm and rework without manage_all",()=>{
 assert.deepEqual(decision(),{allowed:true,reason:null});
 const ui=visibility({permissions:["issue.confirm_completion","issue.rework"]});
 assert.equal(ui.showCompletionConfirm,true);
 assert.equal(ui.showRework,true);
});

test("ordinary user cannot confirm or rework another creator issue",()=>{
 assert.deepEqual(decision({userId:"other"}),{allowed:false,reason:"SCOPE"});
 const ui=visibility({permissions:["issue.confirm_completion","issue.rework"],user:"other"});
 assert.equal(ui.showCompletionConfirm,false);
 assert.equal(ui.showRework,false);
});

test("assignee completion request uses the same capability, scope, and state policy",()=>{
 assert.deepEqual(decision({action:"request-completion",permissions:["issue.request_completion"],userId:"assignee",status:"ACTION_IN_PROGRESS"}),{allowed:true,reason:null});
 assert.equal(decision({action:"request-completion",permissions:["issue.request_completion"],userId:"other",status:"ACTION_IN_PROGRESS"}).reason,"SCOPE");
 assert.equal(decision({action:"request-completion",permissions:[],userId:"assignee",status:"ACTION_IN_PROGRESS"}).reason,"PERMISSION");
 assert.equal(decision({action:"request-completion",permissions:["issue.request_completion"],userId:"assignee"}).reason,"STATE");
});

test("UI review controls also require active site context and Issue EDIT",()=>{
 assert.equal(visibility({permissions:["issue.manage_all"],user:"manager",creator:"other",access:"VIEW"}).showCompletionConfirm,false);
});

test("Worker and UI import the same completion decision without inline creator checks",()=>{
 const worker=readFileSync(new URL("../worker/modules/issues.js",import.meta.url),"utf8"),ui=readFileSync(new URL("../apps/web/assets/issues.js",import.meta.url),"utf8");
 assert.match(worker,/import \{issueCompletionDecision\}/);
 assert.match(worker,/issueCompletionDecision\(\{action:completionAction/);
 assert.doesNotMatch(worker,/type==="confirm"\|\|type==="rework"\).*created_by_user_id!==auth\.userId/);
 assert.doesNotMatch(ui,/issue\.createdByUserId===userId/);
});

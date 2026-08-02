import test from "node:test";
import assert from "node:assert/strict";
import {issueActionVisibility} from "../apps/web/assets/issue-action-policy.js";

const visibility=({access="EDIT",permissions=["issue.act","issue.request_completion"],user="assignee",assignee="assignee",status="ASSIGNED",site="site-a",selectedSite="site-a",photo=false}={})=>issueActionVisibility({session:{context:{user:{id:user},selectedSiteId:selectedSite,boardAccess:{ISSUE:{accessLevel:access}},permissions}},issue:{siteId:site,assigneeUserId:assignee,status},hasActionPhoto:photo});

test("VIEW-only assignee can read detail but receives no action controls",()=>assert.deepEqual(visibility({access:"VIEW"}),{showActionForm:false,showCompletionRequest:false}));
test("EDIT assignee sees action form only in actionable states",()=>{assert.equal(visibility().showActionForm,true);assert.equal(visibility({status:"COMPLETED"}).showActionForm,false)});
test("same-company non-assignee receives no action controls",()=>assert.deepEqual(visibility({user:"other"}),{showActionForm:false,showCompletionRequest:false}));
test("manage_all follows board, context, state and action-photo contracts",()=>{const permissions=["issue.manage_all"];assert.equal(visibility({permissions,user:"manager",assignee:"other"}).showActionForm,true);assert.equal(visibility({permissions,user:"manager",assignee:"other",access:"VIEW"}).showActionForm,false);assert.equal(visibility({permissions,user:"manager",assignee:"other",selectedSite:"site-b"}).showActionForm,false)});
test("completion request requires EDIT, assignee capability, action state and active photo",()=>{assert.equal(visibility({status:"ACTION_IN_PROGRESS",photo:true}).showCompletionRequest,true);assert.equal(visibility({status:"ACTION_IN_PROGRESS",photo:false}).showCompletionRequest,false);assert.equal(visibility({status:"COMPLETED",photo:true}).showCompletionRequest,false)});

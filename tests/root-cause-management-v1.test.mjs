import test from"node:test";import assert from"node:assert/strict";import fs from"node:fs";import{DatabaseSync}from"node:sqlite";
import{rootCausePermissions,rootCauseMeaningChanged}from"../worker/modules/issues.js";
const read=p=>fs.readFileSync(p,"utf8");
const database=(upto=null)=>{const db=new DatabaseSync(":memory:");for(const name of fs.readdirSync("database/migrations").filter(n=>n.endsWith(".sql")&&(!upto||n<=upto)).sort())db.exec(read(`database/migrations/${name}`));return db};
const access=({role,board="EDIT",permissions=[],status="NOT_STARTED"})=>rootCausePermissions({roleCodes:[role],ctx:{permissions,boardAccess:{ISSUE:{accessLevel:board}}}},status);
test("0032 adds human-managed root cause tables without Engine coupling",()=>{const db=database();assert.equal(db.prepare("SELECT COUNT(*) n FROM root_cause_categories WHERE category_scope='SYSTEM' AND is_active=1").get().n,12);for(const table of["issue_root_cause_analyses","issue_root_causes"])assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table));const sql=read("database/migrations/0032_root_cause_management_v1.sql");assert.doesNotMatch(sql,/engine_registry|engine_history|engine_metrics|recommendation|confidence|score/i);db.close()});
test("0032 upgrades v0.24.15 data and enforces duplicate level category",()=>{const db=database("0031_engine_core_v1_metrics_backfill.sql");db.exec("INSERT INTO companies(id,name) VALUES('c','C');INSERT INTO sites(id,company_id,name) VALUES('s','c','S');INSERT INTO users(id,login_identifier,display_name,credential_hash,credential_salt,credential_iterations) VALUES('u','u','U','h','s',100000);INSERT INTO issue_items(id,site_id,created_by_user_id,created_by_name_snapshot,title,location_text,description,category_code,status) VALUES('i','s','u','U','T','L','D','CONSTRUCTION','COMPLETED')");db.exec(read("database/migrations/0032_root_cause_management_v1.sql"));db.exec("INSERT INTO issue_root_cause_analyses(id,issue_id,site_id,status,created_by_user_id,updated_by_user_id) VALUES('a','i','s','DRAFT','u','u');INSERT INTO issue_root_causes(id,analysis_id,issue_id,site_id,cause_category_id,cause_level,created_by_user_id) VALUES('x','a','i','s','rc-system-procedure','ROOT','u')");assert.throws(()=>db.exec("INSERT INTO issue_root_causes(id,analysis_id,issue_id,site_id,cause_category_id,cause_level,created_by_user_id) VALUES('y','a','i','s','rc-system-procedure','ROOT','u')"),/UNIQUE/);db.exec("INSERT INTO issue_root_causes(id,analysis_id,issue_id,site_id,cause_category_id,cause_level,created_by_user_id) VALUES('z','a','i','s','rc-system-procedure','DIRECT','u')");assert.equal(db.prepare("SELECT status FROM issue_items WHERE id='i'").get().status,"COMPLETED");db.close()});
test("API and UI expose scoped draft confirm aggregate contracts without automatic analysis",()=>{const worker=read("worker/modules/issues.js"),ui=read("apps/web/assets/issue-root-cause.js");for(const token of["root-cause/categories","root-cause/analysis","root-cause/confirm","root-cause/aggregate","ROOT_CAUSE_ADDED","ROOT_CAUSE_REMOVED","ROOT_CAUSE_CONFIRMED","ROOT_CAUSE_NOTE_CHANGED"])assert.ok(worker.includes(token),token);for(const token of["원인 분석","직접 원인","기여 원인","근본 원인","초안 저장","분석 확정","재발 방지 메모"])assert.ok(ui.includes(token),token);for(const forbidden of["ROOT_CAUSE_RECOMMENDED","ROOT_CAUSE_CANDIDATE","ROOT_CAUSE_CONFIDENCE","ROOT_CAUSE_SCORE"])assert.ok(!worker.includes(forbidden),forbidden)});
test("Root Cause role and board access matrix matches the Worker contract",()=>{
 assert.deepEqual(access({role:"SITE_MANAGER",board:"MANAGE",permissions:["issue.manage_all","issue.confirm_completion"]}),{canDraft:true,canConfirm:true,canEdit:true});
 assert.deepEqual(access({role:"SAFETY_MANAGER",permissions:["issue.read"]}),{canDraft:false,canConfirm:false,canEdit:false});
 assert.deepEqual(access({role:"CONSTRUCTION_MANAGER",permissions:["issue.read"]}),{canDraft:false,canConfirm:false,canEdit:false});
 assert.deepEqual(access({role:"CONTRACTOR_MANAGER",permissions:["issue.read"]}),{canDraft:true,canConfirm:false,canEdit:true});
 assert.deepEqual(access({role:"CONTRACTOR_SITE_MANAGER",permissions:["issue.read"]}),{canDraft:true,canConfirm:false,canEdit:true});
 assert.deepEqual(access({role:"CONTRACTOR_ASSIGNEE",permissions:["issue.read"]}),{canDraft:false,canConfirm:false,canEdit:false});
 assert.deepEqual(access({role:"NO_ISSUE_ACCESS",board:null,permissions:[]}),{canDraft:false,canConfirm:false,canEdit:false});
});
test("Root Cause draft and confirmation fail closed when any required grant is missing",()=>{
 assert.deepEqual(access({role:"SITE_MANAGER",board:"VIEW",permissions:["issue.manage_all","issue.confirm_completion"]}),{canDraft:false,canConfirm:false,canEdit:false});
 assert.deepEqual(access({role:"SITE_MANAGER",board:"MANAGE",permissions:["issue.manage_all"]}),{canDraft:true,canConfirm:false,canEdit:true});
 assert.deepEqual(access({role:"CONTRACTOR_MANAGER",board:"VIEW",permissions:["issue.read"]}),{canDraft:false,canConfirm:false,canEdit:false});
 assert.deepEqual(access({role:"CONTRACTOR_MANAGER",permissions:["issue.manage_all","issue.confirm_completion"]}),{canDraft:true,canConfirm:false,canEdit:true});
});
test("confirmed analysis exposes state-aware editing without expanding confirmation rights",()=>{
 assert.deepEqual(access({role:"SITE_MANAGER",board:"MANAGE",permissions:["issue.manage_all","issue.confirm_completion"],status:"CONFIRMED"}),{canDraft:true,canConfirm:true,canEdit:true});
 assert.deepEqual(access({role:"CONTRACTOR_MANAGER",permissions:["issue.read"],status:"DRAFT"}),{canDraft:true,canConfirm:false,canEdit:true});
 assert.deepEqual(access({role:"CONTRACTOR_MANAGER",permissions:["issue.read"],status:"CONFIRMED"}),{canDraft:true,canConfirm:false,canEdit:false});
 for(const role of["SAFETY_MANAGER","CONSTRUCTION_MANAGER","CONTRACTOR_ASSIGNEE","NO_ISSUE_ACCESS"])assert.equal(access({role,status:"CONFIRMED",board:role==="NO_ISSUE_ACCESS"?null:"EDIT",permissions:["issue.read"]}).canEdit,false,role);
});
test("semantic comparison ignores cause order but detects every confirmed meaning change",()=>{
 const stored=[{cause_category_id:"category-a",cause_level:"DIRECT",note:"A"},{cause_category_id:"category-b",cause_level:"ROOT",note:null}],same=[{categoryId:"category-b",level:"ROOT",note:null},{categoryId:"category-a",level:"DIRECT",note:"A"}];
 assert.equal(rootCauseMeaningChanged(stored,"Prevent",same,"Prevent"),false);
 assert.equal(rootCauseMeaningChanged(stored,"Prevent",same,"Changed"),true);
 assert.equal(rootCauseMeaningChanged(stored,"Prevent",same.map(value=>value.categoryId==="category-a"?{...value,note:"B"}:value),"Prevent"),true);
 assert.equal(rootCauseMeaningChanged(stored,"Prevent",same.slice(1),"Prevent"),true);
});
test("confirmed edits reopen atomically and UI follows canEdit instead of canDraft",()=>{
 const worker=read("worker/modules/issues.js"),ui=read("apps/web/assets/issue-root-cause.js");
 assert.match(worker,/status='DRAFT',confirmed_by_user_id=NULL,confirmed_at=NULL/);
 assert.match(worker,/ROOT_CAUSE_REOPENED/);
 assert.match(worker,/beforeStatus:"CONFIRMED",afterStatus:"DRAFT"/);
 assert.match(worker,/rootCauseMeaningChanged/);
 assert.match(ui,/data\.access\.canEdit\?editor/);
 assert.doesNotMatch(ui,/data\.access\.canDraft\?editor/);
});

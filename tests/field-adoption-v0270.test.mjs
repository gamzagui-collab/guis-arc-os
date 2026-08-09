import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {aggregateMajorWorks} from "../worker/modules/today/providers/construction-provider.js";
import * as sourceReference from "../worker/modules/issue-source-reference.js";
import {assigneeResponseDecision,normalizeAssigneeResponse} from "../packages/permissions/issue-assignee-response.js";

const migrationPath="database/migrations/0033_field_adoption_phase1.sql";

test("v0.27.0 field adoption migration exists",()=>{
 assert.equal(fs.existsSync(migrationPath),true,"0033_field_adoption_phase1.sql must define the approved persistence contract");
});

const database=()=>{
 const db=new DatabaseSync(":memory:");
 for(const file of fs.readdirSync("database/migrations").filter(name=>name.endsWith(".sql")).sort())db.exec(fs.readFileSync(`database/migrations/${file}`,"utf8"));
 return db;
};
const d1=db=>({prepare(sql){let values=[];return{bind(...next){values=next;return this},async first(){return db.prepare(sql).get(...values)||null},async all(){return{results:db.prepare(sql).all(...values)}}}}});
const seedSourceSite=db=>db.exec("INSERT INTO companies(id,name) VALUES('company-source','원도급'); INSERT INTO sites(id,company_id,name) VALUES('site-source','company-source','현장'); INSERT INTO users(id,login_identifier,display_name,credential_hash,credential_salt,credential_iterations) VALUES('user-source','source','사용자','h','s',100000);");
const insertDailyUpload=(db,{id,revision,status="ACTIVE"})=>db.prepare("INSERT INTO construction_daily_report_uploads(id,site_id,work_date_kst,revision,original_file_key,original_file_name,mime_type,size_bytes,parse_status,uploaded_by_user_id,status) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(id,"site-source","2026-08-09",revision,`key-${id}`,`${id}.xlsx`,"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",1,"CONFIRMED","user-source",status);
const insertDailyItem=(db,{id,uploadId,cell,description="거푸집 설치"})=>db.prepare("INSERT INTO construction_daily_report_imported_items(id,upload_id,work_date_kst,section_type,work_description,source_sheet_name,source_cell_range,sort_order) VALUES(?,?,?,?,?,?,?,?)").run(id,uploadId,"2026-08-09","TODAY_PLAN",description,"8월",cell,1);
const insertMonthlyPlan=(db,{id,siteId="site-source",revision=1,status="SCHEDULED"})=>db.prepare("INSERT INTO construction_monthly_plans(id,site_id,start_date,end_date,trade_key,trade_label,revision,status,work_description,client_payload_hash,created_by_user_id,updated_by_user_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run(id,siteId,"2026-08-01","2026-08-31","FORMWORK","거푸집",revision,status,"월간 작업",`hash-${id}`,"user-source","user-source");

test("0033 stores bounded source provenance and deterministic append-only responses",()=>{
 const db=database();
 const sourceColumns=new Map(db.prepare("PRAGMA table_info(issue_source_references)").all().map(row=>[row.name,row]));
 const responseColumns=new Map(db.prepare("PRAGMA table_info(issue_assignee_responses)").all().map(row=>[row.name,row]));
 assert.equal(sourceColumns.get("source_item_refs_json")?.dflt_value,"'[]'");
 assert.equal(sourceColumns.get("source_snapshot_json")?.notnull,1);
 assert.equal(responseColumns.get("response_revision")?.notnull,1);
 const responseSql=db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='issue_assignee_responses'").get().sql;
 assert.match(responseSql,/CHECK\s*\(response_revision\s*>=\s*1\)/i);
 assert.match(responseSql,/UNIQUE\s*\(issue_id\s*,\s*response_revision\)/i);
 const indexes=db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all().map(row=>row.name);
 for(const name of ["idx_issue_source_site_type_id","idx_issue_assignee_response_latest","idx_issue_assignee_response_attention"])assert.ok(indexes.includes(name),name);
 db.close();
});

test("response revision determines latest value when timestamps collide",()=>{
 const db=database();
 db.exec("INSERT INTO companies(id,name) VALUES('c','C'); INSERT INTO sites(id,company_id,name) VALUES('s','c','S'); INSERT INTO users(id,login_identifier,display_name,credential_hash,credential_salt,credential_iterations) VALUES('u','u','U','h','s',100000); INSERT INTO issue_items(id,site_id,created_by_user_id,created_by_name_snapshot,title,location_text,description,category_code) VALUES('i','s','u','U','T','L','D','CONSTRUCTION');");
 const insert=db.prepare("INSERT INTO issue_assignee_responses(id,issue_id,site_id,response,actor_user_id,response_revision,responded_at) VALUES(?,?,?,?,?,?,?)");
 insert.run("r1","i","s","ACKNOWLEDGED","u",1,"2026-08-08 12:00:00");
 insert.run("r2","i","s","BLOCKED","u",2,"2026-08-08 12:00:00");
 assert.equal(db.prepare("SELECT response FROM issue_assignee_responses WHERE issue_id='i' ORDER BY response_revision DESC LIMIT 1").get().response,"BLOCKED");
 assert.deepEqual({...db.prepare("SELECT status,revision,assigned_to_user_id,due_at FROM issue_items WHERE id='i'").get()},{status:"OPEN",revision:1,assigned_to_user_id:null,due_at:null});
 assert.throws(()=>insert.run("r3","i","s","DUE_DATE_DISCUSSION","u",2,"2026-08-08 12:00:00"),/UNIQUE/);
 db.close();
});

test("aggregated Today work preserves every imported item reference without using its render id",()=>{
 const [work]=aggregateMajorWorks([
  {id:"item-a",section_type:"TODAY_PLAN",source_sheet_name:" 8월 ",source_cell_range:"m10:m11",work_description:"거푸집 설치",workforce_count:2},
  {id:"item-b",section_type:"TODAY_PLAN",source_sheet_name:"8월",source_cell_range:"M12:M13",work_description:"거푸집 설치",workforce_count:3}
 ]);
 assert.deepEqual(work.sourceItemRefs,[
  {itemId:"item-a",matchKey:"TODAY_PLAN|8월|M10:M11"},
  {itemId:"item-b",matchKey:"TODAY_PLAN|8월|M12:M13"}
 ]);
 assert.ok(work.sourceItemRefs.every(ref=>!ref.itemId.startsWith("construction-work-")));
});

test("stale source resolver is available for conservative relinking",()=>{
 assert.equal(typeof sourceReference.resolveIssueSource,"function","resolveIssueSource must implement the approved stale source contract");
});

test("stale daily source relinks only when every match key has one latest item",async()=>{
 const db=database();seedSourceSite(db);insertDailyUpload(db,{id:"upload-old",revision:1,status:"SUPERSEDED"});insertDailyItem(db,{id:"old-a",uploadId:"upload-old",cell:"M10:M11"});insertDailyUpload(db,{id:"upload-new",revision:2});insertDailyItem(db,{id:"new-a",uploadId:"upload-new",cell:"M10:M11",description:"거푸집 설치 변경"});
 const result=await sourceReference.resolveIssueSource({DB:d1(db)},{siteId:"site-source",sourceType:"CONSTRUCTION_DAILY_REPORT",sourceId:"upload-old",sourceRevision:1,sourceItemRefs:[{itemId:"old-a",matchKey:"TODAY_PLAN|8월|M10:M11"}]});
 assert.equal(result.status,"RELINKED");
 assert.equal(result.reference.sourceId,"upload-new");
 assert.equal(result.reference.sourceRevision,2);
 assert.deepEqual(result.reference.sourceItemRefs,[{itemId:"new-a",matchKey:"TODAY_PLAN|8월|M10:M11"}]);
 assert.equal(result.reference.snapshot.workDescription,"거푸집 설치 변경");
 db.close();
});

test("same-site ambiguous or missing latest item detaches without exposing the source",async()=>{
 const db=database();seedSourceSite(db);insertDailyUpload(db,{id:"upload-old",revision:1,status:"SUPERSEDED"});insertDailyItem(db,{id:"old-a",uploadId:"upload-old",cell:"M10:M11"});insertDailyUpload(db,{id:"upload-new",revision:2});insertDailyItem(db,{id:"new-a",uploadId:"upload-new",cell:"M10:M11"});insertDailyItem(db,{id:"new-b",uploadId:"upload-new",cell:"M10:M11"});
 const input={siteId:"site-source",sourceType:"CONSTRUCTION_DAILY_REPORT",sourceId:"upload-old",sourceRevision:1,sourceItemRefs:[{itemId:"old-a",matchKey:"TODAY_PLAN|8월|M10:M11"}]};
 const ambiguous=await sourceReference.resolveIssueSource({DB:d1(db)},input);
 const missing=await sourceReference.resolveIssueSource({DB:d1(db)},{...input,sourceId:"missing-upload"});
 assert.deepEqual(ambiguous,{status:"DETACHED",reference:null,warning:sourceReference.ISSUE_SOURCE_DETACHED_WARNING});
 assert.deepEqual(missing,ambiguous);
 db.close();
});

test("cross-site daily report source is denied without exposing source information",async()=>{
 const db=database();seedSourceSite(db);db.exec("INSERT INTO sites(id,company_id,name) VALUES('site-other','company-source','다른 현장')");insertDailyUpload(db,{id:"upload-other",revision:1});db.prepare("UPDATE construction_daily_report_uploads SET site_id='site-other' WHERE id='upload-other'").run();insertDailyItem(db,{id:"other-a",uploadId:"upload-other",cell:"M10:M11"});
 const input={siteId:"site-source",sourceType:"CONSTRUCTION_DAILY_REPORT",sourceId:"upload-other",sourceRevision:1,sourceItemRefs:[{itemId:"other-a",matchKey:"TODAY_PLAN|8월|M10:M11"}]};
 await assert.rejects(()=>sourceReference.resolveIssueSource({DB:d1(db)},input),error=>{
  assert.equal(error.status,403);assert.equal(error.code,"ISSUE_SOURCE_SCOPE_DENIED");
  assert.equal(JSON.stringify({code:error.code,message:error.message}).includes("upload-other"),false);
  assert.equal(JSON.stringify({code:error.code,message:error.message}).includes("site-other"),false);
  return true;
 });
 db.close();
});

test("cross-site monthly plan source is denied without exposing source information",async()=>{
 const db=database();seedSourceSite(db);db.exec("INSERT INTO sites(id,company_id,name) VALUES('site-other','company-source','다른 현장')");insertMonthlyPlan(db,{id:"plan-other",siteId:"site-other"});
 await assert.rejects(()=>sourceReference.resolveIssueSource({DB:d1(db)},{siteId:"site-source",sourceType:"CONSTRUCTION_MONTHLY_PLAN",sourceId:"plan-other",sourceRevision:1}),error=>{
  assert.equal(error.status,403);assert.equal(error.code,"ISSUE_SOURCE_SCOPE_DENIED");
  assert.equal(JSON.stringify({code:error.code,message:error.message}).includes("plan-other"),false);
  assert.equal(JSON.stringify({code:error.code,message:error.message}).includes("site-other"),false);
  return true;
 });
 db.close();
});

test("same-site stale monthly source detaches and Issue creation preserves normal fields",async()=>{
 const db=database();seedSourceSite(db);insertMonthlyPlan(db,{id:"plan-source",revision:1});
 const detached=await sourceReference.resolveIssueSource({DB:d1(db)},{siteId:"site-source",sourceType:"CONSTRUCTION_MONTHLY_PLAN",sourceId:"plan-source",sourceRevision:2});
 assert.deepEqual(detached,{status:"DETACHED",reference:null,warning:sourceReference.ISSUE_SOURCE_DETACHED_WARNING});
 const worker=fs.readFileSync("worker/modules/issues.js","utf8");
 assert.match(worker,/sourceResult=await resolveIssueSource[\s\S]*payloadHash\(\{title,location,description/);
 assert.match(worker,/sourceResult\.reference\)statements\.push/);
 assert.match(worker,/return json\(\{issue:mapIssue/);
 db.close();
});

test("Today source context reaches Issue creation without making source mandatory",()=>{
 const today=fs.readFileSync("apps/web/assets/today.js","utf8"),issuesUi=fs.readFileSync("apps/web/assets/issues.js","utf8"),worker=fs.readFileSync("worker/modules/issues.js","utf8");
 assert.match(today,/sourceItemIds/);
 assert.match(today,/sourceType:context\.sourceType,sourceId:context\.sourceId,sourceRevision:String\(context\.sourceRevision\)/);
 assert.match(issuesUi,/sourceContext/);
 assert.match(issuesUi,/sourceItemRefsJson/);
 assert.match(worker,/sourceLinkStatus/);
 assert.match(worker,/INSERT INTO issue_source_references/);
 assert.match(worker,/ISSUE_SOURCE_DETACHED_WARNING/);
});

test("Issue detail isolates stored source metadata failures",()=>{
 const worker=fs.readFileSync("worker/modules/issues.js","utf8");
 assert.match(worker,/safeIssueSourceReference/);
 assert.match(worker,/sourceUnavailable/);
 assert.match(worker,/sourceReference/);
});

test("only the exact active assignee can append a bounded response",()=>{
 const allowed=assigneeResponseDecision({userId:"u1",assignedToUserId:"u1",siteId:"s",issueSiteId:"s",boardAccess:"EDIT",permissions:["issue.act"],status:"ASSIGNED"});
 assert.deepEqual(allowed,{allowed:true,reason:null});
 for(const override of [{userId:"manager"},{boardAccess:"VIEW"},{permissions:[]},{siteId:"other"},{status:"COMPLETED"}])assert.equal(assigneeResponseDecision({userId:"u1",assignedToUserId:"u1",siteId:"s",issueSiteId:"s",boardAccess:"EDIT",permissions:["issue.act"],status:"ASSIGNED",...override}).allowed,false);
});

test("assignee response contract has only four values and bounded notes",()=>{
 for(const response of ["ACKNOWLEDGED","NOT_MY_RESPONSIBILITY","DUE_DATE_DISCUSSION","BLOCKED"])assert.equal(normalizeAssigneeResponse({response,note:" 확인 "}).value.note,"확인");
 assert.equal(normalizeAssigneeResponse({response:"APPROVED"}).ok,false);
 assert.equal(normalizeAssigneeResponse({response:"BLOCKED",note:"x".repeat(501)}).ok,false);
});

test("response API is append-only, deterministic, audited, and idempotent",()=>{
 const worker=fs.readFileSync("worker/modules/issues.js","utf8");
 assert.match(worker,/assignee-response/);
 assert.match(worker,/response_revision DESC/);
 assert.match(worker,/ISSUE_ASSIGNEE_RESPONSE_RECORDED/);
 assert.match(worker,/ISSUE_ASSIGNEE_RESPONSE:/);
 assert.doesNotMatch(worker,/NOT_MY_RESPONSIBILITY[^\n]{0,300}UPDATE issue_items/);
});

test("latest response is visible on Issue screens and Today attention count",()=>{
 const ui=fs.readFileSync("apps/web/assets/issues.js","utf8"),provider=fs.readFileSync("worker/modules/today/providers/issue-provider.js","utf8"),build=fs.readFileSync("scripts/build.mjs","utf8");
 assert.match(ui,/assigneeResponse/);
 assert.match(ui,/responseRevision/);
 assert.match(ui,/담당 응답/);
 assert.match(provider,/RESPONSE_ATTENTION/);
 assert.match(provider,/response_revision/);
 assert.match(build,/issue-assignee-response\.js/);
});

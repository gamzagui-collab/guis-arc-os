import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {validateMonthlyPlan,createPlan,updatePlan,cancelPlan,handleMonthlyPlanRequest} from "../worker/modules/construction/monthly-plan.js";
import {ApiError} from "../worker/core/response.js";
import {constructionOptions} from "../worker/modules/construction.js";
import {presentConstructionWarning,constructionWarningsHtml} from "../apps/web/assets/construction-warnings.js";
import {constructionScheduleHtml,refreshConstructionSchedule,resolveCompanyTradeSelection,scheduleCard,scheduleCardView} from "../apps/web/assets/construction-schedule.js";

const read=file=>fs.readFileSync(file,"utf8");
const monthlyApi=read("worker/modules/construction/monthly-plan.js");
const provider=read("worker/modules/today/providers/construction-provider.js");
const scheduleUi=read("apps/web/assets/construction-schedule.js");
const constructionUi=read("apps/web/assets/construction.js");
const css=read("apps/web/assets/construction.css");

function database(){
 const db=new DatabaseSync(":memory:");
 for(const name of fs.readdirSync("database/migrations").sort())db.exec(read(`database/migrations/${name}`));
 return db;
}

function databaseThrough(lastMigration){
 const db=new DatabaseSync(":memory:");
 for(const name of fs.readdirSync("database/migrations").sort().filter(name=>name<=lastMigration))db.exec(read(`database/migrations/${name}`));
 return db;
}

function d1(db,{afterPlanRead}={}){
 const statement=(sql,args=[])=>({
  sql,args,
  bind(...values){return statement(sql,values)},
  async first(){
   const row=db.prepare(sql).get(...args)||null;
   if(row&&afterPlanRead&&sql.startsWith("SELECT * FROM construction_monthly_plans")){const hook=afterPlanRead;afterPlanRead=null;hook(db)}
   return row;
  },
  async all(){return {results:db.prepare(sql).all(...args)}},
  async run(){const result=db.prepare(sql).run(...args);return {success:true,meta:{changes:Number(result.changes)}}}
 });
 return {prepare:sql=>statement(sql),async batch(statements){
  db.exec("BEGIN");
  try{
   const results=statements.map(item=>{const result=db.prepare(item.sql).run(...item.args);return {success:true,meta:{changes:Number(result.changes)}}});
   db.exec("COMMIT");
   return results;
  }catch(error){db.exec("ROLLBACK");throw error}
 }};
}

function seededPlanDb(){
 const db=database();
 db.exec(`INSERT INTO companies(id,name,status) VALUES('company-1','현장회사','ACTIVE'),('company-2','협력회사','ACTIVE');
 INSERT INTO sites(id,company_id,name,status) VALUES('site-1','company-1','현장 1','ACTIVE'),('site-2','company-1','현장 2','ACTIVE');
  INSERT INTO users(id,login_identifier,display_name,credential_hash,credential_salt,credential_iterations,status) VALUES('user-1','01000000000','관리자','hash','salt',1,'ACTIVE');
  INSERT INTO company_site_contracts(id,company_id,site_id,contractor_type,status) VALUES
   ('contract-1','company-1','site-1','GENERAL','ACTIVE'),
   ('contract-2','company-1','site-2','GENERAL','ACTIVE'),
   ('contract-3','company-2','site-1','SPECIALTY','ACTIVE');
  INSERT INTO company_site_contract_trades(id,site_contract_id,trade_code,trade_id,status) VALUES
   ('contract-trade-1','contract-1','FORMWORK','trade-formwork','ACTIVE'),
   ('contract-trade-2','contract-1','ELECTRICAL','trade-electrical','ACTIVE'),
   ('contract-trade-3','contract-2','MASONRY','trade-masonry','ACTIVE'),
   ('contract-trade-4','contract-3','REBAR','trade-rebar','ACTIVE');
  INSERT INTO construction_monthly_plans(id,site_id,start_date,end_date,trade_key,trade_label,work_description,client_payload_hash,created_by_user_id,updated_by_user_id)
  VALUES('plan-1','site-1','2026-08-03','2026-08-03','FORMWORK','거푸집공사 일반','기존 작업','hash','user-1','user-1'),
        ('plan-2','site-2','2026-08-03','2026-08-03','FORMWORK','거푸집공사 일반','다른 현장 작업','hash','user-1','user-1');`);
 return db;
}

const request=(method,body)=>new Request("https://example.test/api",{method,headers:{"content-type":"application/json","x-request-id":crypto.randomUUID()},body:JSON.stringify(body)});
const createRequest=body=>new Request("https://example.test/api",{method:"POST",headers:{"content-type":"application/json","x-request-id":crypto.randomUUID(),"idempotency-key":crypto.randomUUID()},body:JSON.stringify(body)});
const auth={siteId:"site-1",userId:"user-1"};

test("0025 migration adds nullable cancellation reason without changing legacy rows notes revisions or indexes",()=>{
 const db=databaseThrough("0024_construction_monthly_plans.sql");
 db.exec(`INSERT INTO companies(id,name,status) VALUES('company-1','현장회사','ACTIVE');
  INSERT INTO sites(id,company_id,name,status) VALUES('site-1','company-1','현장','ACTIVE');
  INSERT INTO users(id,login_identifier,display_name,credential_hash,credential_salt,credential_iterations,status) VALUES('user-1','01000000000','관리자','hash','salt',1,'ACTIVE');
  INSERT INTO construction_monthly_plans(id,site_id,start_date,end_date,trade_key,trade_label,work_description,note,status,revision,client_payload_hash,created_by_user_id,updated_by_user_id)
  VALUES('legacy','site-1','2026-08-03','2026-08-03','FORMWORK','과거 표기','작업','취소 사유: 과거 우천','CANCELLED',7,'hash','user-1','user-1')`);
 db.exec(read("database/migrations/0025_construction_monthly_plan_cancellation_reason.sql"));
 const columns=db.prepare("PRAGMA table_info(construction_monthly_plans)").all().map(row=>row.name);
 assert.ok(columns.includes("cancellation_reason"));
 const row=db.prepare("SELECT note,revision,cancellation_reason FROM construction_monthly_plans WHERE id='legacy'").get();
 assert.equal(row.note,"취소 사유: 과거 우천");
 assert.equal(row.revision,7);
 assert.equal(row.cancellation_reason,null);
 const indexes=db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='construction_monthly_plans'").all().map(row=>row.name);
 for(const name of["idx_construction_monthly_plans_site_start","idx_construction_monthly_plans_site_end","idx_construction_monthly_plans_site_status","idx_construction_monthly_plans_company"])assert.ok(indexes.includes(name));
 db.close();
});

test("monthly plan migration stores one range row and indexes site date status and company",()=>{
 const db=database(),tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='construction_monthly_plans'").all();
 assert.equal(tables.length,1);
 const indexes=db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='construction_monthly_plans'").all().map(row=>row.name);
 for(const name of["idx_construction_monthly_plans_site_start","idx_construction_monthly_plans_site_end","idx_construction_monthly_plans_site_status","idx_construction_monthly_plans_company"])assert.ok(indexes.includes(name),name);
 db.exec(`INSERT INTO companies(id,name,status) VALUES('company-1','현장회사','ACTIVE');
  INSERT INTO sites(id,company_id,name,status) VALUES('site-1','company-1','현장','ACTIVE');
  INSERT INTO users(id,login_identifier,display_name,credential_hash,credential_salt,credential_iterations,status) VALUES('user-1','01000000000','관리자','hash','salt',1,'ACTIVE');
  INSERT INTO construction_monthly_plans(id,site_id,start_date,end_date,trade_key,trade_label,work_description,client_payload_hash,created_by_user_id,updated_by_user_id)
  VALUES('plan-1','site-1','2026-08-03','2026-08-07','FORMWORK','형틀공','1동 18층 알폼 설치','hash','user-1','user-1');`);
 assert.equal(db.prepare("SELECT COUNT(*) count FROM construction_monthly_plans WHERE start_date<='2026-08-05' AND end_date>='2026-08-05'").get().count,1);
 assert.throws(()=>db.exec(`INSERT INTO construction_monthly_plans(id,site_id,start_date,end_date,trade_key,trade_label,work_description,client_payload_hash,created_by_user_id,updated_by_user_id) VALUES('bad','site-1','2026-08-07','2026-08-03','X','공종','작업','hash','user-1','user-1')`));
 db.close();
});

test("monthly plan validation preserves user text and rejects invalid ranges workforce and time",()=>{
 const value=validateMonthlyPlan({startDate:"2026-12-31",endDate:"2027-01-02",tradeKey:"FORMWORK",tradeLabel:"형틀공",workDescription:"  사용자 원문 작업  ",plannedWorkforce:"0",startTime:"07:30",endTime:"17:00"});
 assert.equal(value.workDescription,"사용자 원문 작업");
 assert.equal(value.plannedWorkforce,0);
 assert.equal(value.startDate,"2026-12-31");
 assert.equal(value.endDate,"2027-01-02");
 assert.throws(()=>validateMonthlyPlan({...value,endDate:"2026-01-01"}),/종료일/);
 assert.throws(()=>validateMonthlyPlan({...value,plannedWorkforce:"1.5"}),/0 이상의 정수/);
 assert.throws(()=>validateMonthlyPlan({...value,startTime:"25:00"}),/24시간 형식/);
});

test("monthly plan date validation rejects normalized dates and accepts real leap days",()=>{
 const base={startDate:"2026-02-28",tradeKey:"FORMWORK",tradeLabel:"형틀공",workDescription:"작업"};
 for(const invalid of["2026-02-29","2026-02-30","2026-04-31","2026-13-01","2026-00-10"])assert.throws(()=>validateMonthlyPlan({...base,startDate:invalid,endDate:invalid}),error=>error.status===400&&error.code==="CONSTRUCTION_MONTHLY_PLAN_DATE_INVALID");
 assert.equal(validateMonthlyPlan({...base,startDate:"2024-02-29",endDate:"2024-02-29"}).startDate,"2024-02-29");
});

test("monthly plan update and cancel preserve note and write structured cancellation audit",async()=>{
 const db=seededPlanDb(),env={DB:d1(db)};
 const updated=await (await updatePlan(request("PATCH",{revision:1,workDescription:"수정 작업",note:"외부 민원 주의"}),env,auth,"plan-1")).json();
 assert.equal(updated.plan.revision,2);
 assert.equal(updated.plan.workDescription,"수정 작업");
 let audit=db.prepare("SELECT * FROM audit_logs WHERE action='CONSTRUCTION_MONTHLY_PLAN_UPDATED'").get();
 let metadata=JSON.parse(audit.metadata_json);
 assert.equal(metadata.beforeRevision,1);
 assert.equal(metadata.afterRevision,2);
 assert.equal(metadata.after.workDescription,"수정 작업");
 const cancelled=await (await cancelPlan(request("DELETE",{revision:2,reason:"우천"}),env,auth,"plan-1")).json();
 assert.equal(cancelled.plan.revision,3);
 assert.equal(cancelled.plan.status,"CANCELLED");
 assert.equal(cancelled.plan.note,"외부 민원 주의");
 assert.equal(cancelled.plan.cancellationReason,"우천");
 const stored=db.prepare("SELECT note,cancellation_reason,cancelled_by_user_id,cancelled_at FROM construction_monthly_plans WHERE id='plan-1'").get();
 assert.equal(stored.note,"외부 민원 주의");
 assert.equal(stored.cancellation_reason,"우천");
 assert.equal(stored.cancelled_by_user_id,"user-1");
 assert.ok(stored.cancelled_at);
 audit=db.prepare("SELECT * FROM audit_logs WHERE action='CONSTRUCTION_MONTHLY_PLAN_CANCELLED'").get();
 metadata=JSON.parse(audit.metadata_json);
 assert.equal(metadata.beforeRevision,2);
 assert.equal(metadata.afterRevision,3);
 assert.equal(metadata.after.status,"CANCELLED");
 assert.equal(metadata.after.note,"외부 민원 주의");
 assert.equal(metadata.after.cancellationReason,"우천");
 assert.equal(metadata.cancellationReason,"우천");
 db.close();
});

test("cancellation reason validation trims input and enforces required and 500 character maximum",async()=>{
 for(const reason of["","   ","가".repeat(501)]){
  const db=seededPlanDb(),env={DB:d1(db)};
  await assert.rejects(()=>cancelPlan(request("DELETE",{revision:1,reason}),env,auth,"plan-1"),error=>error.status===400);
  assert.equal(db.prepare("SELECT status,cancellation_reason,revision FROM construction_monthly_plans WHERE id='plan-1'").get().status,"SCHEDULED");
  assert.equal(db.prepare("SELECT COUNT(*) count FROM audit_logs WHERE action='CONSTRUCTION_MONTHLY_PLAN_CANCELLED'").get().count,0);
  db.close();
 }
 const db=seededPlanDb(),env={DB:d1(db)},reason="가".repeat(500);
 await cancelPlan(request("DELETE",{revision:1,reason:`  ${reason}  `}),env,auth,"plan-1");
 assert.equal(db.prepare("SELECT cancellation_reason FROM construction_monthly_plans WHERE id='plan-1'").get().cancellation_reason,reason);
 db.close();
});

test("concurrent zero-row update returns 409 without data revision or success audit",async()=>{
 const db=seededPlanDb();
 const env={DB:d1(db,{afterPlanRead:database=>database.prepare("UPDATE construction_monthly_plans SET work_description='다른 사용자 작업',revision=2 WHERE id='plan-1'").run()})};
 await assert.rejects(()=>updatePlan(request("PATCH",{revision:1,workDescription:"덮어쓰기"}),env,auth,"plan-1"),error=>error.status===409&&error.code==="CONSTRUCTION_MONTHLY_PLAN_STALE");
 const row=db.prepare("SELECT work_description,revision FROM construction_monthly_plans WHERE id='plan-1'").get();
 assert.equal(row.work_description,"다른 사용자 작업");
 assert.equal(row.revision,2);
 assert.equal(db.prepare("SELECT COUNT(*) count FROM audit_logs WHERE action='CONSTRUCTION_MONTHLY_PLAN_UPDATED'").get().count,0);
 db.close();
});

test("concurrent zero-row cancellation returns 409 without overwriting the winning cancellation or audit",async()=>{
 const db=seededPlanDb();
 const env={DB:d1(db,{afterPlanRead:database=>database.prepare("UPDATE construction_monthly_plans SET status='CANCELLED',cancellation_reason='다른 사용자 취소',revision=2 WHERE id='plan-1'").run()})};
 await assert.rejects(()=>cancelPlan(request("DELETE",{revision:1,reason:"덮어쓰기 취소"}),env,auth,"plan-1"),error=>error.status===409&&error.code==="CONSTRUCTION_MONTHLY_PLAN_STALE");
 const row=db.prepare("SELECT status,cancellation_reason,revision FROM construction_monthly_plans WHERE id='plan-1'").get();
 assert.equal(row.status,"CANCELLED");
 assert.equal(row.cancellation_reason,"다른 사용자 취소");
 assert.equal(row.revision,2);
 assert.equal(db.prepare("SELECT COUNT(*) count FROM audit_logs WHERE action='CONSTRUCTION_MONTHLY_PLAN_CANCELLED'").get().count,0);
 db.close();
});

test("stale cancel, cancelled replay, and other-site access do not mutate or duplicate audit",async()=>{
 const db=seededPlanDb(),env={DB:d1(db)};
 await assert.rejects(()=>cancelPlan(request("DELETE",{revision:2,reason:"오래된 요청"}),env,auth,"plan-1"),error=>error.status===409);
 await assert.rejects(()=>cancelPlan(request("DELETE",{revision:1,reason:"현장 침범"}),env,auth,"plan-2"),error=>error.status===404);
 await assert.rejects(()=>updatePlan(request("PATCH",{revision:1,workDescription:"현장 침범"}),env,auth,"plan-2"),error=>error.status===404);
 await cancelPlan(request("DELETE",{revision:1,reason:"정상 취소"}),env,auth,"plan-1");
 const replay=await (await cancelPlan(request("DELETE",{revision:1,reason:"중복 취소"}),env,auth,"plan-1")).json();
 assert.equal(replay.idempotent,true);
 assert.equal(replay.plan.cancellationReason,"정상 취소");
 assert.equal(db.prepare("SELECT COUNT(*) count FROM audit_logs WHERE action='CONSTRUCTION_MONTHLY_PLAN_CANCELLED'").get().count,1);
 assert.equal(db.prepare("SELECT revision FROM construction_monthly_plans WHERE id='plan-1'").get().revision,2);
 db.close();
});

test("monthly plan create and update store only the official active site trade label",async()=>{
 const db=seededPlanDb(),env={DB:d1(db)};
 const created=await (await createPlan(createRequest({startDate:"2026-08-04",tradeKey:"FORMWORK",workDescription:"신규 작업"}),env,auth)).json();
 assert.equal(created.plan.tradeKey,"FORMWORK");
 assert.equal(created.plan.tradeLabel,"거푸집공사 일반");
 const createAudit=JSON.parse(db.prepare("SELECT metadata_json FROM audit_logs WHERE action='CONSTRUCTION_MONTHLY_PLAN_CREATED'").get().metadata_json);
 assert.equal(createAudit.after.tradeLabel,"거푸집공사 일반");
 const updated=await (await updatePlan(request("PATCH",{revision:1,tradeKey:"ELECTRICAL",tradeLabel:"전기공사 일반"}),env,auth,created.plan.id)).json();
 assert.equal(updated.plan.tradeKey,"ELECTRICAL");
 assert.equal(updated.plan.tradeLabel,"전기공사 일반");
 assert.equal(updated.plan.revision,2);
 const metadata=JSON.parse(db.prepare("SELECT metadata_json FROM audit_logs WHERE action='CONSTRUCTION_MONTHLY_PLAN_UPDATED' AND json_extract(metadata_json,'$.planId')=?1").get(created.plan.id).metadata_json);
 assert.equal(metadata.before.tradeLabel,"거푸집공사 일반");
 assert.equal(metadata.after.tradeLabel,"전기공사 일반");
 db.close();
});

test("PATCH accepts a tradeKey-only change and records the new official label",async()=>{
 const db=seededPlanDb(),env={DB:d1(db)};
 const updated=await (await updatePlan(request("PATCH",{revision:1,tradeKey:"ELECTRICAL"}),env,auth,"plan-1")).json();
 assert.equal(updated.plan.tradeKey,"ELECTRICAL");
 assert.equal(updated.plan.tradeLabel,"전기공사 일반");
 assert.equal(updated.plan.revision,2);
 const metadata=JSON.parse(db.prepare("SELECT metadata_json FROM audit_logs WHERE action='CONSTRUCTION_MONTHLY_PLAN_UPDATED'").get().metadata_json);
 assert.equal(metadata.before.tradeKey,"FORMWORK");
 assert.equal(metadata.before.tradeLabel,"거푸집공사 일반");
 assert.equal(metadata.after.tradeKey,"ELECTRICAL");
 assert.equal(metadata.after.tradeLabel,"전기공사 일반");
 db.close();
});

test("PATCH without a trade change and same-key label omission both retain the official trade",async()=>{
 for(const body of[{revision:1,workDescription:"변경 작업"},{revision:1,tradeKey:"FORMWORK"}]){
  const db=seededPlanDb(),env={DB:d1(db)};
  const updated=await (await updatePlan(request("PATCH",body),env,auth,"plan-1")).json();
  assert.equal(updated.plan.tradeKey,"FORMWORK");
  assert.equal(updated.plan.tradeLabel,"거푸집공사 일반");
  assert.equal(updated.plan.revision,2);
  db.close();
 }
});

test("construction options filter active site trades by optional company without leaking other sites",async()=>{
 const db=seededPlanDb(),env={DB:d1(db)};
 const all=await constructionOptions(env,"site-1");
 assert.deepEqual(all.trades.map(row=>row.trade_key),["REBAR","FORMWORK","ELECTRICAL"]);
 assert.equal(new Set(all.trades.map(row=>row.trade_key)).size,all.trades.length);
 const company1=await constructionOptions(env,"site-1","company-1");
 assert.deepEqual(company1.trades.map(row=>row.trade_key),["FORMWORK","ELECTRICAL"]);
 const company2=await constructionOptions(env,"site-1","company-2");
 assert.deepEqual(company2.trades.map(row=>row.trade_key),["REBAR"]);
 const invalid=await constructionOptions(env,"site-1","not-in-site");
 assert.deepEqual(invalid.trades,[]);
 db.prepare("UPDATE company_site_contract_trades SET status='INACTIVE' WHERE id='contract-trade-2'").run();
 db.prepare("UPDATE trade_master SET status='INACTIVE' WHERE trade_key='REBAR'").run();
 const active=await constructionOptions(env,"site-1");
 assert.deepEqual(active.trades.map(row=>row.trade_key),["FORMWORK"]);
 db.close();
});

test("company and trade change stores the contracted official pair with accurate audit",async()=>{
 const db=seededPlanDb(),env={DB:d1(db)};
 const updated=await (await updatePlan(request("PATCH",{revision:1,contractorCompanyId:"company-2",tradeKey:"REBAR"}),env,auth,"plan-1")).json();
 assert.equal(updated.plan.contractorCompanyId,"company-2");
 assert.equal(updated.plan.contractorCompanyName,"협력회사");
 assert.equal(updated.plan.tradeKey,"REBAR");
 assert.equal(updated.plan.tradeLabel,"철근공사 일반");
 assert.equal(updated.plan.revision,2);
 const row=db.prepare("SELECT contractor_company_id,trade_key,trade_label,revision FROM construction_monthly_plans WHERE id='plan-1'").get();
 assert.equal(row.contractor_company_id,"company-2");
 assert.equal(row.trade_key,"REBAR");
 assert.equal(row.trade_label,"철근공사 일반");
 assert.equal(row.revision,2);
 const metadata=JSON.parse(db.prepare("SELECT metadata_json FROM audit_logs WHERE action='CONSTRUCTION_MONTHLY_PLAN_UPDATED'").get().metadata_json);
 assert.equal(metadata.before.contractorCompanyId,null);
 assert.equal(metadata.before.tradeKey,"FORMWORK");
 assert.equal(metadata.after.contractorCompanyId,"company-2");
 assert.equal(metadata.after.tradeKey,"REBAR");
 assert.equal(metadata.after.tradeLabel,"철근공사 일반");
 db.close();
});

test("company trade UI selection keeps valid keys and clears invalid keys with Korean guidance",()=>{
 const trades=[{trade_key:"FORMWORK",display_name:"거푸집공사 일반"}];
 assert.deepEqual(resolveCompanyTradeSelection(trades,"FORMWORK"),{available:trades,selected:"FORMWORK",message:""});
 assert.deepEqual(resolveCompanyTradeSelection(trades,"ELECTRICAL"),{available:trades,selected:"",message:"선택한 회사에서 사용할 공종을 다시 선택해 주세요."});
 assert.equal(resolveCompanyTradeSelection(trades,"ELECTRICAL",{initial:true}).message,"현재 계약에서 사용할 수 없는 기존 공종입니다. 공종을 다시 선택해 주세요.");
 assert.equal(resolveCompanyTradeSelection([],"").message,"현재 현장에서 사용할 수 있는 공종이 없습니다.");
});

test("mismatched unknown inactive and other-site trades are rejected without plans or audits",async()=>{
 for(const body of[
  {tradeKey:"FORMWORK",tradeLabel:"전기공사 일반"},
  {tradeKey:"UNKNOWN"},
  {tradeKey:"MASONRY"}
 ]){
  const db=seededPlanDb(),env={DB:d1(db)},before=db.prepare("SELECT COUNT(*) count FROM construction_monthly_plans").get().count;
  await assert.rejects(()=>createPlan(createRequest({startDate:"2026-08-04",workDescription:"차단 작업",...body}),env,auth),error=>error.status===400);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM construction_monthly_plans").get().count,before);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM audit_logs WHERE action='CONSTRUCTION_MONTHLY_PLAN_CREATED'").get().count,0);
  db.close();
 }
 const db=seededPlanDb(),env={DB:d1(db)};
 db.prepare("UPDATE trade_master SET status='INACTIVE' WHERE trade_key='FORMWORK'").run();
 await assert.rejects(()=>createPlan(createRequest({startDate:"2026-08-04",tradeKey:"FORMWORK",workDescription:"비활성"}),env,auth),error=>error.status===400);
 assert.equal(db.prepare("SELECT COUNT(*) count FROM audit_logs WHERE action='CONSTRUCTION_MONTHLY_PLAN_CREATED'").get().count,0);
 db.close();
});

test("trade mismatch on update leaves the existing row revision and audit unchanged",async()=>{
 const db=seededPlanDb(),env={DB:d1(db)};
 await assert.rejects(()=>updatePlan(request("PATCH",{revision:1,tradeKey:"FORMWORK",tradeLabel:"전기공사 일반"}),env,auth,"plan-1"),error=>error.status===400&&error.code==="CONSTRUCTION_MONTHLY_PLAN_TRADE_MISMATCH");
 const row=db.prepare("SELECT trade_key,trade_label,revision FROM construction_monthly_plans WHERE id='plan-1'").get();
 assert.equal(row.trade_key,"FORMWORK");
 assert.equal(row.trade_label,"거푸집공사 일반");
 assert.equal(row.revision,1);
 assert.equal(db.prepare("SELECT COUNT(*) count FROM audit_logs WHERE action='CONSTRUCTION_MONTHLY_PLAN_UPDATED'").get().count,0);
 db.close();
});

test("missing or non-integer revisions and denied permissions cannot mutate or audit",async()=>{
 const db=seededPlanDb(),env={DB:d1(db)};
 for(const revision of[undefined,1.5])await assert.rejects(()=>updatePlan(request("PATCH",{revision,workDescription:"잘못된 수정"}),env,auth,"plan-1"),error=>error.status===409);
 const denied=async()=>{throw new ApiError(403,"CONSTRUCTION_BOARD_ACCESS_DENIED","공사관리 편집 권한이 필요합니다.")};
 const deniedRequest=request("PATCH",{revision:1,workDescription:"권한 없는 수정"});
 await assert.rejects(()=>handleMonthlyPlanRequest(deniedRequest,env,new URL("https://example.test/api/v1/construction/monthly-plans/plan-1"),{authorize:denied}),error=>error.status===403);
 assert.equal(db.prepare("SELECT revision FROM construction_monthly_plans WHERE id='plan-1'").get().revision,1);
 assert.equal(db.prepare("SELECT COUNT(*) count FROM audit_logs WHERE action LIKE 'CONSTRUCTION_MONTHLY_PLAN_%'").get().count,0);
 db.close();
});

test("monthly plan API is site scoped, role gated, parameterized, audited and soft cancelled",()=>{
 for(const token of["authorize(request,env,{required:\"EDIT\",write:true})","site_id=?1","contractor_company_id=?5","CONSTRUCTION_MONTHLY_PLAN_CREATED","CONSTRUCTION_MONTHLY_PLAN_UPDATED","CONSTRUCTION_MONTHLY_PLAN_CANCELLED","before:mapPlan(before)","status='CANCELLED'","client_request_id"])assert.ok(monthlyApi.includes(token),token);
 assert.doesNotMatch(monthlyApi,/DELETE FROM construction_monthly_plans/);
 assert.doesNotMatch(monthlyApi,/localStorage|sessionStorage/);
});

test("Construction Today contract uses confirmed report for today and plans for future without duplicate rows",()=>{
 for(const token of["today:{date,source:finalized?","todayEntries=finalized?reportEntries:plannedToday","tomorrow:{date:tomorrow,source:\"MONTHLY_PLAN\"","dayAfterTomorrow:{date:dayAfterTomorrow,source:\"MONTHLY_PLAN\"","중복 표시하지 않습니다.","오늘 공사일보가 아직 확정되지 않아 월간계획을 표시합니다."])assert.ok(provider.includes(token),token);
 for(const token of["오늘","내일","모레","확정 공사일보","월간계획","등록된 공사 일정이 없습니다."])assert.ok(scheduleUi.includes(token),token);
 assert.doesNotMatch(scheduleUi,/엑셀 업로드|Revision 비교|원본 다운로드|날짜 확정/);
});

test("v0.20.0 Construction Today card prioritizes real company trade workforce location and work",()=>{
 const item={id:"plan-1",company:"햇살과창",trade:"경량벽체",plannedWorkforce:6,location:"1동 18층",description:"경량벽체 시공",startTime:"08:00",endTime:"17:00",caution:"고소작업",status:"SCHEDULED",source:"MONTHLY_PLAN"};
 assert.deepEqual(scheduleCardView(item),{company:"햇살과창",trade:"경량벽체",workforce:"6명",location:"1동 18층",description:"경량벽체 시공",time:"08:00~17:00",caution:"고소작업",status:"예정"});
 const html=scheduleCard(item);
 const positions=["햇살과창","경량벽체","6명","1동 18층","경량벽체 시공","08:00~17:00","주의사항","고소작업"].map(text=>html.indexOf(text));
 assert.ok(positions.every((value,index)=>value>=0&&(index===0||value>positions[index-1])));
 assert.doesNotMatch(html,/출처|MONTHLY_PLAN/);
 assert.match(html,/<h3>.*<strong>6명<\/strong><\/h3>/);
});

test("v0.20.0 Construction Today card keeps missing company and location subordinate without inference",()=>{
 const item={id:"report-1",company:null,trade:"T/C 조종사",plannedWorkforce:1,location:null,description:"노코멘트",startTime:null,endTime:null,caution:null,status:"CONFIRMED",source:"CONFIRMED_DAILY_REPORT"};
 const view=scheduleCardView(item),html=scheduleCard(item);
 assert.deepEqual(view,{company:null,trade:"T/C 조종사",workforce:"1명",location:"위치 정보 없음",description:"노코멘트",time:"시간 미정",caution:null,status:"확정"});
 assert.ok(html.indexOf("T/C 조종사")<html.indexOf("회사 미지정"));
 assert.match(html,/construction-schedule-card__missing-company/);
 assert.match(html,/construction-schedule-card__location is-missing/);
 assert.doesNotMatch(html,/construction-schedule-card__company|construction-schedule-card__caution/);
});

test("v0.20.0 Construction Today renders 20 cards in provider order and one section source notice",()=>{
 const entries=Array.from({length:20},(_,index)=>({id:`item-${index+1}`,company:`회사 ${index+1}`,trade:`공종 ${index+1}`,plannedWorkforce:index+1,location:`${index+1}층`,description:`작업 ${index+1}`,status:"SCHEDULED",source:"MONTHLY_PLAN"}));
 const empty={date:"2026-08-02",source:"MONTHLY_PLAN",entries:[],notice:"월간계획 기준"};
 const html=constructionScheduleHtml({schedule:{today:{date:"2026-08-01",source:"MONTHLY_PLAN",entries,notice:"월간계획 기준"},tomorrow:empty,dayAfterTomorrow:empty}});
 assert.equal((html.match(/class="card construction-schedule-card"/g)||[]).length,20);
 for(let index=1;index<20;index++)assert.ok(html.indexOf(`data-schedule-id="item-${index}"`)<html.indexOf(`data-schedule-id="item-${index+1}"`));
 assert.equal((html.match(/출처/g)||[]).length,0);
 assert.equal((html.match(/등록된 공사 일정이 없습니다\./g)||[]).length,2);
});

test("v0.20.0 Construction Today refresh restores scroll after a successful redraw",async()=>{
 const calls=[],viewport={scrollX:17,scrollY:932,scrollTo:(x,y)=>calls.push([x,y])};
 let rendered=null;
 await refreshConstructionSchedule({api:async path=>{assert.equal(path,"/today-schedule");return {schedule:{}}},draw:data=>{rendered=data},viewport});
 assert.deepEqual(rendered,{schedule:{}});
 assert.deepEqual(calls,[[17,932]]);
});

test("v0.20.0 Construction Today refresh also restores scroll after a failed request",async()=>{
 const calls=[],viewport={scrollX:0,scrollY:711,scrollTo:(x,y)=>calls.push([x,y])};
 await assert.rejects(()=>refreshConstructionSchedule({api:async()=>{throw new Error("network")},draw:()=>assert.fail("draw must not run"),viewport}),/network/);
 assert.deepEqual(calls,[[0,711]]);
});

test("v0.20.0 Construction Today responsive CSS uses two safe columns then one column",()=>{
 assert.match(css,/\.construction-day-section>div\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/@media\(max-width:1000px\)\{\.construction-day-section>div\{grid-template-columns:1fr\}\}/);
 assert.match(css,/\.construction-schedule-card\{[^}]*min-width:0;overflow:hidden/);
 assert.match(css,/\.construction-schedule-card h3\{[^}]*overflow-wrap:anywhere/);
 assert.match(css,/\.construction-schedule-card\{padding:16px\}\.construction-schedule-card header/);
});

test("warning presentation separates review and reference without exposing internal codes",()=>{
 const review=presentConstructionWarning({code:"TRADE_MATCH_REVIEW_REQUIRED",tradeRaw:"형틀공",workDescription:"알폼 설치",sourceCellRange:"M10:M11"});
 const reference=presentConstructionWarning({code:"COMPANY_BREAKDOWN_UNAVAILABLE"});
 assert.equal(review.level,"REVIEW");
 assert.equal(review.trade,"형틀공");
 assert.equal(review.blocking,false);
 assert.equal(reference.level,"REFERENCE");
 const html=constructionWarningsHtml({workDate:"2026-07-30",warnings:[{code:"TRADE_MATCH_REVIEW_REQUIRED",tradeRaw:"형틀공"},{code:"COMPANY_BREAKDOWN_UNAVAILABLE"}]});
 for(const text of["확인 필요 1건","참고 1건","공종을 자동으로 확정하기 어렵습니다.","회사별 인원 정보가 없습니다.","원본 위치 정보 없음","확인 후 확정 권장"])assert.ok(html.includes(text),text);
 assert.doesNotMatch(html,/TRADE_MATCH_REVIEW_REQUIRED|COMPANY_BREAKDOWN_UNAVAILABLE/);
});

test("warning and monthly calendar UI keep keyboard, Korean, and responsive contracts",()=>{
 for(const token of["constructionWarningsHtml(row)","bindConstructionWarningToggles","aria-expanded=\"false\""])assert.ok(constructionUi.includes(token)||read("apps/web/assets/construction-warnings.js").includes(token),token);
 const warningUi=read("apps/web/assets/construction-warnings.js");
 assert.match(warningUi,/event\.key==="Enter"\|\|event\.key===" "/);
 for(const token of["월간계획","일정 등록","이전 달","다음 달","오늘로 이동","공종","회사","상태","작업내용","주의사항","예정 인원"])assert.ok(scheduleUi.includes(token),token);
 for(const token of["메모","취소 사유","기존 취소 일정에는 취소 사유 정보가 없습니다."])assert.ok(scheduleUi.includes(token),token);
 for(const token of["companyId","선택한 회사에서 사용할 공종을 다시 선택해 주세요.","현재 계약에서 사용할 수 없는 기존 공종입니다. 공종을 다시 선택해 주세요.","공사 일정 선택 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."])assert.ok(scheduleUi.includes(token),token);
 assert.match(css,/\.construction-calendar-grid/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/overflow-wrap:anywhere/);
 assert.doesNotMatch(scheduleUi,/prompt\(|alert\(|dialog|modal|popup/i);
});

test("navigation places monthly plan directly below daily report",()=>{
 const modules=read("packages/permissions/modules.js");
 assert.match(modules,/\["공사 Today","\/construction"\],\["공사일보","\/construction\/daily"\],\["월간계획","\/construction\/monthly-plan"\]/);
});

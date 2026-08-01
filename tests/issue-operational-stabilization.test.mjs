import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { assignmentWithinScope, ISSUE_SCOPE, issueWithinScope, resolveIssueScope } from "../worker/modules/issue-policy.js";
import {canonicalLocationId,extractLocationSpeech} from "../apps/web/assets/issue-speech.js";
import {resolveIssueLocation} from "../worker/modules/issues.js";

const read = file => fs.readFileSync(file, "utf8");
const worker = read("worker/modules/issues.js");
const session = read("worker/core/session.js");

function database() {
  const db = new DatabaseSync(":memory:");
  db.exec(read("database/migrations/0001_core_foundation.sql"));
  db.exec("INSERT INTO roles(id,code,name,rank) VALUES('role-owner','INTEGRATED_OWNER','Owner',1000)");
  db.exec(read("database/migrations/0002_issue_foundation.sql"));
  db.exec(read("database/migrations/0003_issue_operational_stabilization.sql"));
  return db;
}

test("Data Ownership and handoff agree Issue is implemented while runtime state is READY", () => {
  const ownership = read("docs/03_DATA_OWNERSHIP.md"), matrix = JSON.parse(read("docs/08_VERSION_MATRIX.json")), handoff = read("docs/98_NEXT_CHAT_HANDOFF.md"), index = read("worker/index.js");
  assert.match(ownership, /Issue[^\n]*IMPLEMENTED/);
  assert.doesNotMatch(ownership, /Issue[^\n]*NOT_IMPLEMENTED/);
  assert.equal(matrix.modules.issue, "READY");
  assert.match(handoff, /Issue[^\n]*IMPLEMENTED/);
  assert.match(index, /MODULE_IMPLEMENTATION/);
});

test("role scope matrix is fail closed", () => {
  assert.equal(resolveIssueScope(["SITE_MANAGER"]), ISSUE_SCOPE.SITE);
  assert.equal(resolveIssueScope(["GENERAL_CONTRACTOR_STAFF"]), ISSUE_SCOPE.SITE);
  assert.equal(resolveIssueScope(["CONTRACTOR_MANAGER"]), ISSUE_SCOPE.CONTRACTOR);
  assert.equal(resolveIssueScope(["CONTRACTOR_ASSIGNEE"]), ISSUE_SCOPE.ASSIGNEE);
  assert.equal(resolveIssueScope(["FIELD_WORKER"]), ISSUE_SCOPE.SELF_CREATED);
  assert.equal(resolveIssueScope(["NO_ISSUE_ACCESS"]), ISSUE_SCOPE.NONE);
});

test("contractor and assignee isolation cannot cross company or assignment", () => {
  const issue = { contractor_company_id: "company-a", assigned_to_user_id: "worker-a" };
  assert.equal(issueWithinScope({scope:ISSUE_SCOPE.CONTRACTOR,companyId:"company-a",userId:"manager-a"}, issue), true);
  assert.equal(issueWithinScope({scope:ISSUE_SCOPE.CONTRACTOR,companyId:"company-b",userId:"manager-b"}, issue), false);
  assert.equal(issueWithinScope({scope:ISSUE_SCOPE.ASSIGNEE,companyId:"company-a",userId:"worker-a"}, issue), true);
  assert.equal(issueWithinScope({scope:ISSUE_SCOPE.ASSIGNEE,companyId:"company-a",userId:"worker-b"}, issue), false);
  assert.equal(assignmentWithinScope({scope:ISSUE_SCOPE.CONTRACTOR,companyId:"company-a"},{companyId:"company-b"}),false);
});

test("operational migration reuses roles and grants least privilege", () => {
  const db = database();
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM roles WHERE code IN ('SITE_MANAGER','GENERAL_CONTRACTOR_STAFF','CONTRACTOR_MANAGER','CONTRACTOR_ASSIGNEE','NO_ISSUE_ACCESS','FIELD_WORKER')").get().count, 6);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM role_permissions rp JOIN roles r ON r.id=rp.role_id WHERE r.code='NO_ISSUE_ACCESS'").get().count,0);
  db.exec(read("database/migrations/0005_issue_field_operational.sql"));
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM role_permissions rp JOIN roles r ON r.id=rp.role_id WHERE r.code='FIELD_WORKER'").get().count,3);
  assert.ok(db.prepare("SELECT COUNT(*) AS count FROM role_permissions rp JOIN roles r ON r.id=rp.role_id WHERE r.code='SITE_MANAGER'").get().count >= 11);
});

test("board access and multi-site context are evaluated per active site", () => {
  assert.match(session,/ur\.site_id=\?2 OR ur\.site_id IS NULL/);
  assert.match(session,/current_context_version/);
  assert.match(worker,/requireBoardAccess/); assert.doesNotMatch(worker,/ISSUE_ENTITLEMENT_REQUIRED/);
  assert.match(worker,/ISSUE_ROLE_SCOPE_DENIED/);
  assert.match(worker,/ISSUE_RECORD_SCOPE_DENIED/);
});

test("remote-compatible stale and idempotency contracts prevent duplicates", () => {
  assert.match(worker,/ISSUE_STALE_REVISION/);
  assert.match(worker,/ISSUE_STALE_REVISION","DENIED/);
  assert.match(worker,/IDEMPOTENCY_PAYLOAD_MISMATCH/);
  assert.match(worker,/payload_hash/);
  assert.match(worker,/ISSUE_ACTION:/);
  assert.match(worker,/ISSUE_TRANSITION:/);
  assert.match(worker,/datetime\('now','\+7 days'\)/);
});

test("media authorization and orphan cleanup are fail closed", () => {
  assert.match(worker,/assertIssueScope\(auth,issue\)/);
  assert.match(worker,/Promise\.allSettled\(uploaded\.map/);
  assert.match(worker,/ISSUE_MEDIA_UPLOAD_FAILED/);
  assert.match(worker,/content-disposition/);
  assert.match(worker,/x-content-type-options/);
  assert.doesNotMatch(worker,/publicUrl|r2\.dev/i);
});

test("mobile Issue form is Korean, camera-first, voice-assisted and uses canonical values", () => {
  const ui=read("apps/web/assets/issues.js"),css=read("apps/web/assets/issues.css");
  for(const label of ["전체 이슈","이슈 등록","미조치","완료 확인","완료","통계","담당자 지정","조치","완료 요청","재조치","취소"])assert.match(ui,new RegExp(label));
  assert.match(ui,/capture="environment"/);
  assert.match(ui,/accept="image\/\*"/);
  assert.match(ui,/SpeechRecognition\|\|window\.webkitSpeechRecognition/);
  for(const value of ["부부욕실","공용욕실","발코니","직영"])assert.match(ui+worker,new RegExp(value));
  assert.match(css,/min-height:44px/);
  assert.match(css,/@media\(max-width:412px\)/);
});

test("form options and create API validate site company and assignable membership", () => {
  for(const token of ["\/api\/v1\/issues\/form-options","GENERAL_CONTRACTOR","company_site_contracts","company_site_contract_trades","issue.manage_locations","issue.manage_all","ISSUE_COMPANY_SCOPE_DENIED","ISSUE_COMPANY_ASSIGNEE_INVALID","assigned_to_user_id"])assert.match(worker,new RegExp(token));
  assert.match(worker,/SELECT DISTINCT u\.id,u\.display_name,m\.company_id FROM memberships/);
  assert.doesNotMatch(worker,/r\.code<>'FIELD_WORKER'/);
});

test("location entities preserve canonical IDs without breaking location snapshots", () => {
  const db=database();
  db.exec("INSERT INTO companies(id,name,status) VALUES('company','Company','ACTIVE'); INSERT INTO sites(id,company_id,name,status) VALUES('site','company','Site','ACTIVE')");
  db.exec(read("database/migrations/0006_issue_location_entities.sql"));
  assert.ok(db.prepare("SELECT COUNT(*) count FROM site_locations WHERE site_id='site' AND is_active=1").get().count>=100);
  assert.equal(db.prepare("SELECT display_name FROM site_locations WHERE site_id='site' AND code='PARKING_B1'").get().display_name,"지하1층 주차장");
  for(const column of ["building_location_id","floor_location_id","unit_location_id","room_location_id"])assert.ok(db.prepare("PRAGMA table_info(issue_items)").all().some(row=>row.name===column));
});

test("speech building numbers convert only in location context", () => {
  const config={allowedBuildings:["1동","2동","202동"]};
  assert.equal(extractLocationSpeech("일동 1402호 거실",config).buildingLabel,"1동");
  assert.equal(extractLocationSpeech("이동 1042호 주방",config).buildingLabel,"2동");
  assert.equal(extractLocationSpeech("이동 중입니다",config).buildingLabel,null);
  assert.equal(extractLocationSpeech("일동 기립",config).buildingLabel,null);
  assert.equal(extractLocationSpeech("202동 1002호 거실",config).buildingLabel,"202동");
  assert.equal(extractLocationSpeech("2동 1002호 거실",{...config,buildingNumberMode:"PHASE_PREFIX",phasePrefix:"20"}).buildingLabel,"202동");
});

test("temporary location options send labels without fake IDs",()=>{
  const option=(value,text,canonical=false)=>({value,textContent:text,dataset:canonical?{locationId:"true"}:{}});
  assert.equal(canonicalLocationId(option("site:unit:10","10호",true)),"site:unit:10");
  assert.equal(canonicalLocationId(option("dynamic:1402호","1402호")),"");
  assert.equal(canonicalLocationId(option("DIRECT","B101호")),"");
  assert.equal(canonicalLocationId(option("not-a-real-db-id","가짜호")),"");
  assert.equal(canonicalLocationId(option("dynamic:201동","201동")),"");
  assert.equal(canonicalLocationId(option("dynamic:거실","거실")),"");
});

test("resolveLocation validates canonical UNIT IDs and reuses dynamic labels",async()=>{
  const rows=[
    {id:"site-a-unit-1",site_id:"site-a",location_type:"UNIT",code:"UNIT_1",display_name:"1호",is_active:1},
    {id:"site-b-unit-1",site_id:"site-b",location_type:"UNIT",code:"UNIT_1",display_name:"1호",is_active:1},
    {id:"site-a-unit-old",site_id:"site-a",location_type:"UNIT",code:"UNIT_OLD",display_name:"구호",is_active:0}
  ];
  const env={DB:{prepare(sql){return{bind(...values){return{
    async first(){
      if(sql.includes("WHERE id=?1"))return rows.find(row=>row.id===values[0]&&row.site_id===values[1]&&row.location_type===values[2]&&row.is_active===1)||null;
      return rows.find(row=>row.site_id===values[0]&&row.location_type===values[1]&&row.code===values[2])||null
    },
    async run(){rows.push({id:values[0],site_id:values[1],location_type:values[2],code:values[3],display_name:values[4],is_active:1})}
  }}}}}};
  assert.equal((await resolveIssueLocation(env,"site-a",{id:"site-a-unit-1",type:"UNIT"})).id,"site-a-unit-1");
  for(const id of ["missing-unit","site-b-unit-1","site-a-unit-old"])await assert.rejects(()=>resolveIssueLocation(env,"site-a",{id,type:"UNIT"}),error=>error.status===400);
  const first=await resolveIssueLocation(env,"site-a",{label:"1402호",type:"UNIT",allowDynamic:true});
  const second=await resolveIssueLocation(env,"site-a",{label:"1402호",type:"UNIT",allowDynamic:true});
  assert.equal(first.id,second.id);
  assert.equal(rows.filter(row=>row.site_id==="site-a"&&row.display_name==="1402호").length,1);
});

test("photo editor and collapsed list contracts are wired",()=>{
  const ui=read("apps/web/assets/issues.js"),css=read("apps/web/assets/issues.css");
  for(const token of ["동그라미","화살표","직선","자유펜","실행 취소","전체 지우기","issue-expand","다시 접기","상세 작업 열기"])assert.match(ui,new RegExp(token));
  assert.match(css,/touch-action:none/);
  assert.match(css,/issue-card-collapsed/);
});

test("collapsed Issue rows stay two-line, photo-free, and location-free",()=>{
  const ui=read("apps/web/assets/issues.js"),css=read("apps/web/assets/issues.css");
  const cardSource=ui.slice(ui.indexOf("const card="),ui.indexOf("async function expandCard"));
  for(const token of ["issue-compact-primary","issue-compact-secondary","compact-assignee","compact-classification"])assert.match(cardSource,new RegExp(token));
  assert.doesNotMatch(cardSource,/issue\.location|<img/);
  assert.match(ui,/const compactTitle=/);
  assert.match(css,/issue-compact-primary\{grid-template-columns:auto minmax\(0,1fr\) auto/);
  assert.match(css,/issue-compact-secondary\{grid-template-columns:minmax\(0,1fr\) auto 48px/);
  assert.match(css,/issue-compact-secondary \.issue-expand\{width:44px/);
});

test("mobile shell header separates brand and site-user context",()=>{
  const shell=read("apps/web/assets/app.js"),css=read("apps/web/assets/app.css");
  for(const token of ["GUI's Arc","header-user","site-selector","logout"])assert.match(shell,new RegExp(token));
  assert.doesNotMatch(shell,/mobile-user-menu/);
  assert.match(css,/@media\(max-width:760px\)\{\.top-header\{height:72px;display:grid/);
  assert.match(css,/grid-template-rows:30px 34px/);
  assert.match(css,/\.layout\{padding-top:72px\}/);
});

test("v0.21.0 mobile Issue flow keeps only photo location and content before assignment",()=>{
  const ui=read("apps/web/assets/issues.js"),css=read("apps/web/assets/issues.css"),flow=ui.slice(ui.indexOf("async function createV3"),ui.indexOf("async function createV2"));
  assert.doesNotMatch(flow,/name="floor"/);
  assert.doesNotMatch(flow,/name="contractorCompanyId"|name="tradeCode"|name="assigneeUserId"|name="categoryCode"/);
  for(const token of ["사진 촬영","파일 선택","직접 입력","name=\"description\"","이슈 등록","UNCLASSIFIED","ISSUE_LOCATION"])assert.ok((flow+worker).includes(token));
  assert.match(flow,/payload\.set\("floorLocationId",""\)/);
  assert.match(flow,/join\(" \/ "\)/);
  assert.match(ui,/업체·공종·담당자 배정/);
  assert.match(ui,/업체 미배정/);
  assert.match(worker,/Issue created without assignment/);
  assert.doesNotMatch(worker,/ISSUE_COMPANY_REQUIRED/);
  for(const token of ["issue-image-viewer","touch-action:pinch-zoom","max-width:100%","pointer-events:auto"])assert.match(ui+css,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
});

test("location management and multi-trade schema preserve audit and history",()=>{
  const db=database();
  db.exec("INSERT INTO companies(id,name,status) VALUES('company','Company','ACTIVE'); INSERT INTO sites(id,company_id,name,status) VALUES('site','company','Site','ACTIVE')");
  db.exec(read("database/migrations/0006_issue_location_entities.sql"));
  db.exec(read("database/migrations/0007_issue_mobile_flow.sql"));
  assert.ok(db.prepare("SELECT 1 FROM permissions WHERE code='issue.manage_locations'").get());
  assert.ok(db.prepare("SELECT 1 FROM company_site_contract_trades WHERE trade_code='DIRECT' AND status='ACTIVE'").get());
  for(const token of ["ISSUE_LOCATION_CREATED","ISSUE_LOCATION_DEACTIVATED","ISSUE_LOCATION_DELETED","ISSUE_CONTRACT_TRADES_UPDATED"])assert.match(worker,new RegExp(token));
});

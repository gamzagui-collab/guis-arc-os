import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { assignmentWithinScope, ISSUE_SCOPE, issueWithinScope, resolveIssueScope } from "../worker/modules/issue-policy.js";
import {canonicalLocationId,extractLocationSpeech,naturalLocationSort} from "../apps/web/assets/issue-speech.js";
import {filterIssueLocationOptions,isIssueRoomFormPresetHidden,isIssueBuildingFormPresetHidden,isIssueUnitRequired,resolveIssueLocation,sortIssueLocationOptions,validateIssueLocationSelection} from "../worker/modules/issues.js";

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

test("Data Ownership and runtime agree Issue is implemented and READY", () => {
  const ownership = read("docs/03_DATA_OWNERSHIP.md"), matrix = JSON.parse(read("docs/08_VERSION_MATRIX.json")), index = read("worker/index.js");
  assert.match(ownership, /Issue[^\n]*IMPLEMENTED/);
  assert.doesNotMatch(ownership, /Issue[^\n]*NOT_IMPLEMENTED/);
  assert.equal(matrix.modules.issue, "READY");
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
  for(const label of ["전체","이슈 등록","미조치","완료 확인","완료","통계","담당자 지정","조치","완료 요청","재조치","취소"])assert.match(ui,new RegExp(label));
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

test("speech extracts only explicit room vocabulary and does not promote arbitrary content",()=>{
  assert.equal(extractLocationSpeech("주차장 슬래브 청소").roomLabel,"슬래브");
  assert.equal(extractLocationSpeech("2동 101호 거실 벽면 보수").roomLabel,"거실");
  assert.equal(extractLocationSpeech("주차장 깨끗하게 청소해주세요").roomLabel,null);
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
  const db=database();
  db.exec("PRAGMA foreign_keys=ON; INSERT INTO companies(id,name,status) VALUES('company-a','A','ACTIVE'),('company-b','B','ACTIVE'); INSERT INTO sites(id,company_id,name,status) VALUES('site-a','company-a','A','ACTIVE'),('site-b','company-b','B','ACTIVE');");
  db.exec(read("database/migrations/0006_issue_location_entities.sql"));
  const env={DB:{prepare(sql){let values=[];return{bind(...next){values=next;return this},async first(){return db.prepare(sql).get(...values)||null},async run(){return db.prepare(sql).run(...values)}}}}};
  const building=db.prepare("SELECT id FROM site_locations WHERE site_id='site-a' AND code='BUILDING_1'").get().id;
  const canonical=db.prepare("SELECT id FROM site_locations WHERE site_id='site-a' AND code='UNIT_1'").get().id;
  const otherSite=db.prepare("SELECT id FROM site_locations WHERE site_id='site-b' AND code='UNIT_1'").get().id;
  assert.equal((await resolveIssueLocation(env,"site-a",{id:canonical,type:"UNIT"})).id,canonical);
  for(const id of ["missing-unit",otherSite])await assert.rejects(()=>resolveIssueLocation(env,"site-a",{id,type:"UNIT"}),error=>error.status===400);
  const first=await resolveIssueLocation(env,"site-a",{label:"1402호",type:"UNIT",parentId:building,allowDynamic:true});
  const second=await resolveIssueLocation(env,"site-a",{label:"1402호",type:"UNIT",parentId:building,allowDynamic:true});
  assert.equal(first.id,second.id);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM site_locations WHERE site_id='site-a' AND display_name='1402호' AND parent_id=?").get(building).count,1);
  db.close();
});

test("location metadata is optional while canonical parent scope stays enforced",()=>{
  assert.equal(isIssueUnitRequired("BUILDING"),true);
  assert.equal(isIssueUnitRequired("COMMERCIAL"),true);
  for(const type of ["PARKING","COMMON","FACILITY","EXTERIOR","OTHER"]){
    assert.equal(isIssueUnitRequired(type),false,type);
    assert.doesNotThrow(()=>validateIssueLocationSelection({building:{location_type:type},unit:null}));
  }
  assert.doesNotThrow(()=>validateIssueLocationSelection({building:{id:"building",location_type:"BUILDING"},unit:null}));
  assert.doesNotThrow(()=>validateIssueLocationSelection({building:{id:"commercial",location_type:"COMMERCIAL"},unit:null}));
  assert.doesNotThrow(()=>validateIssueLocationSelection({building:null,floor:null,unit:null,room:null}));
  assert.throws(()=>validateIssueLocationSelection({building:{id:"building"},floor:{id:"floor",parent_id:"other"}}),error=>error.code==="ISSUE_FLOOR_SCOPE_INVALID");
});

test("form option filter hides legacy residential BUILDING_1~15 presets",()=>{
  const rows=[
    {location_type:"BUILDING",code:"BUILDING_1",display_name:"1동",id:"building-1"},
    {location_type:"BUILDING",code:"BUILDING_15",display_name:"15동",id:"building-15"},
    {location_type:"BUILDING",code:"BUILDING_16",display_name:"16동",id:"building-16"},
    {location_type:"PARKING",code:"PARKING_B1",display_name:"주차장 B1",id:"parking-b1"},
    {location_type:"FACILITY",code:"COMMUNITY",display_name:"커뮤니티",id:"community"},
    {location_type:"COMMON",code:"COMMON",display_name:"공용",id:"common"},
    {location_type:"BUILDING",code:"DYNAMIC_BUILDING_TEMP",display_name:"임시동",id:"dynamic-building"},
    {location_type:"BUILDING",code:"CUSTOM_BUILDING_CUSTOM",display_name:"직접동",id:"custom-building"},
  ];
  const filtered=filterIssueLocationOptions(rows);
  assert.equal(filtered.length,6);
  assert.ok(!filtered.find(row=>row.code==="BUILDING_1"));
  assert.ok(!filtered.find(row=>row.code==="BUILDING_15"));
  assert.ok(filtered.find(row=>row.code==="BUILDING_16"));
  assert.equal(filtered.find(row=>row.code==="DYNAMIC_BUILDING_TEMP")?.id,"dynamic-building");
  assert.equal(filtered.find(row=>row.code==="CUSTOM_BUILDING_CUSTOM")?.id,"custom-building");
  assert.ok(isIssueBuildingFormPresetHidden(rows[0]));
  assert.ok(!isIssueBuildingFormPresetHidden({location_type:"BUILDING",code:"DYNAMIC_BUILDING_TEMP"}));
  assert.ok(!isIssueBuildingFormPresetHidden({location_type:"BUILDING",code:"CUSTOM_BUILDING_CUSTOM"}));
});

test("form options keep non-residential building presets and existing issue detail rows remain valid",()=>{
  const rows=[
    {location_type:"PARKING",code:"PARKING_B1",display_name:"주차장 B1",id:"parking-b1"},
    {location_type:"FACILITY",code:"MECHANICAL",display_name:"기계실",id:"mechanical"},
    {location_type:"COMMON",code:"COMMON",display_name:"공용",id:"common"},
  ];
  const filtered=filterIssueLocationOptions(rows);
  assert.equal(filtered.map(row=>row.id).join(","),"parking-b1,mechanical,common");
});

test("form options hides common ROOM presets except preserved shared types and dynamic/custom",()=>{
  const rows=[
    {location_type:"ROOM",code:"LIVING",display_name:"거실",id:"room-living"},
    {location_type:"ROOM",code:"ENTRANCE",display_name:"현관",id:"room-entrance"},
    {location_type:"ROOM",code:"BEDROOM_1",display_name:"침실1",id:"room-bed-1"},
    {location_type:"ROOM",code:"COMMON_BATH",display_name:"공용욕실",id:"room-bath"},
    {location_type:"ROOM",code:"DRESS_ROOM",display_name:"드레스룸",id:"room-dress"},
    {location_type:"ROOM",code:"DYNAMIC_ROOM_BUILDING_1",display_name:"임시룸",id:"room-dynamic"},
    {location_type:"ROOM",code:"CUSTOM_ROOM_001",display_name:"CUSTOM",id:"room-custom"},
    {location_type:"ROOM",code:"CORRIDOR",display_name:"복도",id:"room-corridor"},
    {location_type:"ROOM",code:"ROOM_ALL",display_name:"전체",id:"room-whole"},
  ];
  const filtered=filterIssueLocationOptions(rows);
  const ids=filtered.map(row=>row.id);
  assert.equal(ids.includes("room-living"),false);
  assert.equal(ids.includes("room-entrance"),false);
  assert.equal(ids.includes("room-bed-1"),false);
  assert.equal(ids.includes("room-bath"),false);
  assert.equal(ids.includes("room-dress"),false);
  assert.equal(ids.includes("room-dynamic"),true);
  assert.equal(ids.includes("room-custom"),true);
  assert.equal(ids.includes("room-corridor"),true);
  assert.equal(ids.includes("room-whole"),false);
  assert.ok(isIssueRoomFormPresetHidden({location_type:"ROOM",code:"BEDROOM_1"}));
  assert.ok(!isIssueRoomFormPresetHidden({location_type:"ROOM",code:"DYNAMIC_ROOM_BUILDING_1"}));
  assert.ok(!isIssueRoomFormPresetHidden({location_type:"ROOM",code:"CUSTOM_ROOM_001"}));
  assert.ok(isIssueRoomFormPresetHidden({location_type:"ROOM",code:"ROOM_ALL",display_name:"전체"}));
  assert.ok(!isIssueRoomFormPresetHidden({location_type:"ROOM",code:"CORRIDOR"}));
});

test("existing issue detail keeps hidden preset row ids",async()=>{
  const db=database();
  db.exec("PRAGMA foreign_keys=ON; INSERT INTO companies(id,name,status) VALUES('company-a','A','ACTIVE'); INSERT INTO sites(id,company_id,name,status) VALUES('site-a','company-a','Site A','ACTIVE');");
  db.exec(read("database/migrations/0006_issue_location_entities.sql"));
  const env={
    DB:{
      prepare(sql){
        let values=[];
        return {
          bind(...next){values=next;return this},
          async first(){return db.prepare(sql).get(...values)||null},
          async all(){return db.prepare(sql).all(...values)},
          async run(){return db.prepare(sql).run(...values)},
        };
      },
    },
  };
  const canonical=await resolveIssueLocation(env,"site-a",{id:db.prepare("SELECT id FROM site_locations WHERE site_id='site-a' AND code='BUILDING_1'").get().id,type:"BUILDING"});
  const roomCanonical=await resolveIssueLocation(env,"site-a", {id:db.prepare("SELECT id FROM site_locations WHERE site_id='site-a' AND code='LIVING'").get().id,type:"ROOM",parentId:canonical.id});
  assert.ok(canonical.id);
  assert.ok(roomCanonical.id);
  assert.equal(db.prepare("SELECT code FROM site_locations WHERE id=?").get(canonical.id).code,"BUILDING_1");
  assert.equal(db.prepare("SELECT code FROM site_locations WHERE id=?").get(roomCanonical.id).code,"LIVING");
  db.close();
});

test("new form options hide legacy numeric unit presets without changing canonical rows",()=>{
  const locations=[
    {id:"unit-1",location_type:"UNIT",code:"UNIT_1",display_name:"1호",parent_id:null},
    {id:"unit-10",location_type:"UNIT",code:"UNIT_10",display_name:"10호",parent_id:null},
    {id:"unit-101",location_type:"UNIT",code:"DYNAMIC_UNIT_BUILDING_A_101호",display_name:"101호",parent_id:"building-a"},
    {id:"room",location_type:"ROOM",code:"LIVING",display_name:"거실",parent_id:null}
  ];
  const filtered=filterIssueLocationOptions(locations);
  assert.deepEqual(filtered.filter(row=>row.location_type==="UNIT").map(row=>row.id),["unit-101"]);
  assert.equal(locations.length,4,"filtering must not mutate or delete canonical rows");
});

test("location option labels use Korean numeric natural sort without changing IDs",()=>{
  const values=["1203호","301호","B102호","102호","B101호","201호","101호","103호"].map((display_name,index)=>({id:`id-${index}`,display_name}));
  const sorted=[...values].sort(naturalLocationSort);
  assert.deepEqual(sorted.map(value=>value.display_name),["101호","102호","103호","201호","301호","1203호","B101호","B102호"]);
  assert.deepEqual(new Set(sorted.map(value=>value.id)),new Set(values.map(value=>value.id)));
  assert.deepEqual(sortIssueLocationOptions(values).map(value=>value.display_name),sorted.map(value=>value.display_name));
});

test("dynamic units and whole-room options are scoped to their canonical parent",async()=>{
  const db=database();
  db.exec("PRAGMA foreign_keys=ON; INSERT INTO companies(id,name,status) VALUES('company','Company','ACTIVE'); INSERT INTO sites(id,company_id,name,status) VALUES('site','company','Site','ACTIVE');");
  db.exec(read("database/migrations/0006_issue_location_entities.sql"));
  const adapter={prepare(sql){let values=[];return{bind(...next){values=next;return this},async first(){return db.prepare(sql).get(...values)||null},async run(){return db.prepare(sql).run(...values)}}}};
  const buildingA=db.prepare("SELECT id FROM site_locations WHERE site_id='site' AND code='BUILDING_1'").get().id;
  const buildingB=db.prepare("SELECT id FROM site_locations WHERE site_id='site' AND code='BUILDING_2'").get().id;
  const unitA1=await resolveIssueLocation({DB:adapter},"site",{label:"101호",type:"UNIT",parentId:buildingA,allowDynamic:true});
  const unitA2=await resolveIssueLocation({DB:adapter},"site",{label:"101호",type:"UNIT",parentId:buildingA,allowDynamic:true});
  const unitB=await resolveIssueLocation({DB:adapter},"site",{label:"101호",type:"UNIT",parentId:buildingB,allowDynamic:true});
  assert.equal(unitA1.id,unitA2.id);
  assert.notEqual(unitA1.id,unitB.id);
  assert.equal(db.prepare("SELECT parent_id FROM site_locations WHERE id=?").get(unitA1.id).parent_id,buildingA);
  const wholeA1=await resolveIssueLocation({DB:adapter},"site",{label:"전체",type:"ROOM",parentId:unitA1.id,allowDynamic:true});
  const wholeA2=await resolveIssueLocation({DB:adapter},"site",{label:"전체",type:"ROOM",parentId:unitA1.id,allowDynamic:true});
  const wholeB=await resolveIssueLocation({DB:adapter},"site",{label:"전체",type:"ROOM",parentId:unitB.id,allowDynamic:true});
  assert.equal(wholeA1.id,wholeA2.id);
  assert.notEqual(wholeA1.id,wholeB.id);
  assert.equal(db.prepare("SELECT parent_id FROM site_locations WHERE id=?").get(wholeA1.id).parent_id,unitA1.id);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM site_locations WHERE location_type='ROOM' AND display_name='전체' AND parent_id IS NULL").get().count,0);
  await assert.rejects(()=>resolveIssueLocation({DB:adapter},"site",{label:"1호",type:"UNIT",parentId:buildingA,allowDynamic:true}),error=>error.code==="ISSUE_UNIT_PRESET_DISALLOWED");
  db.close();
});

test("new Issue UI applies one canonical lookup-only policy for direct and Today source routes",()=>{
  const ui=read("apps/web/assets/issues.js"),flow=ui.slice(ui.indexOf("async function createV3"),ui.indexOf("async function detail"));
  assert.match(flow,/name="floor"/);
  assert.doesNotMatch(flow,/name="area" required/);
  assert.match(flow,/locationOptions\(locations\.buildings,[^\n]+natural:false/);
  assert.match(worker,/floors:byType\("FLOOR"\)/);
  assert.match(flow,/locationOptions\(locations\.units/);
  assert.match(flow,/name="detailLocation"/);
  assert.doesNotMatch(flow,/name="building" required/);
  assert.match(flow,/unit\.required=false/);
  assert.match(flow,/buildDraftPayloadView\(issueDraft\)/);
  assert.doesNotMatch(flow,/unitOther|areaOther|value="DIRECT"|payload\.set\("(?:building|floor|unit|room)Label"/);
  assert.match(flow,/floorLocationId/);
  assert.match(flow,/sourcePayload=data\.sourceContext/);
  assert.match(flow,/입력한 위치와 내용은 보존됩니다/);
  assert.doesNotMatch(flow.slice(flow.indexOf("catch(error)")),/form\.reset\(\)/);
});

test("speech parser separates a candidate from editable Draft detail and content",()=>{const ui=read("apps/web/assets/issues.js"),createFlow=ui.slice(ui.indexOf("async function createV3"),ui.indexOf("async function detail")),onresult=createFlow.slice(createFlow.indexOf("recognition.onresult"),createFlow.indexOf("recognition.onerror"));assert.match(createFlow,/extractLocationSpeech\(rawTranscript/);assert.match(createFlow,/finalizeIssueSpeechCandidates\(rawParsed,resolution\)/);assert.doesNotMatch(onresult,/currentLocationParentId|addAndSelect|form\.elements\.area\.value|description\.value=|detailLocation\.value=/);assert.match(onresult,/speechCandidate=makeSpeechCandidate\(rawTranscript\)/)})

test("standalone PWA launch emphasizes the existing camera action once without an automatic picker",()=>{
  const ui=read("apps/web/assets/issues.js"),css=read("apps/web/assets/issues.css"),flow=ui.slice(ui.indexOf("const PWA_CAMERA_LAUNCH_KEY"),ui.indexOf("const OFFLINE"));
  assert.match(flow,/window\.matchMedia\("\(display-mode: standalone\)"\)\.matches\|\|window\.navigator\.standalone===true/);
  assert.match(flow,/sessionStorage\.getItem\(PWA_CAMERA_LAUNCH_KEY\)/);
  assert.match(flow,/sessionStorage\.setItem\(PWA_CAMERA_LAUNCH_KEY,"1"\)/);
  assert.match(flow,/form\.elements\.description\?\.value\.trim\(\)/);
  assert.match(flow,/input\.files\?\.length/);
  assert.match(flow,/cameraAction\.classList\.add\("pwa-camera-ready"\)/);
  assert.match(flow,/cameraAction\.focus\(\{preventScroll:false\}\)/);
  assert.doesNotMatch(flow,/\.click\(|showPicker\(/);
  assert.match(ui,/focusPwaCameraFallback\(form\)/);
  assert.match(css,/\.camera-action\.pwa-camera-ready\{/);
});

test("SpeechRecognition body remains the established single-result flow",()=>{
  const ui=read("apps/web/assets/issues.js"),flow=ui.slice(ui.indexOf("async function createV3"),ui.indexOf("async function detail"));
  assert.match(flow,/const recognition=new SpeechRecognition\(\)/);
  assert.match(flow,/recognition\.lang="ko-KR"/);
  assert.match(flow,/recognition\.onresult=/);
  assert.match(flow,/recognition\.onend=\(\)=>voice\.disabled=false/);
  assert.match(flow,/recognition\.start\(\)/);
  assert.doesNotMatch(flow,/recognition\.stop|recognition\.abort|continuous\s*=|getUserMedia/);
});

test("photo editor and collapsed list contracts are wired",()=>{
  const ui=read("apps/web/assets/issues.js"),css=read("apps/web/assets/issues.css");
  for(const tool of ["circle","arrow","line","pen"])assert.match(ui,new RegExp(`data-edit-tool="${tool}"`));
  for(const token of ["issue-expand"])assert.match(ui,new RegExp(token));
  assert.match(css,/touch-action:none/);
  assert.match(css,/issue-card-collapsed/);
});

test("mobile photo editor defaults to NONE and preserves tool geometry contracts",()=>{
  const ui=read("apps/web/assets/issues.js"),css=read("apps/web/assets/issues.css"),editor=ui.slice(ui.indexOf("function bindPhotoEditor"),ui.indexOf("const locationOptions"));
  assert.doesNotMatch(ui,/edit-mode-toggle|edit-mode-status/);
  assert.match(editor,/mobileEditor=matchMedia\("\(max-width:760px\)"\)\.matches\|\|matchMedia\("\(pointer:coarse\)"\)\.matches/);
  assert.match(editor,/tool=mobileEditor\?"none":"circle"/);
  assert.match(editor,/if\(!original\|\|tool==="none"\)return;event\.preventDefault\(\);canvas\.setPointerCapture/);
  assert.match(editor,/setTool=next=>/);
  assert.match(editor,/button\.onclick=\(\)=>setTool\(button\.dataset\.editTool\)/);
  for(const tool of ["none","circle","rectangle","cloud","arrow","line","pen"])assert.match(ui,new RegExp(`data-edit-tool="${tool}"`));
  assert.match(editor,/ctx\.rect\(from\.x-Math\.abs\(dx\),from\.y-Math\.abs\(dy\),Math\.abs\(dx\)\*2,Math\.abs\(dy\)\*2\)/);
  assert.match(editor,/tool==="cloud"\)\{drawCloudPath\(ctx,from,to\)/);
  assert.match(editor,/ctx\.moveTo\(from\.x,from\.y\);ctx\.lineTo\(to\.x,to\.y\)/);
  assert.match(ui,/<option value="2">[^<]+<\/option><option value="10" selected>[^<]+<\/option><option value="18">[^<]+<\/option>/);
  assert.match(css,/\.photo-editor-wrap canvas\{touch-action:pan-y/);
  assert.match(css,/\.photo-editor-wrap\.drawing-enabled canvas\{touch-action:none/);
});

test("collapsed Issue rows stay lean, photo-free, and management-focused",()=>{
  const ui=read("apps/web/assets/issues.js"),css=read("apps/web/assets/issues.css");
  const cardSource=ui.slice(ui.indexOf("const card="),ui.indexOf("async function expandCard"));
  for(const token of ["issue-category","issue-management-summary","issueListShareAction","issue-expand"])assert.match(cardSource,new RegExp(token));
  assert.doesNotMatch(cardSource,/<img/);
  assert.match(ui,/const compactTitle=/);
  assert.match(css,/issue-compact-summary\{grid-template-columns:72px 92px 72px minmax\(0,1fr\) 92px 52px/);
  assert.match(css,/issue-management-summary[^}]*text-overflow:ellipsis/);
  assert.match(css,/issue-expand\{min-width:48px;min-height:44px/);
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
  const ui=read("apps/web/assets/issues.js"),css=read("apps/web/assets/issues.css"),flow=ui.slice(ui.indexOf("async function createV3"),ui.indexOf("async function detail"));
  assert.match(flow,/name="floor"/);
  assert.doesNotMatch(flow,/name="contractorCompanyId"|name="tradeCode"|name="assigneeUserId"|name="categoryCode"/);
  for(const token of ["사진 촬영","파일 선택","직접 입력","name=\"description\"","이슈 등록","UNCLASSIFIED","ISSUE_LOCATION"])assert.ok((flow+worker).includes(token));
  assert.match(flow,/payload\.set\("floorLocationId",draftPayload\.floorLocationId\)/);
  assert.match(flow,/setManualDetail\(issueDraft,detailLocation\.value\)/);
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
  for(const token of ["ISSUE_LOCATION_CREATED","ISSUE_LOCATION_DEACTIVATED","ISSUE_CONTRACT_TRADES_UPDATED"])assert.match(worker,new RegExp(token));
  assert.doesNotMatch(worker,/ISSUE_LOCATION_DELETED/);
});

test("resolveIssueLocation ROOM는 동일 building 기준 기존값 재사용 및 동적 생성",async()=>{
  const db=database();
  db.exec("PRAGMA foreign_keys=ON;");
  db.exec("INSERT INTO companies(id,name,status) VALUES('company-a','A','ACTIVE'),('company-b','B','ACTIVE'); INSERT INTO sites(id,company_id,name,status) VALUES('site-a','company-a','A','ACTIVE'),('site-b','company-b','B','ACTIVE');");
  db.exec(read("database/migrations/0006_issue_location_entities.sql"));
  const env={
    DB:{
      prepare(sql){
        let values=[];
        return {
          bind(...next){values=next;return this},
          async first(){return db.prepare(sql).get(...values)||null},
          async all(){return db.prepare(sql).all(...values)},
          async run(){return db.prepare(sql).run(...values)},
        };
      },
    },
  };
  const buildingA=db.prepare("SELECT id FROM site_locations WHERE site_id='site-a' AND code='BUILDING_1'").get().id;
  const buildingB=db.prepare("SELECT id FROM site_locations WHERE site_id='site-b' AND code='BUILDING_1'").get().id;
  const roomA1=await resolveIssueLocation(env,"site-a",{label:"벽돌쌓기",type:"ROOM",parentId:buildingA,allowDynamic:true});
  const roomA2=await resolveIssueLocation(env,"site-a",{label:"벽돌쌓기",type:"ROOM",parentId:buildingA,allowDynamic:true});
  const roomB=await resolveIssueLocation(env,"site-b",{label:"벽돌쌓기",type:"ROOM",parentId:buildingB,allowDynamic:true});
  assert.equal(roomA1.id,roomA2.id);
  assert.notEqual(roomA1.id,roomB.id);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM site_locations WHERE site_id='site-a' AND location_type='ROOM' AND display_name='벽돌쌓기' AND parent_id=?").get(buildingA).count,1);
  assert.equal(db.prepare("SELECT code FROM site_locations WHERE id=?").get(roomA1.id)?.code.slice(0,8),"DYNAMIC_");
  db.close();
});

test("createV3 omits the automatic whole-room placeholder from canonical payload",()=>{
  const ui=read("apps/web/assets/issues.js");
  const flow=ui.slice(ui.indexOf("async function createV3"),ui.indexOf("async function detail"));
  assert.match(flow,/payload\.set\("roomLocationId",draftPayload\.roomLocationId\)/);
  assert.doesNotMatch(flow,/areaLabel=.*"전체"|payload\.set\("roomLabel"/);
});

test("NONE allows scrolling and a selected tool enables drawing without changing desktop default",()=>{
 const ui=read("apps/web/assets/issues.js"),editor=ui.slice(ui.indexOf("function bindPhotoEditor"),ui.indexOf("const locationOptions"));assert.match(editor,/wrap\.classList\.toggle\("drawing-enabled",tool!=="none"\)/);assert.match(editor,/if\(!drawing\|\|tool==="none"\)return/);assert.match(editor,/setTool\(mobileEditor\?"none":"circle"\)/);
});
test("free-text detail remains independent from speech evidence collection",()=>{const ui=read("apps/web/assets/issues.js"),createFlow=ui.slice(ui.indexOf("async function createV3"),ui.indexOf("async function detail")),onresult=createFlow.slice(createFlow.indexOf("recognition.onresult"),createFlow.indexOf("recognition.onerror"));assert.match(createFlow,/name="detailLocation"/);assert.doesNotMatch(onresult,/speechRoomValue|form\.elements\.area/)})


test("annotation toolbar has a four-color accessible palette and cloud instead of ellipse",()=>{
 const ui=read("apps/web/assets/issues.js"),css=read("apps/web/assets/issues.css"),palette=ui.slice(ui.indexOf('class="editor-color-palette"'),ui.indexOf('class="editor-width-control"'));
 assert.equal((palette.match(/data-edit-color=/g)||[]).length,4);
 for(const [color,label] of [["#e11d2e","빨강"],["#f4cf22","노랑"],["#1769e0","파랑"],["#ffffff","흰색"]])assert.match(palette,new RegExp(`data-edit-color="${color}"[^>]*aria-label="${label}"`));
 assert.equal((palette.match(/aria-pressed="true"/g)||[]).length,1);assert.match(palette,/data-edit-color="#e11d2e"[^>]*aria-pressed="true"/);
 assert.doesNotMatch(ui,/<select id="edit-color"|#16a34a|#f97316|#7c3aed/);assert.match(ui,/color="#e11d2e"/);
 for(const tool of ["none","circle","rectangle","cloud","arrow","line","pen"])assert.match(ui,new RegExp(`data-edit-tool="${tool}"`));
 assert.doesNotMatch(ui,/data-edit-tool="ellipse"/);assert.match(ui,/drawCloudPath\(ctx,from,to\)/);
 assert.match(css,/\.editor-color-button\{[^}]*min-width:44px[^}]*min-height:44px/);assert.match(css,/\.editor-color-button\[aria-pressed="true"\]/);assert.match(css,/\.editor-color-button\[data-edit-color="#ffffff"\]/);
});

test("assignment trade labels use safe slash separators and preserve canonical option ids",()=>{
 const ui=read("apps/web/assets/issues.js"),css=read("apps/web/assets/issues.css");assert.match(ui,/const tradeOptionLabel=value=>/);assert.match(ui,/join\(" \/ "\)/);assert.equal((ui.match(/new Option\(tradeOptionLabel\(value\),value\.id\)/g)||[]).length,2);assert.doesNotMatch(ui,/value\.displayName} \? \$\{value\.path/);assert.match(css,/#assign select,#issue-bulk-form select\{min-width:0;max-width:100%;text-overflow:ellipsis\}/);
});

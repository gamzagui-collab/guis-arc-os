import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {DatabaseSync} from "node:sqlite";
import {resolveIssueScope,ISSUE_SCOPE} from "../worker/modules/issue-policy.js";
import {INTERNAL_TEST_PRINCIPALS} from "../worker/core/issue-e2e-provisioning.js";
import {createInternalTestCredentials,internalTestIdentifier,validateInternalTestPin} from "../scripts/internal-test-auth.mjs";
import {pinValidationError} from "../worker/core/pin-policy.js";

const read=path=>readFile(new URL(`../${path}`,import.meta.url),"utf8"),migration=await read("database/migrations/0028_internal_test_site.sql"),session=await read("worker/core/session.js"),worker=await read("worker/index.js"),ui=await read("apps/web/assets/app.js"),cli=await read("scripts/internal-test-manage.mjs"),fixture=await read("worker/core/issue-e2e-provisioning.js"),issues=await read("worker/modules/issues.js"),todayIssue=await read("worker/modules/today/providers/issue-provider.js"),workforce=await read("worker/modules/workforce.js");
const agents=await read("AGENTS.md"),rules=await read("DEVELOPMENT_RULES.md");

test("0028 classifies only sites and preserves existing rows",async()=>{
 const db=new DatabaseSync(":memory:");db.exec(await read("database/migrations/0001_core_foundation.sql"));
 db.exec("INSERT INTO companies(id,name) VALUES('gc','운영 원도급'); INSERT INTO sites(id,company_id,name) VALUES('op','gc','운영 현장'),('e2e-v021-site-a','gc','기존 E2E A'),('e2e-v021-site-b','gc','기존 E2E B'); INSERT INTO users(id,login_identifier,display_name,credential_hash,credential_salt,credential_iterations) VALUES('op-user','op','운영','h','s',1),('test-user','test','테스트','h','s',1),('master','master','마스터','h','s',1); INSERT INTO roles(id,code,name,rank) VALUES('master-role','INTEGRATED_OWNER','마스터',1000); INSERT INTO memberships(id,user_id,company_id,site_id) VALUES('op-membership','op-user','gc','op'),('test-membership','test-user','gc','e2e-v021-site-a'),('master-membership','master','gc','op'); INSERT INTO user_site_roles(id,user_id,role_id,company_id,site_id) VALUES('master-site-role','master','master-role','gc','op');");
 const before={sites:db.prepare("SELECT COUNT(*) count FROM sites").get().count,memberships:db.prepare("SELECT COUNT(*) count FROM memberships").get().count};db.exec(migration);
 assert.equal(db.prepare("SELECT purpose FROM sites WHERE id='op'").get().purpose,"OPERATIONAL");
 assert.deepEqual(db.prepare("SELECT purpose FROM sites WHERE id LIKE 'e2e-v021-site-%' ORDER BY id").all().map(row=>row.purpose),["INTERNAL_TEST","INTERNAL_TEST"]);
 assert.equal(db.prepare("SELECT COUNT(*) count FROM sites").get().count,before.sites);assert.equal(db.prepare("SELECT COUNT(*) count FROM memberships").get().count,before.memberships);
 assert.throws(()=>db.exec("INSERT INTO memberships(id,user_id,company_id,site_id) VALUES('bad-op','op-user','gc','e2e-v021-site-a')"),/MEMBERSHIP_SITE_PURPOSE_CONFLICT/);
 assert.throws(()=>db.exec("INSERT INTO memberships(id,user_id,company_id,site_id) VALUES('bad-test','test-user','gc','op')"),/MEMBERSHIP_SITE_PURPOSE_CONFLICT/);
 db.exec("INSERT INTO memberships(id,user_id,company_id,site_id) VALUES('master-test','master','gc','e2e-v021-site-a')");
 assert.equal(db.prepare("SELECT COUNT(*) count FROM memberships WHERE user_id='master'").get().count,2);
});

test("session and shell separate operational and internal test sites",()=>{
 for(const token of["site_purpose","selectedSitePurpose","s.status='ACTIVE'","approval_status===\"APPROVED\""])assert.ok(session.includes(token),token);
 for(const token of["운영 현장","개발 도구","내부 테스트 현장","실제 업무 데이터가 아닙니다.","internal-test-banner"])assert.ok(ui.includes(token),token);
 assert.match(ui,/selected\?\.company_name/);assert.doesNotMatch(ui,/memberships\[0\]\?\.company_name/);
 assert.match(worker,/MEMBERSHIP_SITE_PURPOSE_CONFLICT/);assert.match(worker,/JOIN sites s ON s\.id=m\.site_id/);
});

test("current site remains the server boundary for choices records and aggregates",()=>{
 for(const source of[issues,todayIssue,workforce])assert.match(source,/site_id=\?1|site_id:\?1|site_id=\?2/);
 for(const token of["assignableMembers(env,auth.siteId)","visibleCompanies(env,auth)","activeSite!==ctx.selectedSiteId","ISSUE_RECORD_SCOPE_DENIED"])assert.ok(issues.includes(token),token);
 assert.equal(resolveIssueScope(["PLATFORM_OWNER"]),ISSUE_SCOPE.SITE);
});

test("role fixtures map requested people to existing canonical roles",()=>{
 const expected={site_manager:"SITE_MANAGER",safety_manager:"SAFETY_MANAGER",construction_manager:"CONSTRUCTION_MANAGER",gc_foreman:"GENERAL_CONTRACTOR_FOREMAN",contractor_site_manager:"CONTRACTOR_SITE_MANAGER",contractor_foreman:"CONTRACTOR_FOREMAN",field_worker:"FIELD_WORKER",contractor_b_manager:"CONTRACTOR_MANAGER"};
 for(const [key,role] of Object.entries(expected))assert.equal(INTERNAL_TEST_PRINCIPALS[key].role,role);
 assert.equal(Object.keys(INTERNAL_TEST_PRINCIPALS).length,12);
});

test("internal test management is explicit idempotent-shaped and fail closed",()=>{
 for(const action of["PLAN","APPLY","SHOW","DISABLE","ENABLE"])assert.ok(fixture.includes(action),action);
 for(const token of["ON CONFLICT(id) DO UPDATE","physicalDelete:false","INTERNAL_TEST_FIXTURE_","E2E_PROVISIONING_ENABLED"])assert.ok((fixture+worker).includes(token),token);
 assert.doesNotMatch(fixture,/DELETE FROM (users|companies|sites|memberships)/);
 assert.match(cli,/Production target is forbidden/);assert.match(cli,/GUI_ARC_TARGET!=="integration"/);assert.match(cli,/GUI_ARC_INTERNAL_TEST_PIN/);assert.ok(!cli.includes("GUI_ARC_INTERNAL_TEST_PIN"+"S"));assert.doesNotMatch(cli,/console\.(log|error).*pin/i);
});

test("one common four digit PIN creates separate non-logged credentials for all accounts",()=>{
 let sequence=0;const credentials=createInternalTestCredentials("5827",size=>Buffer.alloc(size,++sequence));
 assert.equal(Object.keys(credentials).length,12);
 assert.equal(new Set(Object.values(credentials).map(value=>value.credentialSalt)).size,12);
 assert.equal(new Set(Object.values(credentials).map(value=>value.credentialHash)).size,12);
 assert.deepEqual(Object.values(credentials).map(value=>value.identifier),Array.from({length:12},(_,index)=>`0102408${String(index+1).padStart(4,"0")}`));
 assert.equal(internalTestIdentifier("site_manager"),"01024080001");
 const serialized=JSON.stringify({action:"APPLY",credentials});
 assert.doesNotMatch(serialized,/5827/);
 assert.equal(validateInternalTestPin("5827"),"5827");
 for(const invalid of["123","12345","12345678","abcd"])assert.throws(()=>validateInternalTestPin(invalid),/4자리/);
 for(const weak of["0000","1111","1234","4321","4567","7654"])assert.throws(()=>validateInternalTestPin(weak),/단순 PIN/);
 assert.equal(pinValidationError("5827"),null);
});

test("startup and development rules have one lean canonical source",()=>{
 for(const token of["위험도 기반 검증","최소 변경","공식 release checkpoint","Production"])assert.ok(rules.includes(token),token);
 for(const token of["AGENTS.md","VERSION.md","DEVELOPMENT_RULES.md","프로젝트 Skill"])assert.ok(agents.includes(token),token);
 assert.ok(agents.split(/\r?\n/).length<=50);
 assert.ok(rules.split(/\r?\n/).length<=80);
});

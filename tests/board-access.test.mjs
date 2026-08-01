import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {includesBoardAccess} from "../worker/core/board-access.js";
import {menuModulesForRoles,MODULES,MODULE_IMPLEMENTATION} from "../worker/core/permissions.js";

const read=file=>fs.readFileSync(file,"utf8");
const migration=read("database/migrations/0008_board_access.sql");
const admin=read("worker/modules/board-access-admin.js");
const issue=read("worker/modules/issues.js");
const workforce=read("worker/modules/workforce.js");
const session=read("worker/core/session.js");
const ui=read("apps/web/assets/board-access.js");

function database(){
 const db=new DatabaseSync(":memory:");
 for(const name of ["0001_core_foundation.sql","0002_issue_foundation.sql","0003_issue_operational_stabilization.sql","0004_workforce_foundation.sql","0005_issue_field_operational.sql","0006_issue_location_entities.sql","0007_issue_mobile_flow.sql"])db.exec(read(`database/migrations/${name}`));
 db.exec(`
 INSERT INTO companies(id,name) VALUES('company-a','Company A');
 INSERT INTO sites(id,company_id,name) VALUES('site-a','company-a','Site A'),('site-b','company-a','Site B');
 INSERT INTO users(id,login_identifier,display_name,credential_hash,credential_salt,credential_iterations) VALUES
 ('manager','manager@test','Manager','${"a".repeat(64)}','salt',100000),
 ('editor','editor@test','Editor','${"b".repeat(64)}','salt',100000),
 ('blocked','blocked@test','Blocked','${"c".repeat(64)}','salt',100000);
 INSERT INTO memberships(id,user_id,company_id,site_id) VALUES
 ('m1','manager','company-a','site-a'),('m2','editor','company-a','site-a'),('m3','blocked','company-a','site-a');
 INSERT INTO user_site_roles(id,user_id,role_id,company_id,site_id) VALUES
 ('ur1','manager','role-site-manager','company-a','site-a'),
 ('ur2','editor','role-general-contractor-staff','company-a','site-a'),
 ('ur3','blocked','role-no-issue-access','company-a','site-a');
 INSERT INTO module_entitlements(id,user_id,module_code) VALUES
 ('me1','manager','issue'),('me2','editor','issue'),('me3','blocked','issue');
 `);
 db.exec(migration);
 return db;
}

test("board access migration creates canonical active boards and safe initial grants",()=>{
 const db=database();
 assert.equal(db.prepare("SELECT COUNT(*) count FROM board_definitions WHERE is_active=1").get().count,3);
 assert.equal(db.prepare("SELECT access_level FROM board_access_grants g JOIN board_definitions b ON b.id=g.board_id WHERE user_id='manager' AND board_key='ISSUE' AND g.is_active=1").get().access_level,"MANAGE");
 assert.equal(db.prepare("SELECT access_level FROM board_access_grants g JOIN board_definitions b ON b.id=g.board_id WHERE user_id='editor' AND board_key='ISSUE' AND g.is_active=1").get().access_level,"EDIT");
 assert.equal(db.prepare("SELECT COUNT(*) count FROM board_access_grants WHERE user_id='blocked' AND is_active=1").get().count,0);
 assert.throws(()=>db.exec("INSERT INTO board_access_grants(id,site_id,board_id,user_id,access_level) VALUES('duplicate','site-a','board-issue','editor','VIEW')"),/UNIQUE/);
 db.close();
});

test("access levels preserve VIEW inclusion and separate EDIT and MANAGE",()=>{
 assert.equal(includesBoardAccess("VIEW","VIEW"),true);
 assert.equal(includesBoardAccess("VIEW","EDIT"),false);
 assert.equal(includesBoardAccess("EDIT","VIEW"),true);
 assert.equal(includesBoardAccess("EDIT","EDIT"),true);
 assert.equal(includesBoardAccess("EDIT","MANAGE"),false);
 assert.equal(includesBoardAccess("MANAGE","EDIT"),true);
 assert.equal(includesBoardAccess(undefined,"VIEW"),false);
});

test("all implemented board APIs enforce common access in addition to business scope",()=>{
 assert.match(issue,/requireBoardAccess[\s\S]*BOARD_KEYS\.ISSUE/);
 assert.match(workforce,/requireBoardAccess[\s\S]*workforceBoardKey/);
 assert.match(session,/boardAccessForUser/);
 for(const token of ["BOARD_ACCESS_DENIED","SITE_SCOPE_DENIED","ISSUE_RECORD_SCOPE_DENIED"])assert.ok((issue+workforce+read("worker/core/board-access.js")).includes(token));
 assert.doesNotMatch(issue+workforce,/ISSUE_PERMISSION_DENIED|WORKFORCE_PERMISSION_DENIED/);
});

test("board administration is site scoped, revision checked, audited and atomic",()=>{
 for(const token of ["authenticate(request,env,{csrf:write})","CONTEXT_VERSION_STALE","BOARD_ACCESS_SITE_DENIED","BOARD_ACCESS_REVISION_STALE","BOARD_ACCESS_MANAGER_TARGET_DENIED","env.DB.batch","BOARD_ACCESS_CHANGED","BOARD_ACCESS_BATCH_FAILED"])assert.match(admin,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
 assert.doesNotMatch(admin,/birth_date|credential_hash|credential_salt/i);
 assert.match(admin,/phone_last4/);
 assert.match(migration,/WHERE is_active=1/);
});

test("management UI supports company-role browsing, batch levels, copy and role defaults",()=>{
 for(const token of ["이름 검색","권한 없음","열람","수정","관리","/batch","회사 전체 선택","회사 유형 전체","권한 복사","변경 비교","기본 권한 적용"])assert.ok(ui.includes(token));
 assert.match(admin,/WHERE b\.is_active=1/);
 assert.doesNotMatch(ui,/CONSTRUCTION|SAFETY|QUALITY|MATERIALS|EQUIPMENT|DOCUMENTS/);
});

test("v0.6.2 board access APIs support grouped users, atomic batch, copy preview and role defaults",()=>{
 for(const route of ["/users","/batch","/copy","/apply-default"])assert.ok(admin.includes(route));
 for(const token of ["phone_last4","company_type","role_codes","permissionSummary","REPLACE_ALL","REPLACE_SELECTED","ADD_ONLY","dryRun","ROLE_DEFAULTS","BOARD_ACCESS_COPIED","BOARD_ROLE_DEFAULT_APPLIED"])assert.ok(admin.includes(token));
 assert.match(admin,/UPDATE sessions SET context_version=context_version\+1/);
 assert.doesNotMatch(admin,/login_identifier[^,\n]*return|credential_hash|credential_salt|birth_date/);
});

test("manager menu skeleton is separate from persisted board access",()=>{
 assert.deepEqual(menuModulesForRoles(["today","issue"],["INTEGRATED_OWNER"]),MODULES);
 assert.deepEqual(menuModulesForRoles(["today","workforce"],["SITE_MANAGER"]),MODULES);
 assert.deepEqual(menuModulesForRoles(["today","issue"],["CONTRACTOR_EMPLOYEE"]),["today","issue"]);
 assert.equal(MODULE_IMPLEMENTATION.construction,"READY");
 assert.equal(MODULE_IMPLEMENTATION.workforce,"READY");
 assert.match(read("apps/web/assets/app.js"),/moduleState==="PLANNED"/);
 assert.match(read("apps/web/assets/app.js"),/현재 준비 중인 기능입니다/);
});

test("manager grant repair is explicit, audited, and future-safe",()=>{
 const repair=read("database/migrations/0012_manager_board_grants.sql");
 for(const token of ["BOARD_MANAGER_GRANT_REPAIRED","PLATFORM_OWNER","INTEGRATED_OWNER","SITE_MANAGER","board_grants_after_manager_role_insert","board_grants_after_definition_insert","board_grants_after_definition_activation"])assert.match(repair,new RegExp(token));
 assert.doesNotMatch(session,/if.*MASTER.*return|bypass/i);
});

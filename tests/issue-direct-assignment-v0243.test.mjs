import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {DatabaseSync} from "node:sqlite";

const worker=await readFile(new URL("../worker/modules/issues.js",import.meta.url),"utf8");
const ui=await readFile(new URL("../apps/web/assets/issues.js",import.meta.url),"utf8");
const migration=await readFile(new URL("../database/migrations/0027_issue_assignment_type.sql",import.meta.url),"utf8");

test("v0.24.3 migration separates contractor direct and unassigned without inventing direct rows",()=>{
 assert.match(migration,/assignment_type TEXT NOT NULL DEFAULT 'UNASSIGNED'/);
 assert.match(migration,/CHECK\(assignment_type IN \('CONTRACTOR','DIRECT','UNASSIGNED'\)\)/);
 assert.match(migration,/WHERE contractor_company_id IS NOT NULL/);
 assert.doesNotMatch(migration,/SET assignment_type='DIRECT'/);
});

test("v0.24.3 migration preserves rows and deterministically classifies legacy assignments",async()=>{
 const db=new DatabaseSync(":memory:");db.exec(await readFile(new URL("../database/migrations/0001_core_foundation.sql",import.meta.url),"utf8"));
 db.exec("INSERT INTO companies(id,name) VALUES('gc','원도급사'),('sub','협력업체'); INSERT INTO sites(id,company_id,name) VALUES('site','gc','현장'); INSERT INTO users(id,login_identifier,display_name,credential_hash,credential_salt,credential_iterations) VALUES('user','u','사용자','h','s',1);");
 db.exec(await readFile(new URL("../database/migrations/0002_issue_foundation.sql",import.meta.url),"utf8"));
 db.exec("INSERT INTO issue_items(id,site_id,created_by_user_id,created_by_name_snapshot,contractor_company_id,title,location_text,description,category_code) VALUES('contractor','site','user','사용자','sub','업체 이슈','현장','내용','CONSTRUCTION'),('empty','site','user','사용자',NULL,'빈 이슈','현장','내용','CONSTRUCTION');");
 db.exec(migration);const rows=db.prepare("SELECT id,assignment_type FROM issue_items ORDER BY id").all().map(row=>({...row}));
 assert.deepEqual(rows,[{id:"contractor",assignment_type:"CONTRACTOR"},{id:"empty",assignment_type:"UNASSIGNED"}]);
});

test("v0.24.3 direct assignment uses site GC members and active site trades",()=>{
 assert.match(worker,/SELECT s\.company_id,c\.name FROM sites s/);
 assert.match(worker,/assignableMembers\(env,siteId,site\.company_id\)/);
 assert.match(worker,/ISSUE_DIRECT_TRADE_INVALID/);
 assert.match(worker,/ISSUE_DIRECT_ASSIGNEE_INVALID/);
 assert.match(worker,/auth\.companyId!==direct\.companyId/);
});

test("v0.24.3 single and bulk APIs persist and audit explicit assignment type",()=>{
 assert.match(worker,/SET assignment_type=\?2,contractor_company_id=\?3/);
 assert.match(worker,/before=\{assignmentType:/);
 assert.match(worker,/after=\{assignmentType/);
 assert.match(worker,/ISSUE_ASSIGNMENT_CHANGED/);
 assert.match(worker,/ISSUE_BULK_ITEM_UPDATED/);
});

test("v0.24.3 UI exposes Korean direct unassigned controls and assignment filter",()=>{
 assert.match(ui,/<option value="DIRECT">직영<\/option>/);
 assert.match(ui,/<option value="UNASSIGNED">미배정<\/option>/);
 assert.match(ui,/new Option\("직영","__DIRECT__"\)/);
 assert.match(ui,/new Option\("미배정","__UNASSIGNED__"\)/);
 assert.match(ui,/원도급 담당자로 다시 선택하거나 정리/);
});

test("v0.24.3 mobile quick registration remains unassigned by default",()=>{
 assert.match(worker,/assignmentType=contractor\?"CONTRACTOR":"UNASSIGNED"/);
 assert.match(worker,/assignmentType,contractor/);
});

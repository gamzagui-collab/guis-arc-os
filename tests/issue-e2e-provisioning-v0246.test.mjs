import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {createInternalTestCredentials} from "../scripts/internal-test-auth.mjs";
import {ensureCompanySiteContract,provisionIssueE2EFixture} from "../worker/core/issue-e2e-provisioning.js";

const credentials=()=>{let sequence=0;return createInternalTestCredentials("5827",size=>Buffer.alloc(size,++sequence))};

function database(){
 const sqlite=new DatabaseSync(":memory:");
 sqlite.exec("PRAGMA foreign_keys=ON");
 for(const name of fs.readdirSync("database/migrations").filter(name=>name.endsWith(".sql")).sort())sqlite.exec(fs.readFileSync(`database/migrations/${name}`,"utf8"));
 return sqlite;
}

function d1(sqlite,{failAt=0}={}){
 const wrap=(sql,values=[])=>({
  bind(...next){return wrap(sql,next)},
  async all(){return {results:sqlite.prepare(sql).all(...values)}},
  async first(){return sqlite.prepare(sql).get(...values)||null},
  run(){return sqlite.prepare(sql).run(...values)}
 });
 return {
  prepare(sql){return wrap(sql)},
  async batch(statements){
   sqlite.exec("BEGIN");
   try{for(const [index,statement] of statements.entries()){if(failAt===index+1)throw new Error("INJECTED_BATCH_FAILURE");statement.run()}sqlite.exec("COMMIT")}
   catch(error){sqlite.exec("ROLLBACK");throw error}
  }
 };
}

const count=(db,table,where="1=1")=>db.prepare(`SELECT COUNT(*) count FROM ${table} WHERE ${where}`).get().count;

test("fresh DB creates desired contracts and all downstream relations",async()=>{
 const sqlite=database(),result=await provisionIssueE2EFixture(d1(sqlite),{credentials:credentials()},"fresh");
 assert.deepEqual(result.contracts,{general:"e2e-v021-contract-gc",contractorA:"e2e-v021-contract-a",contractorB:"e2e-v021-contract-b"});
 for(const id of Object.values(result.contracts))assert.equal(count(sqlite,"company_site_contracts",`id='${id}'`),1);
 assert.equal(count(sqlite,"company_site_contract_trades","site_contract_id IN ('e2e-v021-contract-gc','e2e-v021-contract-a','e2e-v021-contract-b')"),3);
 assert.equal(sqlite.prepare("SELECT site_contractor_id FROM workforce_site_enrollments WHERE id='e2e-v021-workforce-enrollment'").get().site_contractor_id,result.contracts.contractorA);
 sqlite.close();
});

test("existing v0.21 GC contract is reused without duplicate or FK failure",async()=>{
 const sqlite=database();
 sqlite.exec("INSERT INTO companies(id,name,status,company_type) VALUES('e2e-v021-company','기존 원도급','ACTIVE','GENERAL_CONTRACTOR'); INSERT INTO sites(id,company_id,name,status,purpose) VALUES('e2e-v021-site-a','e2e-v021-company','기존 테스트 현장','ACTIVE','INTERNAL_TEST'); INSERT INTO company_site_contracts(id,company_id,site_id,contractor_type,trade_code,status) VALUES('gc-contract-e2e-v021-site-a','e2e-v021-company','e2e-v021-site-a','GENERAL_CONTRACTOR','DIRECT','ACTIVE');");
 const result=await provisionIssueE2EFixture(d1(sqlite),{credentials:credentials()},"existing");
 assert.equal(result.contracts.general,"gc-contract-e2e-v021-site-a");
 assert.equal(count(sqlite,"company_site_contracts","company_id='e2e-v021-company' AND site_id='e2e-v021-site-a'"),1);
 assert.equal(sqlite.prepare("SELECT site_contract_id FROM company_site_contract_trades WHERE id='e2e-v021-contract-trade-gc'").get().site_contract_id,"gc-contract-e2e-v021-site-a");
 sqlite.close();
});

test("applying twice is idempotent for fixture entities and relations",async()=>{
 const sqlite=database(),db=d1(sqlite),input={credentials:credentials()};
 await provisionIssueE2EFixture(db,input,"twice-1");
 sqlite.prepare("INSERT INTO board_access_grants(id,site_id,board_id,user_id,access_level,is_active) VALUES('historical-inactive-issue','e2e-v021-site-a','board-issue','e2e-v021-user-site-manager','VIEW',0)").run();
 sqlite.prepare("INSERT INTO module_entitlements(id,user_id,module_code,status) VALUES('stale-no-access-issue','e2e-v021-user-no-access','issue','ACTIVE')").run();
 sqlite.prepare("INSERT INTO board_access_grants(id,site_id,board_id,user_id,access_level,is_active) VALUES('stale-no-access-board','e2e-v021-site-a','board-issue','e2e-v021-user-no-access','VIEW',1)").run();
 sqlite.prepare("INSERT INTO user_site_roles(id,user_id,role_id,company_id,site_id,status) VALUES('stale-no-access-role','e2e-v021-user-no-access','role-general-contractor-staff','e2e-v021-company','e2e-v021-site-a','ACTIVE')").run();
 await provisionIssueE2EFixture(db,input,"twice-2");
 assert.deepEqual({companies:count(sqlite,"companies","id LIKE 'e2e-v021-%'"),sites:count(sqlite,"sites","id LIKE 'e2e-v021-site-%'"),contracts:count(sqlite,"company_site_contracts","company_id LIKE 'e2e-v021-%'"),users:count(sqlite,"users","id LIKE 'e2e-v021-user-%'"),memberships:count(sqlite,"memberships","user_id LIKE 'e2e-v021-user-%'"),trades:count(sqlite,"company_site_contract_trades","id LIKE 'e2e-v021-contract-trade-%'")},{companies:3,sites:2,contracts:3,users:12,memberships:13,trades:3});
 assert.equal(sqlite.prepare("SELECT is_active FROM board_access_grants WHERE id='historical-inactive-issue'").get().is_active,0);
 assert.equal(sqlite.prepare("SELECT status FROM module_entitlements WHERE id='stale-no-access-issue'").get().status,"INACTIVE");
 assert.equal(sqlite.prepare("SELECT is_active FROM board_access_grants WHERE id='stale-no-access-board'").get().is_active,0);
 assert.equal(sqlite.prepare("SELECT status FROM user_site_roles WHERE id='stale-no-access-role'").get().status,"INACTIVE");
 assert.equal(count(sqlite,"user_site_roles","user_id LIKE 'e2e-v021-user-%' AND status='ACTIVE'"),13);
 sqlite.close();
});

test("injected batch failure rolls back every fixture mutation",async()=>{
 const sqlite=database();
 await assert.rejects(()=>provisionIssueE2EFixture(d1(sqlite,{failAt:10}),{credentials:credentials()},"rollback"),/INJECTED_BATCH_FAILURE/);
 assert.equal(count(sqlite,"companies","id LIKE 'e2e-v021-%'"),0);assert.equal(count(sqlite,"users","id LIKE 'e2e-v021-user-%'"),0);
 sqlite.close();
});

test("fixture rejects an arbitrary phone identifier outside the fixed account mapping",async()=>{
 const sqlite=database(),input={credentials:credentials()};
 input.credentials.site_manager.identifier="01099999999";
 await assert.rejects(()=>provisionIssueE2EFixture(d1(sqlite),input,"bad-identifier"),/E2E_FIXTURE_IDENTIFIER_INVALID/);
 assert.equal(count(sqlite,"users","id LIKE 'e2e-v021-user-%'"),0);
 sqlite.close();
});

test("ambiguous natural key and OPERATIONAL site fail closed in Korean",async()=>{
 const ambiguous={prepare(sql){return{bind(){return sql.startsWith("SELECT purpose")?{first:async()=>({purpose:"INTERNAL_TEST"})}:{all:async()=>({results:[{id:"a"},{id:"b"}]})}}}}};
 await assert.rejects(()=>ensureCompanySiteContract(ambiguous,{desiredId:"new",companyId:"company",siteId:"site"}),/계약이 여러 개/);
 const operational={prepare(sql){return{bind(){return sql.startsWith("SELECT purpose")?{first:async()=>({purpose:"OPERATIONAL"})}:{all:async()=>({results:[]})}}}}};
 await assert.rejects(()=>ensureCompanySiteContract(operational,{desiredId:"new",companyId:"company",siteId:"site"}),/운영 현장/);
});

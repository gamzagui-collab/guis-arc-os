import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {countEffectiveActiveLocations,loadEffectiveIssueLocations} from "../worker/modules/location-master-policy.js";

const envFor=db=>({DB:{prepare(sql){return{bind(...args){return{async first(){return db.prepare(sql).get(...args)||null},async all(){return{results:db.prepare(sql).all(...args)}}}}}}}});

function fixture(){
  const db=new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE site_location_imports(id TEXT,site_id TEXT,status TEXT);
    CREATE TABLE site_locations(id TEXT,site_id TEXT,location_type TEXT,code TEXT,display_name TEXT,parent_id TEXT,sort_order INTEGER,source TEXT,is_active INTEGER);
    INSERT INTO site_locations VALUES
      ('legacy-47','site-a','FLOOR','FLOOR_47','47층',NULL,47,'LEGACY',1),
      ('import-1','site-a','FLOOR','FLOOR_1','1층','building',1,'IMPORT',1),
      ('inactive-import','site-a','FLOOR','FLOOR_2','2층','building',2,'IMPORT',0),
      ('foreign','site-b','FLOOR','FLOOR_50','50층',NULL,50,'LEGACY',1);
  `);
  return db;
}

test("legacy compatibility remains until a successful APPLIED import exists",async()=>{
  const db=fixture(),env=envFor(db);
  assert.deepEqual((await loadEffectiveIssueLocations(env,"site-a")).map(row=>row.id),["import-1","legacy-47"]);
  assert.equal(await countEffectiveActiveLocations(env,"site-a"),2);
  for(const status of ["UPLOADED","INVALID","READY","FAILED","APPLYING"]){
    db.prepare("INSERT INTO site_location_imports VALUES(?,?,?)").run(`import-${status}`,"site-a",status);
    assert.equal((await loadEffectiveIssueLocations(env,"site-a")).some(row=>row.id==="legacy-47"),true,status);
  }
  db.close();
});

test("APPLIED import cuts Issue options and summary over to active IMPORT rows only",async()=>{
  const db=fixture(),env=envFor(db);
  db.prepare("INSERT INTO site_location_imports VALUES('applied','site-a','APPLIED')").run();
  assert.deepEqual((await loadEffectiveIssueLocations(env,"site-a")).map(row=>row.id),["import-1"]);
  assert.equal(await countEffectiveActiveLocations(env,"site-a"),1);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM site_locations WHERE id='legacy-47'").get().count,1);
  db.close();
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {aggregateMajorWorks} from "../worker/modules/today/providers/construction-provider.js";

const migrationPath="database/migrations/0033_field_adoption_phase1.sql";

test("v0.27.0 field adoption migration exists",()=>{
 assert.equal(fs.existsSync(migrationPath),true,"0033_field_adoption_phase1.sql must define the approved persistence contract");
});

const database=()=>{
 const db=new DatabaseSync(":memory:");
 for(const file of fs.readdirSync("database/migrations").filter(name=>name.endsWith(".sql")).sort())db.exec(fs.readFileSync(`database/migrations/${file}`,"utf8"));
 return db;
};

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

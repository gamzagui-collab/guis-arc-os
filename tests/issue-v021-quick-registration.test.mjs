import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {ISSUE_SCOPE,issueWithinScope} from "../worker/modules/issue-policy.js";

const read=file=>fs.readFileSync(file,"utf8");
const worker=read("worker/modules/issues.js");
const ui=read("apps/web/assets/issues.js");

test("v0.21.0 create accepts a normal unassigned OPEN issue without fake classification",()=>{
  assert.doesNotMatch(worker,/ISSUE_COMPANY_REQUIRED/);
  assert.match(worker,/company\?\.name\|\|null/);
  assert.match(worker,/tradeRecord\?\.id\|\|null/);
  assert.match(worker,/Issue created without assignment/);
  assert.match(worker,/form\.get\("category"\)\|\|"UNCLASSIFIED"/);
});

test("v0.21.0 existing Issue schema already permits nullable assignment fields",()=>{
  const db=new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  for(const file of fs.readdirSync("database/migrations").sort())db.exec(read(`database/migrations/${file}`));
  const columns=new Map(db.prepare("PRAGMA table_info(issue_items)").all().map(column=>[column.name,column]));
  for(const name of ["contractor_company_id","trade_code","assigned_to_user_id"])assert.equal(columns.get(name).notnull,0,name);
  db.close();
});

test("v0.21.0 creator can read an unassigned Issue without exposing it to another contractor",()=>{
  const issue={created_by_user_id:"creator",contractor_company_id:null,assigned_to_user_id:null};
  assert.equal(issueWithinScope({scope:ISSUE_SCOPE.SELF_CREATED,userId:"creator",companyId:"company-a"},issue),true);
  assert.equal(issueWithinScope({scope:ISSUE_SCOPE.CONTRACTOR,userId:"creator",companyId:"company-a"},issue),true);
  assert.equal(issueWithinScope({scope:ISSUE_SCOPE.CONTRACTOR,userId:"other",companyId:"company-b"},issue),false);
});

test("v0.21.0 quick form and manager assignment are separate contracts",()=>{
  const flow=ui.slice(ui.indexOf("async function createV3"),ui.indexOf("async function createV2"));
  for(const value of ["사진 촬영","파일 선택","건물·구역","세부 위치","name=\"description\"","이슈 등록"])assert.ok(flow.includes(value),value);
  assert.doesNotMatch(flow,/name="contractorCompanyId"|name="tradeCode"|name="assigneeUserId"|name="categoryCode"/);
  for(const value of ["업체·공종·담당자 배정","contractorCompanyId","tradeId","assigneeUserId","업체 미배정","공종 미지정","담당자 미배정"])assert.ok(ui.includes(value),value);
  assert.match(worker,/before,after/);
});

test("v0.21.0 mobile contracts cover 360 390 and 412 pixel widths",()=>{
  const css=read("apps/web/assets/issues.css");
  assert.match(css,/@media\(max-width:412px\)/);
  assert.match(css,/\.mobile-issue-form\{overflow:hidden\}/);
  assert.match(css,/\.form-actions \.primary\{width:100%;min-height:52px\}/);
});

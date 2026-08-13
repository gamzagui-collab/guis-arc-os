import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read=file=>fs.readFileSync(file,"utf8");
const worker=read("worker/modules/issues.js");
const ui=read("apps/web/assets/issues.js");
const createWorker=worker.slice(worker.indexOf("async function createIssue"),worker.indexOf("async function recordAssigneeResponse"));
const deleteWorker=worker.slice(worker.indexOf("async function deleteLocation"),worker.indexOf("async function updateCompanyTrades"));
const createUi=ui.slice(ui.indexOf("async function createV3"),ui.indexOf("async function detail"));

test("Issue Create is lookup-only and never writes Location Master rows",()=>{
  assert.doesNotMatch(createWorker,/allowDynamic:true|INSERT INTO site_locations|UPDATE site_locations|DELETE FROM site_locations/);
  assert.doesNotMatch(createWorker,/buildingLabel|floorLabel|unitLabel|roomLabel/);
});

test("Issue Create rejects a non-building canonical type in the building slot",()=>{
  assert.match(createWorker,/MANAGED_LOCATION_TYPES\.has\(buildingType\)/);
  assert.match(createWorker,/ISSUE_LOCATION_TYPE_INVALID/);
});

test("omitting ROOM stores the most-specific selected parent without creating an all-room row",()=>{
  assert.doesNotMatch(createWorker,/label:"전체"|allowDynamic:Boolean\(roomParentId\)/);
  assert.match(createWorker,/room=roomInputId\?await resolveLocation/);
});

test("location delete is inactive-only even when no Issue references the row",()=>{
  assert.doesNotMatch(deleteWorker,/DELETE FROM site_locations|ISSUE_LOCATION_DELETED|mode:used\?"INACTIVE":"DELETED"/);
  assert.match(deleteWorker,/UPDATE site_locations SET is_active=0/);
  assert.match(deleteWorker,/mode:"INACTIVE"/);
});

test("createV3 sends canonical IDs only and does not submit dynamic location labels",()=>{
  for(const field of ["buildingLabel","floorLabel","unitLabel","roomLabel"])assert.doesNotMatch(createUi,new RegExp(`payload\\.set\\("${field}"`));
  assert.doesNotMatch(createUi,/value="DIRECT"|unitOther|areaOther/);
  for(const field of ["buildingLocationId","floorLocationId","unitLocationId","roomLocationId"])assert.match(createUi,new RegExp(`payload\\.set\\("${field}"`));
});

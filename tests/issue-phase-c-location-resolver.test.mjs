import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {reconcileResolverSelection,resolveIssueDescriptionLocation} from "../apps/web/assets/issue-location-resolver.js";

const locations=[
  {id:"b202",parent_id:null,location_type:"BUILDING",display_name:"202동"},
  {id:"f14",parent_id:"b202",location_type:"FLOOR",display_name:"14층"},
  {id:"u1401",parent_id:"f14",location_type:"UNIT",display_name:"1401호"},
  {id:"rLiving",parent_id:"u1401",location_type:"ROOM",display_name:"거실"},
  {id:"rMasterBath",parent_id:"u1401",location_type:"ROOM",display_name:"부부욕실"},
  {id:"rCommonBath",parent_id:"u1401",location_type:"ROOM",display_name:"공용욕실"},
];
const aliases=[{alias_text:"2동",normalized_alias:"2동",location_id:"b202"}];
const resolve=(description,options={})=>resolveIssueDescriptionLocation(description,{locations,aliases,...options});

test("Phase C resolves full-number and short-unit descriptions to the same canonical path",()=>{
  for(const description of ["202동 1401호 거실 벽면 할석","202동 14층 1호 거실 벽면 할석"]){
    const result=resolve(description);
    assert.equal(result.status,"RESOLVED");
    assert.deepEqual(result.path,{buildingId:"b202",floorId:"f14",unitId:"u1401",roomId:"rLiving"});
  }
});

test("Phase C resolves a site-scoped alias without hard-coded building conversion",()=>{
  const result=resolve("2동 14층 1호 거실");
  assert.equal(result.status,"RESOLVED");
  assert.equal(result.path.buildingId,"b202");
});

test("Phase C exact tokens do not match numeric substrings",()=>{
  const expanded=[...locations,{id:"f4",parent_id:"b202",location_type:"FLOOR",display_name:"4\uCE35"},{id:"b1202",parent_id:null,location_type:"BUILDING",display_name:"1202\uB3D9"}];
  const result=resolveIssueDescriptionLocation("202\uB3D9 14\uCE35 1\uD638 \uAC70\uC2E4",{locations:expanded,aliases});
  assert.equal(result.status,"RESOLVED");
  assert.equal(result.path.buildingId,"b202");
  assert.equal(result.path.floorId,"f14");
});

test("Phase C keeps the most-specific unique safe parent",()=>{
  const buildingOnly=resolve("202동 외벽 균열");
  assert.equal(buildingOnly.status,"PARTIAL");
  assert.deepEqual(buildingOnly.path,{buildingId:"b202",floorId:null,unitId:null,roomId:null});
  const ambiguousRoom=resolve("202동 1401호 욕실 누수");
  assert.equal(ambiguousRoom.status,"AMBIGUOUS");
  assert.equal(ambiguousRoom.path.unitId,"u1401");
  assert.equal(ambiguousRoom.path.roomId,null);
  const nonExactRoom=resolve("202\uB3D9 1401\uD638 \uAC70\uC2E4\uC55E \uADE0\uC5F4");
  assert.equal(nonExactRoom.path.roomId,null);
});

test("Phase C never invents missing units or locations",()=>{
  const missing=resolve("202동 1501호 거실");
  assert.equal(missing.status,"PARTIAL");
  assert.deepEqual(missing.path,{buildingId:"b202",floorId:null,unitId:null,roomId:null});
  const unresolved=resolve("L형옹벽 1구간 방수 불량");
  assert.equal(unresolved.status,"UNRESOLVED");
  assert.deepEqual(unresolved.path,{buildingId:null,floorId:null,unitId:null,roomId:null});
});

test("Phase C isolates resolver errors and does not mutate the master",()=>{
  const before=JSON.stringify(locations);
  const result=resolveIssueDescriptionLocation("202동",{locations:null,aliases});
  assert.equal(result.status,"ERROR_FALLBACK");
  assert.equal(JSON.stringify(locations),before);
});

test("resolver selection ownership clears stale automatic values and preserves manual values",()=>{
  const automatic={buildingId:"b202",floorId:"f14",unitId:"u1401",roomId:"rLiving"};
  const unresolved={status:"UNRESOLVED",path:{buildingId:null,floorId:null,unitId:null,roomId:null}};
  assert.deepEqual(reconcileResolverSelection(automatic,automatic,unresolved,false).path,{buildingId:null,floorId:null,unitId:null,roomId:null});
  assert.deepEqual(reconcileResolverSelection(automatic,automatic,unresolved,true).path,automatic);
  const manual={buildingId:"otherBuilding",floorId:"otherFloor",unitId:"otherUnit",roomId:"otherRoom"};
  const ambiguous={status:"AMBIGUOUS",path:{buildingId:"b202",floorId:"f14",unitId:"u1401",roomId:null}};
  assert.deepEqual(reconcileResolverSelection(manual,automatic,ambiguous,true).path,manual);
});

test("createV3 resolves only on explicit final-description apply and preserves manual override",()=>{
  const ui=fs.readFileSync(new URL("../apps/web/assets/issues.js",import.meta.url),"utf8");
  const flow=ui.slice(ui.indexOf("async function createV3"),ui.indexOf("async function detail"));
  assert.match(flow,/id="description-apply"/);
  assert.match(flow,/resolveIssueDescriptionLocation\(form\.elements\.description\.value/);
  assert.match(flow,/descriptionApply\.onclick/);
  assert.doesNotMatch(flow,/description\.addEventListener\("input".*resolveIssueDescriptionLocation/s);
  const speech=flow.slice(flow.indexOf("recognition.onresult"),flow.indexOf("recognition.onerror"));
  assert.doesNotMatch(speech,/resolveIssueDescriptionLocation|applyResolvedLocationPath/);
  assert.match(flow,/form\.dataset\.manualLocationOverride="true"/);
  assert.doesNotMatch(flow,/manualLocationOverride.*description\.addEventListener/s);
});

test("form-options exposes only current-site active aliases for read-only resolving",()=>{
  const worker=fs.readFileSync(new URL("../worker/modules/issues.js",import.meta.url),"utf8");
  assert.match(worker,/FROM site_location_aliases a JOIN site_locations l/);
  assert.match(worker,/a\.site_id=\?1 AND a\.is_active=1 AND l\.is_active=1/);
  assert.match(worker,/resolverAliases/);
});

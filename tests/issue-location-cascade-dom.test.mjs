import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {locationChildrenForParent,reconcileLocationCascadePath} from "../apps/web/assets/issue-location-resolver.js";

const source=fs.readFileSync(new URL("../apps/web/assets/issues.js",import.meta.url),"utf8");
const flow=source.slice(source.indexOf("async function createV3"),source.indexOf("async function detail"));

test("v3 Issue cascade contains exactly building floor and unit selectors",()=>{
  for(const name of ["building","floor","unit"])assert.match(flow,new RegExp(`name="${name}"`));
  assert.doesNotMatch(flow,/name="area"|locations\.areas|roomId:canonicalLocationId/);
  assert.match(flow,/name="detailLocation"/);
});

test("v3 cascade exposes only direct structural children and clears stale descendants",()=>{
  const rows=[
    {id:"b1",parent_id:null,location_type:"BUILDING"},{id:"b2",parent_id:null,location_type:"BUILDING"},
    {id:"f1",parent_id:"b1",location_type:"FLOOR"},{id:"f2",parent_id:"b2",location_type:"FLOOR"},
    {id:"u1",parent_id:"f1",location_type:"UNIT"},{id:"u2",parent_id:"f2",location_type:"UNIT"},
    {id:"historical-room",parent_id:"u1",location_type:"ROOM"}
  ];
  assert.deepEqual(locationChildrenForParent(rows,"b1","FLOOR").map(x=>x.id),["f1"]);
  assert.deepEqual(locationChildrenForParent(rows,"f1","UNIT").map(x=>x.id),["u1"]);
  assert.deepEqual(reconcileLocationCascadePath(rows,{buildingId:"b2",floorId:"f1",unitId:"u1"}),{buildingId:"b2",floorId:null,unitId:null,roomId:null});
});

test("historical ROOM rows remain readable data but never become v3 selectable structural children",()=>{
  const rows=[{id:"u1",parent_id:"f1",location_type:"UNIT"},{id:"r1",parent_id:"u1",location_type:"ROOM"}];
  assert.deepEqual(locationChildrenForParent(rows,"u1","UNIT"),[]);
  assert.equal(rows.find(x=>x.id==="r1").location_type,"ROOM");
});

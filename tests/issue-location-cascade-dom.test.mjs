import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {locationChildrenForParent,reconcileLocationCascadePath} from "../apps/web/assets/issue-location-resolver.js";

const source=fs.readFileSync(new URL("../apps/web/assets/issues.js",import.meta.url),"utf8"),flow=source.slice(source.indexOf("async function createV3"),source.indexOf("async function detail"));
const expression=(start,end)=>{const from=flow.indexOf(start);assert.notEqual(from,-1,`missing ${start}`);const to=flow.indexOf(end,from+start.length);assert.notEqual(to,-1,`missing ${end}`);return flow.slice(from+start.length,to)};
const filterSource=expression("filterLocationSelect=",",applyLocationPathToForm="),applySource=expression("applyLocationPathToForm=",",resolverPathLabel=");
const canonicalLocationId=option=>option?.dataset?.locationId?option.value:"";
const filterLocationSelect=new Function("locationChildrenForParent","canonicalLocationId",`return (${filterSource})`)(locationChildrenForParent,canonicalLocationId);

const fixture=[
 {id:"b1",parent_id:null,location_type:"BUILDING",display_name:"201동"},
 {id:"b2",parent_id:null,location_type:"BUILDING",display_name:"202동"},
 {id:"facility",parent_id:null,location_type:"FACILITY",display_name:"커뮤니티센터"},
 {id:"legacyFloor",parent_id:null,location_type:"FLOOR",display_name:"지하3층"},
 {id:"f1",parent_id:"b1",location_type:"FLOOR",display_name:"14층"},
 {id:"f1b",parent_id:"b1",location_type:"FLOOR",display_name:"15층"},
 {id:"f2",parent_id:"b2",location_type:"FLOOR",display_name:"14층"},
 {id:"u1",parent_id:"f1",location_type:"UNIT",display_name:"1401호"},
 {id:"u1b",parent_id:"f1b",location_type:"UNIT",display_name:"1501호"},
 {id:"u2",parent_id:"f2",location_type:"UNIT",display_name:"1401호"},
 {id:"r1",parent_id:"u1",location_type:"ROOM",display_name:"거실"},
 {id:"r1b",parent_id:"u1b",location_type:"ROOM",display_name:"거실"},
 {id:"r2",parent_id:"u2",location_type:"ROOM",display_name:"거실"},
 {id:"stairs1",parent_id:"f1",location_type:"ROOM",display_name:"1번계단"},
 {id:"stairs2",parent_id:"f2",location_type:"ROOM",display_name:"1번계단"},
 {id:"facilityRoom",parent_id:"facility",location_type:"ROOM",display_name:"로비"},
 {id:"legacyRoom",parent_id:null,location_type:"ROOM",display_name:"전체"}
];
const locations={buildings:fixture.filter(value=>["BUILDING","FACILITY"].includes(value.location_type)),floors:fixture.filter(value=>value.location_type==="FLOOR"),units:fixture.filter(value=>value.location_type==="UNIT"),areas:fixture.filter(value=>value.location_type==="ROOM")},resolverLocations=[...locations.buildings,...locations.floors,...locations.units,...locations.areas];

const option=item=>({value:item.id,textContent:item.display_name,dataset:{locationId:"true",parentId:item.parent_id||"",locationType:item.location_type},hidden:false,disabled:false,selected:false});
const select=items=>{const placeholder={value:"",textContent:"placeholder",dataset:{},hidden:false,disabled:false,selected:true},options=[placeholder,...items.map(option)];return {options,required:false,get selectedOptions(){return options.filter(value=>value.selected)},get value(){return this.selectedOptions[0]?.value||""},set value(next){let matched=false;for(const item of options){item.selected=!matched&&item.value===next;if(item.selected)matched=true}if(!matched)placeholder.selected=true}}};
const selectable=control=>control.options.filter(value=>value.dataset.locationId&&!value.hidden&&!value.disabled);
const canonical=control=>control.options.filter(value=>value.dataset.locationId);
const state=control=>({totalCanonicalOptions:canonical(control).length,selectableCanonicalOptions:selectable(control).length,selectableIds:selectable(control).map(value=>value.value),value:control.value});
const createHarness=()=>{const building=select(locations.buildings),floor=select(locations.floors),unit=select(locations.units),area=select(locations.areas),applyLocationPathToForm=new Function("reconcileLocationCascadePath","filterLocationSelect","resolverLocations","building","floor","unit","area","locations",`return (${applySource})`)(reconcileLocationCascadePath,filterLocationSelect,resolverLocations,building,floor,unit,area,locations);return {building,floor,unit,area,applyLocationPathToForm}};
const assertHiddenDisabled=(control,ids)=>{for(const id of ids){const item=canonical(control).find(value=>value.value===id);assert.ok(item,`missing ${id}`);assert.equal(item.hidden,true);assert.equal(item.disabled,true);assert.equal(item.selected,false)}};

test("initial cascade keeps canonical DOM options but exposes no selectable descendants",()=>{
 const h=createHarness();h.applyLocationPathToForm({});
 assert.deepEqual([state(h.floor).selectableCanonicalOptions,state(h.unit).selectableCanonicalOptions,state(h.area).selectableCanonicalOptions],[0,0,0]);
 assert.deepEqual([state(h.floor).totalCanonicalOptions,state(h.unit).totalCanonicalOptions,state(h.area).totalCanonicalOptions],[4,3,7]);
 assertHiddenDisabled(h.floor,["legacyFloor","f1","f1b","f2"]);assertHiddenDisabled(h.unit,["u1","u1b","u2"]);assertHiddenDisabled(h.area,["r1","r1b","r2","stairs1","stairs2","facilityRoom","legacyRoom"]);
});

test("building selection exposes only direct children and changing building clears stale descendants",()=>{
 const h=createHarness();h.applyLocationPathToForm({buildingId:"b1",floorId:"f1",unitId:"u1",roomId:"r1"});
 assert.deepEqual(state(h.floor).selectableIds,["f1","f1b"]);assert.deepEqual(state(h.unit).selectableIds,["u1"]);assert.deepEqual(state(h.area).selectableIds,["r1"]);
 h.applyLocationPathToForm({buildingId:"b2"});
 assert.deepEqual([h.floor.value,h.unit.value,h.area.value],["","",""]);assert.deepEqual(state(h.floor).selectableIds,["f2"]);assert.deepEqual(state(h.unit).selectableIds,[]);assert.deepEqual(state(h.area).selectableIds,[]);assertHiddenDisabled(h.floor,["f1","f1b"]);assertHiddenDisabled(h.unit,["u1"]);assertHiddenDisabled(h.area,["r1"]);
});

test("floor change clears stale unit and room while exposing direct children",()=>{
 const h=createHarness();h.applyLocationPathToForm({buildingId:"b1",floorId:"f1",unitId:"u1",roomId:"r1"});h.applyLocationPathToForm({buildingId:"b1",floorId:"f1b"});
 assert.equal(h.unit.value,"");assert.equal(h.area.value,"");assert.deepEqual(state(h.unit).selectableIds,["u1b"]);assert.deepEqual(state(h.area).selectableIds,[]);assertHiddenDisabled(h.unit,["u1"]);assertHiddenDisabled(h.area,["r1"]);
});

test("unit selection exposes only its direct rooms",()=>{
 const h=createHarness();h.applyLocationPathToForm({buildingId:"b1",floorId:"f1",unitId:"u1"});assert.deepEqual(state(h.area).selectableIds,["r1"]);assertHiddenDisabled(h.area,["r1b","r2"]);
});

test("duplicate room labels remain isolated to the current parent",()=>{
 const h=createHarness();h.applyLocationPathToForm({buildingId:"b1",floorId:"f1"});const stairs=canonical(h.area).filter(value=>value.textContent==="1번계단");assert.equal(stairs.length,2);assert.deepEqual(selectable(h.area).filter(value=>value.textContent==="1번계단").map(value=>value.value),["stairs1"]);assertHiddenDisabled(h.area,["stairs2"]);
});

test("unit-less floor and facility rooms work without attaching null-parent legacy rows",()=>{
 const floorHarness=createHarness();floorHarness.applyLocationPathToForm({buildingId:"b1",floorId:"f1"});assert.deepEqual(state(floorHarness.area).selectableIds,["stairs1"]);
 const facilityHarness=createHarness();facilityHarness.applyLocationPathToForm({buildingId:"facility"});assert.deepEqual(state(facilityHarness.floor).selectableIds,[]);assert.deepEqual(state(facilityHarness.unit).selectableIds,[]);assert.deepEqual(state(facilityHarness.area).selectableIds,["facilityRoom"]);assertHiddenDisabled(facilityHarness.floor,["legacyFloor"]);assertHiddenDisabled(facilityHarness.area,["legacyRoom"]);
});

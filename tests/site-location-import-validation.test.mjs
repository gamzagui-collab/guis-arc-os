import assert from "node:assert/strict";
import test from "node:test";
import {validateLocationImport} from "../worker/modules/site-location-import/validation.js";
import {buildLocationImportDiff} from "../worker/modules/site-location-import/diff.js";

const siteId="site-a";
const workbook=locations=>({locations,aliases:[],workbookMeta:{sheetNames:["01_위치목록"]}});
const row=(area="202동",floor="14층",space="1401호",detail="거실")=>({area,floor,space,detail,sourceSheetName:"01_위치목록",sourceRow:2});
const currentRow=(id,{parent_id=null,location_type="BUILDING",display_name=id,canonical_key=`key/${id}`,sort_order=10,source="IMPORT",is_active=1,site_id=siteId}={})=>({id,parent_id,location_type,display_name,canonical_key,sort_order,source,is_active,site_id});

test("candidate validation maps numeric units, generic fixed spaces, and detail rooms without alias rows",()=>{
  const checked=validateLocationImport({siteId,workbook:workbook([row("202동","14층","1401호","거실"),row("202동","14층","계단실","")]),current:{locations:[],aliases:[]}});
  assert.equal(checked.applyAllowed,true);
  assert.deepEqual(checked.normalized.aliases,[]);
  assert.ok(checked.normalized.locations.some(item=>item.locationType==="UNIT"&&item.displayName==="1401호"));
  assert.ok(checked.normalized.locations.some(item=>item.locationType==="FACILITY"&&item.displayName==="계단실"));
  assert.ok(checked.normalized.locations.some(item=>item.locationType==="ROOM"&&item.displayName==="거실"));
});

test("validation rejects missing area, unsafe fields, and a populated space without a floor",()=>{
  const checked=validateLocationImport({siteId,workbook:workbook([row("","14층","1401호",""),row("202동","","1401호",""),row("202동","14층","1401호","\u0001")]),current:{locations:[],aliases:[]}});
  assert.equal(checked.applyAllowed,false);
  assert.deepEqual(new Set(checked.errors.map(item=>item.code)),new Set(["LOCATION_IMPORT_FIELD_REQUIRED","LOCATION_IMPORT_FLOOR_REQUIRED","LOCATION_IMPORT_CONTROL_CHARACTER"]));
});

test("diff is deterministic, preserves LEGACY and MANUAL, and inactivates only omitted IMPORT nodes",()=>{
  const parsed=validateLocationImport({siteId,workbook:workbook([row("202동","14층","1401호","")]),current:{locations:[],aliases:[]}});
  const importNodes=parsed.normalized.locations.map(item=>currentRow(item.id,{parent_id:item.parentId,location_type:item.locationType,display_name:item.displayName,canonical_key:item.canonicalKey,sort_order:item.sortOrder}));
  const current={locations:[...importNodes,currentRow("legacy",{display_name:"기존",source:"LEGACY"}),currentRow("manual",{display_name:"수동",source:"MANUAL"})],aliases:[{id:"alias-kept"}]};
  const same=buildLocationImportDiff({siteId,normalized:validateLocationImport({siteId,workbook:workbook([row("202동","14층","1401호","")]),current}).normalized,current});
  assert.equal(same.counts.unchanged,3);
  assert.equal(same.operations.some(item=>item.id==="legacy"||item.id==="manual"),false);
  const removed=buildLocationImportDiff({siteId,normalized:validateLocationImport({siteId,workbook:workbook([row("202동","","","")]),current}).normalized,current});
  assert.ok(removed.operations.some(item=>item.type==="INACTIVE"));
  assert.equal(removed.operations.some(item=>item.id==="legacy"||item.id==="manual"),false);
  assert.equal(removed.operations.some(item=>item.type.startsWith("ALIAS_")),false);
});

test("foreign generated IDs are rejected and no client metadata can change the authenticated site",()=>{
  const initial=validateLocationImport({siteId,workbook:workbook([row()]),current:{locations:[],aliases:[]}});
  const foreignId=initial.normalized.locations[0].id;
  const checked=validateLocationImport({siteId,workbook:{...workbook([row()]),workbookMeta:{sheetNames:["01_위치목록"],siteId:"site-b"}},current:{locations:[],aliases:[]},identityGuards:{foreignLocationIds:new Set([foreignId])}});
  assert.equal(checked.applyAllowed,false);
  assert.ok(checked.errors.some(item=>item.code==="LOCATION_IMPORT_CROSS_SITE_REFERENCE"));
  assert.ok(checked.normalized.locations.every(item=>item.siteId===siteId));
});

test("active imported descendants cannot attach to an inactive LEGACY or MANUAL parent",()=>{
  for(const source of ["LEGACY","MANUAL"]){
    const parent=currentRow(`inactive-${source}`,{display_name:"202동",source,is_active:0});
    const checked=validateLocationImport({siteId,workbook:workbook([row("202동","14층","1401호","")]),current:{locations:[parent],aliases:[]}});
    assert.equal(checked.applyAllowed,false);
    assert.ok(checked.errors.some(item=>item.code==="LOCATION_IMPORT_PARENT_INACTIVE"));
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import {strToU8,zipSync} from "fflate";
import {SIMPLE_LOCATION_HEADERS,SIMPLE_LOCATION_SHEET} from "../worker/modules/site-location-import/contracts.js";
import {parseSiteLocationWorkbook} from "../worker/modules/site-location-import/xlsx-parser.js";
import {buildLocationCandidateTree} from "../worker/modules/site-location-import/candidate-tree.js";
import {validateLocationImport} from "../worker/modules/site-location-import/validation.js";
import {buildLocationImportDiff,fingerprintLocationMaster,sha256} from "../worker/modules/site-location-import/diff.js";

const esc=value=>String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
const column=index=>String.fromCharCode(65+index);
const worksheet=rows=>`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((row,rowIndex)=>`<row r="${rowIndex+1}">${row.map((value,columnIndex)=>`<c r="${column(columnIndex)}${rowIndex+1}" t="inlineStr"><is><t>${esc(value)}</t></is></c>`).join("")}</row>`).join("")}</sheetData></worksheet>`;
const workbook=(rows,headers=SIMPLE_LOCATION_HEADERS)=>{
  const workbookXml=`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${SIMPLE_LOCATION_SHEET}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const rels=`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;
  return zipSync({"xl/workbook.xml":strToU8(workbookXml),"xl/_rels/workbook.xml.rels":strToU8(rels),"xl/worksheets/sheet1.xml":strToU8(worksheet([headers,...rows]))});
};

test("v2 fingerprints use real deterministic SHA-256",()=>{
  assert.equal(sha256("abc"),"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  const first={locations:[
    {id:"b",site_id:"site-a",parent_id:"a",location_type:"FLOOR",canonical_key:"key/b",display_name:"2",sort_order:20,source:"IMPORT",is_active:1},
    {id:"a",site_id:"site-a",parent_id:null,location_type:"BUILDING",canonical_key:"key/a",display_name:"1",sort_order:10,source:"IMPORT",is_active:1}
  ]};
  const reordered={locations:[...first.locations].reverse()};
  assert.equal(fingerprintLocationMaster("site-a",first),fingerprintLocationMaster("site-a",reordered));
  assert.notEqual(fingerprintLocationMaster("site-a",first),fingerprintLocationMaster("site-a",{locations:first.locations.map(row=>row.id==="b"?{...row,display_name:"changed"}:row)}));
  assert.match(fingerprintLocationMaster("site-a",first),/^[0-9a-f]{64}$/);
});

test("v2 rejects generated same-site ID owners for different physical paths",()=>{
  const initial=validateLocationImport({siteId:"site-a",workbook:parseSiteLocationWorkbook(workbook([["202동","14층","1401호","거실"]])),current:{locations:[],aliases:[]}});
  const generated=initial.normalized.locations.at(-1);
  for(const source of ["LEGACY","MANUAL","IMPORT"]){
    const collision={id:generated.id,site_id:"site-a",parent_id:null,location_type:"OTHER",canonical_key:`other/${source}`,display_name:`다른-${source}`,sort_order:1,source,is_active:1};
    const checked=validateLocationImport({siteId:"site-a",workbook:parseSiteLocationWorkbook(workbook([["202동","14층","1401호","거실"]])),current:{locations:[collision],aliases:[]}});
    assert.equal(checked.applyAllowed,false,source);
    assert.ok(checked.errors.some(item=>item.code==="LOCATION_IMPORT_ID_COLLISION"),source);
  }
});

test("v2 reuses an exact same-site physical path and isolates the same ID in another site",()=>{
  const first=validateLocationImport({siteId:"site-a",workbook:parseSiteLocationWorkbook(workbook([["202동","14층","1401호","거실"]])),current:{locations:[],aliases:[]}});
  const existing=first.normalized.locations.map(row=>({id:row.id,site_id:row.siteId,parent_id:row.parentId,location_type:row.locationType,canonical_key:row.canonicalKey,display_name:row.displayName,sort_order:row.sortOrder,source:"IMPORT",is_active:1}));
  const exact=validateLocationImport({siteId:"site-a",workbook:parseSiteLocationWorkbook(workbook([["202동","14층","1401호","거실"]])),current:{locations:existing,aliases:[]}});
  assert.equal(exact.applyAllowed,true);
  assert.deepEqual(exact.normalized.locations.map(row=>row.id),existing.map(row=>row.id));
  const foreign=existing.map(row=>({...row,site_id:"site-b",canonical_key:`foreign/${row.id}`,display_name:`foreign-${row.id}`}));
  const isolated=validateLocationImport({siteId:"site-a",workbook:parseSiteLocationWorkbook(workbook([["202동","14층","1401호","거실"]])),current:{locations:foreign,aliases:[]}});
  assert.equal(isolated.errors.some(item=>item.code==="LOCATION_IMPORT_ID_COLLISION"),false);
});

test("v3 parses only the three structural columns and builds a deduplicated hierarchy",()=>{
  assert.deepEqual(SIMPLE_LOCATION_HEADERS,["건물/구역","층","호/공간"]);
  const parsed=parseSiteLocationWorkbook(workbook([["202동","14층","1401호","거실"],["202동","14층","1401호","주방"]]));
  assert.deepEqual(parsed.aliases,[]);
  assert.deepEqual(parsed.locations.map(({area,floor,space,detail})=>({area,floor,space,detail})),[
    {area:"202동",floor:"14층",space:"1401호",detail:""},
    {area:"202동",floor:"14층",space:"1401호",detail:""}
  ]);
  const tree=buildLocationCandidateTree({siteId:"site-a",rows:parsed.locations});
  assert.deepEqual(tree.locations.map(({locationType,displayName})=>[locationType,displayName]),[
    ["BUILDING","202동"],["FLOOR","14층"],["UNIT","1401호"]
  ]);
});

test("v2 rejects a missing human header and requires a floor for a populated residential space",()=>{
  assert.throws(()=>parseSiteLocationWorkbook(workbook([["202동","14층","1401호","거실"]],SIMPLE_LOCATION_HEADERS.slice(0,-1))),error=>error.code==="LOCATION_XLSX_REQUIRED_HEADER_MISSING");
  const parsed=parseSiteLocationWorkbook(workbook([["202동","","1401호",""]]));
  const checked=validateLocationImport({siteId:"site-a",workbook:parsed,current:{locations:[],aliases:[]}});
  assert.equal(checked.applyAllowed,false);
  assert.ok(checked.errors.some(item=>item.code==="LOCATION_IMPORT_FLOOR_REQUIRED"));
});

test("v2 exact re-import preserves IDs while only omitted IMPORT nodes become inactive",()=>{
  const parsed=parseSiteLocationWorkbook(workbook([["202동","14층","1401호","거실"]]));
  const first=validateLocationImport({siteId:"site-a",workbook:parsed,current:{locations:[],aliases:[]}});
  const old=first.normalized.locations.map(row=>({...row,site_id:row.siteId,parent_id:row.parentId,location_type:row.locationType,canonical_key:row.canonicalKey,display_name:row.displayName,sort_order:row.sortOrder,is_active:1,source:"IMPORT"}));
  old.push({id:"legacy-root",site_id:"site-a",parent_id:null,location_type:"BUILDING",canonical_key:null,display_name:"기존동",sort_order:99,is_active:1,source:"LEGACY"});
  const second=validateLocationImport({siteId:"site-a",workbook:parsed,current:{locations:old,aliases:[]}});
  assert.deepEqual(second.normalized.locations.map(row=>row.id),first.normalized.locations.map(row=>row.id));
  const diff=buildLocationImportDiff({siteId:"site-a",normalized:second.normalized,current:{locations:old,aliases:[]}});
  assert.equal(diff.counts.added,0);
  assert.equal(diff.counts.inactivated,0);
  assert.equal(diff.counts.unchanged,3);
  assert.equal(diff.operations.some(item=>item.id==="legacy-root"),false);
});

test("v2 emits a rename candidate and retains the existing ID only after an explicit decision",()=>{
  const current={locations:[
    {id:"root",site_id:"site-a",parent_id:null,location_type:"BUILDING",canonical_key:"legacy/root",display_name:"202동",sort_order:10,is_active:1,source:"IMPORT"},
    {id:"floor",site_id:"site-a",parent_id:"root",location_type:"FLOOR",canonical_key:"legacy/floor",display_name:"14층",sort_order:10,is_active:1,source:"IMPORT"},
    {id:"old",site_id:"site-a",parent_id:"floor",location_type:"UNIT",canonical_key:"legacy/old",display_name:"복도",sort_order:10,is_active:1,source:"IMPORT"}
  ],aliases:[{id:"untouched-alias"}]};
  const parsed=parseSiteLocationWorkbook(workbook([["202동","14층","경로",""]]));
  const checked=validateLocationImport({siteId:"site-a",workbook:parsed,current});
  const preview=buildLocationImportDiff({siteId:"site-a",normalized:checked.normalized,current});
  const candidate=preview.operations.find(item=>item.type==="RENAME_CANDIDATE");
  assert.ok(candidate);
  const selected=buildLocationImportDiff({siteId:"site-a",normalized:checked.normalized,current,renameDecisions:[{fromId:candidate.from.id,toId:candidate.to.id,decision:"SAME_LOCATION"}]});
  const update=selected.operations.find(item=>item.type==="UPDATE"&&item.id==="old");
  assert.ok(update);
  assert.equal(update.after.displayName,"경로");
  assert.equal(update.after.canonicalKey,"legacy/old");
  assert.equal(selected.operations.some(item=>item.type==="ADD"&&item.after.displayName==="경로"),false);
  assert.equal(selected.operations.some(item=>item.type==="INACTIVE"&&item.id==="old"),false);
  assert.deepEqual(checked.normalized.aliases,[]);
});

test("v2 accepts NEW_LOCATION while unresolved rename candidates block an Apply diff",()=>{
  const current={locations:[
    {id:"old",site_id:"site-a",parent_id:null,location_type:"BUILDING",canonical_key:"legacy/old",display_name:"201동",sort_order:10,is_active:1,source:"IMPORT"}
  ],aliases:[]};
  const checked=validateLocationImport({siteId:"site-a",workbook:parseSiteLocationWorkbook(workbook([["202동","","",""]])),current});
  const preview=buildLocationImportDiff({siteId:"site-a",normalized:checked.normalized,current});
  const candidate=preview.operations.find(item=>item.type==="RENAME_CANDIDATE");
  assert.ok(candidate);
  const unresolved=buildLocationImportDiff({siteId:"site-a",normalized:checked.normalized,current,renameDecisions:[]});
  assert.ok(unresolved.operations.some(item=>item.code==="LOCATION_IMPORT_RENAME_DECISION_REQUIRED"));
  const decided=buildLocationImportDiff({siteId:"site-a",normalized:checked.normalized,current,renameDecisions:[{fromId:candidate.from.id,toId:candidate.to.id,decision:"NEW_LOCATION"}]});
  assert.equal(decided.counts.error,0);
  assert.equal(decided.counts.renameCandidates,0);
  assert.ok(decided.operations.some(item=>item.type==="ADD"&&item.id===candidate.to.id));
  assert.ok(decided.operations.some(item=>item.type==="INACTIVE"&&item.id===candidate.from.id));
});

test("v2 parent SAME_LOCATION preserves descendant IDs and rewrites parent references",()=>{
  const current={locations:[
    {id:"building-old",site_id:"site-a",parent_id:null,location_type:"BUILDING",canonical_key:"key/building",display_name:"201동",sort_order:10,is_active:1,source:"IMPORT"},
    {id:"floor-old",site_id:"site-a",parent_id:"building-old",location_type:"FLOOR",canonical_key:"key/floor",display_name:"14층",sort_order:10,is_active:1,source:"IMPORT"},
    {id:"unit-old",site_id:"site-a",parent_id:"floor-old",location_type:"UNIT",canonical_key:"key/unit",display_name:"1401호",sort_order:10,is_active:1,source:"IMPORT"},
    {id:"room-old",site_id:"site-a",parent_id:"unit-old",location_type:"ROOM",canonical_key:"key/room",display_name:"거실",sort_order:10,is_active:1,source:"IMPORT"}
  ],aliases:[]};
  const checked=validateLocationImport({siteId:"site-a",workbook:parseSiteLocationWorkbook(workbook([["202동","14층","1401호","거실"]])),current});
  const preview=buildLocationImportDiff({siteId:"site-a",normalized:checked.normalized,current});
  const candidate=preview.operations.find(item=>item.type==="RENAME_CANDIDATE"&&item.from.id==="building-old");
  assert.ok(candidate);
  const decided=buildLocationImportDiff({siteId:"site-a",normalized:checked.normalized,current,renameDecisions:[{fromId:candidate.from.id,toId:candidate.to.id,decision:"SAME_LOCATION"}]});
  assert.equal(decided.counts.error,0);
  for(const id of ["building-old","floor-old","unit-old"])assert.ok(decided.operations.some(item=>item.id===id&&item.type==="UPDATE"));
  assert.equal(decided.operations.find(item=>item.id==="floor-old").after.parentId,"building-old");
  assert.equal(decided.operations.find(item=>item.id==="unit-old").after.parentId,"floor-old");
  assert.ok(decided.operations.some(item=>item.id==="room-old"&&item.type==="INACTIVE"));
  assert.equal(decided.operations.some(item=>item.type==="ADD"),false);
});

test("v2 parent and child renames each require an explicit hierarchical decision",()=>{
  const current={locations:[
    {id:"building-old",site_id:"site-a",parent_id:null,location_type:"BUILDING",canonical_key:"key/building",display_name:"201동",sort_order:10,is_active:1,source:"IMPORT"},
    {id:"floor-old",site_id:"site-a",parent_id:"building-old",location_type:"FLOOR",canonical_key:"key/floor",display_name:"14층",sort_order:10,is_active:1,source:"IMPORT"}
  ],aliases:[]};
  const checked=validateLocationImport({siteId:"site-a",workbook:parseSiteLocationWorkbook(workbook([["202동","15층","",""]])),current});
  const preview=buildLocationImportDiff({siteId:"site-a",normalized:checked.normalized,current});
  const parentCandidate=preview.operations.find(item=>item.type==="RENAME_CANDIDATE"&&item.from.id==="building-old");
  assert.ok(parentCandidate);

  const parentDecided=buildLocationImportDiff({siteId:"site-a",normalized:checked.normalized,current,renameDecisions:[
    {fromId:parentCandidate.from.id,toId:parentCandidate.to.id,decision:"SAME_LOCATION"}
  ]});
  const childCandidate=parentDecided.operations.find(item=>item.type==="RENAME_CANDIDATE"&&item.from.id==="floor-old");
  assert.ok(childCandidate);
  assert.ok(parentDecided.operations.some(item=>item.code==="LOCATION_IMPORT_RENAME_DECISION_REQUIRED"&&item.id===childCandidate.id));
  assert.equal(parentDecided.operations.some(item=>item.type==="ADD"&&item.after?.displayName==="15층"),true);
  assert.equal(parentDecided.operations.some(item=>item.type==="INACTIVE"&&item.id==="floor-old"),true);

  const fullyDecided=buildLocationImportDiff({siteId:"site-a",normalized:checked.normalized,current,renameDecisions:[
    {fromId:parentCandidate.from.id,toId:parentCandidate.to.id,decision:"SAME_LOCATION"},
    {fromId:childCandidate.from.id,toId:childCandidate.to.id,decision:"SAME_LOCATION"}
  ]});
  const childUpdate=fullyDecided.operations.find(item=>item.type==="UPDATE"&&item.id==="floor-old");
  assert.ok(childUpdate);
  assert.equal(childUpdate.after.displayName,"15층");
  assert.equal(childUpdate.after.parentId,"building-old");
  assert.equal(fullyDecided.operations.some(item=>item.type==="ADD"||item.type==="INACTIVE"||item.type==="RENAME_CANDIDATE"||item.type==="ERROR"),false);
});

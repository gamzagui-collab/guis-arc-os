import assert from "node:assert/strict";
import test from "node:test";
import { validateLocationImport } from "../worker/modules/site-location-import/validation.js";
import { buildLocationImportDiff } from "../worker/modules/site-location-import/diff.js";

const siteId="site-a";
const location=(id,parentLocationId="",locationType="BUILDING",canonicalKey=`key/${id}`,displayName=id,sortOrder=0)=>({locationId:id,parentLocationId,locationType,canonicalKey,displayName,sortOrder,sourceSheetName:"01_위치마스터",sourceRow:2});
const alias=(id,locationId,text=id,type="FIELD_NAME")=>({aliasId:id,locationId,aliasText:text,normalizedAlias:text.toLowerCase(),aliasType:type,sourceSheetName:"02_위치별칭",sourceRow:2});
const workbook=(locations=[location("root")],aliases=[])=>({locations,aliases,workbookMeta:{templateVersion:"LOCATION_MASTER_V1",sheetNames:["00_사용안내","01_위치마스터","02_위치별칭","03_검증_확인필요","04_도면근거","05_ChatGPT작성규칙"]}});
const current=(locations=[],aliases=[])=>({locations,aliases});
const storedLocation=(id,{site_id=siteId,parent_id=null,location_type="BUILDING",canonical_key=`key/${id}`,display_name=id,sort_order=0,source="IMPORT",is_active=1}={})=>({id,site_id,parent_id,location_type,canonical_key,display_name,sort_order,source,is_active});
const storedAlias=(id,locationId,{site_id=siteId,alias_text=id,normalized_alias=id.toLowerCase(),alias_type="FIELD_NAME",source="IMPORT",is_active=1}={})=>({id,site_id,location_id:locationId,alias_text,normalized_alias,alias_type,source,is_active});
const codes=result=>result.errors.map(error=>error.code);
const validate=(book,snapshot=current())=>validateLocationImport({siteId,workbook:book,current:snapshot});

test("validation returns every stable structural and graph error without write statements",()=>{
  const cases=[
    ["LOCATION_IMPORT_SHEET_REQUIRED",{...workbook(),workbookMeta:{sheetNames:["01_위치마스터"]}},current()],
    ["LOCATION_IMPORT_HEADER_REQUIRED",{...workbook(),locations:undefined},current()],
    ["LOCATION_IMPORT_LOCATION_ID_DUPLICATE",workbook([location("x"),location("x")]),current()],
    ["LOCATION_IMPORT_CANONICAL_KEY_DUPLICATE",workbook([location("x"),location("y","","BUILDING","key/x")]),current()],
    ["LOCATION_IMPORT_PARENT_MISSING",workbook([location("x","missing","FLOOR")]),current()],
    ["LOCATION_IMPORT_PARENT_SELF",workbook([location("x","x","FLOOR")]),current()],
    ["LOCATION_IMPORT_PARENT_CYCLE",workbook([location("a","b","FLOOR"),location("b","a","FLOOR")]),current()],
    ["LOCATION_IMPORT_TYPE_UNSUPPORTED",workbook([location("x","","UNKNOWN")]),current()],
    ["LOCATION_IMPORT_CROSS_SITE_REFERENCE",workbook([location("x","foreign","FLOOR")]),current([storedLocation("foreign",{site_id:"site-b"})])],
    ["LOCATION_IMPORT_IDENTITY_REUSED",workbook([location("x","","BUILDING","new-key")]),current([storedLocation("x",{canonical_key:"old-key"})])],
    ["LOCATION_IMPORT_CANONICAL_KEY_REUSED",workbook([location("x","","BUILDING","shared")]),current([storedLocation("other",{canonical_key:"shared"})])],
    ["LOCATION_IMPORT_ALIAS_TARGET_MISSING",workbook([location("root")],[alias("a","missing")]),current()]
  ];
  for(const [code,book,snapshot] of cases){
    const result=validate(book,snapshot);
    assert.ok(codes(result).includes(code),code);
    assert.equal(result.applyAllowed,false);
    assert.equal(JSON.stringify(result).includes("statement"),false);
  }
});

test("validation enforces hierarchy, aliases, site metadata, and same-site active existing parents",()=>{
  const root=storedLocation("legacy-root",{location_type:"BUILDING",source:"LEGACY"});
  const valid=validate(workbook([location("floor","legacy-root","FLOOR"),location("unit","floor","UNIT"),location("room","unit","ROOM")],[alias("a","room","  Room A  ")]),current([root]));
  assert.equal(valid.applyAllowed,true);
  assert.equal(valid.normalized.aliases[0].normalizedAlias,"room a");
  assert.ok(codes(validate({...workbook(),workbookMeta:{...workbook().workbookMeta,siteId:"site-b"}})).includes("LOCATION_IMPORT_CROSS_SITE_REFERENCE"));
  assert.ok(codes(validate(workbook([location("room","root","ROOM"),location("root","room","BUILDING")]))).includes("LOCATION_IMPORT_PARENT_CYCLE"));
  assert.ok(codes(validate(workbook([location("root","","SITE")]))).includes("LOCATION_IMPORT_TYPE_UNSUPPORTED"));
  assert.ok(codes(validate(workbook([location("floor","unit","FLOOR"),location("unit","root","UNIT"),location("root")]))).includes("LOCATION_IMPORT_TYPE_UNSUPPORTED"));
  assert.ok(codes(validate(workbook([location("root")],[alias("a","root","same"),alias("b","root"," SAME ")]))).includes("LOCATION_IMPORT_IDENTITY_REUSED"));
});

test("diff is deterministic, protects non-import rows, and never emits hard deletes",()=>{
  const locations=[location("root"),location("floor","root","FLOOR")];
  const aliases=[alias("alias-a","floor","Floor A")];
  const snapshot=current([
    storedLocation("root"),
    storedLocation("floor",{parent_id:"root",location_type:"FLOOR",display_name:"Old floor"}),
    storedLocation("gone"),
    storedLocation("legacy",{source:"LEGACY"}),
    storedLocation("manual",{source:"MANUAL"}),
    storedLocation("foreign",{site_id:"site-b"})
  ],[
    storedAlias("alias-a","floor",{alias_text:"Old alias",normalized_alias:"floor a"}),
    storedAlias("alias-gone","floor"),
    storedAlias("alias-legacy","floor",{source:"LEGACY"}),
    storedAlias("alias-foreign","floor",{site_id:"site-b"})
  ]);
  const a=validate(workbook(locations,aliases),snapshot);
  const b=validate(workbook([...locations].reverse(),[...aliases].reverse()),snapshot);
  assert.equal(a.applyAllowed,true);
  const first=buildLocationImportDiff({siteId,normalized:a.normalized,current:snapshot});
  const second=buildLocationImportDiff({siteId,normalized:b.normalized,current:{locations:[...snapshot.locations].reverse(),aliases:[...snapshot.aliases].reverse()}});
  assert.deepEqual(first,second);
  assert.deepEqual(first.counts,{added:0,updated:1,unchanged:1,inactivated:1,aliasAdded:0,aliasUpdated:1,aliasInactivated:1,error:0});
  assert.ok(first.operations.some(op=>op.type==="INACTIVE"&&op.id==="gone"));
  assert.ok(first.operations.some(op=>op.type==="ALIAS_INACTIVE"&&op.id==="alias-gone"));
  assert.ok(!first.operations.some(op=>["legacy","manual","foreign","alias-legacy","alias-foreign"].includes(op.id)));
  assert.ok(!first.operations.some(op=>op.type==="UNCHANGED"));
  assert.ok(!first.operations.some(op=>/DELETE/i.test(op.type)));
  assert.match(first.baseMasterFingerprint,/^[a-f0-9]{64}$/);
  assert.match(first.previewHash,/^[a-f0-9]{64}$/);
});

test("diff emits identity collisions as ERROR rather than UPDATE",()=>{
  const normalized={locations:[{id:"x",siteId,parentId:null,locationType:"BUILDING",canonicalKey:"new-key",displayName:"x",sortOrder:0}],aliases:[]};
  const result=buildLocationImportDiff({siteId,normalized,current:current([storedLocation("x",{canonical_key:"old-key"})])});
  assert.equal(result.operations[0].type,"ERROR");
  assert.equal(result.operations[0].code,"LOCATION_IMPORT_IDENTITY_REUSED");
  assert.equal(result.counts.error,1);
});

test("fingerprints include recursively canonicalized nested field values",()=>{
  const normalized={locations:[{id:"x",siteId,parentId:null,locationType:"BUILDING",canonicalKey:"key/x",displayName:"New",sortOrder:0}],aliases:[]};
  const one=current([storedLocation("x",{display_name:"Old one"})]);
  const two=current([storedLocation("x",{display_name:"Old two"})]);
  const first=buildLocationImportDiff({siteId,normalized,current:one});
  const second=buildLocationImportDiff({siteId,normalized,current:two});
  assert.deepEqual(first.counts,second.counts);
  assert.notEqual(first.baseMasterFingerprint,second.baseMasterFingerprint);
  assert.notEqual(first.previewHash,second.previewHash);
});

test("validation rejects claiming legacy or manual location identities",()=>{
  for(const source of ["LEGACY","MANUAL"]){
    const snapshot=current([storedLocation("claimed",{source})]);
    const result=validate(workbook([location("claimed")]),snapshot);
    assert.equal(result.applyAllowed,false);
    assert.ok(codes(result).includes("LOCATION_IMPORT_IDENTITY_REUSED"));
  }
});

test("validation rejects aliases targeting omitted imported locations",()=>{
  const snapshot=current([storedLocation("omitted")]);
  const result=validate(workbook([location("root")],[alias("a","omitted")]),snapshot);
  assert.equal(result.applyAllowed,false);
  assert.ok(codes(result).includes("LOCATION_IMPORT_ALIAS_TARGET_MISSING"));
});

test("validation rejects conflicts with existing same-site normalized aliases",()=>{
  const snapshot=current([storedLocation("root")],[storedAlias("existing","root",{normalized_alias:"shared"})]);
  const result=validate(workbook([location("root")],[alias("incoming","root"," SHARED ")]),snapshot);
  assert.equal(result.applyAllowed,false);
  assert.ok(codes(result).includes("LOCATION_IMPORT_IDENTITY_REUSED"));
});

test("diff distinguishes adds, unchanged aliases, and inactive import reactivation",()=>{
  const normalized={
    locations:[
      {id:"new",siteId,parentId:null,locationType:"BUILDING",canonicalKey:"key/new",displayName:"new",sortOrder:0},
      {id:"same",siteId,parentId:null,locationType:"BUILDING",canonicalKey:"key/same",displayName:"same",sortOrder:0},
      {id:"wake",siteId,parentId:null,locationType:"BUILDING",canonicalKey:"key/wake",displayName:"wake",sortOrder:0}
    ],
    aliases:[
      {id:"alias-new",siteId,locationId:"new",aliasText:"New alias",normalizedAlias:"new alias",aliasType:"FIELD_NAME"},
      {id:"alias-same",siteId,locationId:"same",aliasText:"Same alias",normalizedAlias:"same alias",aliasType:"FIELD_NAME"},
      {id:"alias-wake",siteId,locationId:"wake",aliasText:"Wake alias",normalizedAlias:"wake alias",aliasType:"FIELD_NAME"}
    ]
  };
  const snapshot=current([
    storedLocation("same"),storedLocation("wake",{is_active:0})
  ],[
    storedAlias("alias-same","same",{alias_text:"Same alias",normalized_alias:"same alias"}),
    storedAlias("alias-wake","wake",{alias_text:"Wake alias",normalized_alias:"wake alias",is_active:0})
  ]);
  const result=buildLocationImportDiff({siteId,normalized,current:snapshot});
  assert.ok(result.operations.some(op=>op.type==="ADD"&&op.id==="new"));
  assert.ok(result.operations.some(op=>op.type==="ALIAS_ADD"&&op.id==="alias-new"));
  assert.ok(result.operations.some(op=>op.type==="UPDATE"&&op.id==="wake"));
  assert.ok(result.operations.some(op=>op.type==="ALIAS_UPDATE"&&op.id==="alias-wake"));
  assert.equal(result.counts.added,1);
  assert.equal(result.counts.aliasAdded,1);
  assert.equal(result.counts.updated,1);
  assert.equal(result.counts.aliasUpdated,1);
  assert.equal(result.counts.unchanged,2);
});

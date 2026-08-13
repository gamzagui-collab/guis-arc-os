import { normalizeAlias } from "./contracts.js";

const REQUIRED_SHEETS=["01_위치마스터","02_위치별칭"];
const ROOT_TYPES=new Set(["BUILDING","PARKING","COMMERCIAL","COMMON","FACILITY","EXTERIOR","OTHER"]);
const TYPES=new Set([...ROOT_TYPES,"FLOOR","UNIT","ROOM"]);
const ALIAS_TYPES=new Set(["OFFICIAL_VARIANT","FIELD_NAME","LEGACY_NAME"]);
const compatible=(child,parent)=>ROOT_TYPES.has(child)?!parent:child==="FLOOR"?ROOT_TYPES.has(parent):child==="UNIT"?(parent==="FLOOR"||ROOT_TYPES.has(parent)):child==="ROOM"?(parent==="UNIT"||parent==="FLOOR"||ROOT_TYPES.has(parent)):false;
const value=(row,camel,snake)=>row?.[camel]??row?.[snake];
const active=row=>Number(value(row,"isActive","is_active"))===1;
const error=(code,row,field)=>({code,field,sourceSheetName:row?.sourceSheetName??null,sourceRow:row?.sourceRow??null});

export function blockedLocationInactivationIds(siteId,incomingIds,currentLocations=[]){
  const activeRows=currentLocations.filter(row=>value(row,"siteId","site_id")===siteId&&active(row));
  const candidates=new Set(activeRows.filter(row=>value(row,"source","source")==="IMPORT"&&!incomingIds.has(value(row,"id","id"))).map(row=>value(row,"id","id")));
  const retained=new Set(activeRows.filter(row=>!candidates.has(value(row,"id","id"))).map(row=>value(row,"id","id")));
  let changed=true;while(changed){changed=false;for(const row of activeRows){const id=value(row,"id","id"),parentId=value(row,"parentId","parent_id");if(candidates.has(id)&&activeRows.some(child=>value(child,"parentId","parent_id")===id&&retained.has(value(child,"id","id")))){candidates.delete(id);retained.add(id);changed=true}if(parentId&&retained.has(id)&&candidates.has(parentId)){candidates.delete(parentId);retained.add(parentId);changed=true}}}
  return new Set(activeRows.filter(row=>value(row,"source","source")==="IMPORT"&&!incomingIds.has(value(row,"id","id"))&&retained.has(value(row,"id","id"))).map(row=>value(row,"id","id")));
}

export function validateLocationImport({siteId,workbook,current={},identityGuards={}}){
  const errors=[];
  const locations=Array.isArray(workbook?.locations)?workbook.locations:[];
  const aliases=Array.isArray(workbook?.aliases)?workbook.aliases:[];
  const sheets=workbook?.workbookMeta?.sheetNames;
  if(Array.isArray(sheets))for(const sheet of REQUIRED_SHEETS)if(!sheets.includes(sheet))errors.push(error("LOCATION_IMPORT_SHEET_REQUIRED",null,"sheet"));
  if(!Array.isArray(workbook?.locations)||!Array.isArray(workbook?.aliases))errors.push(error("LOCATION_IMPORT_HEADER_REQUIRED",null,"headers"));
  for(const key of ["siteId","site_id","siteCode","site_code"]){const metadata=workbook?.workbookMeta?.[key];if(metadata&&metadata!==siteId)errors.push(error("LOCATION_IMPORT_CROSS_SITE_REFERENCE",null,key));}

  const existingLocations=Array.isArray(current.locations)?current.locations:[];
  const existingAliases=Array.isArray(current.aliases)?current.aliases:[];
  const foreignLocationIds=identityGuards.foreignLocationIds??new Set();
  const foreignAliasIds=identityGuards.foreignAliasIds??new Set();
  const byExistingId=new Map(existingLocations.map(row=>[value(row,"id","id"),row]));
  const sameSiteKey=new Map(existingLocations.filter(row=>value(row,"siteId","site_id")===siteId&&value(row,"canonicalKey","canonical_key")).map(row=>[value(row,"canonicalKey","canonical_key"),row]));
  const normalizedLocations=locations.map(row=>({
    id:String(row.locationId??"").trim(),siteId,parentId:String(row.parentLocationId??"").trim()||null,
    locationType:String(row.locationType??"").trim().toUpperCase(),canonicalKey:String(row.canonicalKey??"").trim(),
    displayName:String(row.displayName??"").trim(),sortOrder:Number(row.sortOrder),sourceSheetName:row.sourceSheetName,sourceRow:row.sourceRow
  }));
  const incomingById=new Map();
  const incomingByKey=new Map();
  for(const row of normalizedLocations){
    if(!row.id)errors.push(error("LOCATION_IMPORT_FIELD_REQUIRED",row,"location_id"));else if(incomingById.has(row.id))errors.push(error("LOCATION_IMPORT_LOCATION_ID_DUPLICATE",row,"location_id"));else incomingById.set(row.id,row);
    if(!row.canonicalKey)errors.push(error("LOCATION_IMPORT_FIELD_REQUIRED",row,"canonical_key"));else if(incomingByKey.has(row.canonicalKey))errors.push(error("LOCATION_IMPORT_CANONICAL_KEY_DUPLICATE",row,"canonical_key"));else incomingByKey.set(row.canonicalKey,row);
    if(!row.displayName)errors.push(error("LOCATION_IMPORT_FIELD_REQUIRED",row,"display_name"));
    if(!Number.isFinite(row.sortOrder)||!Number.isInteger(row.sortOrder)||row.sortOrder<0)errors.push(error("LOCATION_IMPORT_SORT_ORDER_INVALID",row,"sort_order"));
    if(!TYPES.has(row.locationType))errors.push(error("LOCATION_IMPORT_TYPE_UNSUPPORTED",row,"location_type"));
    if(foreignLocationIds.has(row.id))errors.push(error("LOCATION_IMPORT_CROSS_SITE_REFERENCE",row,"location_id"));
    if(row.parentId&&foreignLocationIds.has(row.parentId))errors.push(error("LOCATION_IMPORT_CROSS_SITE_REFERENCE",row,"parent_location_id"));
    if(row.parentId===row.id)errors.push(error("LOCATION_IMPORT_PARENT_SELF",row,"parent_location_id"));
    const old=byExistingId.get(row.id);
    if(old&&value(old,"siteId","site_id")!==siteId)errors.push(error("LOCATION_IMPORT_CROSS_SITE_REFERENCE",row,"location_id"));
    else if(old&&value(old,"source","source")!=="IMPORT")errors.push(error("LOCATION_IMPORT_IDENTITY_REUSED",row,"location_id"));
    else if(old&&value(old,"canonicalKey","canonical_key")&&value(old,"canonicalKey","canonical_key")!==row.canonicalKey)errors.push(error("LOCATION_IMPORT_IDENTITY_REUSED",row,"canonical_key"));
    const keyOwner=sameSiteKey.get(row.canonicalKey);
    if(keyOwner&&value(keyOwner,"id","id")!==row.id)errors.push(error("LOCATION_IMPORT_CANONICAL_KEY_REUSED",row,"canonical_key"));
  }

  const graph=new Map(normalizedLocations.map(row=>[row.id,row]));
  for(const row of normalizedLocations){
    if(!row.parentId){if(!compatible(row.locationType,null))errors.push(error("LOCATION_IMPORT_TYPE_UNSUPPORTED",row,"parent_location_id"));continue;}
    let parent=graph.get(row.parentId);
    if(!parent){
      const stored=byExistingId.get(row.parentId);
      if(stored&&value(stored,"siteId","site_id")!==siteId){errors.push(error("LOCATION_IMPORT_CROSS_SITE_REFERENCE",row,"parent_location_id"));continue;}
      if(stored&&active(stored)&&value(stored,"source","source")!=="IMPORT")parent={id:row.parentId,parentId:value(stored,"parentId","parent_id")??null,locationType:value(stored,"locationType","location_type")};
      else {errors.push(error("LOCATION_IMPORT_PARENT_MISSING",row,"parent_location_id"));continue;}
      graph.set(parent.id,parent);
    }
    if(!compatible(row.locationType,parent.locationType))errors.push(error("LOCATION_IMPORT_TYPE_UNSUPPORTED",row,"parent_location_id"));
  }
  const colors=new Map();
  const visit=id=>{const color=colors.get(id);if(color===1)return true;if(color===2)return false;colors.set(id,1);const parent=graph.get(id)?.parentId;if(parent&&graph.has(parent)&&visit(parent))return true;colors.set(id,2);return false;};
  if([...graph.keys()].some(visit))errors.push(error("LOCATION_IMPORT_PARENT_CYCLE",null,"parent_location_id"));
  const incomingIds=new Set(normalizedLocations.map(row=>row.id).filter(Boolean));
  for(const id of blockedLocationInactivationIds(siteId,incomingIds,existingLocations))errors.push(error("LOCATION_IMPORT_PARENT_HAS_RETAINED_CHILD",byExistingId.get(id),"location_id"));

  const normalizedAliases=aliases.map(row=>({id:String(row.aliasId??"").trim(),siteId,locationId:String(row.locationId??"").trim(),aliasText:String(row.aliasText??"").trim(),normalizedAlias:normalizeAlias(row.aliasText??""),aliasType:String(row.aliasType??"").trim().toUpperCase(),sourceSheetName:row.sourceSheetName,sourceRow:row.sourceRow}));
  const aliasIds=new Set(),aliasTexts=new Map();
  for(const row of normalizedAliases){
    if(!row.id)errors.push(error("LOCATION_IMPORT_FIELD_REQUIRED",row,"alias_id"));else if(aliasIds.has(row.id))errors.push(error("LOCATION_IMPORT_IDENTITY_REUSED",row,"alias_id"));aliasIds.add(row.id);
    if(!row.aliasText)errors.push(error("LOCATION_IMPORT_FIELD_REQUIRED",row,"alias_text"));
    if(foreignAliasIds.has(row.id))errors.push(error("LOCATION_IMPORT_CROSS_SITE_REFERENCE",row,"alias_id"));
    if(foreignLocationIds.has(row.locationId))errors.push(error("LOCATION_IMPORT_CROSS_SITE_REFERENCE",row,"location_id"));
    if(aliasTexts.has(row.normalizedAlias)&&aliasTexts.get(row.normalizedAlias)!==row.id)errors.push(error("LOCATION_IMPORT_IDENTITY_REUSED",row,"alias_text"));else aliasTexts.set(row.normalizedAlias,row.id);
    const target=incomingById.get(row.locationId)??byExistingId.get(row.locationId);
    if(!target)errors.push(error("LOCATION_IMPORT_ALIAS_TARGET_MISSING",row,"location_id"));
    else if(!incomingById.has(row.locationId)&&(value(target,"siteId","site_id")!==siteId||!active(target)))errors.push(error("LOCATION_IMPORT_CROSS_SITE_REFERENCE",row,"location_id"));
    else if(!incomingById.has(row.locationId)&&value(target,"source","source")==="IMPORT")errors.push(error("LOCATION_IMPORT_ALIAS_TARGET_MISSING",row,"location_id"));
    if(!ALIAS_TYPES.has(row.aliasType))errors.push(error("LOCATION_IMPORT_TYPE_UNSUPPORTED",row,"alias_type"));
    const old=existingAliases.find(item=>value(item,"id","id")===row.id);
    if(old&&value(old,"siteId","site_id")!==siteId)errors.push(error("LOCATION_IMPORT_CROSS_SITE_REFERENCE",row,"alias_id"));
    else if(old&&value(old,"source","source")!=="IMPORT")errors.push(error("LOCATION_IMPORT_IDENTITY_REUSED",row,"alias_id"));
    else if(old&&(value(old,"normalizedAlias","normalized_alias")!==row.normalizedAlias||value(old,"locationId","location_id")!==row.locationId))errors.push(error("LOCATION_IMPORT_IDENTITY_REUSED",row,"alias_id"));
    const normalizedOwner=existingAliases.find(item=>value(item,"siteId","site_id")===siteId&&value(item,"normalizedAlias","normalized_alias")===row.normalizedAlias);
    if(normalizedOwner&&value(normalizedOwner,"id","id")!==row.id)errors.push(error("LOCATION_IMPORT_IDENTITY_REUSED",row,"alias_text"));
  }
  normalizedLocations.sort((a,b)=>a.id.localeCompare(b.id));normalizedAliases.sort((a,b)=>a.id.localeCompare(b.id));
  return {errors,applyAllowed:errors.length===0,normalized:{locations:normalizedLocations,aliases:normalizedAliases}};
}

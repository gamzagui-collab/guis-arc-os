import {IMPORT_REQUIRED_SHEETS,normalizeLocationText} from "./contracts.js";
import {buildLocationCandidateTree,isLocationParentCompatible} from "./candidate-tree.js";

const value=(row,camel,snake)=>row?.[camel]??row?.[snake];
const active=row=>Number(value(row,"isActive","is_active"))===1;
const error=(code,row,field)=>({code,field,sourceSheetName:row?.sourceSheetName??null,sourceRow:row?.sourceRow??null});
const CONTROL_CHARACTER=/[\u0000-\u001F\u007F]/u;

export function isLocationImportParentInactive(parentId,candidateIds,existingById){
  return Boolean(parentId&&existingById.has(parentId)&&!active(existingById.get(parentId))&&!candidateIds.has(parentId));
}

export function blockedLocationInactivationIds(siteId,incomingIds,currentLocations=[]){
  const activeRows=currentLocations.filter(row=>value(row,"siteId","site_id")===siteId&&active(row));
  const candidates=new Set(activeRows.filter(row=>value(row,"source","source")==="IMPORT"&&!incomingIds.has(value(row,"id","id"))).map(row=>value(row,"id","id")));
  const retained=new Set(activeRows.filter(row=>!candidates.has(value(row,"id","id"))).map(row=>value(row,"id","id")));
  let changed=true;
  while(changed){changed=false;for(const row of activeRows){const id=value(row,"id","id"),parentId=value(row,"parentId","parent_id");if(candidates.has(id)&&activeRows.some(child=>value(child,"parentId","parent_id")===id&&retained.has(value(child,"id","id")))){candidates.delete(id);retained.add(id);changed=true}if(parentId&&retained.has(id)&&candidates.has(parentId)){candidates.delete(parentId);retained.add(parentId);changed=true}}}
  return new Set(activeRows.filter(row=>value(row,"source","source")==="IMPORT"&&!incomingIds.has(value(row,"id","id"))&&retained.has(value(row,"id","id"))).map(row=>value(row,"id","id")));
}

export function validateLocationImport({siteId,workbook,current={},identityGuards={}}){
  const errors=[];
  const rows=Array.isArray(workbook?.locations)?workbook.locations:[];
  const sheets=workbook?.workbookMeta?.sheetNames;
  if(Array.isArray(sheets))for(const sheet of IMPORT_REQUIRED_SHEETS)if(!sheets.includes(sheet))errors.push(error("LOCATION_IMPORT_SHEET_REQUIRED",null,"sheet"));
  if(!Array.isArray(workbook?.locations))errors.push(error("LOCATION_IMPORT_HEADER_REQUIRED",null,"headers"));
  for(const row of rows)for(const field of ["area","floor","space"])if(CONTROL_CHARACTER.test(String(row?.[field]??"")))errors.push(error("LOCATION_IMPORT_CONTROL_CHARACTER",row,field));
  const existingLocations=Array.isArray(current.locations)?current.locations:[];
  const built=buildLocationCandidateTree({siteId,rows,currentLocations:existingLocations});
  errors.push(...built.errors);
  const existingById=new Map(existingLocations.map(row=>[value(row,"id","id"),row]));
  const candidateIds=new Set(built.locations.map(row=>row.id));
  const existingByKey=new Map(existingLocations.filter(row=>value(row,"siteId","site_id")===siteId&&value(row,"canonicalKey","canonical_key")).map(row=>[value(row,"canonicalKey","canonical_key"),row]));
  const foreignIds=identityGuards.foreignLocationIds??new Set();
  for(const location of built.locations){
    if(foreignIds.has(location.id))errors.push(error("LOCATION_IMPORT_CROSS_SITE_REFERENCE",location,"location_id"));
    const keyOwner=existingByKey.get(location.canonicalKey);
    if(keyOwner&&value(keyOwner,"id","id")!==location.id)errors.push(error("LOCATION_IMPORT_CANONICAL_KEY_REUSED",location,"canonical_key"));
    const parent=location.parentId?built.locations.find(row=>row.id===location.parentId)??existingById.get(location.parentId):null;
    if(location.parentId&&!parent)errors.push(error("LOCATION_IMPORT_PARENT_MISSING",location,"parent_location_id"));
    else if(isLocationImportParentInactive(location.parentId,candidateIds,existingById))errors.push(error("LOCATION_IMPORT_PARENT_INACTIVE",location,"parent_location_id"));
    else if(!isLocationParentCompatible(location.locationType,parent&&value(parent,"locationType","location_type")))errors.push(error("LOCATION_IMPORT_TYPE_UNSUPPORTED",location,"location_type"));
  }
  const incomingIds=new Set(built.locations.map(row=>row.id));
  for(const id of blockedLocationInactivationIds(siteId,incomingIds,existingLocations))errors.push(error("LOCATION_IMPORT_PARENT_HAS_RETAINED_CHILD",existingById.get(id),"location_id"));
  const locations=built.locations.map(row=>({...row,displayName:normalizeLocationText(row.displayName)}));
  return {errors,applyAllowed:errors.length===0,normalized:{locations,aliases:[]}};
}

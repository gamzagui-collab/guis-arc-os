import {blockedLocationInactivationIds} from "./validation.js";
import {sha256} from "./identity.js";
const get=(row,camel,snake)=>row?.[camel]??row?.[snake];
const cleanLocation=row=>({id:get(row,"id","id"),siteId:get(row,"siteId","site_id"),parentId:get(row,"parentId","parent_id")??null,locationType:get(row,"locationType","location_type"),canonicalKey:get(row,"canonicalKey","canonical_key")??null,displayName:get(row,"displayName","display_name"),sortOrder:Number(get(row,"sortOrder","sort_order")||0),source:get(row,"source","source"),isActive:Number(get(row,"isActive","is_active"))});
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==="object"?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const stable=value=>JSON.stringify(canonical(value));
export {sha256};
const ordered=items=>[...items].sort((a,b)=>String(a.id).localeCompare(String(b.id))||a.type.localeCompare(b.type));
const same=(a,b,keys)=>keys.every(key=>a[key]===b[key]);

export function fingerprintLocationMaster(siteId,current={}){return sha256(stable({locations:(current.locations??[]).map(cleanLocation).filter(row=>row.siteId===siteId).sort((a,b)=>a.id.localeCompare(b.id))}))}

function renameCandidates(operations){
  const pendingAdds=operations.filter(item=>item.type==="ADD"),pendingRemoved=operations.filter(item=>item.type==="INACTIVE"),parentMap=new Map(),candidates=[];
  let changed=true;
  while(changed){
    changed=false;
    const groups=new Map();
    for(const item of pendingAdds){const row=item.after,parentId=parentMap.get(row.parentId)??row.parentId,key=`${parentId??""}|${row.locationType}`,group=groups.get(key)??{adds:[],removed:[]};group.adds.push(item);groups.set(key,group)}
    for(const item of pendingRemoved){const row=item.before,key=`${row.parentId??""}|${row.locationType}`,group=groups.get(key)??{adds:[],removed:[]};group.removed.push(item);groups.set(key,group)}
    for(const group of groups.values())if(group.adds.length===1&&group.removed.length===1){
      const add=group.adds[0],removed=group.removed[0];
      if(add.after.displayName!==removed.before.displayName)candidates.push({type:"RENAME_CANDIDATE",id:`${removed.id}:${add.id}`,from:removed.before,to:add.after});
      parentMap.set(add.id,removed.id);
      pendingAdds.splice(pendingAdds.indexOf(add),1);
      pendingRemoved.splice(pendingRemoved.indexOf(removed),1);
      changed=true;
    }
  }
  return candidates;
}

export function buildLocationImportDiff({siteId,normalized,current={},renameDecisions}){
  const currentLocations=(current.locations??[]).map(cleanLocation),locationById=new Map(currentLocations.map(row=>[row.id,row])),operations=[];let unchanged=0;
  for(const incoming of normalized.locations??[]){const old=locationById.get(incoming.id);if(old&&old.siteId!==siteId)operations.push({type:"ERROR",id:incoming.id,code:"LOCATION_IMPORT_CROSS_SITE_REFERENCE"});else if(!old)operations.push({type:"ADD",id:incoming.id,after:{...incoming,source:"IMPORT",isActive:1}});else if(old.source!=="IMPORT")unchanged++;else{const after={...incoming,source:"IMPORT",isActive:1};if(same(old,after,["parentId","locationType","canonicalKey","displayName","sortOrder","isActive"]))unchanged++;else operations.push({type:"UPDATE",id:incoming.id,before:old,after})}}
  const incomingIds=new Set((normalized.locations??[]).map(row=>row.id)),blocked=blockedLocationInactivationIds(siteId,incomingIds,currentLocations);
  for(const row of currentLocations)if(row.siteId===siteId&&row.source==="IMPORT"&&row.isActive===1&&!incomingIds.has(row.id))operations.push(blocked.has(row.id)?{type:"ERROR",id:row.id,code:"LOCATION_IMPORT_PARENT_HAS_RETAINED_CHILD"}:{type:"INACTIVE",id:row.id,before:row,after:{...row,isActive:0}});
  const baseOperations=operations.map(item=>({...item})),candidates=renameCandidates(baseOperations),basePreviewHash=sha256(stable(ordered([...baseOperations,...candidates]))),candidateById=new Map(candidates.map(item=>[item.id,item])),selected=new Set(),idMap=new Map();
  const preserve=(add,inactive,parentId=add.after.parentId)=>{add.skip=true;inactive.skip=true;idMap.set(add.id,inactive.id);operations.push({type:"UPDATE",id:inactive.id,before:inactive.before,after:{...add.after,id:inactive.id,parentId,canonicalKey:inactive.before.canonicalKey,source:"IMPORT",isActive:1}})};
  for(const decision of renameDecisions??[]){const id=`${decision?.fromId??""}:${decision?.toId??""}`,candidate=candidateById.get(id);if(!candidate||!["SAME_LOCATION","NEW_LOCATION"].includes(decision?.decision)){operations.push({type:"ERROR",id,code:"LOCATION_IMPORT_RENAME_DECISION_INVALID"});continue}selected.add(id);if(decision.decision==="NEW_LOCATION")continue;const add=operations.find(item=>item.type==="ADD"&&item.id===candidate.to.id),inactive=operations.find(item=>item.type==="INACTIVE"&&item.id===candidate.from.id);if(add&&inactive)preserve(add,inactive,idMap.get(add.after.parentId)??add.after.parentId)}
  let changed=true;while(changed){changed=false;for(const add of operations.filter(item=>item.type==="ADD"&&!item.skip&&idMap.has(item.after.parentId))){const parentId=idMap.get(add.after.parentId),matches=operations.filter(item=>item.type==="INACTIVE"&&!item.skip&&item.before.parentId===parentId&&item.before.locationType===add.after.locationType&&item.before.displayName===add.after.displayName);if(matches.length===1){preserve(add,matches[0],parentId);changed=true}else if(add.after.parentId!==parentId){add.after={...add.after,parentId};changed=true}}}
  if(Array.isArray(renameDecisions))for(const candidate of candidates)if(!selected.has(candidate.id))operations.push({type:"ERROR",id:candidate.id,code:"LOCATION_IMPORT_RENAME_DECISION_REQUIRED"});
  const visible=[...operations.filter(item=>!item.skip),...candidates.filter(item=>!selected.has(item.id))],sorted=ordered(visible),count=type=>sorted.filter(row=>row.type===type).length;
  return {operations:sorted,counts:{added:count("ADD"),updated:count("UPDATE"),unchanged,inactivated:count("INACTIVE"),renameCandidates:count("RENAME_CANDIDATE"),error:count("ERROR")},baseMasterFingerprint:fingerprintLocationMaster(siteId,current),previewHash:basePreviewHash};
}

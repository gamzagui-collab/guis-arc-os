import {normalizeLocationText} from "./contracts.js";
import {generatedLocationIdentity} from "./identity.js";

const ROOT_TYPES=new Set(["BUILDING","PARKING","COMMERCIAL","COMMON","FACILITY","EXTERIOR","OTHER"]);
const rootType=value=>/^\d+동$/u.test(value)?"BUILDING":"OTHER";
const unitType=value=>/^\d+호$/u.test(value)?"UNIT":"FACILITY";
const segment=(type,name)=>`${type}:${normalizeLocationText(name)}`;
const currentValue=(row,camel,snake)=>row?.[camel]??row?.[snake];

function existingPathIndex(siteId,locations=[]){
  const rows=new Map(locations.filter(row=>currentValue(row,"siteId","site_id")===siteId).map(row=>[currentValue(row,"id","id"),row]));
  const paths=new Map(),visiting=new Set();
  const resolve=id=>{
    if(paths.has(id))return paths.get(id);
    if(visiting.has(id))return null;
    const row=rows.get(id);if(!row)return null;
    visiting.add(id);
    const parentId=currentValue(row,"parentId","parent_id");
    const parent=parentId?resolve(parentId):"";
    visiting.delete(id);
    if(parentId&&!parent)return null;
    const path=parent?`${parent}/${segment(currentValue(row,"locationType","location_type"),currentValue(row,"displayName","display_name"))}`:segment(currentValue(row,"locationType","location_type"),currentValue(row,"displayName","display_name"));
    paths.set(id,path);return path;
  };
  for(const id of rows.keys())resolve(id);
  return {byPath:new Map([...paths.entries()].map(([id,path])=>[path,rows.get(id)])),pathById:paths};
}

export function buildLocationCandidateTree({siteId,rows=[],currentLocations=[]}){
  const errors=[],existing=existingPathIndex(siteId,currentLocations),nodes=new Map(),childOrder=new Map();
  const nextOrder=parentPath=>{const current=(childOrder.get(parentPath)??0)+10;childOrder.set(parentPath,current);return current};
  const ensure=(parent,type,input,row)=>{
    const displayName=normalizeLocationText(input);if(!displayName)return null;
    const path=parent?`${parent.path}/${segment(type,displayName)}`:segment(type,displayName);
    if(nodes.has(path))return nodes.get(path);
    const old=existing.byPath.get(path),generated=generatedLocationIdentity(siteId,path),sortOrder=old&&currentValue(old,"source","source")!=="IMPORT"?Number(currentValue(old,"sortOrder","sort_order")||0):nextOrder(parent?.path??"/");
    const id=old?currentValue(old,"id","id"):generated.id;
    const canonicalKey=old&&currentValue(old,"canonicalKey","canonical_key")?currentValue(old,"canonicalKey","canonical_key"):generated.canonicalKey;
    const ownerPath=existing.pathById.get(id);
    if(ownerPath&&ownerPath!==path)errors.push({code:"LOCATION_IMPORT_ID_COLLISION",field:"location_id",sourceSheetName:row.sourceSheetName,sourceRow:row.sourceRow});
    const node={id,siteId,parentId:parent?.id??null,locationType:type,canonicalKey,displayName,sortOrder,source:old?currentValue(old,"source","source"):"IMPORT",isActive:1,path,sourceSheetName:row.sourceSheetName,sourceRow:row.sourceRow};
    nodes.set(path,node);return node;
  };
  for(const row of rows){
    const area=normalizeLocationText(row.area),floor=normalizeLocationText(row.floor),space=normalizeLocationText(row.space),detail=normalizeLocationText(row.detail);
    if(!area){errors.push({code:"LOCATION_IMPORT_FIELD_REQUIRED",field:"동/구역",sourceSheetName:row.sourceSheetName,sourceRow:row.sourceRow});continue}
    if((space||detail)&&!floor){errors.push({code:"LOCATION_IMPORT_FLOOR_REQUIRED",field:"층",sourceSheetName:row.sourceSheetName,sourceRow:row.sourceRow});continue}
    let parent=ensure(null,rootType(area),area,row);
    if(floor)parent=ensure(parent,"FLOOR",floor,row);
    if(space)parent=ensure(parent,unitType(space),space,row);
    if(detail)ensure(parent,"ROOM",detail,row);
  }
  const locations=[...nodes.values()].sort((a,b)=>a.path.localeCompare(b.path)||a.sortOrder-b.sortOrder);
  const keys=new Map(),ids=new Map();
  for(const node of locations){
    if(keys.has(node.canonicalKey)&&keys.get(node.canonicalKey)!==node.path)errors.push({code:"LOCATION_IMPORT_CANONICAL_KEY_COLLISION",field:"canonical_key",sourceSheetName:node.sourceSheetName,sourceRow:node.sourceRow});else keys.set(node.canonicalKey,node.path);
    if(ids.has(node.id)&&ids.get(node.id)!==node.path)errors.push({code:"LOCATION_IMPORT_ID_COLLISION",field:"location_id",sourceSheetName:node.sourceSheetName,sourceRow:node.sourceRow});else ids.set(node.id,node.path);
  }
  return {locations,errors};
}

export const isLocationParentCompatible=(child,parent)=>{
  if(child==="FACILITY")return !parent||parent==="FLOOR"||ROOT_TYPES.has(parent);
  if(ROOT_TYPES.has(child))return !parent;
  if(child==="FLOOR")return ROOT_TYPES.has(parent);
  if(child==="UNIT")return parent==="FLOOR"||ROOT_TYPES.has(parent);
  return child==="ROOM"&&["UNIT","FACILITY","FLOOR",...ROOT_TYPES].includes(parent);
};

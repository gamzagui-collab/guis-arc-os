const EMPTY_PATH=()=>({buildingId:null,floorId:null,unitId:null,roomId:null});
const normalize=value=>String(value||"").normalize("NFKC").replace(/\s+/g,"").toLowerCase();
const BUILDING_TYPES=new Set(["BUILDING","PARKING","COMMERCIAL","COMMON","FACILITY","EXTERIOR","OTHER"]);
const unique=values=>[...new Map(values.map(value=>[value.id,value])).values()];
const children=(locations,parentId,type)=>locations.filter(value=>value.parent_id===parentId&&value.location_type===type);
const result=(status,path,labels={},detail=null)=>({status,path,labels,detail});
const locationTokens=(text,pattern)=>new Set(text.match(pattern)||[]);
const samePath=(left,right)=>["buildingId","floorId","unitId","roomId"].every(key=>(left?.[key]||null)===(right?.[key]||null));

export function locationChildrenForParent(locations,parentId,type){
 if(!parentId||!Array.isArray(locations))return [];
 return locations.filter(value=>value.parent_id===parentId&&value.location_type===type);
}

export function reconcileLocationCascadePath(locations,path={}){
 const byId=new Map((locations||[]).map(value=>[value.id,value])),resolved=EMPTY_PATH();
 const building=byId.get(path.buildingId);
 if(!building||!BUILDING_TYPES.has(building.location_type))return resolved;
 resolved.buildingId=building.id;
 const floor=byId.get(path.floorId);
 if(floor?.location_type==="FLOOR"&&floor.parent_id===building.id)resolved.floorId=floor.id;
 const unitParent=resolved.floorId||resolved.buildingId,unit=byId.get(path.unitId);
 if(unit?.location_type==="UNIT"&&unit.parent_id===unitParent)resolved.unitId=unit.id;
 const roomParent=resolved.unitId||resolved.floorId||resolved.buildingId,room=byId.get(path.roomId);
 if(room?.location_type==="ROOM"&&room.parent_id===roomParent)resolved.roomId=room.id;
 return resolved;
}

export function reconcileResolverSelection(current,lastOwned,resolverResult,manualOverride=false){
 const currentPath={...EMPTY_PATH(),...current},resolvedPath={...EMPTY_PATH(),...resolverResult?.path};
 if(["UNRESOLVED","ERROR_FALLBACK"].includes(resolverResult?.status)){
  const clear=!manualOverride&&lastOwned&&samePath(currentPath,lastOwned);
  return {path:clear?EMPTY_PATH():currentPath,ownedPath:null};
 }
 if(resolverResult?.status==="AMBIGUOUS"&&manualOverride){
  return {path:currentPath,ownedPath:null};
 }
 return {path:resolvedPath,ownedPath:resolvedPath};
}

const DETAIL_SUGGESTIONS=Object.freeze({
 RESIDENTIAL:["거실","주방/식당","현관","침실","욕실","발코니","드레스룸","팬트리","기타"],
 COMMON:["계단실","복도","엘리베이터홀","공용부","화장실","출입구","기타"],
 PARKING:["주차구역","램프","출입구","계단실","기계실","전기실","기타"],
 EXTERIOR:["외곽","출입구","보도","조경","비계","옥상","기타"],
 INDEPENDENT:["내부","입구","벽","천장","바닥","기타"]
});

export function issueDetailSuggestions({building="",floor="",space=""}={}){
 const labels=`${building} ${floor} ${space}`.normalize("NFKC"),kind=/(?:B?\d{3,4})호/i.test(space)?"RESIDENTIAL":/주차|램프/.test(labels)?"PARKING":/외부|옥상/.test(`${building} ${floor}`)?"EXTERIOR":String(space).trim()?"INDEPENDENT":"COMMON";
 return {kind,items:[...DETAIL_SUGGESTIONS[kind]]};
}

export function issueLocationSubmission({mode="CANONICAL",manualText="",canonical={},canonicalText="",detailText=""}={}){
 const direct=mode==="DIRECT";
 const structural=String(canonicalText).trim(),detail=String(detailText).trim();
 return {
  location:direct?String(manualText).trim():[structural,detail].filter(Boolean).join(" / "),
  buildingLocationId:direct?"":canonical.buildingLocationId||"",
  buildingType:direct?"BUILDING":canonical.buildingType||"BUILDING",
  floorLocationId:direct?"":canonical.floorLocationId||"",
  unitLocationId:direct?"":canonical.unitLocationId||"",
  roomLocationId:""
 };
}

export function resolveIssueDescriptionLocation(description,{locations,aliases=[]}={}){
 try{
  if(!Array.isArray(locations)||!Array.isArray(aliases))throw new TypeError("Invalid resolver input");
  const text=normalize(description),wordTokens=new Set(String(description||"").normalize("NFKC").split(/\s+/).map(normalize).filter(Boolean)),buildingTokens=locationTokens(text,/(?:[a-z]?\d+)\uB3D9/gi),floorTokens=locationTokens(text,/(?:b?\d+)\uCE35/gi),byId=new Map(locations.map(value=>[value.id,value])),path=EMPTY_PATH(),labels={};
  if(!text)return result("UNRESOLVED",path,labels);
  const buildingMatches=locations.filter(value=>BUILDING_TYPES.has(value.location_type)&&buildingTokens.has(normalize(value.display_name||value.name)));
  const aliasMatches=aliases.filter(value=>buildingTokens.has(normalize(value.alias_text||value.normalized_alias))).map(value=>byId.get(value.location_id)).filter(value=>value&&BUILDING_TYPES.has(value.location_type));
  const buildings=unique([...buildingMatches,...aliasMatches]);
  if(buildings.length!==1)return result(buildings.length>1?"AMBIGUOUS":"UNRESOLVED",path,labels,buildings.length>1?"BUILDING":null);
  const building=buildings[0];path.buildingId=building.id;labels.building=building.display_name||building.name;
  const floors=children(locations,building.id,"FLOOR"),explicitFloors=floors.filter(value=>floorTokens.has(normalize(value.display_name||value.name)));
  let floor=explicitFloors.length===1?explicitFloors[0]:null,ambiguous=explicitFloors.length>1;
  const fullUnitToken=text.match(/(?:b\d+|\d{3,4})\uD638/i)?.[0]||null,descendantUnits=floors.flatMap(value=>children(locations,value.id,"UNIT"));
  let unit=null;
  if(fullUnitToken){const matches=descendantUnits.filter(value=>normalize(value.display_name||value.name)===fullUnitToken.toLowerCase());if(matches.length===1){unit=matches[0];floor=byId.get(unit.parent_id)||floor}else if(matches.length>1)ambiguous=true}
  else if(floor){const short=text.match(/(?:^|[^0-9])(\d{1,2})\uD638(?:$|[^0-9])/i)?.[1],floorNumber=normalize(floor.display_name||floor.name).match(/(\d+)\uCE35/)?.[1],candidate=short&&floorNumber?`${floorNumber}${String(short).padStart(2,"0")}\uD638`:null,matches=candidate?children(locations,floor.id,"UNIT").filter(value=>normalize(value.display_name||value.name)===candidate):[];if(matches.length===1)unit=matches[0];else if(matches.length>1)ambiguous=true}
  if(floor){path.floorId=floor.id;labels.floor=floor.display_name||floor.name}if(unit){path.unitId=unit.id;labels.unit=unit.display_name||unit.name}
  const parentId=unit?.id||floor?.id||building.id,rooms=children(locations,parentId,"ROOM"),exactRooms=rooms.filter(value=>wordTokens.has(normalize(value.display_name||value.name)));
  let room=null;if(exactRooms.length===1)room=exactRooms[0];else if(exactRooms.length>1)ambiguous=true;
  if(!room&&rooms.length){const tokens=String(description||"").normalize("NFKC").split(/\s+/).map(normalize).filter(value=>value.length>=2),partials=unique(tokens.flatMap(token=>rooms.filter(value=>normalize(value.display_name||value.name).includes(token))));if(partials.length>1)ambiguous=true}
  if(room){path.roomId=room.id;labels.room=room.display_name||room.name}
  if(ambiguous)return result("AMBIGUOUS",path,labels,"LOWER_LOCATION");
  return result(path.roomId?"RESOLVED":"PARTIAL",path,labels);
 }catch{return result("ERROR_FALLBACK",EMPTY_PATH(),{},"RUNTIME")}
}

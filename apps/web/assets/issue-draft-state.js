export const ISSUE_DRAFT_SOURCE=Object.freeze({MANUAL:"MANUAL",SPEECH:"SPEECH",NONE:"NONE"});

const emptyLocation=()=>({id:null,label:"",source:"NONE"});
const emptyText=()=>({text:"",source:"NONE"});
const clean=value=>String(value||"").trim();
const clone=draft=>structuredClone(draft);
const normalizeLocation=(value,source)=>({id:value?.id||null,label:clean(value?.label),source:value?.id?source:"NONE"});
const removeToken=(text,label)=>clean(text).split(/\s+/).filter(token=>token!==clean(label)).join(" ");

export function createIssueDraft(){return {
 building:emptyLocation(),floor:emptyLocation(),unit:emptyLocation(),detail:emptyText(),content:emptyText(),
 directLocation:{enabled:false,text:""},speech:{rawTranscript:"",normalizedTranscript:"",parserSnapshot:null,appliedRuleIds:[]},
 unresolvedStructural:[],notice:""
}}

function resolveUnresolvedLevel(draft,level){
 const next=clone(draft),resolved=next.unresolvedStructural.filter(value=>value.level===level);
 for(const value of resolved)next.content.text=removeToken(next.content.text,value.label);
 next.unresolvedStructural=next.unresolvedStructural.filter(value=>value.level!==level);
 return next
}

export function setManualBuilding(draft,value){let next=resolveUnresolvedLevel(draft,"building");next.building=normalizeLocation(value,"MANUAL");next.floor=emptyLocation();next.unit=emptyLocation();next.notice="";return next}
export function setManualFloor(draft,value){let next=resolveUnresolvedLevel(draft,"floor");next.floor=normalizeLocation(value,"MANUAL");next.unit=emptyLocation();next.notice="";return next}
export function setManualUnit(draft,value){let next=resolveUnresolvedLevel(draft,"unit");next.unit=normalizeLocation(value,"MANUAL");next.notice="";return next}
export function setManualDetail(draft,text){const next=clone(draft);next.detail={text:clean(text),source:"MANUAL"};return next}
export function setManualContent(draft,text){const next=clone(draft);next.content={text:clean(text),source:"MANUAL"};return next}
export function setDirectLocation(draft,enabled,text=""){const next=clone(draft);next.directLocation={enabled:Boolean(enabled),text:clean(text)};if(enabled){next.building=emptyLocation();next.floor=emptyLocation();next.unit=emptyLocation()}next.notice="";return next}

const same=(left,right)=>Boolean(left?.id&&right?.id&&left.id===right.id);
const speechLocation=value=>normalizeLocation(value,"SPEECH");
const protectedConflict=(draft,candidate,level)=>draft[level].source==="MANUAL"&&candidate[level]?.id&&!same(draft[level],candidate[level]);

export function mergeSpeechCandidateIntoDraft(draft,candidate={}){
 const next=clone(draft),conflictBuilding=protectedConflict(next,candidate,"building"),conflictFloor=!conflictBuilding&&protectedConflict(next,candidate,"floor"),conflictUnit=!conflictBuilding&&!conflictFloor&&protectedConflict(next,candidate,"unit");
 next.notice=conflictBuilding||conflictFloor||conflictUnit?"MANUAL_LOCATION_PRIORITY":"";
 if(!next.directLocation.enabled){
  if(next.building.source!=="MANUAL"&&!conflictBuilding)next.building=speechLocation(candidate.building);
  if(next.floor.source!=="MANUAL"&&!conflictBuilding&&!conflictFloor&&(!candidate.floor?.id||!next.building.id||!candidate.building?.id||same(next.building,candidate.building)))next.floor=speechLocation(candidate.floor);
  if(next.unit.source!=="MANUAL"&&!conflictBuilding&&!conflictFloor&&!conflictUnit&&(!candidate.unit?.id||!next.floor.id||!candidate.floor?.id||same(next.floor,candidate.floor)))next.unit=speechLocation(candidate.unit);
 }
 if(next.detail.source!=="MANUAL")next.detail={text:clean(candidate.detail),source:clean(candidate.detail)?"SPEECH":"NONE"};
 if(next.content.source!=="MANUAL"){
  let content=clean(candidate.content);const unresolved=Array.isArray(candidate.unresolvedStructural)?candidate.unresolvedStructural:[];
  for(const value of unresolved)if(next[value.level]?.source==="MANUAL"&&next[value.level]?.id)content=removeToken(content,value.label);
  next.content={text:content,source:content?"SPEECH":"NONE"};
  next.unresolvedStructural=unresolved.filter(value=>!(next[value.level]?.source==="MANUAL"&&next[value.level]?.id)).map(value=>({...value}));
 }
 next.speech={rawTranscript:clean(candidate.rawTranscript),normalizedTranscript:clean(candidate.normalizedTranscript),parserSnapshot:candidate.parserSnapshot?structuredClone(candidate.parserSnapshot):null,appliedRuleIds:[...(candidate.appliedRuleIds||[])]};
 return next
}

export function buildDraftLocationText(draft){return draft.directLocation.enabled?clean(draft.directLocation.text):[draft.building.label,draft.floor.label,draft.unit.label,draft.detail.text].map(clean).filter(Boolean).join(" / ")}
export function buildDraftDisplay(draft){return {location:draft.directLocation.enabled?clean(draft.directLocation.text):[draft.building.label,draft.floor.label,draft.unit.label].map(clean).filter(Boolean).join(" / ")||"위치정보 없음",detail:clean(draft.detail.text),content:clean(draft.content.text),notice:draft.notice==="MANUAL_LOCATION_PRIORITY"?"수동 위치를 우선하여 음성 위치는 적용하지 않았습니다.":""}}
export function buildDraftPayloadView(draft){return {location:buildDraftLocationText(draft),description:clean(draft.content.text),buildingLocationId:draft.directLocation.enabled?"":draft.building.id||"",buildingType:"BUILDING",floorLocationId:draft.directLocation.enabled?"":draft.floor.id||"",unitLocationId:draft.directLocation.enabled?"":draft.unit.id||"",roomLocationId:"",speech:clone(draft.speech)}}

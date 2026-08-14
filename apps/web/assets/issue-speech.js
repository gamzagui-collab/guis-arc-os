const KOREAN_BUILDING_NUMBERS={일:1,이:2,삼:3,사:4,오:5,육:6,칠:7,팔:8,구:9,십:10,십일:11,십이:12,십삼:13,십사:14,십오:15};
const ROOM_SPEECH_TERMS=new Set(["현관","거실","주방","안방","침실","부부욕실","공용욕실","욕실","발코니","다용도실","드레스룸","복도","계단실","엘리베이터홀","주차구역","램프","기계실","전기실","공용부","외부","옥상","지하","슬래브","바닥","벽면","벽체","천장","기둥","보","피트","샤프트"]);
const DETAIL_START_TERMS=new Set([...ROOM_SPEECH_TERMS,"화장실","엘리베이터","홀","창가","창가쪽","방","작은방","큰방","세대","계단","팬트리","출입구","입구","외곽","보도","조경","비계","벽","외벽","북측","남측","동측","서측"]);
const DETAIL_CONTINUATION_TERMS=new Set([...DETAIL_START_TERMS,"쪽","측","앞","뒤","옆","안쪽","바깥쪽","내부","좌측","우측","상부","하부","주변","창호"]);

function splitIssueSpeechRemainder(value){
  const tokens=String(value||"").split(/\s+/).filter(Boolean);
  if(!tokens.length||!DETAIL_START_TERMS.has(tokens[0]))return {detailCandidate:"",contentCandidate:tokens.join(" ")};
  let boundary=1;
  while(boundary<tokens.length&&DETAIL_CONTINUATION_TERMS.has(tokens[boundary]))boundary++;
  if(boundary===tokens.length)return {detailCandidate:"",contentCandidate:tokens.join(" ")};
  return {detailCandidate:tokens.slice(0,boundary).join(" "),contentCandidate:tokens.slice(boundary).join(" ")};
}

export function extractLocationSpeech(text,{buildingNumberMode="STANDARD",phasePrefix=null,allowedBuildings=[]}={}){
  const normalized=String(text||"").replace(/\s+/g," ").trim();
  const unit=normalized.match(/((?:B\s*)?\d+)\s*호/i);
  const floor=normalized.match(/(지하\s*\d+|\d+)\s*층/);
  const numericBuilding=normalized.match(/(\d+)\s*동(?=\s|,|\.|$)/);
  const koreanBuilding=unit?normalized.match(/(십오|십사|십삼|십이|십일|십|일|이|삼|사|오|육|칠|팔|구)동(?=\s+\d+\s*호)/):null;
  let number=numericBuilding?Number(numericBuilding[1]):koreanBuilding?KOREAN_BUILDING_NUMBERS[koreanBuilding[1]]:null;
  if(number&&buildingNumberMode==="PHASE_PREFIX"&&phasePrefix&&number<100)number=Number(`${phasePrefix}${number}`);
  const buildingLabel=number?`${number}동`:null;
  const buildingAllowed=Boolean(buildingLabel&&(allowedBuildings.includes(buildingLabel)||numericBuilding));
  const numberedStair=normalized.match(/(?:([0-9]+)\s*번\s*계단(?:실)?|계단(?:실)?\s*([0-9]+)\s*번)/),stairNumber=numberedStair?.[1]||numberedStair?.[2],roomLabel=stairNumber?`${stairNumber}번계단`:(normalized.match(/[가-힣A-Za-z0-9]+/g)||[]).find(value=>ROOM_SPEECH_TERMS.has(value))||null;
  const locationTokens=[numericBuilding?.[0],koreanBuilding?.[0],floor?.[0],unit?.[0],numberedStair?.[0]].filter(Boolean),remainder=locationTokens.reduce((value,token)=>value.replace(token," "),normalized).replace(/\s+/g," ").trim(),{detailCandidate,contentCandidate}=splitIssueSpeechRemainder(remainder);
  return {normalized,buildingLabel:buildingAllowed?buildingLabel:null,floorLabel:floor?`${floor[1].replace(/\s+/g,"")}층`:null,unitLabel:unit?`${unit[1].replace(/\s+/g,"").toUpperCase()}호`:null,roomLabel,detailCandidate,contentCandidate};
}

export function finalizeIssueSpeechCandidates(parsed,resolution={}){
  const sameLabel=(left,right)=>String(left||"").replace(/\s+/g,"").toUpperCase()===String(right||"").replace(/\s+/g,"").toUpperCase(),path=resolution.path||{},labels=resolution.labels||{},unresolvedStructuralLabels=[];
  for(const [candidate,pathKey,labelKey] of [[parsed.buildingLabel,"buildingId","building"],[parsed.floorLabel,"floorId","floor"],[parsed.unitLabel,"unitId","unit"]])if(candidate&&(!path[pathKey]||!sameLabel(candidate,labels[labelKey])))unresolvedStructuralLabels.push(candidate);
  return {detailCandidate:parsed.detailCandidate||"",contentCandidate:[...unresolvedStructuralLabels,parsed.contentCandidate].filter(Boolean).join(" "),unresolvedStructuralLabels};
}

export const normalizeSpeechCorrection=value=>String(value||"").normalize("NFKC").replace(/\s+/g," ").trim().toLocaleLowerCase("ko-KR");
export function applySpeechCorrections(raw,rules=[],parserSnapshot={}){const normalized=normalizeSpeechCorrection(raw),appliedRuleIds=[],fieldValues={};let content=null;for(const fieldType of ["LOCATION_BUILDING","LOCATION_FLOOR","LOCATION_UNIT","LOCATION_ROOM","CONTENT_TERM"]){const key={LOCATION_BUILDING:"building",LOCATION_FLOOR:"floor",LOCATION_UNIT:"unit",LOCATION_ROOM:"room",CONTENT_TERM:"content"}[fieldType],source=fieldType==="CONTENT_TERM"?normalized:normalizeSpeechCorrection(parserSnapshot[key]),candidates=rules.filter(rule=>rule.field_type===fieldType&&rule.raw_normalized===source&&rule.status==="ACTIVE"&&Number(rule.evidence_count)>=3),total=candidates.reduce((sum,rule)=>sum+Number(rule.evidence_count||0),0);candidates.sort((a,b)=>(Number(b.evidence_count)-Number(b.negative_evidence_count))-(Number(a.evidence_count)-Number(a.negative_evidence_count)));const winner=candidates[0],second=candidates[1],probability=winner&&total?Number(winner.evidence_count)/total:0,lead=probability-(second?Number(second.evidence_count)/total:0);if(!winner||probability<.7||lead<.2||Number(winner.evidence_count)<=Number(winner.negative_evidence_count))continue;if(fieldType==="CONTENT_TERM")content=winner.corrected_value;else fieldValues[key]=winner.corrected_value;appliedRuleIds.push(winner.id)}return {text:String(raw||""),content,fieldValues,appliedRuleIds}}

export function canonicalLocationId(option){
  const value=String(option?.value||"");
  return option?.dataset?.locationId==="true"&&value!=="DIRECT"&&!value.startsWith("dynamic:")?value:"";
}

const locationCollator=new Intl.Collator("ko-KR",{numeric:true,sensitivity:"base"});
export const naturalLocationSort=(left,right)=>locationCollator.compare(String(left?.display_name||""),String(right?.display_name||""));

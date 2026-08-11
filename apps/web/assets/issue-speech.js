const KOREAN_BUILDING_NUMBERS={일:1,이:2,삼:3,사:4,오:5,육:6,칠:7,팔:8,구:9,십:10,십일:11,십이:12,십삼:13,십사:14,십오:15};
const ROOM_SPEECH_TERMS=new Set(["현관","거실","주방","안방","침실","부부욕실","공용욕실","욕실","발코니","다용도실","드레스룸","복도","계단실","엘리베이터홀","주차구역","램프","기계실","전기실","공용부","외부","옥상","지하","슬래브","바닥","벽면","벽체","천장","기둥","보","피트","샤프트"]);

export function extractLocationSpeech(text,{buildingNumberMode="STANDARD",phasePrefix=null,allowedBuildings=[]}={}){
  const normalized=String(text||"").replace(/\s+/g," ").trim();
  const unit=normalized.match(/(\d+)\s*호/);
  const numericBuilding=normalized.match(/(\d+)\s*동(?=\s|,|\.|$)/);
  const koreanBuilding=unit?normalized.match(/(십오|십사|십삼|십이|십일|십|일|이|삼|사|오|육|칠|팔|구)동(?=\s+\d+\s*호)/):null;
  let number=numericBuilding?Number(numericBuilding[1]):koreanBuilding?KOREAN_BUILDING_NUMBERS[koreanBuilding[1]]:null;
  if(number&&buildingNumberMode==="PHASE_PREFIX"&&phasePrefix&&number<100)number=Number(`${phasePrefix}${number}`);
  const buildingLabel=number?`${number}동`:null;
  const buildingAllowed=Boolean(buildingLabel&&(allowedBuildings.includes(buildingLabel)||numericBuilding));
  const roomLabel=(normalized.match(/[가-힣A-Za-z0-9]+/g)||[]).find(value=>ROOM_SPEECH_TERMS.has(value))||null;
  return {normalized,buildingLabel:buildingAllowed?buildingLabel:null,unitLabel:unit?`${unit[1]}호`:null,roomLabel};
}

export function canonicalLocationId(option){
  const value=String(option?.value||"");
  return option?.dataset?.locationId==="true"&&value!=="DIRECT"&&!value.startsWith("dynamic:")?value:"";
}

const locationCollator=new Intl.Collator("ko-KR",{numeric:true,sensitivity:"base"});
export const naturalLocationSort=(left,right)=>locationCollator.compare(String(left?.display_name||""),String(right?.display_name||""));

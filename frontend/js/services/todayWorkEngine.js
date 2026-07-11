import { state, saveLocal } from "../core/state.js";
import { calculateConcreteSpecimens } from "./qualityKnowledge.js";
import { getDemoWeatherSummary } from "./weatherEngine.js";
import { TRADE_KNOWLEDGE } from "./knowledgeBase.js";
import { getProcessById, findProcessByText } from "../data/processIntegrationDatabase.js";
import { upsertWorkInstance, removeWorkInstanceBySource } from "./workInstanceDatabase.js";

export const ROLE_LIST = ["현장소장","공사관리자","품질관리자","안전관리자","자재관리자","장비관리자"];

function todayYmd(){ return new Date().toLocaleDateString("sv-SE",{timeZone:"Asia/Seoul"}); }
export function ensureTodayData(){
  const date=todayYmd();
  if(!state.todayWork || state.todayWork.date!==date){
    state.todayWork={date,role:state.todayWork?.role||"현장소장",trades:[],activities:[],concrete:{enabled:false,volumeM3:120,part:"슬래브",pump:"52M"},materials:[],equipment:[],documentChecks:{}};
  }
  state.todayWork.trades=Array.isArray(state.todayWork.trades)?state.todayWork.trades:[];
  state.todayWork.activities=Array.isArray(state.todayWork.activities)?state.todayWork.activities:[];
  state.todayWork.materials=Array.isArray(state.todayWork.materials)?state.todayWork.materials:[];
  state.todayWork.equipment=Array.isArray(state.todayWork.equipment)?state.todayWork.equipment:[];
  state.todayWork.documentChecks=(state.todayWork.documentChecks&&typeof state.todayWork.documentChecks==="object"&&!Array.isArray(state.todayWork.documentChecks))?state.todayWork.documentChecks:{};
  return state.todayWork;
}
export function addTodayTrade(name){const t=ensureTodayData(); if(name&&!t.trades.includes(name)) t.trades.push(name); saveLocal();}
export function addTodayActivity({processId,location="",detail="",contractor="",workers="",startTime="",endTime=""} = {}){const t=ensureTodayData();const p=getProcessById(processId);if(!p)return false;const activity={id:Date.now(),processId:p.id,category:p.category,trade:p.trade,subProcess:p.subProcess,location:String(location||"").trim(),detail:String(detail||"").trim(),contractor:String(contractor||"").trim(),workers:Number(workers)||0,startTime:String(startTime||""),endTime:String(endTime||""),createdAt:new Date().toISOString()};const work=upsertWorkInstance({...activity,date:t.date,title:p.subProcess,sourceId:activity.id},"today",false);activity.workId=work.workId;t.activities.push(activity);saveLocal();return true;}
export function setTodayDocumentCheck(key,checked){const t=ensureTodayData();t.documentChecks[String(key)]=Boolean(checked);saveLocal();}
export function isTodayDocumentChecked(key){return Boolean(ensureTodayData().documentChecks[String(key)]);}
export function removeTodayActivity(id){const t=ensureTodayData();t.activities=t.activities.filter(x=>String(x.id)!==String(id));removeWorkInstanceBySource("today",id,false);saveLocal();}
export function addMaterial(item){ensureTodayData().materials.push({id:Date.now(),...item}); saveLocal();}
export function addEquipment(item){ensureTodayData().equipment.push({id:Date.now(),...item}); saveLocal();}
export function setConcretePlan(plan){const t=ensureTodayData(); t.concrete={...t.concrete,...plan,enabled:true}; saveLocal();}

function weatherProcessActions(process,weather){
  const out=[]; const r=process.weatherRules||{};
  if(weather.maxRain>=1&&r.rain) out.push(r.rain);
  if(weather.maxWind>=7&&r.wind) out.push(r.wind);
  if(weather.maxApparent>=33&&r.heat) out.push(r.heat);
  if(weather.maxApparent<=3&&r.cold) out.push(r.cold);
  return out;
}
export function getTodayIntegratedProcesses(){
  const t=ensureTodayData();
  const fromActivities=t.activities.filter(Boolean).map(a=>({activity:a,process:getProcessById(a.processId)||findProcessByText(`${a.subProcess||""} ${a.trade||""} ${a.detail||""}`)})).filter(x=>x.process);
  const fromLegacy=t.trades.map((name,i)=>({activity:{id:`legacy-${i}`,location:"",detail:""},process:findProcessByText(name)})).filter(x=>x.process&&!fromActivities.some(y=>y.process.id===x.process.id));
  if(t.concrete?.enabled&&!fromActivities.some(x=>x.process.id==="rc-slab-concrete")) fromActivities.push({activity:{id:"concrete-plan",location:t.concrete.part||"",detail:`${t.concrete.volumeM3||0}㎥ · ${t.concrete.pump||"펌프카"}`},process:getProcessById("rc-slab-concrete")});
  return [...fromActivities,...fromLegacy];
}
export function buildTodayBriefing(){
  const t=ensureTodayData(); const weather=getDemoWeatherSummary();
  const actions=[]; const roleActions=Object.fromEntries(ROLE_LIST.map(r=>[r,[]])); const photos=[]; const tbm=[]; const requiredDocuments=[]; const missing=[];
  const integrated=getTodayIntegratedProcesses();
  for(const {activity,process} of integrated){
    const place=activity.location?` · ${activity.location}`:"";
    const crew=activity.workers?` · ${activity.workers}명`:"";
    actions.push(`${process.subProcess}${place}${crew}: ${process.preventiveActions[0]}`);
    if(!activity.location) missing.push({type:"input",process:process.subProcess,message:"작업 위치가 입력되지 않았습니다."});
    if(!activity.workers) missing.push({type:"input",process:process.subProcess,message:"작업 인원이 입력되지 않았습니다."});
    process.preventiveActions.slice(0,5).forEach(x=>roleActions["안전관리자"].push(`${process.subProcess}: ${x}`));
    process.qualityActions.slice(0,3).forEach(x=>roleActions["품질관리자"].push(`${process.subProcess}: ${x}`));
    process.constructionActions.slice(0,3).forEach(x=>roleActions["공사관리자"].push(`${process.subProcess}: ${x}`));
    process.materialsEquipment.slice(0,3).forEach(x=>roleActions["자재관리자"].push(`${process.subProcess}: ${x} 준비 확인`));
    process.documents.forEach(x=>{const key=`${process.id}:${x}`;requiredDocuments.push({processId:process.id,process:process.subProcess,document:x,key,checked:Boolean(t.documentChecks?.[key])});if(!t.documentChecks?.[key])missing.push({type:"document",process:process.subProcess,message:`${x} 준비 확인이 필요합니다.`,key});});
    weatherProcessActions(process,weather).forEach(x=>roleActions["안전관리자"].push(`${process.subProcess} · 날씨: ${x}`));
    tbm.push(`■ ${process.subProcess}${place}\n${process.tbmPoints.map(x=>`- ${x}`).join("\n")}`);
    photos.push(`${process.subProcess} 작업 전 안전조치`,`${process.subProcess} 작업구역 통제`);
  }
  for(const tradeName of t.trades){
    const trade=TRADE_KNOWLEDGE.find(x=>x.name===tradeName);
    if(trade&&!findProcessByText(tradeName)){ actions.push(`${trade.name}: ${trade.keyPoint||trade.summary}`); roleActions["안전관리자"].push(`${trade.name}: ${trade.safetyTop5?.[0]||"위험요소 확인"}`); if(trade.tbm)tbm.push(trade.tbm); }
  }
  let specimen=null;
  if(t.concrete?.enabled){
    specimen=calculateConcreteSpecimens({volumeM3:t.concrete.volumeM3,verticalStrip:true,horizontalStrip:true,standard28d:true});
    actions.push(`콘크리트 ${t.concrete.volumeM3}㎥: 공시체 ${specimen.totalPieces}개 준비`);
    roleActions["품질관리자"].push(`타설량 ${t.concrete.volumeM3}㎥ → 시험빈도 ${specimen.setCount}회, 공시체 ${specimen.totalPieces}개`);
    photos.push("레미콘 송장","슬럼프 시험","공기량 시험","공시체 라벨","타설 후 보양");
  }
  for(const m of t.materials){actions.push(`자재반입: ${m.name} ${m.qty||""} 검수 및 하역구역 통제`); roleActions["자재관리자"].push(`${m.name}: 규격·수량·보관위치 확인`); roleActions["안전관리자"].push(`${m.name}: 하역구역 출입통제와 신호수 배치`);}
  for(const e of t.equipment){actions.push(`장비운영: ${e.name} 작업반경·점검표 확인`); roleActions["장비관리자"].push(`${e.name}: 장비점검표, 신호수, 작업반경 확인`); roleActions["안전관리자"].push(`${e.name}: 협착·전도·낙하 위험 통제`);}
  if(weather.maxRain>=5) roleActions["현장소장"].push("강수 위험 시간대 작업순서 조정 검토");
  if(weather.maxWind>=8) roleActions["안전관리자"].push("풍속 위험으로 양중·고소작업 재검토");
  if(weather.maxApparent>=35) roleActions["안전관리자"].push("온열질환 예방 순회점검 및 휴식관리");
  return {today:t,weather,specimen,integrated,requiredDocuments,missing:[...new Map(missing.map(x=>[`${x.process}:${x.message}`,x])).values()],actions:[...new Set(actions)].slice(0,14),roleActions:Object.fromEntries(Object.entries(roleActions).map(([k,v])=>[k,[...new Set(v)]])),photoPoints:[...new Set(photos)],tbm:tbm.filter(Boolean).join("\n\n")};
}

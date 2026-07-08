import { state, saveLocal } from "../core/state.js";
import { calculateConcreteSpecimens } from "./qualityKnowledge.js";
import { getDemoWeatherSummary } from "./weatherEngine.js";
import { TRADE_KNOWLEDGE } from "./knowledgeBase.js";

export const ROLE_LIST = ["현장소장","공사관리자","품질관리자","안전관리자","자재관리자","장비관리자"];

export function ensureTodayData(){
  state.todayWork = state.todayWork || {date:new Date().toISOString().slice(0,10),role:"현장소장",trades:[],concrete:{enabled:false,volumeM3:120,part:"슬래브",pump:"52M"},materials:[],equipment:[]};
  return state.todayWork;
}
export function addTodayTrade(name){const t=ensureTodayData(); if(name&&!t.trades.includes(name)) t.trades.push(name); saveLocal();}
export function addMaterial(item){ensureTodayData().materials.push({id:Date.now(),...item}); saveLocal();}
export function addEquipment(item){ensureTodayData().equipment.push({id:Date.now(),...item}); saveLocal();}
export function setConcretePlan(plan){const t=ensureTodayData(); t.concrete={...t.concrete,...plan,enabled:true}; saveLocal();}

export function buildTodayBriefing(){
  const t=ensureTodayData(); const weather=getDemoWeatherSummary();
  const actions=[]; const roleActions=Object.fromEntries(ROLE_LIST.map(r=>[r,[]])); const photos=[]; const tbm=[];
  for(const tradeName of t.trades){
    const trade=TRADE_KNOWLEDGE.find(x=>x.name===tradeName);
    if(trade){
      actions.push(`${trade.name}: ${trade.keyPoint||trade.summary}`);
      roleActions["안전관리자"].push(`${trade.name}: ${trade.safetyTop5?.[0]||"위험요소 확인"}`);
      roleActions["품질관리자"].push(`${trade.name}: ${trade.qualityTop3?.[0]||"품질기준 확인"}`);
      roleActions["공사관리자"].push(`${trade.name}: 시공순서와 후속공정 확인`);
      if(trade.tbm) tbm.push(trade.tbm);
    }
  }
  let specimen=null;
  if(t.concrete?.enabled){
    specimen=calculateConcreteSpecimens({volumeM3:t.concrete.volumeM3,verticalStrip:true,horizontalStrip:true,standard28d:true});
    actions.push(`콘크리트 ${t.concrete.volumeM3}㎥: 공시체 ${specimen.totalPieces}개 준비`);
    roleActions["품질관리자"].push(`타설량 ${t.concrete.volumeM3}㎥ → 시험빈도 ${specimen.setCount}회, 공시체 ${specimen.totalPieces}개`);
    roleActions["안전관리자"].push(`${t.concrete.pump||"펌프카"} 아웃트리거·받침판·작업반경 통제`);
    roleActions["공사관리자"].push(`${t.concrete.part||"타설부위"} 타설순서, 이어치기, 레미콘 동선 확인`);
    roleActions["현장소장"].push(`강수·풍속 확인 후 타설 진행 여부 최종 판단`);
    photos.push("레미콘 송장","슬럼프 시험","공기량 시험","공시체 라벨","타설 후 보양");
    tbm.push(`오늘 콘크리트 타설은 공시체 ${specimen.totalPieces}개, 펌프카 전도위험, 강우 보양을 중점 확인합니다.`);
  }
  for(const m of t.materials){actions.push(`자재반입: ${m.name} ${m.qty||""} 검수 및 하역구역 통제`); roleActions["자재관리자"].push(`${m.name}: 규격·수량·보관위치 확인`); roleActions["안전관리자"].push(`${m.name}: 하역구역 출입통제와 신호수 배치`);}
  for(const e of t.equipment){actions.push(`장비운영: ${e.name} 작업반경·점검표 확인`); roleActions["장비관리자"].push(`${e.name}: 장비점검표, 신호수, 작업반경 확인`); roleActions["안전관리자"].push(`${e.name}: 협착·전도·낙하 위험 통제`);}
  if(weather.maxRain>=5) roleActions["현장소장"].push("강수 위험 시간대 작업순서 조정 검토");
  if(weather.maxWind>=8) roleActions["안전관리자"].push("풍속 위험으로 양중·고소작업 재검토");
  if(weather.maxApparent>=35) roleActions["안전관리자"].push("온열질환 예방 순회점검 및 휴식관리");
  return {today:t,weather,specimen,actions:[...new Set(actions)].slice(0,8),roleActions,photoPoints:[...new Set(photos)],tbm:tbm.filter(Boolean).join("\\n\\n")};
}

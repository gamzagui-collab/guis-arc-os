import { state } from "../core/state.js";
import { TRADE_KNOWLEDGE, buildTbmFromTrades } from "./knowledgeBase.js";
import { ACCIDENT_BRIEFINGS } from "./accidentBriefing.js";
import { getDemoWeatherSummary } from "./weatherEngine.js";

function hasText(text, words){
  return words.some(w => String(text || "").includes(w));
}

export function buildAiFieldBriefing(){
  const weather = getDemoWeatherSummary();
  const schedules = state.schedules || [];
  const selectedTradeNames = state.selectedTrades || [];
  const selectedTrades = TRADE_KNOWLEDGE.filter(t => selectedTradeNames.includes(t.name));

  const risks = [];
  const quality = [];
  const inspections = [];
  const roleActions = {
    "현장소장": [],
    "안전관리자": [],
    "품질관리자": [],
    "공사관리자": [],
    "장비관리자": [],
    "자재관리자": []
  };

  for(const t of selectedTrades){
    risks.push(...t.safetyTop5.map(x => `${t.name}: ${x}`));
    quality.push(...t.qualityTop3.map(x => `${t.name}: ${x}`));
    inspections.push(...t.inspectionTop3.map(x => `${t.name}: ${x}`));
    roleActions["안전관리자"].push(`${t.name}: ${t.safetyTop5[0]} 중점 확인`);
    roleActions["품질관리자"].push(`${t.name}: ${t.qualityTop3[0]} 확인`);
    roleActions["공사관리자"].push(`${t.name}: ${t.keyPoint}`);
  }

  for(const s of schedules){
    if(s.type === "타설"){
      risks.push("타설: 펌프카 전도·레미콘 차량 협착·강우 품질저하");
      quality.push("타설: 슬럼프·공시체·양생계획 확인");
      inspections.push("타설: 검측 완료 전 타설 금지, 강우 시 감리 협의 기록");
      roleActions["현장소장"].push(`${s.title}: 타설 진행 여부 최종 판단`);
      roleActions["안전관리자"].push(`${s.title}: 펌프카 작업반경·아웃트리거 확인`);
      roleActions["품질관리자"].push(`${s.title}: 슬럼프·공기량·공시체 확인`);
      roleActions["공사관리자"].push(`${s.title}: 레미콘 대기공간·진입로 확보`);
    }
    if(s.type === "자재"){
      risks.push("자재반입: 지게차 충돌·하역 중 낙하·보행자 동선혼재");
      roleActions["자재관리자"].push(`${s.title}: 규격·수량·보관위치 확인`);
      roleActions["안전관리자"].push(`${s.title}: 하역구역 통제와 신호수 배치`);
    }
    if(s.type === "장비"){
      risks.push("장비운영: 작업반경 내 협착·전도·신호 불일치");
      roleActions["장비관리자"].push(`${s.title}: 장비점검표·작업반경·신호수 확인`);
      roleActions["안전관리자"].push(`${s.title}: 출입통제와 풍속 확인`);
    }
  }

  if(weather.maxRain >= 5){
    risks.push("기상: 3시간 강수 증가, 외부작업·타설 보양 필요");
    roleActions["현장소장"].push("강수 시간대 외부작업 순서 조정");
    roleActions["공사관리자"].push("배수로·보양재·우천 대비 작업순서 확인");
  }
  if(weather.maxWind >= 8){
    risks.push("기상: 풍속 주의, 크레인·갱폼·고소작업 재검토");
    roleActions["안전관리자"].push("풍속 위험 시간대 양중·고소작업 집중관리");
    roleActions["장비관리자"].push("크레인·고소작업대 작업 가능 여부 재확인");
  }
  if(weather.maxApparent >= 35){
    risks.push("온열: 체감온도 위험, 옥외작업 휴식·수분관리 강화");
    roleActions["안전관리자"].push("11~15시 온열질환 순회점검 및 휴식관리");
  }

  const matchedAccidents = ACCIDENT_BRIEFINGS.filter(a => 
    selectedTradeNames.some(t => a.relatedTrades?.includes(t) || a.trade === t) ||
    schedules.some(s => hasText(a.trade + a.title, [s.type, s.title]))
  );

  const unique = arr => [...new Set(arr)].filter(Boolean);
  const accidentTop5 = unique(risks).slice(0,5);
  const qualityTop3 = unique(quality).slice(0,3);
  const inspectionTop3 = unique(inspections).slice(0,3);

  return {
    weather,
    accidentTop5,
    qualityTop3,
    inspectionTop3,
    matchedAccidents: matchedAccidents.slice(0,3),
    roleActions,
    tbm: buildTbmText(accidentTop5, qualityTop3, inspectionTop3, matchedAccidents)
  };
}

function buildTbmText(accidentTop5, qualityTop3, inspectionTop3, accidents){
  return [
    "■ GUI's Arc OS AI 현장비서 TBM",
    "",
    "오늘 사고위험 TOP5",
    ...accidentTop5.map(x => `□ ${x}`),
    "",
    "품질 중점 TOP3",
    ...qualityTop3.map(x => `□ ${x}`),
    "",
    "감리지적 예방 TOP3",
    ...inspectionTop3.map(x => `□ ${x}`),
    "",
    "유사 사고사례",
    ...(accidents.length ? accidents.map(a => `□ ${a.type}: ${a.title}`) : ["□ 선택 공종과 직접 연결된 사고사례 없음"]),
    "",
    "오늘은 작업 시작 전 역할별 확인사항을 먼저 체크하고, 기상위험 시간대에는 작업순서 조정을 검토합니다."
  ].join("\n");
}

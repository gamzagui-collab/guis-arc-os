import { state, saveLocal } from "../core/state.js";
import { getDemoWeatherSummary } from "./weatherEngine.js";
import { SAFETY_DUTY_DB, SAFETY_DUTY_GROUP_ORDER, getRecurringSafetyDuties, getEventSafetyDuties } from "../data/safetyDutyDatabase.js";
import { getProcessById } from "../data/processIntegrationDatabase.js";
import { workInstancesForDate } from "./workInstanceDatabase.js";

const pad = n => String(n).padStart(2, "0");
function kstDate(offset = 0){
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  now.setDate(now.getDate() + offset);
  now.setHours(0, 0, 0, 0);
  return now;
}
export function todayYmd(){
  const d = kstDate();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function toYmd(date){ return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`; }
function diffDays(aYmd, bYmd){
  const a = new Date(`${aYmd}T00:00:00+09:00`);
  const b = new Date(`${bYmd}T00:00:00+09:00`);
  return Math.round((a - b) / 86400000);
}
function addDays(date, days){ const d = new Date(date); d.setDate(d.getDate() + days); return d; }

export const SAFETY_DUTY_TEMPLATES = getRecurringSafetyDuties();
export const SAFETY_EVENT_DUTIES = getEventSafetyDuties();
export { SAFETY_DUTY_DB, SAFETY_DUTY_GROUP_ORDER };

export const SAFETY_STANDARDS = {
  "콘크리트 타설": {
    risk:"펌프카 전도, 호스 요동, 레미콘 차량 동선, 타설구간 미끄럼·추락",
    checklist:["펌프카 아웃트리거 받침판과 지반상태 확인", "타설구간 단부·개구부 추락방지 확인", "레미콘 진입·후진 동선 신호수 배치", "강우 시 전기·미끄럼·보양재 사전 준비", "타설 전 TBM에서 호스 요동·협착 위험 전달"],
    tbm:"콘크리트 타설은 펌프카 전도와 호스 요동, 레미콘 차량 동선이 핵심입니다. 작업반경 출입통제, 신호수 배치, 단부·개구부 방호를 먼저 확인하고 비가 오면 미끄럼과 전기 위험을 추가로 관리합니다."
  },
  "철근공사": {
    risk:"철근 찔림, 절단·가공 협착, 양중 낙하, 배근구간 추락",
    checklist:["돌출철근 보호캡 설치", "철근 가공기 방호장치 확인", "양중구간 출입통제", "작업발판·통로 확보", "검측 전후 후속공정 간섭 확인"],
    tbm:"철근작업은 짧은 이동 중 찔림·추락 사고가 많습니다. 보호캡, 작업통로, 양중구간 통제를 먼저 확인합니다."
  },
  "거푸집공사": {
    risk:"동바리 붕괴, 단부 추락, 해체 중 낙하물, 작업발판 불량",
    checklist:["동바리 수직도·수평연결재 확인", "작업발판·난간·승강설비 확인", "해체순서 작업반 공유", "하부 출입통제", "타설하중 전 설치상태 재확인"],
    tbm:"거푸집·동바리는 설치상태와 해체순서가 핵심입니다. 하부 출입통제와 작업발판 상태를 먼저 확인합니다."
  },
  "동바리": {
    risk:"침하·좌굴·붕괴, 해체 전 강도 미확인",
    checklist:["상하부 받침·잭베이스 확인", "수평연결재·가새 설치 확인", "침하 우려 구간 보강", "타설 전 책임자 확인", "해체 전 강도·존치기간 확인"],
    tbm:"동바리는 작은 누락이 붕괴로 이어질 수 있습니다. 받침, 연결재, 침하 여부를 타설 전 반드시 확인합니다."
  },
  "비계": {
    risk:"추락, 낙하물, 벽이음 불량, 작업발판 탈락",
    checklist:["작업발판 고정상태 확인", "안전난간·발끝막이판 확인", "벽이음·승강설비 확인", "하부 낙하물 방지", "해체구간 출입통제"],
    tbm:"비계 작업은 추락과 낙하물 위험이 우선입니다. 발판, 난간, 벽이음, 하부 통제를 확인합니다."
  },
  "양중": {
    risk:"인양물 낙하, 줄걸이 불량, 작업반경 침범, 풍속 영향",
    checklist:["줄걸이 상태와 인양하중 확인", "신호수·유도줄 배치", "작업반경 출입통제", "풍속 상승 시 작업중지 검토", "하부 동시작업 금지"],
    tbm:"양중은 신호수와 작업반경 통제가 생명입니다. 풍속과 줄걸이 상태를 확인하고 하부 동시작업을 금지합니다."
  },
  "반입": {
    risk:"하역 중 협착, 지게차 후진, 보행자 충돌, 야적 불량",
    checklist:["하역구역 라바콘·통제선 설치", "신호수 배치", "보행자 동선 분리", "야적장 전도방지", "반입시간 사전공지"],
    tbm:"자재 반입은 하역구역 통제와 보행자 동선 분리가 핵심입니다. 지게차 후진과 협착 위험을 공유합니다."
  },
  "국토안전부": {
    risk:"외부점검 대비 구조체·품질·안전관리 기록 누락",
    checklist:["주요 공정 현황과 점검 동선 정리", "철근콘크리트 공정 검측·타설 기록 확인", "위험성평가·TBM·시정조치 기록 정리", "동바리·거푸집·비계 등 임시구조물 관리자료 준비", "지적 예상사항 담당자 지정"],
    tbm:"국토안전부 점검은 현장 상태와 기록의 일치가 중요합니다. 주공정, 검측·타설기록, 임시구조물 안전자료를 먼저 정리합니다."
  },
  "안전보건공단": {
    risk:"위험성평가, TBM, 고위험작업 통제, 추락·장비 위험 지적 가능",
    checklist:["위험성평가 최신화 여부 확인", "TBM 전달사항과 참석자 기록 확인", "추락·낙하·장비동선 중점 순회", "고위험작업 작업계획서 확인", "지적사항 즉시 시정계획 준비"],
    tbm:"안전보건공단 점검 대비는 위험성평가와 TBM 실행성입니다. 서류보다 실제 작업구간의 추락·장비 통제를 우선 확인합니다."
  },
  "노동부": {
    risk:"산업안전보건법 이행, 교육·보호구·작업허가·감독 대응",
    checklist:["안전보건교육·신규근로자 교육 기록 확인", "위험성평가 공유 및 개선조치 확인", "보호구 착용·작업허가 관리 확인", "산재·아차사고 보고체계 확인", "감독 대응 서류와 현장 시정조치 정리"],
    tbm:"노동부 점검 대비는 법정 이행과 실제 조치의 일치가 중요합니다. 교육, 보호구, 위험성평가, 작업허가 기록을 현장 상태와 맞춥니다."
  },
  "일반": {
    risk:"공종별 위험요인 미등록",
    checklist:["작업구역 통제", "작업 전 위험성평가 확인", "보호구 착용", "장비·전기·통로 상태 확인", "작업반장 TBM 전달 확인"],
    tbm:"등록된 세부공종 기준이 부족합니다. 작업 전 위험성평가와 현장 통제를 우선 확인합니다."
  }
};

function scheduleTypePriority(type){ return {"타설":1,"점검":2,"작업":3,"장비":4,"자재":5}[type] || 9; }
function schedulesForToday(){
  const today = todayYmd();
  return (state.schedules || [])
    .filter(item => item.date === today)
    .sort((a,b)=>scheduleTypePriority(a.type)-scheduleTypePriority(b.type));
}
function standardForSchedule(item = {}){
  const process = item.processId ? getProcessById(item.processId) : null;
  if(process){
    return {
      risk:(process.safetyRisks || []).join(", ") || "공정별 위험요인 확인",
      checklist:process.preventiveActions || [],
      tbm:(process.tbmPoints || []).join(" / ") || process.safetyJournalSummary || "작업 전 위험요인을 공유합니다."
    };
  }
  const type = item.type || item.category || "작업";
  const subTrade = item.subTrade || item.subProcess || "일반";
  const title = item.title || "일반";
  if(type === "점검") return SAFETY_STANDARDS[subTrade] || SAFETY_STANDARDS["국토안전부"];
  if(type === "타설" || String(title).includes("타설")) return SAFETY_STANDARDS["콘크리트 타설"];
  return SAFETY_STANDARDS[subTrade] || SAFETY_STANDARDS[title] || SAFETY_STANDARDS["일반"];
}
function weatherSafetyActions(weather){
  const actions = [];
  if(weather.maxRain >= 5) actions.push({level:"danger", title:"강우 시간대 작업순서 조정", detail:`${weather.peakRain?.hour || "피크"}시 최대 ${weather.maxRain.toFixed(1)}mm 예상. 타설·양중·외부작업 보양/연기 검토`});
  else if(weather.maxRain >= 1) actions.push({level:"warn", title:"약한 강우 대비", detail:"미끄럼, 누전, 자재 방수, 배수로 상태를 작업 전 확인"});
  if(weather.maxWind >= 10) actions.push({level:"danger", title:"풍속 상승으로 양중·고소작업 재검토", detail:`최대 ${weather.maxWind.toFixed(1)}m/s. 신호수·유도줄·작업반경 통제 강화`});
  else if(weather.maxWind >= 7) actions.push({level:"warn", title:"오후 풍속 관찰", detail:"가벼운 자재 비산과 양중 흔들림에 대비"});
  if(weather.maxApparent >= 35) actions.push({level:"danger", title:"온열질환 집중관리", detail:`최고 체감 ${weather.maxApparent.toFixed(1)}℃. 물·그늘·휴식·체온확인 고정`});
  if(weather.maxApparent <= 0) actions.push({level:"warn", title:"한랭·결빙 주의", detail:"방한장구, 미끄럼 방지, 온수 휴식 준비"});
  if(!actions.length) actions.push({level:"safe", title:"기상 위험 낮음", detail:"기본 안전수칙과 순회점검 유지"});
  return actions;
}

function buildTodayInputSafetyItems(){
  return workInstancesForDate(todayYmd()).map(work=>{
    const process=getProcessById(work.processId);
    if(!process) return null;
    return {
      level:process.riskLevel==="critical"||process.riskLevel==="high"?"danger":"warn",
      title:`${work.workId} · ${process.subProcess}${work.location?` · ${work.location}`:""}`,
      detail:`${process.safetyJournalSummary || "공정 위험요인을 중점 관리합니다."} 주요 위험: ${process.safetyRisks.slice(0,4).join(", ")}`,
      checklist:[...process.preventiveActions, ...(process.documents||[]).slice(0,3).map(x=>`필요서류 확인: ${x}`)],
      documents:process.documents || [], source:"통합 작업 DB", process, workId:work.workId
    };
  }).filter(Boolean);
}

function buildScheduleSafetyItems(schedules){
  return (Array.isArray(schedules) ? schedules : []).filter(Boolean).flatMap(item => {
    const std = standardForSchedule(item);
    const type = item.type || item.category || "작업";
    const title = item.title || item.subProcess || "일정";
    const base = `${type} · ${title}`;
    return [{ level:type === "타설" || type === "점검" ? "danger" : "warn", title:base, detail:std.risk, schedule:item, checklist:std.checklist }];
  });
}
function endOfMonth(date){
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1, 0);
  return d;
}
function routinePeriod(task, todayDate = kstDate()){
  const cycleStart = state.safetyRoutineStartDate || toYmd(todayDate);
  const start = new Date(`${cycleStart}T00:00:00+09:00`);
  const d = new Date(todayDate);
  d.setHours(0,0,0,0);
  if(task.cycle === "daily") return { start:toYmd(d), end:toYmd(d), label:"금일", round:"일일" };
  if(task.cycle === "weekly"){
    const day = d.getDay();
    const st = new Date(d); st.setDate(d.getDate() - ((day + 6) % 7));
    const en = addDays(st, 6);
    return { start:toYmd(st), end:toYmd(en), label:"이번 주", round:"주 1회" };
  }
  if(task.cycle === "biweekly"){
    const elapsed = Math.max(0, Math.floor((d - start) / 86400000));
    const st = addDays(start, Math.floor(elapsed / 14) * 14);
    const en = addDays(st, 13);
    return { start:toYmd(st), end:toYmd(en), label:"2주 주기", round:"2주 1회" };
  }
  if(task.cycle === "twiceMonthly"){
    const st = new Date(d);
    const en = new Date(d);
    if(d.getDate() <= 15){ st.setDate(1); en.setDate(15); return { start:toYmd(st), end:toYmd(en), label:"월 1회차(1~15일)", round:"월 2회 중 1회" }; }
    st.setDate(16); const last = endOfMonth(d); return { start:toYmd(st), end:toYmd(last), label:"월 2회차(16~말일)", round:"월 2회 중 2회" };
  }
  if(task.cycle === "monthly"){
    const st = new Date(d); st.setDate(1); const en = endOfMonth(d);
    return { start:toYmd(st), end:toYmd(en), label:"이번 달", round:"월 1회" };
  }
  if(task.cycle === "bimonthly"){
    const st = new Date(d); st.setDate(1); st.setMonth(st.getMonth() - (st.getMonth() % 2));
    const en = new Date(st); en.setMonth(en.getMonth()+2, 0);
    return { start:toYmd(st), end:toYmd(en), label:"2개월 주기", round:"2개월 1회" };
  }
  if(task.cycle === "quarterly"){
    const st = new Date(d); st.setDate(1); st.setMonth(Math.floor(st.getMonth() / 3) * 3);
    const en = new Date(st); en.setMonth(en.getMonth()+3, 0);
    return { start:toYmd(st), end:toYmd(en), label:"이번 분기", round:"분기 1회" };
  }
  if(task.cycle === "halfYear"){
    const st = new Date(d); st.setDate(1); st.setMonth(st.getMonth() < 6 ? 0 : 6);
    const en = new Date(st); en.setMonth(en.getMonth()+6, 0);
    return { start:toYmd(st), end:toYmd(en), label:st.getMonth() === 0 ? "상반기" : "하반기", round:"반기 1회" };
  }
  if(task.cycle === "yearly"){
    const st = new Date(d); st.setMonth(0, 1); const en = new Date(d); en.setMonth(11, 31);
    return { start:toYmd(st), end:toYmd(en), label:"올해", round:"연 1회" };
  }
  return { start:toYmd(d), end:toYmd(d), label:"금일", round:"기타" };
}
function routineDueDate(task, todayDate = kstDate()){ return routinePeriod(task, todayDate).start; }
function nextDueDate(task, todayDate = kstDate()){ return routinePeriod(task, todayDate).end; }
function addCycleFromYmd(ymd, cycle){
  const d = new Date(`${ymd}T00:00:00+09:00`);
  if(Number.isNaN(d.getTime())) return null;
  if(cycle === "daily") d.setDate(d.getDate() + 1);
  else if(cycle === "weekly") d.setDate(d.getDate() + 7);
  else if(cycle === "biweekly") d.setDate(d.getDate() + 14);
  else if(cycle === "twiceMonthly") d.setDate(d.getDate() + 15);
  else if(cycle === "monthly") d.setMonth(d.getMonth() + 1);
  else if(cycle === "bimonthly") d.setMonth(d.getMonth() + 2);
  else if(cycle === "quarterly") d.setMonth(d.getMonth() + 3);
  else if(cycle === "halfYear") d.setMonth(d.getMonth() + 6);
  else if(cycle === "yearly") d.setFullYear(d.getFullYear() + 1);
  else d.setDate(d.getDate() + 1);
  return toYmd(d);
}
function validRoutineHistory(taskId){
  const raw = state.safetyRoutineHistory?.[taskId];
  if(!Array.isArray(raw)) return [];
  return [...new Set(raw.filter(x => /^\d{4}-\d{2}-\d{2}$/.test(String(x))))].sort();
}
function latestRoutineDate(taskId){
  const rows = validRoutineHistory(taskId);
  return rows.length ? rows[rows.length - 1] : "";
}
function dueText(item){
  if(item.lastDone === item.today && item.cycle === "daily") return "금일 실시 완료";
  if(item.daysLeft < 0) return `기한 ${Math.abs(item.daysLeft)}일 경과`;
  if(item.daysLeft === 0) return "오늘 실시 필요";
  return `다음 기한 ${item.daysLeft}일 남음`;
}
export function ensureSafetyRoutine(){
  state.safetyRoutineStartDate = state.safetyRoutineStartDate || todayYmd();
  state.safetyRoutineDone = state.safetyRoutineDone || {};
  state.safetyRoutineHistory = (state.safetyRoutineHistory && typeof state.safetyRoutineHistory === "object" && !Array.isArray(state.safetyRoutineHistory))
    ? state.safetyRoutineHistory
    : {};
  const today = todayYmd();
  return SAFETY_DUTY_TEMPLATES.map(task => {
    const lastDone = latestRoutineDate(task.id);
    const baseDate = lastDone || state.safetyRoutineStartDate;
    const calculatedNext = addCycleFromYmd(baseDate, task.cycle);
    const fallbackPeriod = routinePeriod(task);
    const nextDue = calculatedNext || fallbackPeriod.end;
    const daysLeft = diffDays(nextDue, today);
    const dueNow = daysLeft <= 0;
    const soon = daysLeft > 0 && daysLeft <= 3;
    const doneToday = lastDone === today;
    return {
      ...task,
      due: nextDue,
      dueEnd: nextDue,
      nextDue,
      periodLabel: lastDone ? `최근 실시 ${lastDone}` : `기준일 ${state.safetyRoutineStartDate}`,
      roundLabel: task.group,
      lastDone,
      today,
      daysLeft,
      done: doneToday,
      dueNow,
      soon,
      dueText: dueText({ cycle:task.cycle, lastDone, today, daysLeft })
    };
  });
}
export function markSafetyRoutineDone(taskId){
  const task = SAFETY_DUTY_TEMPLATES.find(x => x.id === taskId);
  if(!task) return;
  state.safetyRoutineDone = state.safetyRoutineDone || {};
  state.safetyRoutineDone[`${task.id}:${routineDueDate(task)}`] = new Date().toISOString();
  saveLocal();
}
export function resetSafetyRoutineDone(taskId){
  const task = SAFETY_DUTY_TEMPLATES.find(x => x.id === taskId);
  if(!task) return;
  delete state.safetyRoutineDone?.[`${task.id}:${routineDueDate(task)}`];
  saveLocal();
}
function monthlyPeriodsForTask(task, baseDate = kstDate()){
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const last = endOfMonth(baseDate).getDate();
  const ymd = day => `${year}-${pad(month+1)}-${pad(day)}`;
  if(task.cycle === "daily") return Array.from({length:last}, (_,i)=>({start:ymd(i+1), end:ymd(i+1), label:`${i+1}일`}));
  if(task.cycle === "weekly"){
    const periods = [];
    let d = new Date(year, month, 1);
    while(d.getMonth() === month){
      const st = new Date(d); const en = addDays(st, 6);
      periods.push({start:toYmd(st), end:toYmd(en), label:`${periods.length+1}주차`});
      d = addDays(st, 7);
    }
    return periods;
  }
  if(task.cycle === "biweekly") return [{start:ymd(1), end:ymd(Math.min(14,last)), label:"1회차"},{start:ymd(Math.min(15,last)), end:ymd(last), label:"2회차"}];
  if(task.cycle === "twiceMonthly") return [{start:ymd(1), end:ymd(15), label:"1회 완료"},{start:ymd(16), end:ymd(last), label:"2회 완료"}];
  if(task.cycle === "monthly") return [{start:ymd(1), end:ymd(last), label:"월간 완료"}];
  return [{start:ymd(1), end:ymd(last), label:task.group || "정기 완료"}];
}
export function buildSafetyMonthlyReport(){
  state.safetyRoutineDone = state.safetyRoutineDone || {};
  const base = kstDate();
  const monthKey = `${base.getFullYear()}-${pad(base.getMonth()+1)}`;
  const rows = SAFETY_DUTY_TEMPLATES.flatMap(task => monthlyPeriodsForTask(task, base).map(period => {
    const key = `${task.id}:${period.start}`;
    return { taskId:task.id, title:task.title, group:task.group, owner:task.owner, cycle:task.cycle, label:period.label, periodStart:period.start, periodEnd:period.end, done:Boolean(state.safetyRoutineDone[key]), doneAt:state.safetyRoutineDone[key] || "", documents:task.documents || [] };
  }));
  const done = rows.filter(x=>x.done).length;
  const missing = rows.length - done;
  return { monthKey, rows, done, missing, total:rows.length };
}
function buildAiSummary(scheduleItems, weatherItems, routines){
  const lines = [];
  if(scheduleItems.some(x => x.schedule?.type === "타설")) lines.push("오늘은 콘크리트 타설 일정이 있어 펌프카 전도, 레미콘 동선, 타설구간 추락·미끄럼을 최우선으로 봅니다.");
  if(scheduleItems.some(x => x.schedule?.type === "점검")) lines.push("점검 일정이 있으므로 위험성평가·TBM·순회점검·시정조치 기록과 실제 현장 상태의 일치 여부를 먼저 맞춥니다.");
  const dangerWeather = weatherItems.filter(x => x.level === "danger");
  if(dangerWeather.length) lines.push(`기상 위험 ${dangerWeather.length}건이 있어 작업순서 조정 또는 고위험작업 중지 검토가 필요합니다.`);
  const dueCount = routines.filter(x => x.dueNow).length;
  const soonCount = routines.filter(x => x.soon).length;
  if(dueCount) lines.push(`정기 안전업무 ${dueCount}건이 오늘 마감 또는 기한 경과 상태입니다. 미완료 항목은 오늘업무에 우선 반영하세요.`);
  if(soonCount) lines.push(`정기 안전업무 ${soonCount}건은 처리 기한이 3일 이내입니다. 월간 누락 방지를 위해 미리 완료 처리하세요.`);
  if(!lines.length) lines.push("오늘은 급한 위험 신호는 낮지만 TBM, 보호구, 통로·개구부, 장비동선 순회점검을 유지하면 됩니다.");
  return lines;
}
function buildTbm(scheduleItems, weatherItems, routines){
  const messages = [];
  scheduleItems.slice(0,4).forEach(item => { const tbm = standardForSchedule(item?.schedule || {}).tbm; if(tbm) messages.push(tbm); });
  weatherItems.filter(x => x.level !== "safe").slice(0,3).forEach(x => messages.push(`${x.title}: ${x.detail}`));
  routines.filter(x => x.dueNow).slice(0,2).forEach(x => messages.push(`정기업무: ${x.title}을 오늘 완료하고 기록을 남깁니다.`));
  return [...new Set(messages)].join("\n\n") || "금일 작업 전 TBM에서 작업구역 통제, 보호구 착용, 장비동선, 날씨 변화를 공유하세요.";
}
export function buildSafetyDashboard(){
  const schedules = schedulesForToday();
  const weather = getDemoWeatherSummary();
  const weatherItems = weatherSafetyActions(weather);
  const scheduleItems = buildScheduleSafetyItems(schedules);
  const todayWorkItems = buildTodayInputSafetyItems();
  const linkedItems = [...todayWorkItems, ...scheduleItems.filter(x => !todayWorkItems.some(y => y.title.includes(x.title.replace(/^.*? · /, ""))))];
  const routines = ensureSafetyRoutine();
  const dueRoutines = routines.filter(x => x.dueNow || x.soon);
  const todayTasks = [
    ...linkedItems.map(x => ({source:x.source || "일정", level:x.level, title:x.title, detail:x.detail, checklist:x.checklist})),
    ...weatherItems.map(x => ({source:"날씨", level:x.level, title:x.title, detail:x.detail})),
    ...dueRoutines.map(x => ({source:x.group, level:x.priority === "high" ? "danger" : "warn", title:x.title, detail:`${x.owner} · ${x.dueText || (x.dueNow ? "오늘 처리" : `${x.daysLeft}일 후 임박`)}`}))
  ];
  return {
    date: todayYmd(), schedules, weather, weatherItems, scheduleItems:linkedItems, todayWorkItems, routines, eventDuties: SAFETY_EVENT_DUTIES, dutyDatabase: SAFETY_DUTY_DB,
    todayTasks: todayTasks.slice(0,18),
    aiSummary: buildAiSummary(linkedItems, weatherItems, routines),
    tbm: buildTbm(linkedItems, weatherItems, routines)
  };
}

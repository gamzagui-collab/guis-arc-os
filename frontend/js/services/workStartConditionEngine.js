import { state, saveLocal } from "../core/state.js";
import { tasksForWork, workInstancesForDate, todayYmd } from "./workInstanceDatabase.js";
import { ensureQualityState, isConcreteWork } from "./qualityManagement.js";
import { ensureConstructionState, getConstructionRecord } from "./constructionManagement.js";
import { ensureResourceState, syncResourcesForWork } from "./resourceManagement.js";

const nowIso = () => new Date().toISOString();
const doneTask = task => task?.status === "완료" || ((task?.items || []).length > 0 && (task.items || []).every((_, i) => Boolean(task.checkedItems?.[i])));
const clean = value => String(value ?? "").trim();
const materialReady = row => ["반입완료","검수완료","사용중","잔량확인"].includes(row.status) && (row.inspection || row.status !== "검수완료" ? true : row.inspection);
const equipmentReady = row => ["반입완료","배치완료","사용중"].includes(row.status) && Boolean(row.certificateConfirmed) && Boolean(row.operatorQualified) && Boolean(row.dailyCheckConfirmed) && Boolean(row.placementConfirmed);

function condition({ id, title, ownerRole, required=true, ok=false, detail="", targetPage="todayPage", source="AUTO" }){
  return { id, title, ownerRole, required, ok:Boolean(ok), detail, targetPage, source };
}
function firstTask(tasks, type, pattern){ return tasks.find(task => task.type === type && (!pattern || pattern.test(`${task.title} ${(task.items||[]).join(" ")}`))); }

export function ensureWorkStartConditionState(){
  state.workStartConditionHistory = Array.isArray(state.workStartConditionHistory) ? state.workStartConditionHistory : [];
  state.workStartConditionOverrides = state.workStartConditionOverrides && typeof state.workStartConditionOverrides === "object" && !Array.isArray(state.workStartConditionOverrides) ? state.workStartConditionOverrides : {};
}

export function evaluateWorkStartConditions(work){
  ensureWorkStartConditionState(); ensureQualityState(); ensureConstructionState(); ensureResourceState();
  const tasks = tasksForWork(work.workId);
  const record = getConstructionRecord(work.workId, true);
  const inspection = (state.constructionInspections || []).find(x => x.workId === work.workId);
  const resources = syncResourcesForWork(work, false);
  const materials = resources.filter(x => x.type === "자재");
  const equipment = resources.filter(x => x.type === "장비");
  const specimens = (state.specimenTasks || []).filter(x => x.workId === work.workId);
  const tests = (state.qualityTests || []).filter(x => x.workId === work.workId);
  const qualityDocs = (state.qualityDocuments || []).filter(x => x.workId === work.workId);
  const concrete = isConcreteWork(work);
  const rows = [];

  const tbm = firstTask(tasks, "TBM");
  const safety = firstTask(tasks, "SAFETY_CHECK");
  const equipmentSafety = firstTask(tasks, "EQUIPMENT_SAFETY");
  const risk = tasks.find(t => /위험성평가/.test(t.title));
  const plan = firstTask(tasks, "WORK_PLAN") || tasks.find(t => /작업계획/.test(t.title));
  const permit = firstTask(tasks, "WORK_PERMIT") || tasks.find(t => /작업허가/.test(t.title));

  if(tbm) rows.push(condition({id:"tbm",title:"TBM 완료",ownerRole:"안전관리",ok:doneTask(tbm),detail:"작업 시작 전 TBM 실시 및 참석 확인",targetPage:"safetyPage"}));
  if(risk) rows.push(condition({id:"risk",title:"위험성평가 확인",ownerRole:"안전관리",ok:doneTask(risk),detail:"당일 작업 위험요인과 예방조치 확인",targetPage:"safetyPage"}));
  if(safety) rows.push(condition({id:"safety",title:"작업 전 안전점검",ownerRole:"안전관리",ok:doneTask(safety),detail:"추락·낙하·동선·보호구 등 필수 안전조치 확인",targetPage:"safetyPage"}));
  if(equipmentSafety) rows.push(condition({id:"equipment-safety",title:"장비 작업 안전확인",ownerRole:"안전관리",ok:doneTask(equipmentSafety),detail:"작업반경·신호수·아웃트리거·지반상태 확인",targetPage:"safetyPage"}));
  if(permit) rows.push(condition({id:"permit",title:"작업허가 확인",ownerRole:"안전관리",ok:doneTask(permit),detail:"허가 대상 작업의 당일 작업조건 확인",targetPage:"safetyPage"}));

  if(plan) rows.push(condition({id:"work-plan",title:"작업계획 확인",ownerRole:"공사관리",ok:doneTask(plan) || Boolean(record?.workPlanConfirmed),detail:"작업순서·방법·장비·인원·안전조치 계획 확인",targetPage:"constructionPage"}));
  rows.push(condition({id:"prerequisites",title:"선행공정 확인",ownerRole:"공사관리",ok:Boolean(record?.prerequisitesConfirmed),detail:"선행공정 완료와 작업구역 인계상태 확인",targetPage:"constructionPage"}));

  if(concrete){
    rows.push(condition({id:"inspection",title:"검측 완료",ownerRole:"공사관리",ok:inspection?.status === "검측완료",detail:`현재 검측상태: ${inspection?.status || "미요청"}`,targetPage:"constructionPage"}));
    rows.push(condition({id:"specimen",title:"공시체 계획",ownerRole:"품질관리",ok:specimens.length > 0,detail:"타설량 기준 공시체 계획과 Work ID 연결 확인",targetPage:"qualityPage"}));
    const plannedTests = tests.filter(x => ["슬럼프 시험","공기량 시험","염화물 시험","콘크리트 온도"].includes(x.testType));
    rows.push(condition({id:"quality-ready",title:"품질시험 준비",ownerRole:"품질관리",ok:plannedTests.length >= 4,detail:`기본 현장시험 ${plannedTests.length}/4건 계획`,targetPage:"qualityPage"}));
    rows.push(condition({id:"curing",title:"양생계획 확인",ownerRole:"공사관리",ok:Boolean(record?.curingConfirmed),detail:"양생기간·보호방법·후속공정 착수조건 확인",targetPage:"constructionPage"}));
  }

  if(materials.length){
    const ready = materials.filter(materialReady).length;
    rows.push(condition({id:"materials",title:"자재 반입·검수",ownerRole:"자재·장비",ok:ready === materials.length,detail:`준비 ${ready}/${materials.length}건`,targetPage:"resourcePage"}));
  }
  if(equipment.length){
    const ready = equipment.filter(equipmentReady).length;
    rows.push(condition({id:"equipment",title:"장비 서류·점검·배치",ownerRole:"자재·장비",ok:ready === equipment.length,detail:`준비 ${ready}/${equipment.length}건`,targetPage:"resourcePage"}));
  }
  if(qualityDocs.length){
    const requiredDocs = qualityDocs.filter(x => /시험성적서|자재승인|납품/.test(x.documentType));
    if(requiredDocs.length){
      const ready = requiredDocs.filter(x => x.status === "확인완료").length;
      rows.push(condition({id:"quality-docs",title:"품질자료 확인",ownerRole:"품질관리",required:false,ok:ready === requiredDocs.length,detail:`확인 ${ready}/${requiredDocs.length}건`,targetPage:"qualityPage"}));
    }
  }

  const required = rows.filter(x => x.required);
  const completed = required.filter(x => x.ok).length;
  const blocking = required.filter(x => !x.ok);
  const ratio = required.length ? Math.round(completed / required.length * 100) : 100;
  let status = "시작 가능";
  if(blocking.length >= 3 || blocking.some(x => ["inspection","safety","equipment","permit"].includes(x.id))) status = "시작 보류";
  else if(blocking.length) status = "확인 필요";

  const evaluation = {
    workId:work.workId, workDate:work.workDate, status, readiness:ratio,
    total:required.length, completed, blockingCount:blocking.length,
    conditions:rows, blocking, checkedAt:nowIso()
  };
  state.workStartConditionLast = state.workStartConditionLast && typeof state.workStartConditionLast === "object" ? state.workStartConditionLast : {};
  state.workStartConditionLast[work.workId] = evaluation;
  return evaluation;
}

export function evaluateStartConditionsForDate(date=todayYmd()){
  return workInstancesForDate(date).map(work => ({work, evaluation:evaluateWorkStartConditions(work)}));
}

export function migrateWorkStartConditionData(){
  ensureWorkStartConditionState();
  for(const work of state.workInstances || []) evaluateWorkStartConditions(work);
  state.workStartConditionMigratedAt = state.workStartConditionMigratedAt || nowIso();
}

export function saveWorkStartConditionSnapshot(workId){
  const work = (state.workInstances || []).find(x => x.workId === workId);
  if(!work) return null;
  const snapshot = evaluateWorkStartConditions(work);
  state.workStartConditionHistory.push(snapshot);
  if(state.workStartConditionHistory.length > 200) state.workStartConditionHistory = state.workStartConditionHistory.slice(-200);
  saveLocal();
  return snapshot;
}

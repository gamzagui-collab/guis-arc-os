import { state, saveLocal } from "../core/state.js";
import { ensureWorkInstanceStore, workInstancesForDate, tasksForWork, todayYmd } from "./workInstanceDatabase.js";
import { ensureQualityState, isConcreteWork } from "./qualityManagement.js";
import { ensureResourceState, syncResourcesForWork } from "./resourceManagement.js";
import { evidenceFor, getWorkApproval } from "./evidenceManagement.js";

const nowIso=()=>new Date().toISOString();
const clean=v=>String(v??"").trim();
function isTaskDone(task){
  if(!task) return false;
  if(task.status==="완료") return true;
  const items=task.items||[];
  return items.length>0 && items.every((_,i)=>Boolean(task.checkedItems?.[i]));
}
function taskBy(workId,type,pattern){
  return tasksForWork(workId).find(t=>t.type===type && (!pattern || pattern.test(`${t.title} ${(t.items||[]).join(" ")}`)));
}
function result(ruleId,title,ok,severity,detail,target){return {ruleId,title,ok,severity:ok?"ok":severity,detail,target};}
const actionKey=(workId,ruleId)=>`${workId}:${ruleId}`;
export function getComplianceAction(workId,ruleId){ensureComplianceState();return state.complianceActions[actionKey(workId,ruleId)]||null;}
export function setComplianceAction(workId,ruleId,status,reason=""){ensureComplianceState();const key=actionKey(workId,ruleId);state.complianceActions[key]={workId,ruleId,status,reason:clean(reason),updatedAt:nowIso()};saveLocal();return state.complianceActions[key];}
export function targetPageId(target){return ({"안전관리":"safetyPage","품질관리":"qualityPage","공사관리":"constructionPage","자재·장비":"resourcePage"})[target]||"todayPage";}

export function ensureComplianceState(){
  ensureWorkInstanceStore(); ensureQualityState(); ensureResourceState();
  state.complianceAuditHistory=Array.isArray(state.complianceAuditHistory)?state.complianceAuditHistory:[];
  state.complianceAcknowledgements=state.complianceAcknowledgements&&typeof state.complianceAcknowledgements==="object"&&!Array.isArray(state.complianceAcknowledgements)?state.complianceAcknowledgements:{};
  state.complianceActions=state.complianceActions&&typeof state.complianceActions==="object"&&!Array.isArray(state.complianceActions)?state.complianceActions:{};
}

export function auditWorkInstance(work){
  ensureComplianceState();
  const tasks=tasksForWork(work.workId);
  const docs=tasks.filter(t=>["DOCUMENT","WORK_PLAN","WORK_PERMIT"].includes(t.type));
  const tbm=tasks.find(t=>t.type==="TBM");
  const risk=docs.find(t=>/위험성평가/.test(t.title));
  const plan=tasks.find(t=>t.type==="WORK_PLAN") || docs.find(t=>/작업계획|계획서/.test(t.title));
  const permit=tasks.find(t=>t.type==="WORK_PERMIT") || docs.find(t=>/작업허가|허가서/.test(t.title));
  const quality=tasks.find(t=>t.type==="QUALITY_CHECK");
  const inspection=state.constructionInspections.find(x=>x.workId===work.workId);
  const specimens=state.specimenTasks.filter(x=>x.workId===work.workId);
  const resources=syncResourcesForWork(work,false);
  const equipment=resources.filter(x=>x.type==="장비");
  const curingItem=quality?.items?.findIndex(x=>/양생/.test(x))??-1;
  const concrete=isConcreteWork(work);
  const rows=[];
  rows.push(result("tbm","TBM",isTaskDone(tbm),"critical","작업 전 TBM 항목 전체 확인 필요","안전관리"));
  rows.push(result("risk","위험성평가",risk?isTaskDone(risk):false,"critical",risk?"위험성평가 작성·서명·증빙 확인":"공정 DB 필요서류에 위험성평가가 연결되지 않음","안전관리"));
  if(plan) rows.push(result("work-plan","작업계획서",isTaskDone(plan),"critical","작업순서·방법·장비·인원·안전조치 계획 확인","공사관리"));
  if(permit) rows.push(result("permit","작업허가서",isTaskDone(permit),"critical","당일 작업조건과 안전조치 확인 후 작업 시작 승인","안전관리"));
  if(equipment.length) rows.push(result("equipment","장비 서류·자체점검",equipment.every(x=>x.inspection),"critical",`장비 ${equipment.length}건의 점검·검수 여부 확인`,`자재·장비`));
  if(quality) rows.push(result("quality","품질체크",isTaskDone(quality),"warn","공정별 품질 체크리스트 완료 필요","품질관리"));
  if(concrete){
    rows.push(result("specimen","공시체 계획",specimens.length>0,"critical","타설 작업의 공시체 계획 및 라벨 연결 확인","품질관리"));
    rows.push(result("inspection","검측",inspection?.status==="검측완료","critical",inspection?`현재 상태: ${inspection.status}`:"검측 기록 없음","공사관리"));
    rows.push(result("curing","양생계획",curingItem>=0?Boolean(quality?.checkedItems?.[curingItem]):false,"critical",curingItem>=0?"공사관리의 양생계획 확인 필요":"양생계획 항목이 공정 DB에 없음","공사관리"));
  }
  const construction=tasks.find(t=>t.type==="CONSTRUCTION_CHECK");
  if(construction) rows.push(result("construction","공사체크",isTaskDone(construction),"warn","준비사항·선행공정·시공순서 확인","공사관리"));
  const decorated=rows.map(x=>({...x,action:getComplianceAction(work.workId,x.ruleId),targetPage:targetPageId(x.target),evidence:evidenceFor(work.workId,x.ruleId),approval:getWorkApproval(work.workId,x.ruleId)}));
  const missing=decorated.filter(x=>!x.ok);
  const managed=missing.filter(x=>["완료","보류","예외"].includes(x.action?.status));
  const open=missing.filter(x=>!["완료","보류","예외"].includes(x.action?.status));
  return {...work,checks:decorated,missing,openMissing:open,managedCount:managed.length,criticalCount:open.filter(x=>x.severity==="critical").length,warnCount:open.filter(x=>x.severity==="warn").length,completeCount:decorated.length-missing.length,totalCount:decorated.length};
}

export function buildComplianceAudit(date=todayYmd(),persist=false){
  ensureComplianceState();
  const works=workInstancesForDate(date).map(auditWorkInstance);
  const summary={date,works,totalWorks:works.length,totalChecks:works.reduce((n,w)=>n+w.totalCount,0),missingCount:works.reduce((n,w)=>n+w.openMissing.length,0),managedCount:works.reduce((n,w)=>n+w.managedCount,0),criticalCount:works.reduce((n,w)=>n+w.criticalCount,0),warnCount:works.reduce((n,w)=>n+w.warnCount,0)};
  if(persist){
    state.complianceLastAudit={date,checkedAt:nowIso(),missingCount:summary.missingCount,criticalCount:summary.criticalCount};
    state.complianceAuditHistory.push(state.complianceLastAudit);
    state.complianceAuditHistory=state.complianceAuditHistory.slice(-90);
    saveLocal();
  }
  return summary;
}

export function migrateComplianceData(){ensureComplianceState();buildComplianceAudit(todayYmd(),false);state.complianceDbMigratedAt=state.complianceDbMigratedAt||nowIso();}

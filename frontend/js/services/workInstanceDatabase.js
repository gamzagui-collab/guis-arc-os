import { state, saveLocal } from "../core/state.js";
import { getProcessById, findProcessByText } from "../data/processIntegrationDatabase.js";
import { syncRoleTasksForWork } from "./roleTaskGenerationEngine.js";
import { classifyWorkDocument } from "../data/workDocumentDatabase.js";

const KST = "Asia/Seoul";
const pad = n => String(n).padStart(2, "0");
export function todayYmd(){ return new Date().toLocaleDateString("sv-SE", { timeZone:KST }); }
function nowIso(){ return new Date().toISOString(); }
function clean(value){ return String(value ?? "").trim(); }
function workDate(record={}){ return record.workDate || record.date || todayYmd(); }

export function ensureWorkInstanceStore(){
  state.workInstances = Array.isArray(state.workInstances) ? state.workInstances : [];
  state.tasks = Array.isArray(state.tasks) ? state.tasks : [];
  state.workInstanceSequence = state.workInstanceSequence && typeof state.workInstanceSequence === "object" ? state.workInstanceSequence : {};
  return state.workInstances;
}
function nextWorkId(date=todayYmd()){
  ensureWorkInstanceStore();
  const maxExisting = state.workInstances
    .map(x => String(x.workId || "").match(new RegExp(`^WORK-${date.replaceAll("-","")}-(\\d{3})$`)))
    .filter(Boolean).reduce((max,m)=>Math.max(max,Number(m[1])),0);
  const next = Math.max(Number(state.workInstanceSequence[date]) || 0, maxExisting) + 1;
  state.workInstanceSequence[date] = next;
  return `WORK-${date.replaceAll("-","")}-${pad(next).padStart(3,"0")}`;
}
function resolveProcess(record={}){
  return getProcessById(record.processId) || findProcessByText(`${record.subProcess||record.subTrade||""} ${record.trade||""} ${record.title||""} ${record.description||record.detail||""}`);
}
function normalizeStatus(value){ return value === "확정" ? "확정" : value || "미확정"; }
export function normalizeWorkInstance(record={}, source="manual"){
  const date=workDate(record); const process=resolveProcess(record);
  return {
    workId: record.workId || nextWorkId(date),
    source: record.source || source,
    sourceId: record.sourceId ?? record.id ?? null,
    workDate: date,
    processId: record.processId || process?.id || null,
    category: record.category || record.type || process?.category || "작업",
    trade: record.trade || process?.trade || "기타",
    subProcess: record.subProcess || record.subTrade || process?.subProcess || record.title || "일반 작업",
    title: record.title || process?.subProcess || record.subTrade || "일반 작업",
    location: clean(record.location), contractor: clean(record.contractor), workers:Number(record.workers)||0,
    startTime: clean(record.startTime), endTime: clean(record.endTime),
    detail: clean(record.detail || record.description), status:normalizeStatus(record.status),
    createdAt: record.createdAt || nowIso(), updatedAt:record.updatedAt || nowIso(),
    links: { scheduleId:record.links?.scheduleId ?? (source==="schedule" ? record.id : null), todayActivityId:record.links?.todayActivityId ?? (source==="today" ? record.id : null) }
  };
}
export function generateTasksForWork(work){
  ensureWorkInstanceStore();
  return syncRoleTasksForWork(work, state.tasks);
}
export function upsertWorkInstance(record={}, source="manual", persist=true){
  ensureWorkInstanceStore(); const sourceId=record.sourceId ?? record.id ?? null;
  let work=record.workId ? state.workInstances.find(x=>x.workId===record.workId) : null;
  if(!work && sourceId!=null) work=state.workInstances.find(x=>String(x.links?.[source === "schedule" ? "scheduleId" : "todayActivityId"])===String(sourceId));
  let candidate=null;
  if(!work){
    candidate=normalizeWorkInstance({...record,sourceId},source);
    work=state.workInstances.find(x=>x.workDate===candidate.workDate && x.processId && x.processId===candidate.processId && clean(x.location)===clean(candidate.location) && !(source==="schedule"?x.links?.scheduleId:x.links?.todayActivityId));
  }
  if(work){
    const links={...(work.links||{})};
    if(source==="schedule") links.scheduleId=sourceId;
    if(source==="today") links.todayActivityId=sourceId;
    const normalized=normalizeWorkInstance({...work,...record,links,workId:work.workId,createdAt:work.createdAt},work.source||source);
    Object.assign(work,normalized,{links,updatedAt:nowIso()});
  }
  else { work=candidate || normalizeWorkInstance({...record,sourceId},source); state.workInstances.push(work); }
  generateTasksForWork(work); if(persist) saveLocal(); return work;
}
export function removeWorkInstanceBySource(source,sourceId,persist=true){
  ensureWorkInstanceStore(); const linkKey=source==="schedule"?"scheduleId":"todayActivityId";
  const target=state.workInstances.find(x=>String(x.links?.[linkKey])===String(sourceId));
  if(target){
    target.links={...(target.links||{}),[linkKey]:null};
    const hasLink=target.links.scheduleId!=null||target.links.todayActivityId!=null;
    if(!hasLink){ state.workInstances=state.workInstances.filter(x=>x.workId!==target.workId); state.tasks=state.tasks.filter(x=>x.workId!==target.workId); }
    else target.updatedAt=nowIso();
  }
  if(persist)saveLocal();
}
export function migrateLegacyWorkData(){
  ensureWorkInstanceStore();
  for(const item of (state.schedules||[])){ const work=upsertWorkInstance({...item,sourceId:item.id},"schedule",false); item.workId=work.workId; }
  const today=state.todayWork;
  for(const item of (today?.activities||[])){ const work=upsertWorkInstance({...item,date:today.date,sourceId:item.id,title:item.subProcess},"today",false); item.workId=work.workId; }
  state.workDbMigratedAt = state.workDbMigratedAt || nowIso();
}
export function workInstancesForDate(date=todayYmd()){ ensureWorkInstanceStore(); return state.workInstances.filter(x=>x.workDate===date); }
export function tasksForWork(workId){ ensureWorkInstanceStore(); return state.tasks.filter(x=>x.workId===workId); }

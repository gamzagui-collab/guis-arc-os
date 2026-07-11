import { state, saveLocal } from "../core/state.js";
import { ensureWorkInstanceStore, workInstancesForDate, tasksForWork, todayYmd } from "./workInstanceDatabase.js";
import { getProcessById, findProcessByText } from "../data/processIntegrationDatabase.js";

const nowIso=()=>new Date().toISOString();
const makeId=prefix=>`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
const clean=v=>String(v??"").trim();

export function ensureConstructionState(){
  ensureWorkInstanceStore();
  state.constructionRecords=Array.isArray(state.constructionRecords)?state.constructionRecords:[];
  state.constructionDrawings=Array.isArray(state.constructionDrawings)?state.constructionDrawings:[];
  state.constructionHandovers=Array.isArray(state.constructionHandovers)?state.constructionHandovers:[];
  state.constructionInspections=Array.isArray(state.constructionInspections)?state.constructionInspections:[];
  return {records:state.constructionRecords,drawings:state.constructionDrawings,handovers:state.constructionHandovers,inspections:state.constructionInspections};
}
function processFor(work={}){return getProcessById(work.processId)||findProcessByText(`${work.trade||""} ${work.subProcess||""} ${work.title||""}`);}
function defaultRecord(work){
  const process=processFor(work); const actions=process?.constructionActions||[];
  return {
    recordId:makeId("CONST"),workId:work.workId,
    preparation:actions.slice(0,2).join("\n"),
    workPlan:actions.join("\n"), workPlanConfirmed:false,
    prerequisites:"선행공정 완료 여부와 작업구역 인계 상태 확인", prerequisitesConfirmed:false,
    sequence:actions.join("\n"),
    curingPlan:"양생기간, 보호방법, 후속공정 착수조건 확인", curingConfirmed:false,
    interference:"동시작업·장비동선·자재 적치구역 간섭 확인",
    manager:"",notes:"",status:"확인",createdAt:nowIso(),updatedAt:nowIso()
  };
}
export function getConstructionRecord(workId,create=true){
  ensureConstructionState(); let record=state.constructionRecords.find(x=>x.workId===workId);
  if(!record&&create){const work=state.workInstances.find(x=>x.workId===workId);if(work){record=defaultRecord(work);state.constructionRecords.push(record);}}
  return record||null;
}
export function constructionWorkForDate(date=todayYmd()){
  ensureConstructionState();
  return workInstancesForDate(date).map(work=>({
    ...work,
    constructionTasks:tasksForWork(work.workId).filter(t=>t.type==="CONSTRUCTION_CHECK"),
    record:getConstructionRecord(work.workId,true),
    drawings:state.constructionDrawings.filter(x=>x.workId===work.workId),
    handovers:state.constructionHandovers.filter(x=>x.workId===work.workId),
    inspection:state.constructionInspections.find(x=>x.workId===work.workId)||null
  }));
}
export function toggleConstructionTaskItem(taskId,index,checked){
  ensureConstructionState();const task=state.tasks.find(x=>x.taskId===taskId);if(!task)return;
  task.checkedItems={...(task.checkedItems||{}),[index]:Boolean(checked)};
  const total=(task.items||[]).length,done=Object.values(task.checkedItems).filter(Boolean).length;
  task.status=total&&done>=total?"완료":done?"진행":"미완료";task.updatedAt=nowIso();saveLocal();
}
export function saveConstructionRecord(workId,patch={}){
  const record=getConstructionRecord(workId,true);if(!record)return null;
  Object.assign(record,{preparation:patch.preparation===undefined?record.preparation:clean(patch.preparation),workPlan:patch.workPlan===undefined?record.workPlan:clean(patch.workPlan),workPlanConfirmed:patch.workPlanConfirmed===undefined?Boolean(record.workPlanConfirmed):Boolean(patch.workPlanConfirmed),prerequisites:patch.prerequisites===undefined?record.prerequisites:clean(patch.prerequisites),prerequisitesConfirmed:patch.prerequisitesConfirmed===undefined?Boolean(record.prerequisitesConfirmed):Boolean(patch.prerequisitesConfirmed),sequence:patch.sequence===undefined?record.sequence:clean(patch.sequence),curingPlan:patch.curingPlan===undefined?record.curingPlan:clean(patch.curingPlan),curingConfirmed:patch.curingConfirmed===undefined?Boolean(record.curingConfirmed):Boolean(patch.curingConfirmed),interference:patch.interference===undefined?record.interference:clean(patch.interference),manager:patch.manager===undefined?record.manager:clean(patch.manager),notes:patch.notes===undefined?record.notes:clean(patch.notes),status:patch.status||record.status||"확인",updatedAt:nowIso()});saveLocal();return record;
}

export function saveConstructionInspection(workId,data={}){
  ensureConstructionState();
  let row=state.constructionInspections.find(x=>x.workId===workId);
  if(!row){row={inspectionId:makeId("CINSP"),workId,createdAt:nowIso()};state.constructionInspections.push(row);}
  Object.assign(row,{
    status:data.status||row.status||"미요청",
    inspector:clean(data.inspector),
    result:clean(data.result),
    notes:clean(data.notes),
    requestedAt:data.requestedAt||row.requestedAt||"",
    inspectedAt:data.inspectedAt||row.inspectedAt||"",
    ownerRole:"construction",supportRoles:["quality","safety"],updatedAt:nowIso()
  });
  saveLocal(); return row;
}

export function addConstructionDrawing(workId,data={}){
  ensureConstructionState();const row={drawingId:makeId("DRAW"),workId,title:clean(data.title)||"시공도면",revision:clean(data.revision),status:data.status||"미확인",checkedBy:clean(data.checkedBy),createdAt:nowIso(),updatedAt:nowIso()};state.constructionDrawings.push(row);saveLocal();return row;
}
export function toggleConstructionDrawing(id,checked){ensureConstructionState();const row=state.constructionDrawings.find(x=>x.drawingId===id);if(!row)return;row.status=checked?"확인완료":"미확인";row.updatedAt=nowIso();saveLocal();}
export function addConstructionHandover(workId,data={}){
  ensureConstructionState();const row={handoverId:makeId("HAND"),workId,from:clean(data.from),to:clean(data.to),content:clean(data.content)||"작업구역 및 후속공정 인계",status:data.status||"인계완료",createdAt:nowIso()};state.constructionHandovers.push(row);saveLocal();return row;
}
export function migrateConstructionData(){
  ensureConstructionState();
  for(const work of state.workInstances||[]){ const row=getConstructionRecord(work.workId,true); if(row){ row.status=row.status==="준비"?"확인":(row.status||"확인"); row.workPlan=row.workPlan||row.sequence||""; row.workPlanConfirmed=Boolean(row.workPlanConfirmed); row.prerequisitesConfirmed=Boolean(row.prerequisitesConfirmed); row.curingPlan=row.curingPlan||"양생기간, 보호방법, 후속공정 착수조건 확인"; row.curingConfirmed=Boolean(row.curingConfirmed); }}
  state.constructionDbMigratedAt=state.constructionDbMigratedAt||nowIso();
}

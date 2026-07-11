import { state } from "../core/state.js";
import { applyTaskRole } from "./taskRoleClassification.js";

const nowIso=()=>new Date().toISOString();
const clone=value=>JSON.parse(JSON.stringify(value));
const textOf=task=>`${task?.title||""} ${(task?.items||[]).join(" ")}`;

function backupOnce(){
  if(state.roleMigrationBackupV981) return;
  state.roleMigrationBackupV981={
    createdAt:nowIso(),
    dataSchemaVersion:state.dataSchemaVersion||0,
    tasks:clone(state.tasks||[]),
    qualityInspections:clone(state.qualityInspections||[]),
    constructionInspections:clone(state.constructionInspections||[]),
    workResources:clone(state.workResources||[])
  };
}
function inspectionId(row,index){return row.inspectionId||`CINSP-MIG-${Date.now()}-${index}`;}
function migrateInspections(){
  state.qualityInspections=Array.isArray(state.qualityInspections)?state.qualityInspections:[];
  state.constructionInspections=Array.isArray(state.constructionInspections)?state.constructionInspections:[];
  state.qualityInspections.forEach((row,index)=>{
    let target=state.constructionInspections.find(x=>x.workId===row.workId);
    if(!target){
      target={...clone(row),inspectionId:inspectionId(row,index),ownerRole:"construction",supportRoles:["quality","safety"],migratedFrom:"qualityInspections",migratedAt:nowIso()};
      state.constructionInspections.push(target);
    }else{
      const sourceTime=Date.parse(row.updatedAt||row.inspectedAt||row.createdAt||0)||0;
      const targetTime=Date.parse(target.updatedAt||target.inspectedAt||target.createdAt||0)||0;
      if(sourceTime>targetTime) Object.assign(target,clone(row),{ownerRole:"construction",supportRoles:["quality","safety"],migratedFrom:"qualityInspections",migratedAt:nowIso()});
    }
  });
}
function migrateTasks(){
  state.tasks=Array.isArray(state.tasks)?state.tasks:[];
  for(const task of state.tasks){
    const text=textOf(task);
    if(task.type==="QUALITY_CHECK" && /검측/.test(text)){
      task.type="INSPECTION"; task.ownerRole="construction"; task.supportRoles=["quality","safety"]; task.referenceRoles=["director"];
    }
    if(task.type==="SAFETY_CHECK" && /품질|공사체크|시공순서|도면|검측 요청/.test(text)){
      task.ownerRole=/품질/.test(text)?"quality":"construction";
      task.supportRoles=task.ownerRole==="quality"?["construction"]:["quality","safety"];
      task.referenceRoles=["director"];
    }
    if(/장비 사전확인|장비점검|검사증|보험|운전자 자격|정비/.test(text)){
      task.type="EQUIPMENT_DOCUMENT"; task.ownerRole="resource"; task.supportRoles=["safety"]; task.referenceRoles=["construction","director"];
      task.title=String(task.title||"장비 확인").replace("장비 사전확인","장비 서류·자체점검");
    }else if(/작업반경|신호수|아웃트리거|유도자|장비 작업 안전/.test(text)){
      task.type="EQUIPMENT_SAFETY"; task.ownerRole="safety"; task.supportRoles=["resource","construction","foreman"]; task.referenceRoles=["director"];
    }
    applyTaskRole(task);
    task.roleMigratedAt=task.roleMigratedAt||nowIso();
  }
}
function classifyResources(){
  state.workResources=Array.isArray(state.workResources)?state.workResources:[];
  for(const row of state.workResources){
    if(row.type!=="장비") continue;
    row.ownerRole="resource";
    row.supportRoles=["safety","construction"];
    row.safetyCheckScope=row.safetyCheckScope||"작업반경·신호수·아웃트리거·지반상태";
    row.resourceCheckScope=row.resourceCheckScope||"검사증·보험·운전자 자격·일상점검·정비상태";
  }
}
export function migrateRoleSeparatedDataV981(){
  if(state.roleDataMigratedVersion==="9.8.1") return;
  backupOnce(); migrateInspections(); migrateTasks(); classifyResources();
  state.roleDataMigratedVersion="9.8.1";
  state.roleDataMigratedAt=nowIso();
}

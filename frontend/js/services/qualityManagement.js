import { state, saveLocal } from "../core/state.js";
import { ensureWorkInstanceStore, workInstancesForDate, tasksForWork, todayYmd } from "./workInstanceDatabase.js";
import { ensureSpecimenState, registerCasting } from "./specimenManager.js";

function nowIso(){ return new Date().toISOString(); }
function id(prefix){ return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`; }
function clean(v){ return String(v ?? "").trim(); }
const CONSTRUCTION_WORDS=/검측|시공순서|이어치기|작업순서|공정|수직도|수평도|개구부 위치|설치 위치|작업 대상 위치|존치부/i;
const DEFAULT_CONCRETE_TESTS=["슬럼프 시험","공기량 시험","염화물 시험","콘크리트 온도"];

export function ensureQualityState(){
  ensureWorkInstanceStore(); ensureSpecimenState();
  state.qualityInspections = Array.isArray(state.qualityInspections) ? state.qualityInspections : [];
  state.qualityTests = Array.isArray(state.qualityTests) ? state.qualityTests : [];
  state.qualityPhotos = Array.isArray(state.qualityPhotos) ? state.qualityPhotos : [];
  state.qualityDocuments = Array.isArray(state.qualityDocuments) ? state.qualityDocuments : [];
  return {inspections:state.qualityInspections,tests:state.qualityTests,photos:state.qualityPhotos,documents:state.qualityDocuments};
}
export function isConcreteWork(work={}){return /concrete|콘크리트|타설/i.test(`${work.processId||""} ${work.trade||""} ${work.subProcess||""} ${work.title||""}`);}
export function isQualityOwnedItem(item=""){return !CONSTRUCTION_WORDS.test(clean(item));}
function qualityTaskView(task){const items=(task.items||[]).map((item,originalIndex)=>({item,originalIndex})).filter(x=>isQualityOwnedItem(x.item));return {...task,qualityItems:items};}

export function ensureAutomaticQualityRecords(work){
  ensureQualityState(); let changed=false;
  if(isConcreteWork(work)){
    for(const testType of DEFAULT_CONCRETE_TESTS){
      if(!state.qualityTests.some(x=>x.workId===work.workId&&x.testType===testType)){
        state.qualityTests.push({testId:id("QTEST"),workId:work.workId,testType,plannedDate:work.workDate||todayYmd(),result:"",status:"예정",notes:"공정 DB 자동 생성",source:"AUTO",createdAt:nowIso(),updatedAt:nowIso()}); changed=true;
      }
    }
  }
  const defaults=["시험성적서","자재승인서·납품서류"];
  for(const documentType of defaults){
    if(!state.qualityDocuments.some(x=>x.workId===work.workId&&x.documentType===documentType)){
      state.qualityDocuments.push({documentId:id("QDOC"),workId:work.workId,documentType,status:"미확인",fileName:"",notes:"",source:"AUTO",createdAt:nowIso(),updatedAt:nowIso()}); changed=true;
    }
  }
  if(changed) saveLocal();
}

export function qualityWorkForDate(date=todayYmd()){
  ensureQualityState();
  const works=workInstancesForDate(date);
  works.forEach(ensureAutomaticQualityRecords);
  return works.map(work => ({
    ...work,
    qualityTasks:tasksForWork(work.workId).filter(t=>t.type === "QUALITY_CHECK").map(qualityTaskView).filter(t=>t.qualityItems.length),
    inspection:(state.constructionInspections||[]).find(x=>x.workId===work.workId) || null,
    tests:state.qualityTests.filter(x=>x.workId===work.workId),
    specimenTasks:state.specimenTasks.filter(x=>x.workId===work.workId),
    photos:state.qualityPhotos.filter(x=>x.workId===work.workId),
    documents:state.qualityDocuments.filter(x=>x.workId===work.workId)
  })).filter(x=>x.qualityTasks.length || isConcreteWork(x) || x.tests.length || x.specimenTasks.length || x.documents.length);
}

export function toggleQualityTaskItem(taskId,itemIndex,checked){ensureQualityState();const task=state.tasks.find(x=>x.taskId===taskId);if(!task)return;task.checkedItems={...(task.checkedItems||{}),[itemIndex]:Boolean(checked)};const owned=(task.items||[]).map((item,index)=>({item,index})).filter(x=>isQualityOwnedItem(x.item));const done=owned.filter(x=>task.checkedItems?.[x.index]).length;task.status=owned.length&&done>=owned.length?"완료":done?"진행":"미완료";task.updatedAt=nowIso();saveLocal();}
export function addQualityTest(workId,data={}){ensureQualityState();const test={testId:id("QTEST"),workId,testType:clean(data.testType)||"현장 품질시험",plannedDate:data.plannedDate||todayYmd(),result:clean(data.result),status:data.status||"예정",notes:clean(data.notes),source:data.source||"MANUAL",createdAt:nowIso(),updatedAt:nowIso()};state.qualityTests.push(test);saveLocal();return test;}
export function updateQualityTest(testId,patch={}){ensureQualityState();const test=state.qualityTests.find(x=>x.testId===testId);if(!test)return;Object.assign(test,patch,{updatedAt:nowIso()});saveLocal();}
export function updateQualityDocument(documentId,patch={}){ensureQualityState();const doc=state.qualityDocuments.find(x=>x.documentId===documentId);if(!doc)return;Object.assign(doc,patch,{updatedAt:nowIso()});saveLocal();}
export function addQualityPhoto(workId,file){ensureQualityState();const photo={photoId:id("QPHOTO"),workId,name:file?.name||"품질사진",size:file?.size||0,type:file?.type||"",category:"품질증빙",capturedAt:nowIso()};state.qualityPhotos.push(photo);saveLocal();return photo;}
export function createSpecimenPlanForWork(workId,data={}){ensureQualityState();const work=state.workInstances.find(x=>x.workId===workId);if(!work)throw new Error("연결할 작업을 찾을 수 없습니다.");const existing=state.castings.find(x=>x.workId===workId);if(existing)return {casting:existing,tasks:state.specimenTasks.filter(x=>x.workId===workId),totalQty:existing.totalSpecimens||0,existing:true};return registerCasting({workId,castDate:work.workDate,block:data.block||work.location||"현장",floor:data.floor||"",member:data.member||work.subProcess||work.title,volumeM3:Number(data.volumeM3)||120,designStrength:data.designStrength||"",company:data.company||work.contractor||"",mixNo:data.mixNo||""});}
export function resolveSpecimenWorkId(task={}){ensureQualityState();if(task.workId)return task.workId;return state.castings.find(c=>String(c.id)===String(task.castingId))?.workId||null;}
export function migrateQualityData(){ensureQualityState();for(const casting of state.castings){if(casting.workId)continue;const match=state.workInstances.find(w=>w.workDate===casting.castDate&&isConcreteWork(w)&&(!casting.block||clean(w.location).includes(clean(casting.block))));if(match)casting.workId=match.workId;}for(const task of state.specimenTasks){const casting=state.castings.find(c=>String(c.id)===String(task.castingId));if(casting?.workId&&task.workId!==casting.workId)task.workId=casting.workId;}for(const work of state.workInstances||[])ensureAutomaticQualityRecords(work);state.qualityDbMigratedAt=state.qualityDbMigratedAt||nowIso();}

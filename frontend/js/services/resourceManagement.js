import { state, saveLocal } from "../core/state.js";
import { ensureWorkInstanceStore, workInstancesForDate, todayYmd } from "./workInstanceDatabase.js";
import { getProcessById, findProcessByText } from "../data/processIntegrationDatabase.js";

const nowIso=()=>new Date().toISOString();
const makeId=prefix=>`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
const clean=v=>String(v??"").trim();
const EQUIPMENT_WORDS=["기","차","크레인","펌프카","레미콘","진동기","절단기","절곡기","믹서","팬","양수기","분전반","용접","측정기","삼각대","브레이커","살수장비","작업대","승강설비","비계","발판","동바리"];
const MATERIAL_WORDS=["철근","결속선","캡","패널","멍에","장선","체결재","와이어로프","샤클","유도줄","받침판","방수재","프라이머","보양포","비닐","몰드","벽돌","블록","몰탈","타일","접착제","도료","희석제","케이블","접지선","보호대","스페이서","가스용기","불티방지포","방진막","폐기물 용기"];

export const MATERIAL_STATUS=["필요","발주","반입예정","반입완료","검수완료","사용중","잔량확인"];
export const EQUIPMENT_STATUS=["필요","섭외","반입예정","반입완료","배치완료","사용중","반출완료"];

export function ensureResourceState(){
  ensureWorkInstanceStore();
  state.workResources=Array.isArray(state.workResources)?state.workResources:[];
  for(const row of state.workResources) normalizeResource(row);
  return state.workResources;
}
function processFor(work={}){return getProcessById(work.processId)||findProcessByText(`${work.trade||""} ${work.subProcess||""} ${work.title||""}`);}
export function classifyResource(name=""){
  const text=clean(name);
  if(MATERIAL_WORDS.some(x=>text.includes(x))) return "자재";
  if(EQUIPMENT_WORDS.some(x=>text.includes(x))) return "장비";
  return "자재";
}
function resourceKey(workId,type,name){return `${workId}:${type}:${clean(name).toLowerCase()}`;}
function normalizeResource(row){
  row.type=row.type==="장비"?"장비":"자재";
  row.quantity=clean(row.quantity); row.unit=clean(row.unit); row.supplier=clean(row.supplier);
  row.deliveryDate=row.deliveryDate||""; row.location=clean(row.location); row.notes=clean(row.notes);
  row.status=row.status||"필요"; row.inspection=Boolean(row.inspection);
  if(row.type==="자재"){
    row.orderConfirmed=Boolean(row.orderConfirmed||["발주","반입예정","반입완료","검수완료","사용중","잔량확인","준비완료"].includes(row.status));
    row.receiptConfirmed=Boolean(row.receiptConfirmed||["반입완료","검수완료","사용중","잔량확인","준비완료"].includes(row.status));
    row.qualityDocumentConfirmed=Boolean(row.qualityDocumentConfirmed);
    row.stockChecked=Boolean(row.stockChecked);
    if(row.status==="준비완료") row.status="검수완료";
  }else{
    row.certificateConfirmed=Boolean(row.certificateConfirmed||row.inspection);
    row.operatorQualified=Boolean(row.operatorQualified);
    row.dailyCheckConfirmed=Boolean(row.dailyCheckConfirmed||row.inspection);
    row.placementConfirmed=Boolean(row.placementConfirmed||["배치완료","사용중","반출완료","준비완료"].includes(row.status));
    row.returnConfirmed=Boolean(row.returnConfirmed||row.status==="반출완료");
    if(row.status==="준비완료") row.status="배치완료";
  }
  return row;
}
function defaultRow(work,name,type,source="process"){
  return normalizeResource({resourceId:makeId("RES"),resourceKey:resourceKey(work.workId,type,name),workId:work.workId,type,name:clean(name),quantity:"",unit:type==="장비"?"대":"",supplier:"",deliveryDate:work.workDate,status:"필요",inspection:false,location:"",notes:"",source,createdAt:nowIso(),updatedAt:nowIso()});
}
export function syncResourcesForWork(work,persist=false){
  ensureResourceState(); const process=processFor(work); const defs=[];
  for(const name of process?.materialsEquipment||[]) defs.push({name,type:classifyResource(name),source:"process"});
  const today=state.todayWork||{};
  if(today.date===work.workDate){
    for(const row of today.materials||[]) defs.push({name:row.name||row.title,type:"자재",source:"today",quantity:row.qty||row.quantity||"",unit:row.unit||""});
    for(const row of today.equipment||[]) defs.push({name:row.name||row.title,type:"장비",source:"today",quantity:row.qty||row.quantity||"",unit:row.unit||"대"});
  }
  for(const def of defs.filter(x=>clean(x.name))){
    const key=resourceKey(work.workId,def.type,def.name); let row=state.workResources.find(x=>x.resourceKey===key);
    if(!row){row=defaultRow(work,def.name,def.type,def.source);state.workResources.push(row);}
    normalizeResource(row); if(!row.quantity&&def.quantity)row.quantity=def.quantity;if(!row.unit&&def.unit)row.unit=def.unit;row.updatedAt=nowIso();
  }
  if(persist)saveLocal();
  return state.workResources.filter(x=>x.workId===work.workId).map(normalizeResource);
}
export function resourceWorkForDate(date=todayYmd()){
  ensureResourceState();
  return workInstancesForDate(date).map(work=>({...work,resources:syncResourcesForWork(work,false)}));
}
export function updateWorkResource(resourceId,patch={}){
  ensureResourceState();const row=state.workResources.find(x=>x.resourceId===resourceId);if(!row)return null;
  const common={quantity:clean(patch.quantity??row.quantity),unit:clean(patch.unit??row.unit),supplier:clean(patch.supplier??row.supplier),deliveryDate:patch.deliveryDate??row.deliveryDate,status:patch.status||row.status,location:clean(patch.location??row.location),notes:clean(patch.notes??row.notes),updatedAt:nowIso()};
  Object.assign(row,common);
  if(row.type==="자재") Object.assign(row,{orderConfirmed:Boolean(patch.orderConfirmed),receiptConfirmed:Boolean(patch.receiptConfirmed),inspection:Boolean(patch.inspection),qualityDocumentConfirmed:Boolean(patch.qualityDocumentConfirmed),stockChecked:Boolean(patch.stockChecked)});
  else Object.assign(row,{certificateConfirmed:Boolean(patch.certificateConfirmed),operatorQualified:Boolean(patch.operatorQualified),dailyCheckConfirmed:Boolean(patch.dailyCheckConfirmed),placementConfirmed:Boolean(patch.placementConfirmed),returnConfirmed:Boolean(patch.returnConfirmed),inspection:Boolean(patch.dailyCheckConfirmed)});
  normalizeResource(row); saveLocal(); return row;
}
export function addWorkResource(workId,data={}){
  ensureResourceState();const work=state.workInstances.find(x=>x.workId===workId);if(!work)return null;const name=clean(data.name);if(!name)return null;
  const type=data.type==="장비"?"장비":"자재",key=resourceKey(workId,type,name);let row=state.workResources.find(x=>x.resourceKey===key);
  if(!row){row=defaultRow(work,name,type,"manual");state.workResources.push(row);}Object.assign(row,{quantity:clean(data.quantity),unit:clean(data.unit)||(type==="장비"?"대":""),updatedAt:nowIso()});saveLocal();return row;
}
export function removeWorkResource(resourceId){ensureResourceState();state.workResources=state.workResources.filter(x=>x.resourceId!==resourceId);saveLocal();}
export function migrateResourceData(){ensureResourceState();for(const work of state.workInstances||[])syncResourcesForWork(work,false);state.resourceDbMigratedAt=state.resourceDbMigratedAt||nowIso();state.resourceRoleSplitMigratedAt=state.resourceRoleSplitMigratedAt||nowIso();}

import { state } from "../core/state.js";
import { getProcessById, findProcessByText } from "../data/processIntegrationDatabase.js";
import { classifyWorkDocument } from "../data/workDocumentDatabase.js";
import { applyTaskRole, taskRoleRule } from "./taskRoleClassification.js";

const nowIso = () => new Date().toISOString();
const clean = value => String(value ?? "").trim();
const unique = values => [...new Set((values || []).map(clean).filter(Boolean))];
const slug = value => clean(value).toLowerCase().replace(/[^0-9a-z가-힣]+/g, "-").replace(/^-|-$/g, "");

function resolveProcess(work = {}){
  return getProcessById(work.processId) || findProcessByText(`${work.subProcess || ""} ${work.trade || ""} ${work.title || ""} ${work.detail || ""}`);
}

function definition({ ruleId, type, title, items, ownerRole, supportRoles, referenceRoles, required = true, evidenceRequired = false, completionRule }){
  const role = taskRoleRule(type);
  return {
    ruleId,
    type,
    title,
    items: unique(items),
    ownerRole: ownerRole || role.ownerRole,
    supportRoles: unique(supportRoles || role.supportRoles),
    referenceRoles: unique(referenceRoles || role.referenceRoles),
    required,
    evidenceRequired,
    completionRule: completionRule || "모든 필수항목 완료"
  };
}

function equipmentSafetyItems(process){
  const source = [...(process?.preventiveActions || []), ...(process?.tbmPoints || [])];
  const keywords = ["작업반경", "신호수", "유도자", "아웃트리거", "지반", "동선", "후진", "붐", "받침판", "출입통제"];
  return unique(source.filter(item => keywords.some(keyword => item.includes(keyword))));
}

export function buildRoleTaskDefinitions(work = {}){
  const process = resolveProcess(work);
  if(!process) return [];
  const processKey = process.id || slug(process.subProcess);
  const definitions = [];

  if((process.tbmPoints || []).length){
    definitions.push(definition({
      ruleId:`${processKey}:safety:tbm`, type:"TBM", title:`${process.subProcess} TBM`, items:process.tbmPoints,
      ownerRole:"safety", supportRoles:["foreman"], referenceRoles:["director","construction"], evidenceRequired:true,
      completionRule:"TBM 실시 및 참석 확인"
    }));
  }
  if((process.preventiveActions || []).length){
    definitions.push(definition({
      ruleId:`${processKey}:safety:check`, type:"SAFETY_CHECK", title:`${process.subProcess} 안전점검`, items:process.preventiveActions,
      ownerRole:"safety", supportRoles:["foreman","construction"], referenceRoles:["director"], evidenceRequired:true,
      completionRule:"필수 안전조치 확인"
    }));
  }

  const equipmentItems = equipmentSafetyItems(process);
  if(equipmentItems.length){
    definitions.push(definition({
      ruleId:`${processKey}:safety:equipment`, type:"EQUIPMENT_SAFETY", title:`${process.subProcess} 장비 작업 안전확인`, items:equipmentItems,
      ownerRole:"safety", supportRoles:["resource","construction","foreman"], referenceRoles:["director"],
      completionRule:"작업반경·유도자·지반 등 작업 안전조건 확인"
    }));
  }

  for(const documentTitle of (process.documents || [])){
    const doc = classifyWorkDocument(documentTitle);
    const type = doc?.documentType || "DOCUMENT";
    const role = taskRoleRule(type);
    definitions.push(definition({
      ruleId:`${processKey}:document:${slug(documentTitle)}`, type, title:documentTitle,
      items:[doc ? `${doc.question} · ${doc.completionRule}` : `${documentTitle} 작성·서명·증빙 확인`],
      ownerRole:doc?.ownerRole || role.ownerRole, supportRoles:doc?.supportRoles || role.supportRoles,
      referenceRoles:doc?.referenceRoles || role.referenceRoles, evidenceRequired:true,
      completionRule:doc?.completionRule || "문서 작성 및 확인"
    }));
  }

  if((process.qualityActions || []).length){
    definitions.push(definition({
      ruleId:`${processKey}:quality:check`, type:"QUALITY_CHECK", title:`${process.subProcess} 품질체크`, items:process.qualityActions,
      ownerRole:"quality", supportRoles:["construction"], referenceRoles:["director"], evidenceRequired:true,
      completionRule:"품질 기준 확인 및 결과 기록"
    }));
  }
  if((process.constructionActions || []).length){
    definitions.push(definition({
      ruleId:`${processKey}:construction:check`, type:"CONSTRUCTION_CHECK", title:`${process.subProcess} 공사체크`, items:process.constructionActions,
      ownerRole:"construction", supportRoles:["quality","safety","resource"], referenceRoles:["director"],
      completionRule:"시공 준비·순서·후속공정 확인"
    }));
  }

  return dedupeDefinitions(definitions);
}

export function dedupeDefinitions(definitions = []){
  const map = new Map();
  for(const item of definitions){
    const key = `${item.ownerRole}:${item.type}:${slug(item.title)}`;
    const existing = map.get(key);
    if(!existing) map.set(key, {...item});
    else {
      existing.items = unique([...(existing.items || []), ...(item.items || [])]);
      existing.supportRoles = unique([...(existing.supportRoles || []), ...(item.supportRoles || [])]);
      existing.referenceRoles = unique([...(existing.referenceRoles || []), ...(item.referenceRoles || [])]);
      existing.evidenceRequired ||= item.evidenceRequired;
      existing.required ||= item.required;
    }
  }
  return [...map.values()];
}

export function syncRoleTasksForWork(work, tasks = state.tasks || []){
  const definitions = buildRoleTaskDefinitions(work);
  const made = [];
  for(const d of definitions){
    const taskKey = `${work.workId}:${d.ownerRole}:${d.type}:${slug(d.title)}`;
    let task = tasks.find(item => item.taskKey === taskKey || (item.workId === work.workId && item.ownerRole === d.ownerRole && item.type === d.type && slug(item.title) === slug(d.title)));
    if(!task){
      task = {
        taskId:`TASK-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
        taskKey, workId:work.workId, ruleId:d.ruleId, generatedBy:"ROLE_RULE_ENGINE",
        type:d.type, title:d.title, items:d.items, status:"미완료", checkedItems:{}, createdAt:nowIso(), updatedAt:nowIso()
      };
      Object.assign(task, d);
      tasks.push(applyTaskRole(task));
    }else{
      Object.assign(task, d, {taskKey, ruleId:d.ruleId, generatedBy:task.generatedBy || "ROLE_RULE_ENGINE", updatedAt:nowIso()});
      applyTaskRole(task);
    }
    made.push(task);
  }
  return made;
}

export function migrateRoleTaskGeneration(){
  state.tasks = Array.isArray(state.tasks) ? state.tasks : [];
  const merged = new Map();
  for(const raw of state.tasks){
    const task = applyTaskRole(raw);
    const key = `${task.workId}:${task.ownerRole}:${task.type}:${slug(task.title)}`;
    const existing = merged.get(key);
    if(!existing){
      task.taskKey = key;
      merged.set(key, task);
      continue;
    }
    existing.items = unique([...(existing.items || []), ...(task.items || [])]);
    existing.checkedItems = {...(task.checkedItems || {}), ...(existing.checkedItems || {})};
    if(existing.status !== "완료" && task.status === "완료") existing.status = "완료";
    existing.supportRoles = unique([...(existing.supportRoles || []), ...(task.supportRoles || [])]);
    existing.referenceRoles = unique([...(existing.referenceRoles || []), ...(task.referenceRoles || [])]);
    existing.updatedAt = nowIso();
  }
  state.tasks = [...merged.values()];
  for(const work of (state.workInstances || [])) syncRoleTasksForWork(work, state.tasks);
  state.roleTaskRuleSchemaVersion = 1;
  state.roleTaskRuleMigratedAt = state.roleTaskRuleMigratedAt || nowIso();
  return state.tasks;
}

import { state, saveLocal } from "../core/state.js";
import { classifyWorkDocument } from "../data/workDocumentDatabase.js";
const ROLE_RULES={
 TBM:{ownerRole:"safety",supportRoles:["foreman"],referenceRoles:["director","construction"]},
 SAFETY_CHECK:{ownerRole:"safety",supportRoles:["foreman","construction"],referenceRoles:["director"]},
 DOCUMENT:{ownerRole:"safety",supportRoles:[],referenceRoles:["director"]},
 WORK_PLAN:{ownerRole:"construction",supportRoles:["safety","resource","foreman"],referenceRoles:["director","quality"]},
 WORK_PERMIT:{ownerRole:"safety",supportRoles:["construction","foreman","resource"],referenceRoles:["director"]},
 QUALITY_CHECK:{ownerRole:"quality",supportRoles:["construction"],referenceRoles:["director"]},
 CONSTRUCTION_CHECK:{ownerRole:"construction",supportRoles:["quality","safety","resource"],referenceRoles:["director"]},
 INSPECTION:{ownerRole:"construction",supportRoles:["quality","safety"],referenceRoles:["director"]},
 EQUIPMENT_DOCUMENT:{ownerRole:"resource",supportRoles:["safety"],referenceRoles:["construction","director"]},
 EQUIPMENT_SAFETY:{ownerRole:"safety",supportRoles:["resource","construction","foreman"],referenceRoles:["director"]}
};
export function taskRoleRule(type){return ROLE_RULES[type]||{ownerRole:"construction",supportRoles:[],referenceRoles:["director"]};}
export function applyTaskRole(task){
 const docRule=classifyWorkDocument(task.title||"");
 if(docRule && ["DOCUMENT","WORK_PLAN","WORK_PERMIT"].includes(task.type)) task.type=docRule.documentType;
 const rule=docRule||taskRoleRule(task.type);task.ownerRole=task.ownerRole||rule.ownerRole;task.supportRoles=Array.isArray(task.supportRoles)?task.supportRoles:rule.supportRoles;task.referenceRoles=Array.isArray(task.referenceRoles)?task.referenceRoles:rule.referenceRoles;task.required=task.required!==false;task.completionRule=task.completionRule||"모든 필수항목 완료";task.evidenceRequired=Boolean(task.evidenceRequired);return task;}
export function migrateTaskRoleClassification(){state.tasks=Array.isArray(state.tasks)?state.tasks:[];state.tasks.forEach(applyTaskRole);state.taskRoleSchemaVersion=1;state.taskRoleMigratedAt=state.taskRoleMigratedAt||new Date().toISOString();saveLocal();return state.tasks;}

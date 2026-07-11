import { state, saveLocal } from "../core/state.js";

const nowIso=()=>new Date().toISOString();
const clean=v=>String(v??"").trim();
const key=(workId,ruleId)=>`${workId}:${ruleId}`;

export function ensureEvidenceState(){
  state.workEvidence=Array.isArray(state.workEvidence)?state.workEvidence:[];
  state.workApprovals=state.workApprovals&&typeof state.workApprovals==="object"&&!Array.isArray(state.workApprovals)?state.workApprovals:{};
}
export function evidenceFor(workId,ruleId){ensureEvidenceState();return state.workEvidence.filter(x=>x.workId===workId&&(!ruleId||x.ruleId===ruleId));}
export function addWorkEvidence({workId,ruleId,type="문서",name,note="",author=""}){
  ensureEvidenceState(); const title=clean(name); if(!workId||!ruleId||!title)return null;
  const row={evidenceId:`EVD-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,workId,ruleId,type:clean(type)||"문서",name:title,note:clean(note),author:clean(author),createdAt:nowIso()};
  state.workEvidence.push(row); saveLocal(); return row;
}
export function removeWorkEvidence(evidenceId){ensureEvidenceState();state.workEvidence=state.workEvidence.filter(x=>x.evidenceId!==evidenceId);saveLocal();}
export function getWorkApproval(workId,ruleId){ensureEvidenceState();return state.workApprovals[key(workId,ruleId)]||null;}
export function setWorkApproval(workId,ruleId,stage,person="",comment=""){
  ensureEvidenceState(); const k=key(workId,ruleId); const prev=state.workApprovals[k]||{workId,ruleId,createdAt:nowIso()};
  state.workApprovals[k]={...prev,stage,person:clean(person),comment:clean(comment),updatedAt:nowIso()}; saveLocal(); return state.workApprovals[k];
}
export function migrateEvidenceData(){ensureEvidenceState();state.evidenceDbMigratedAt=state.evidenceDbMigratedAt||nowIso();}

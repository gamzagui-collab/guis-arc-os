import { state, saveLocal } from "../core/state.js";
import { addWorkEvidence } from "./evidenceManagement.js";

const nowIso = () => new Date().toISOString();
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone:"Asia/Seoul" });
const clean = value => String(value ?? "").trim();

export function ensureSimpleActionState(){
  state.simpleActionRecords = Array.isArray(state.simpleActionRecords) ? state.simpleActionRecords : [];
}

export function getSimpleActionRecords({date=today(), workId=""}={}){
  ensureSimpleActionState();
  return state.simpleActionRecords
    .filter(row => (!date || row.date === date) && (!workId || row.workId === workId))
    .sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function createSimpleAction({workId="", actionType="현장확인", note="", photoDataUrl="", photoName="", location=""}={}){
  ensureSimpleActionState();
  const linkedWorkId = clean(workId) || "UNLINKED";
  const row = {
    actionId:`ACT-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    workId:linkedWorkId,
    date:today(),
    actionType:clean(actionType) || "현장확인",
    note:clean(note),
    location:clean(location),
    photoDataUrl:clean(photoDataUrl),
    photoName:clean(photoName),
    status:"확인대기",
    createdAt:nowIso(),
    confirmedAt:"",
    completedAt:""
  };
  state.simpleActionRecords.push(row);
  if(linkedWorkId !== "UNLINKED" && row.photoName){
    addWorkEvidence({
      workId:linkedWorkId,
      ruleId:"simple-action-photo",
      type:"사진",
      name:row.photoName,
      note:[row.actionType,row.note].filter(Boolean).join(" · "),
      author:"현장 사용자"
    });
  } else saveLocal();
  return row;
}

export function updateSimpleActionStatus(actionId, status){
  ensureSimpleActionState();
  const row = state.simpleActionRecords.find(item => item.actionId === actionId);
  if(!row) return null;
  row.status = status;
  if(status === "확인") row.confirmedAt = nowIso();
  if(status === "완료"){
    row.confirmedAt = row.confirmedAt || nowIso();
    row.completedAt = nowIso();
  }
  saveLocal();
  return row;
}

export function migrateSimpleActionFlow(){
  ensureSimpleActionState();
  state.simpleActionFlowMigratedAt = state.simpleActionFlowMigratedAt || nowIso();
}

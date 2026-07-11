import { state } from "../core/state.js";
import { auditWorkInstance } from "./complianceAudit.js";
import { tasksForWork, todayYmd } from "./workInstanceDatabase.js";
import { ensureQualityState, isConcreteWork } from "./qualityManagement.js";
import { ensureResourceState, syncResourcesForWork } from "./resourceManagement.js";
import { ensureConstructionState } from "./constructionManagement.js";

const READY_RESOURCE = new Set(["준비완료", "사용중", "반출완료"]);
const doneTask = task => task?.status === "완료" || ((task?.items || []).length > 0 && (task.items || []).every((_, i) => Boolean(task.checkedItems?.[i])));
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

function minutesUntil(work){
  if(work.workDate !== todayYmd() || !/^\d{2}:\d{2}$/.test(work.startTime || "")) return null;
  const [h,m] = work.startTime.split(":").map(Number);
  const now = new Date();
  const kst = new Date(now.toLocaleString("en-US", { timeZone:"Asia/Seoul" }));
  return h * 60 + m - (kst.getHours() * 60 + kst.getMinutes());
}

export function evaluateWorkPriority(work){
  ensureQualityState(); ensureResourceState(); ensureConstructionState();
  const audit = auditWorkInstance(work);
  const tasks = tasksForWork(work.workId);
  const resources = syncResourcesForWork(work, false);
  const equipment = resources.filter(x => x.type === "장비");
  const unreadyResources = resources.filter(x => !READY_RESOURCE.has(x.status));
  const uninspectedEquipment = equipment.filter(x => !x.inspection);
  const inspection = (state.constructionInspections || []).find(x => x.workId === work.workId);
  const specimens = (state.specimenTasks || []).filter(x => x.workId === work.workId);
  const construction = (state.constructionRecords || []).find(x => x.workId === work.workId);
  const incompleteTasks = tasks.filter(x => !doneTask(x));
  const reasons = [];
  let risk = 0;

  if(audit.criticalCount){ risk += audit.criticalCount * 18; reasons.push(`중대 누락 ${audit.criticalCount}건`); }
  if(audit.warnCount){ risk += audit.warnCount * 8; reasons.push(`보완 누락 ${audit.warnCount}건`); }
  if(uninspectedEquipment.length){ risk += Math.min(24, uninspectedEquipment.length * 8); reasons.push(`장비 미점검 ${uninspectedEquipment.length}건`); }
  if(unreadyResources.length){ risk += Math.min(18, unreadyResources.length * 4); reasons.push(`자원 미준비 ${unreadyResources.length}건`); }
  if(isConcreteWork(work) && inspection?.status !== "검측완료"){ risk += 18; reasons.push("검측 미완료"); }
  if(isConcreteWork(work) && specimens.length === 0){ risk += 18; reasons.push("공시체 계획 없음"); }
  if(construction?.status === "중지"){ risk += 25; reasons.push("공사 상태 중지"); }

  const mins = minutesUntil(work);
  if(mins !== null){
    if(mins <= 0){ risk += 20; reasons.push("작업 시작시간 경과"); }
    else if(mins <= 60){ risk += 16; reasons.push(`작업 시작 ${mins}분 전`); }
    else if(mins <= 180){ risk += 8; reasons.push(`작업 시작 ${Math.ceil(mins/60)}시간 이내`); }
  }

  const readiness = clamp(100 - risk, 0, 100);
  const priorityScore = clamp(risk + (work.status === "확정" ? 5 : 0), 0, 100);
  const level = priorityScore >= 65 ? "긴급" : priorityScore >= 35 ? "주의" : priorityScore > 0 ? "확인" : "정상";
  return {
    workId: work.workId, readiness, priorityScore, level, reasons,
    audit, incompleteTasks:incompleteTasks.length,
    resourcesTotal:resources.length, resourcesReady:resources.length-unreadyResources.length,
    equipmentTotal:equipment.length, equipmentInspected:equipment.length-uninspectedEquipment.length,
    inspectionStatus:inspection?.status || "미검측", specimenCount:specimens.length
  };
}

export function rankWorks(works=[]){
  return works.map(work => ({ work, evaluation:evaluateWorkPriority(work) }))
    .sort((a,b) => b.evaluation.priorityScore - a.evaluation.priorityScore || String(a.work.startTime||"99:99").localeCompare(String(b.work.startTime||"99:99")) || String(a.work.workId).localeCompare(String(b.work.workId)));
}

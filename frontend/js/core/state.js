export const state = {};

function safeParse(value, fallback){
  try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
}

const DATA_SCHEMA_VERSION = 26;

function normalizeScheduleRecord(item = {}, index = 0){
  const title = String(item.title || item.subProcess || item.subTrade || "제목 없음");
  const rawType = item.type || item.category || "";
  const type = ["타설","점검","작업","장비","자재"].includes(rawType)
    ? rawType
    : (title.includes("타설") ? "타설" : title.includes("점검") ? "점검" : "작업");
  return {
    ...item,
    id: item.id ?? `schedule-${Date.now()}-${index}`,
    date: item.date || new Date().toLocaleDateString("sv-SE", { timeZone:"Asia/Seoul" }),
    type,
    category: type,
    title,
    trade: item.trade || (type === "점검" ? "점검" : type === "타설" ? "철근콘크리트공사" : "기타"),
    subTrade: item.subTrade || item.subProcess || (type === "점검" ? "국토안전부" : type === "타설" ? "콘크리트 타설" : "일반"),
    processId: item.processId || item.process?.id || null,
    location: item.location || "",
    description: item.description || item.detail || "",
    status: item.status === "확정" ? "확정" : "미확정",
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || item.createdAt || new Date().toISOString()
  };
}

function normalizeTodayWork(todayWork = {}){
  const date = new Date().toLocaleDateString("sv-SE", { timeZone:"Asia/Seoul" });
  const activities = Array.isArray(todayWork.activities) ? todayWork.activities : [];
  return {
    ...todayWork,
    date: todayWork.date || date,
    role: todayWork.role || "현장소장",
    trades: Array.isArray(todayWork.trades) ? todayWork.trades : [],
    activities: activities.filter(Boolean).map((a, i) => ({
      ...a,
      id: a.id ?? `activity-${Date.now()}-${i}`,
      processId: a.processId || a.process?.id || null,
      location: a.location || "",
      detail: a.detail || a.description || "",
      createdAt: a.createdAt || new Date().toISOString()
    })),
    concrete: todayWork.concrete || { enabled:false, volumeM3:120, part:"슬래브", pump:"52M" },
    materials: Array.isArray(todayWork.materials) ? todayWork.materials : [],
    equipment: Array.isArray(todayWork.equipment) ? todayWork.equipment : []
  };
}

function migrateState(){
  state.schedules = (Array.isArray(state.schedules) ? state.schedules : []).filter(Boolean).map(normalizeScheduleRecord);
  state.todayWork = normalizeTodayWork(state.todayWork || {});
  state.selectedTrades = Array.isArray(state.selectedTrades) ? state.selectedTrades : [];
  state.castings = Array.isArray(state.castings) ? state.castings : [];
  state.specimenTasks = Array.isArray(state.specimenTasks) ? state.specimenTasks : [];
  state.qualityInspections = Array.isArray(state.qualityInspections) ? state.qualityInspections : [];
  state.constructionInspections = Array.isArray(state.constructionInspections) ? state.constructionInspections : [];
  state.qualityTests = Array.isArray(state.qualityTests) ? state.qualityTests : [];
  state.qualityPhotos = Array.isArray(state.qualityPhotos) ? state.qualityPhotos : [];
  state.qualityDocuments = Array.isArray(state.qualityDocuments) ? state.qualityDocuments : [];
  state.constructionRecords = Array.isArray(state.constructionRecords) ? state.constructionRecords : [];
  state.constructionDrawings = Array.isArray(state.constructionDrawings) ? state.constructionDrawings : [];
  state.constructionHandovers = Array.isArray(state.constructionHandovers) ? state.constructionHandovers : [];
  state.workResources = Array.isArray(state.workResources) ? state.workResources : [];
  state.complianceAuditHistory = Array.isArray(state.complianceAuditHistory) ? state.complianceAuditHistory : [];
  state.complianceAcknowledgements = state.complianceAcknowledgements && typeof state.complianceAcknowledgements === "object" ? state.complianceAcknowledgements : {};
  state.complianceActions = state.complianceActions && typeof state.complianceActions === "object" ? state.complianceActions : {};
  state.workEvidence = Array.isArray(state.workEvidence) ? state.workEvidence : [];
  state.workApprovals = state.workApprovals && typeof state.workApprovals === "object" ? state.workApprovals : {};
  state.directorInstructions = Array.isArray(state.directorInstructions) ? state.directorInstructions : [];
  state.workStartConditionHistory = Array.isArray(state.workStartConditionHistory) ? state.workStartConditionHistory : [];
  state.workStartConditionOverrides = state.workStartConditionOverrides && typeof state.workStartConditionOverrides === "object" ? state.workStartConditionOverrides : {};
  state.simpleActionRecords = Array.isArray(state.simpleActionRecords) ? state.simpleActionRecords : [];
  state.uiSimpleMode = state.uiSimpleMode !== false;
  state.dataSchemaVersion = DATA_SCHEMA_VERSION;
}

export function loadLocal(){
  const saved = safeParse(localStorage.getItem("guisArcOsState"), {});
  Object.assign(state, saved && typeof saved === "object" ? saved : {});
  migrateState();
  return state;
}

export function saveLocal(){
  localStorage.setItem("guisArcOsState", JSON.stringify(state));
}

export function setCurrentSiteProfile(profile){
  state.siteProfile = profile;
  state.site = {
    siteCode: profile.siteCode || profile.code || "GUEST",
    pin: profile.pin || "",
    siteName: profile.siteName || "Guest 현장",
    siteType: profile.siteType || "school"
  };
  saveLocal();
}

export function startGuestSite(){
  const profile = {
    mode: "guest",
    siteName: "Guest 현장",
    siteCode: "GUEST",
    pin: "",
    siteType: "school",
    createdAt: new Date().toISOString()
  };
  setCurrentSiteProfile(profile);
  return profile;
}

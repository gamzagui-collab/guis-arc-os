export const state = {};

function safeParse(value, fallback){
  try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
}

export function loadLocal(){
  const saved = safeParse(localStorage.getItem("guisArcOsState"), {});
  Object.assign(state, saved);
  state.schedules = state.schedules || [];
  state.selectedTrades = state.selectedTrades || [];
  state.castings = state.castings || [];
  state.specimenTasks = state.specimenTasks || [];
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

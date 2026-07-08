export const state = {
  mode: "guest",
  site: null,
  schedules: [],
  selectedTrades: ["철근공사", "콘크리트 타설"],
  weatherRisk: "주의",
  siteProfile: {
    siteName: "",
    siteCode: "",
    pin: "",
    siteType: "school",
    clientName: "",
    contractorName: "",
    supervisorName: "",
    startDate: "",
    endDate: ""
  },
  selectedRoles: ["현장소장", "안전관리자", "품질관리자", "공사관리자"],
  dailyActions: [],
};
export function saveLocal(){localStorage.setItem("guisArcV7", JSON.stringify(state));}
export function loadLocal(){try{Object.assign(state, JSON.parse(localStorage.getItem("guisArcV7") || "{}"));}catch{}}


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

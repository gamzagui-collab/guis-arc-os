import { state, saveLocal } from "../core/state.js";
import { setApiBase, API_BASE } from "./api.js";

export const DEFAULT_SETTINGS = {
  apiBase: API_BASE,
  fontScale: "large",
  compactMode: false,
  highContrast: false,
  fixedHeader: true,
  siteTheme: "blue"
};

export function loadSettings(){
  try{
    return {...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem("guisArcSettings") || "{}")};
  }catch{
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings){
  localStorage.setItem("guisArcSettings", JSON.stringify(settings));
  if(settings.apiBase) setApiBase(settings.apiBase);
  document.documentElement.dataset.fontScale = settings.fontScale || "large";
  document.documentElement.dataset.contrast = settings.highContrast ? "high" : "normal";
  document.documentElement.dataset.compact = settings.compactMode ? "true" : "false";
}

export function exportLocalData(){
  const payload = {
    exportedAt: new Date().toISOString(),
    version: "7.7.0",
    state,
    settings: loadSettings(),
    localStorage: {
      guisArcV7: localStorage.getItem("guisArcV7"),
      guisArcSettings: localStorage.getItem("guisArcSettings"),
      guisArcApiBase: localStorage.getItem("guisArcApiBase")
    }
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `guis-arc-os-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importLocalData(file){
  const text = await file.text();
  const payload = JSON.parse(text);
  if(payload.state){
    Object.assign(state, payload.state);
    saveLocal();
  }
  if(payload.settings){
    saveSettings(payload.settings);
  }
  return payload;
}

export const state = {
  mode: "guest",
  site: null,
  schedules: [],
  selectedTrades: ["철근공사", "콘크리트 타설"],
  weatherRisk: "주의",
};
export function saveLocal(){localStorage.setItem("guisArcV7", JSON.stringify(state));}
export function loadLocal(){try{Object.assign(state, JSON.parse(localStorage.getItem("guisArcV7") || "{}"));}catch{}}

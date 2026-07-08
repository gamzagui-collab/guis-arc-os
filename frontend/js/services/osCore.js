import { state } from "../core/state.js";
import { getDemoWeatherSummary } from "./weatherEngine.js";
import { buildAiFieldBriefing } from "./aiFieldAssistant.js";

export function buildOsDashboard(){
  const weather = getDemoWeatherSummary();
  const ai = buildAiFieldBriefing();
  const today = new Date().toISOString().slice(0,10);
  const todaySchedules = (state.schedules || []).filter(x => x.date === today);
  const critical = [];

  if(weather.maxRain >= 5) critical.push({level:"danger", title:"강수 주의", text:"타설·외부마감·방수 작업은 보양재와 배수로를 먼저 확인"});
  if(weather.maxWind >= 8) critical.push({level:"danger", title:"풍속 주의", text:"크레인·갱폼·고소작업 작업반경과 신호수 확인"});
  if(weather.maxApparent >= 35) critical.push({level:"danger", title:"온열 위험", text:"11~15시 옥외작업 휴식과 수분관리 강화"});
  if(!critical.length) critical.push({level:"normal", title:"기상 위험 낮음", text:"기본 안전수칙과 작업 전 TBM 유지"});

  return {
    siteName: state.siteProfile?.siteName || state.site?.siteName || "게스트 현장",
    siteType: state.siteProfile?.siteType || state.site?.siteType || "미지정",
    today,
    weather,
    ai,
    todaySchedules,
    critical,
    quickTasks: ["TBM 실시 및 참석자 확인","오늘 공정별 위험요소 공유","장비·자재 반입 동선 확인","품질 검측·사진 기록 확인","기상 위험 시간대 순회 계획"]
  };
}

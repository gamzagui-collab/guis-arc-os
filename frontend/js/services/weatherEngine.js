import { concreteDecision, workWindowRecommendation } from "./weatherDecision.js";

const HOURS = Array.from({length: 24}, (_, i) => String(i).padStart(2, "0"));
const RAIN_PATTERN = {
  kma:[0,0,0,0,0,0,0,0,0.2,0.4,0.8,1.2,1.8,2.4,4.0,6.5,5.2,2.0,0.8,0.2,0,0,0,0],
  ecmwf:[0,0,0,0,0,0,0,0.1,0.3,0.5,1.0,1.6,2.2,3.0,5.2,7.0,6.0,2.8,1.0,0.3,0,0,0,0],
  gfs:[0,0,0,0,0,0,0,0,0.1,0.3,0.7,1.1,1.5,2.0,3.5,5.8,4.8,2.4,0.7,0.1,0,0,0,0],
  jma:[0,0,0,0,0,0,0,0,0.0,0.2,0.5,0.9,1.2,1.7,2.8,4.6,3.6,1.5,0.4,0.0,0,0,0,0]
};

function hourlyWeather(){
  return HOURS.map((hour, idx) => {
    const modelRain = Object.fromEntries(Object.entries(RAIN_PATTERN).map(([model, arr]) => [model, arr[idx]]));
    const avgRain1h = +(Object.values(modelRain).reduce((a,b)=>a+b,0) / 4).toFixed(1);
    const rain1h = Math.max(...Object.values(modelRain));
    const h = Number(hour);
    const temp = h < 7 ? 24 : h < 12 ? 28 + (h-7)*0.7 : h < 16 ? 32 + (h-12)*0.4 : 31 - Math.max(0,h-16)*0.6;
    const humidity = rain1h > 0 ? 78 : 68;
    const wind = h >= 14 && h <= 17 ? 8.5 : h >= 10 && h <= 13 ? 5.5 : 3.2;
    const apparent = +(temp + Math.max(0, humidity-60)*0.08 + Math.max(0,temp-30)*0.7).toFixed(1);
    return {hour,temp:+temp.toFixed(1),apparent,humidity,wind,rain1h,avgRain1h,modelRain,rain3h:rain1h};
  });
}

export function getDemoWeatherSummary(){
  const hourly = hourlyWeather();
  const workHourly = hourly.filter(h => Number(h.hour) >= 7 && Number(h.hour) <= 17);
  const maxRain = Math.max(...workHourly.map(x=>x.rain1h));
  const maxWind = Math.max(...workHourly.map(x=>x.wind));
  const maxApparent = Math.max(...workHourly.map(x=>x.apparent));
  const decision = concreteDecision({maxRain,maxWind,maxApparent});
  return {
    sourceMode:"v9.0 demo · 1시간 강수 기준",
    hourly,workHourly,maxRain,maxWind,maxApparent,
    peakHeat:workHourly.find(x=>x.apparent===maxApparent),
    peakRain:workHourly.find(x=>x.rain1h===maxRain),
    peakWind:workHourly.find(x=>x.wind===maxWind),
    concrete:decision,
    decision:decision.checks.map(x=>({type:x.title,level:decision.overall,text:x.text})),
    workWindow:workWindowRecommendation(workHourly.map(h=>({...h,rain3h:h.rain1h})))
  };
}

export function buildDecision(maxRain,maxWind,maxApparent){
  return concreteDecision({maxRain,maxWind,maxApparent}).checks.map(x=>({type:x.title,level:x.level,text:x.text}));
}

export function riskClass(level){
  if(level==="위험"||level==="danger"||level==="중지검토") return "risk-red";
  if(level==="주의"||level==="warning") return "risk-orange";
  if(level==="관찰"||level==="watch") return "risk-yellow";
  return "risk-blue";
}

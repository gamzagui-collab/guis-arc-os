import { concreteDecision } from "./weatherDecision.js";

const MODELS = ["kma", "ecmwf", "gfs", "jma"];

function pad(n){ return String(n).padStart(2, "0"); }
function dateLabel(offset){
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getMonth()+1}/${d.getDate()}`;
}
function isoDate(offset){
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0,10);
}
function rainValue(day, hour, model){
  const peak = day === 0 ? 15 : (10 + day * 2) % 24;
  const distance = Math.abs(hour - peak);
  const base = Math.max(0, 7 - distance * 1.7);
  const dailyFactor = [1, .5, .9, .2, .7, .35][day] || .3;
  const modelFactor = {kma:.9, ecmwf:1.15, gfs:1.0, jma:.75}[model] || 1;
  const nightCut = hour < 6 || hour > 21 ? .35 : 1;
  return +(Math.max(0, base * dailyFactor * modelFactor * nightCut)).toFixed(1);
}

export function getSixDayHourlyWeather(){
  const rows = [];
  for(let day=0; day<6; day++){
    for(let hour=0; hour<24; hour++){
      const modelRain = Object.fromEntries(MODELS.map(m => [m, rainValue(day, hour, m)]));
      const rain1h = Math.max(...Object.values(modelRain));
      const avgRain1h = +(Object.values(modelRain).reduce((a,b)=>a+b,0)/MODELS.length).toFixed(1);
      const temp = +(24 + Math.sin((hour-7)/24*Math.PI) * 9 + day*.2).toFixed(1);
      const humidity = rain1h > 0 ? 82 : 68;
      const wind = +(3 + (hour>=13 && hour<=17 ? 4.5 : 0) + day*.2).toFixed(1);
      const apparent = +(temp + Math.max(0,humidity-60)*0.08 + Math.max(0,temp-30)*0.7).toFixed(1);
      rows.push({day, date: isoDate(day), dateLabel: dateLabel(day), hour: pad(hour), temp, humidity, wind, apparent, rain1h, avgRain1h, modelRain});
    }
  }
  return rows;
}

export function getDemoWeatherSummary(){
  const hourly = getSixDayHourlyWeather();
  const workHourly = hourly.filter(h => Number(h.hour) >= 7 && Number(h.hour) <= 17);
  const todayWork = workHourly.filter(h => h.day === 0);
  const maxRain = Math.max(...todayWork.map(x=>x.rain1h));
  const maxWind = Math.max(...todayWork.map(x=>x.wind));
  const maxApparent = Math.max(...todayWork.map(x=>x.apparent));
  const decision = concreteDecision({maxRain, maxWind, maxApparent});
  return {
    sourceMode:"v9.1 demo · 6일 1시간 강수 기준",
    hourly,
    workHourly,
    maxRain,maxWind,maxApparent,
    peakHeat:todayWork.find(x=>x.apparent===maxApparent),
    peakRain:todayWork.find(x=>x.rain1h===maxRain),
    peakWind:todayWork.find(x=>x.wind===maxWind),
    concrete:decision,
    decision:decision.checks.map(x=>({type:x.title,level:decision.overall,text:x.text})),
    workWindow: buildWorkWindow(todayWork)
  };
}

function buildWorkWindow(rows){
  const safe = rows.filter(h => h.rain1h < 2 && h.wind < 8 && h.apparent < 35);
  if(!safe.length) return "오늘 07~17시 중 명확한 안전 작업시간이 없습니다.";
  return `${safe[0].hour}시~${safe[safe.length-1].hour}시 사이가 비교적 유리합니다.`;
}

export function riskClass(level){
  if(level==="위험"||level==="danger"||level==="중지검토") return "risk-red";
  if(level==="주의"||level==="warning") return "risk-orange";
  if(level==="관찰"||level==="watch") return "risk-yellow";
  return "risk-blue";
}

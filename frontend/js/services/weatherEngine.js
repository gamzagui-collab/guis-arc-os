import { concreteDecision, workWindowRecommendation } from "./weatherDecision.js";

const BASE_HOURLY = [
  {hour:"07", temp:26.5, apparent:30.1, humidity:88, wind:3.2, rain3h:0},
  {hour:"08", temp:28.1, apparent:32.5, humidity:82, wind:3.8, rain3h:0},
  {hour:"09", temp:29.4, apparent:34.1, humidity:78, wind:4.1, rain3h:0},
  {hour:"10", temp:30.2, apparent:35.3, humidity:76, wind:4.8, rain3h:0},
  {hour:"11", temp:31.0, apparent:36.8, humidity:74, wind:5.2, rain3h:0},
  {hour:"12", temp:32.2, apparent:38.1, humidity:72, wind:5.8, rain3h:0},
  {hour:"13", temp:33.0, apparent:39.0, humidity:70, wind:6.5, rain3h:0},
  {hour:"14", temp:33.5, apparent:39.7, humidity:68, wind:7.1, rain3h:1.5},
  {hour:"15", temp:32.8, apparent:38.9, humidity:72, wind:8.4, rain3h:4.2},
  {hour:"16", temp:31.4, apparent:36.9, humidity:78, wind:8.8, rain3h:8.5},
  {hour:"17", temp:29.8, apparent:34.6, humidity:82, wind:7.2, rain3h:6.0}
];

function shiftRain(hourly, factor){
  return hourly.map(x => ({...x, rain3h: +(x.rain3h * factor).toFixed(1)}));
}

export function getDemoWeatherSummary(){
  const models = [
    {id:"kma", name:"KMA", hourly: shiftRain(BASE_HOURLY, 0.85), note:"기상청 실 API 이관 예정"},
    {id:"ecmwf", name:"ECMWF", hourly: shiftRain(BASE_HOURLY, 1.15), note:"Open-Meteo ECMWF 계열 이관 예정"},
    {id:"gfs", name:"GFS", hourly: shiftRain(BASE_HOURLY, 1.0), note:"Open-Meteo GFS 계열 이관 예정"},
    {id:"jma", name:"JMA", hourly: shiftRain(BASE_HOURLY, 0.7), note:"JMA 비교값 이관 예정"}
  ];

  const hourly = BASE_HOURLY.map((h, idx) => {
    const rains = models.map(m => m.hourly[idx].rain3h);
    return {
      ...h,
      modelRain: Object.fromEntries(models.map(m => [m.id, m.hourly[idx].rain3h])),
      avgRain3h: +(rains.reduce((a,b)=>a+b,0) / rains.length).toFixed(1),
      maxRain3h: Math.max(...rains)
    };
  });

  const maxRain = Math.max(...hourly.map(x=>x.maxRain3h));
  const maxWind = Math.max(...hourly.map(x=>x.wind));
  const maxApparent = Math.max(...hourly.map(x=>x.apparent));
  const decision = concreteDecision({maxRain, maxWind, maxApparent});

  return {
    sourceMode: "v8.2 demo · 실제 v6.4 예보 API 이관 준비",
    models,
    hourly,
    maxRain,
    maxWind,
    maxApparent,
    peakHeat: hourly.find(x=>x.apparent===maxApparent),
    peakRain: hourly.find(x=>x.maxRain3h===maxRain),
    peakWind: hourly.find(x=>x.wind===maxWind),
    decision: decision.checks.map(x => ({type:x.title, level:decision.overall, text:x.text})),
    concrete: decision,
    workWindow: workWindowRecommendation(hourly)
  };
}

export function buildDecision(maxRain, maxWind, maxApparent){
  return concreteDecision({maxRain, maxWind, maxApparent}).checks.map(x => ({type:x.title, level:x.level, text:x.text}));
}

export function riskClass(level){
  if(level==="위험" || level==="danger" || level==="중지검토") return "risk-red";
  if(level==="주의" || level==="warning") return "risk-orange";
  if(level==="관찰" || level==="watch") return "risk-yellow";
  return "risk-blue";
}

const MOCK_HOURLY = [
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

export function getDemoWeatherSummary(){
  const maxRain = Math.max(...MOCK_HOURLY.map(x=>x.rain3h));
  const maxWind = Math.max(...MOCK_HOURLY.map(x=>x.wind));
  const maxApparent = Math.max(...MOCK_HOURLY.map(x=>x.apparent));
  const peakHeat = MOCK_HOURLY.find(x=>x.apparent===maxApparent);
  const peakRain = MOCK_HOURLY.find(x=>x.rain3h===maxRain);
  const peakWind = MOCK_HOURLY.find(x=>x.wind===maxWind);
  return {
    sourceMode: "v7.1 demo · v6.4 예보엔진 이관 예정",
    hourly: MOCK_HOURLY,
    maxRain, maxWind, maxApparent, peakHeat, peakRain, peakWind,
    decision: buildDecision(maxRain, maxWind, maxApparent)
  };
}

export function buildDecision(maxRain, maxWind, maxApparent){
  const items = [];
  if(maxRain >= 5) items.push({type:"강수", level:"위험", text:"16시 전후 강수 가능성. 콘크리트 타설은 보양재·배수로·감리 협의 후 진행."});
  else if(maxRain > 0) items.push({type:"강수", level:"주의", text:"약한 비 가능성. 외부 마감·방수·타설 전 표면상태 확인."});
  else items.push({type:"강수", level:"정상", text:"강수 위험 낮음."});

  if(maxWind >= 8) items.push({type:"풍속", level:"주의", text:"15~16시 풍속 주의. 크레인·갱폼·고소작업 작업반경과 신호수 확인."});
  else items.push({type:"풍속", level:"정상", text:"풍속 위험 낮음."});

  if(maxApparent >= 35) items.push({type:"온열", level:"위험", text:"11~15시 체감온도 위험. 옥외작업 휴식·수분·관리자 순회 강화."});
  else if(maxApparent >= 32) items.push({type:"온열", level:"주의", text:"오전 후반부터 온열 주의. 수분 섭취와 그늘 휴식 안내."});
  else items.push({type:"온열", level:"정상", text:"온열 위험 낮음."});

  return items;
}

export function riskClass(level){
  if(level==="위험" || level==="중지검토") return "risk-red";
  if(level==="주의") return "risk-orange";
  return "risk-blue";
}

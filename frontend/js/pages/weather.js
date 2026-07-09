import { getDemoWeatherSummary, riskClass } from "../services/weatherEngine.js";
import { WEATHER_MODELS } from "../services/weatherModels.js";

const DEFAULT_LAT = 35.8036;
const DEFAULT_LON = 126.8809;

function blueRainStyle(v){
  if(v <= 0) return "";
  const alpha = Math.min(0.92, 0.10 + v / 12);
  const color = v >= 7 ? "color:#fff;font-weight:1000;" : "color:#0f172a;font-weight:900;";
  return `style="background:rgba(37,99,235,${alpha});${color}"`;
}
function rainCell(value, extraClass=""){
  return `<td class="${extraClass}" ${blueRainStyle(value)}>${value.toFixed(1)}</td>`;
}
function windyUrl(lat, lon){
  return `https://embed.windy.com/embed2.html?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&detailLat=${lat.toFixed(4)}&detailLon=${lon.toFixed(4)}&width=650&height=450&zoom=7&level=surface&overlay=rain&product=ecmwf&menu=&message=&marker=true&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=m%2Fs&metricTemp=%C2%B0C&radarRange=-1`;
}
function graphBars(rows){
  const max = Math.max(1, ...rows.map(h=>h.rain1h));
  const peakIndex = rows.findIndex(h => h.rain1h === max && max > 0);
  return rows.map((h, idx) => {
    const value = Number(h.rain1h || 0);
    const height = value <= 0 ? 2 : Math.max(8, Math.round((value / max) * 142));
    const isPeak = idx === peakIndex;
    return `<div class="rain-hour-col rain-hour-modern ${isPeak ? "rain-peak-col" : ""}">
      <div class="rain-bar-slot modern-rain-slot">
        ${isPeak ? `<span class="peak-sticker">최고치</span>` : ""}
        <div class="rain-graph-bar blue-bar modern-rain-bar" style="height:${height}px"></div>
      </div>
      <div class="rain-value">${value.toFixed(1)}</div>
      <div class="rain-hour">${h.hour}시</div>
    </div>`;
  }).join("");
}

function tempLevel(v){ if(v>=38) return "danger"; if(v>=35) return "warn"; if(v<=0) return "cold"; return "safe"; }
function windLevel(v){ if(v>=14) return "danger"; if(v>=10) return "warn"; if(v>=7) return "watch"; return "safe"; }
function workHourRows(rows){ return rows.filter(h => Number(h.hour) >= 6 && Number(h.hour) <= 18); }
function dailyPeakMap(rows, key){
  const peaks = new Map();
  for(const h of rows){
    const prev = peaks.get(h.day);
    if(!prev || Number(h[key]) > Number(prev[key])) peaks.set(h.day, h);
  }
  return peaks;
}
function weeklyLineGraph(rows, key, type){
  const data = rows.slice(0, 24 * 6);
  const values = data.map(h => Number(h[key] || 0));
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const unit = type === "wind" ? "m/s" : "℃";
  const label = type === "wind" ? "풍속" : "온도";
  const padding = Math.max(type === "wind" ? 1 : 2, (rawMax - rawMin) * 0.08);
  const min = Math.floor((rawMin - padding) * 2) / 2;
  const max = Math.ceil((rawMax + padding) * 2) / 2;
  const range = Math.max(1, max - min);
  const width = Math.max(1080, data.length * 10.5);
  const height = 302;
  const pad = { left: 58, right: 28, top: 54, bottom: 54 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const points = data.map((h, i) => {
    const x = pad.left + (i / Math.max(1, data.length - 1)) * innerW;
    const y = pad.top + (1 - ((Number(h[key] || 0) - min) / range)) * innerH;
    return { ...h, x, y, value:Number(h[key] || 0) };
  });
  const path = points.map((p,i)=>`${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const peaks = dailyPeakMap(data, key);
  const peakPoints = [...peaks.values()].map(peak => points.find(p => p.day === peak.day && p.hour === peak.hour)).filter(Boolean);
  const hourLabels = points.filter(p => [0, 6, 12, 18].includes(Number(p.hour)));
  const dateLabels = points.filter(p => Number(p.hour) === 0);
  const yTicks = Array.from({length:5}, (_,i)=>{
    const ratio = i / 4;
    const value = max - ratio * range;
    const y = pad.top + ratio * innerH;
    return { value, y };
  });
  const cls = type === "wind" ? "weekly-line-wind" : "weekly-line-temp";
  return `<div class="weekly-line-scroll ${cls}">
    <svg class="weekly-line-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="일주일 ${label} 시간별 흐름">
      <line class="chart-axis" x1="${pad.left}" y1="${height-pad.bottom}" x2="${width-pad.right}" y2="${height-pad.bottom}"></line>
      <line class="chart-axis" x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${height-pad.bottom}"></line>
      ${yTicks.map(t=>`<g class="y-tick"><line class="chart-grid" x1="${pad.left}" y1="${t.y.toFixed(1)}" x2="${width-pad.right}" y2="${t.y.toFixed(1)}"></line><text x="${pad.left-10}" y="${(t.y+4).toFixed(1)}">${t.value.toFixed(1)}${unit}</text></g>`).join("")}
      <path class="weekly-line-path" d="${path}"></path>
      ${hourLabels.map(p=>`<g class="hour-tick"><line x1="${p.x.toFixed(1)}" y1="${height-pad.bottom}" x2="${p.x.toFixed(1)}" y2="${height-pad.bottom+5}"></line><text x="${p.x.toFixed(1)}" y="${(height-28)}">${String(p.hour).padStart(2,"0")}시</text></g>`).join("")}
      ${points.filter((_,i)=>i%3===0).map(p=>`<circle class="line-dot-soft" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2"></circle>`).join("")}
      ${points.map(p=>`<circle class="line-hit-dot" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="7"><title>${p.dateLabel} ${String(p.hour).padStart(2,"0")}시 · ${label} ${p.value.toFixed(1)}${unit}</title></circle>`).join("")}
      ${peakPoints.map(p=>`<g class="peak-callout peak-callout-modern" transform="translate(${p.x.toFixed(1)},${p.y.toFixed(1)})"><circle class="peak-dot" r="4.8"></circle><line class="peak-stem" x1="0" y1="-7" x2="0" y2="-20"></line><rect x="-40" y="-48" width="80" height="24" rx="12"></rect><text x="0" y="-32">최고치[${Number(p.hour)}시]</text></g>`).join("")}
      ${dateLabels.map(p=>`<text class="date-tick" x="${p.x.toFixed(1)}" y="${height-7}">${p.dateLabel}</text>`).join("")}
    </svg>
  </div>`;
}
function highlightOpinionText(text){
  const words = ["신뢰도", "높음", "보통", "낮음", "일치", "불일치", "튀는 예보", "평균", "강수", "야외작업", "실내작업", "풍속", "온도", "최대", "중지", "연기", "주의", "휴식", "그늘", "관리자"];
  return words.reduce((html, word)=>html.replaceAll(word, `<strong class="ai-keyword">${word}</strong>`), text);
}
function highlightActionText(text){
  const words = [
    "작업중지", "중지", "연기", "시간 조정", "온열질환", "열사병", "어지러움", "두통", "구토", "의식저하",
    "11~15시", "물", "그늘", "휴식", "관리자 순회", "방한장구", "결빙", "미끄럼",
    "크레인", "고소작업", "외장", "비계", "신호수", "작업반경", "유도줄", "아웃트리거", "비산"
  ];
  return words.reduce((html, word)=>html.replaceAll(word, `<strong class="decision-keyword">${word}</strong>`), text);
}
function decisionBadge(decision, type){
  const level = decision.level || "관찰";
  const cls = level.includes("위험") ? "danger" : level.includes("주의") ? "warn" : level.includes("양호") ? "safe" : "watch";
  return `<span class="decision-badge ${type}-decision-${cls}">${decision.title}</span>`;
}

function mapSection(){
  return `
    <section class="weather-top-grid">
      <article class="card map-card">
        <h3>🗺 좌표 선택 지도</h3>
        <p class="help-text">지도를 클릭하면 Windy 지도도 같은 좌표로 이동합니다.</p>
        <div id="leafletMap" class="leaflet-map" data-lat="${DEFAULT_LAT}" data-lon="${DEFAULT_LON}">
          <div class="leaflet-fallback">
            <div id="fallbackMap" class="fake-map local-map">
              <div class="map-pin">●</div>
              <div class="map-label">김제시</div>
            </div>
          </div>
        </div>
        <p id="mapCoordText" class="help-text">김제시 (${DEFAULT_LAT}, ${DEFAULT_LON})</p>
      </article>

      <article class="card map-card">
        <h3>☁ Windy 강수 지도</h3>
        <p class="help-text">좌측 지도에서 선택한 좌표 기준으로 비구름 흐름을 확인합니다.</p>
        <iframe id="windyFrame" class="windy-frame" title="Windy map" src="${windyUrl(DEFAULT_LAT, DEFAULT_LON)}"></iframe>
      </article>
    </section>
  `;
}
function updateWindy(lat, lon){
  const frame = document.querySelector("#windyFrame");
  const coord = document.querySelector("#mapCoordText");
  if(frame) frame.src = windyUrl(lat, lon);
  if(coord) coord.textContent = `선택 좌표 (${lat.toFixed(4)}, ${lon.toFixed(4)}) · Windy 이동 완료`;
}
function bindLeafletMap(){
  const mapEl = document.querySelector("#leafletMap");
  if(!mapEl) return;
  const lat = Number(mapEl.dataset.lat || DEFAULT_LAT);
  const lon = Number(mapEl.dataset.lon || DEFAULT_LON);

  if(window.L){
    mapEl.innerHTML = "";
    const map = window.L.map(mapEl).setView([lat, lon], 10);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap"
    }).addTo(map);
    const marker = window.L.marker([lat, lon]).addTo(map);
    map.on("click", e => {
      marker.setLatLng(e.latlng);
      updateWindy(e.latlng.lat, e.latlng.lng);
    });
    setTimeout(()=>map.invalidateSize(), 100);
    return;
  }

  document.querySelector("#fallbackMap")?.addEventListener("click", e => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const yRatio = (e.clientY - rect.top) / rect.height;
    const newLat = DEFAULT_LAT + (0.5 - yRatio) * 0.7;
    const newLon = DEFAULT_LON + (xRatio - 0.5) * 1.1;
    updateWindy(newLat, newLon);
  });
}
export function renderWeather(root){
  const w = getDemoWeatherSummary();
  const todayRows = w.todayRows;
  root.innerHTML = `
    <div class="section-head compact-head">
      <div>
        <h2>WEATHER · 강수·온도·풍속</h2>
        <p>강수는 그래프+비교표, 온도·풍속은 오늘 조치표+일주일 흐름 그래프로 확인합니다.</p>
      </div>
      <div class="export-row">
        <button class="secondary-btn" onclick="window.print()">출력 / 저장</button>
        <button class="secondary-btn">CSV 저장</button>
      </div>
    </div>

    <div class="weather-toolbar">
      <button class="location-pill">📍 김제시 (${DEFAULT_LAT}, ${DEFAULT_LON})</button>
      <span>🕒 기준시간: ${w.baseTimeLabel}</span>
      <button class="refresh-pill">↻</button>
    </div>

    <div class="kpi-row weather-kpi">
      <div class="kpi"><span>오늘 예상 강수량</span><strong>${w.maxRain.toFixed(1)}mm</strong><small>${w.peakRain.hour}:00 ~ 17:00</small></div>
      <div class="kpi"><span>체감온도</span><strong>${w.maxApparent.toFixed(1)}℃</strong><small>최고 체감</small></div>
      <div class="kpi"><span>최대 풍속</span><strong>${w.maxWind.toFixed(1)}m/s</strong><small>장비작업 기준</small></div>
      <div class="kpi"><span>작업 추천 시간</span><strong>${w.workWindow}</strong><small>오전 작업 권장</small></div>
      <div class="kpi"><span>오늘 일치도</span><strong class="star-text">${w.todayConsistency}</strong><small>예보처 편차 기준</small></div>
    </div>

    ${mapSection()}

    <section class="card ai-weather-card ai-wide-card">
      <h3>AI 오늘 날씨 의견</h3>
      <div class="ai-lines">
        ${w.aiOpinion.map(x=>`<p>✓ ${highlightOpinionText(x)}</p>`).join("")}
      </div>
      <small>기준: ${w.baseTimeLabel}</small>
    </section>

    <section class="card weather-chart-card rain-first-card">
      <h3>오늘 1시간 강수 그래프</h3>
      <div class="rain-graph-fixed">${graphBars(todayRows)}</div>
      <p class="chart-note">강수량은 하루 그래프로 먼저 확인하고, 비가 오는 시간대와 피크만 빠르게 판단합니다. 오늘 ${w.peakRain.hour}시 강수량이 최대 ${w.maxRain.toFixed(1)}mm로 예상됩니다.</p>
    </section>

    <section class="card rain-compare-card">
      <div class="section-head mini-head">
        <div><h3>6일 시간별 강수 비교표</h3><p>강수는 일주일 비교표로 예보처 차이와 전반적인 비 가능성을 판단합니다.</p></div>
        <span class="unit-label">(단위: mm)</span>
      </div>
      <div class="table-scroll sticky-weather-wrap rain-table-wrap">
        <table class="weather-compare-table weather-v932">
          <thead>
            <tr>
              <th class="sticky-col-date">날짜</th>
              <th class="sticky-col-hour">시간</th>
              ${WEATHER_MODELS.map(m=>`<th class="model-head">${m.name}<br><small>${m.label}</small></th>`).join("")}
              <th class="avg-head">평균</th>
              <th class="max-head">최대</th>
              <th class="consistency-head">일치도</th>
            </tr>
          </thead>
          <tbody>
            ${w.hourly.map(h=>`
              <tr class="${h.hour==="00" ? "date-start-row" : ""}">
                ${h.hour==="00" ? `<th class="date-cell sticky-col-date" rowspan="24"><span>${h.dateLabel}</span><small>${h.weekdayLabel}</small></th>` : ""}
                <th class="sticky-col-hour">${h.hour}시</th>
                ${WEATHER_MODELS.map(m=>rainCell(h.modelRain[m.id] || 0, "model-cell")).join("")}
                ${rainCell(h.avgRain1h, "avg-cell")}
                ${rainCell(h.rain1h, "max-cell")}
                <td class="star-cell star-score-${h.consistency}">${h.stars}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      <p class="chart-note">0.0mm는 무색, 강수량이 커질수록 옅은 파랑에서 진한 파랑으로 표시됩니다. 일치도는 1~2개 빨강, 3개 주황, 4개 이상 초록입니다.</p>
    </section>

    <section class="card today-decision-card temp-decision-card">
      <div class="section-head mini-head">
        <div><h3>오늘 시간별 온도 조치표</h3><p>온도는 오늘 1일차를 시간별로 보고, 어느 시간대에 어떤 조치가 필요한지 판단합니다.</p></div>
        <span class="unit-label">(단위: ℃)</span>
      </div>
      <div class="table-scroll today-action-wrap">
        <table class="weather-compare-table climate-compare-table weather-v934">
          <thead><tr><th>시간</th><th>기온</th><th>체감온도</th><th>판정</th><th>주요 조치</th></tr></thead>
          <tbody>${workHourRows(todayRows).map(h=>`
            <tr>
              <th>${h.hour}시</th>
              <td>${h.temp.toFixed(1)}</td>
              <td class="temp-level-${tempLevel(h.apparent)}">${h.apparent.toFixed(1)}</td>
              <td>${decisionBadge(h.tempDecision, "temp")}</td>
              <td>${highlightActionText(h.tempDecision.text)}</td>
            </tr>`).join("")}</tbody>
        </table>
      </div>
    </section>

    <section class="card weather-chart-card climate-card temp-card">
      <h3>일주일 온도 흐름 그래프</h3>
      <div class="weekly-line-card temp-graph">${weeklyLineGraph(w.hourly, "apparent", "temp")}</div>
      <p class="chart-note">온도 일주일치는 세부 설명보다 흐름 확인용입니다. 6일 전체 시간별 체감온도를 선그래프로 표시하고, 00시·06시·12시·18시를 하단에 표시하고, 일별 최고치는 그래프 위 말풍선으로 표시합니다.</p>
    </section>

    <section class="card today-decision-card wind-decision-card">
      <div class="section-head mini-head">
        <div><h3>오늘 시간별 풍속 조치표</h3><p>풍속은 오늘 시간별로 확인하여 크레인·고소·외장 작업의 주의/중지 시간을 판단합니다.</p></div>
        <span class="unit-label">(단위: m/s)</span>
      </div>
      <div class="table-scroll today-action-wrap">
        <table class="weather-compare-table climate-compare-table weather-v934">
          <thead><tr><th>시간</th><th>풍속</th><th>판정</th><th>주요 조치</th></tr></thead>
          <tbody>${workHourRows(todayRows).map(h=>`
            <tr>
              <th>${h.hour}시</th>
              <td class="wind-level-${windLevel(h.wind)}">${h.wind.toFixed(1)}</td>
              <td>${decisionBadge(h.windDecision, "wind")}</td>
              <td>${highlightActionText(h.windDecision.text)}</td>
            </tr>`).join("")}</tbody>
        </table>
      </div>
    </section>

    <section class="card weather-chart-card climate-card wind-card">
      <h3>일주일 풍속 흐름 그래프</h3>
      <div class="weekly-line-card wind-graph">${weeklyLineGraph(w.hourly, "wind", "wind")}</div>
      <p class="chart-note">풍속 일주일치는 바람이 강한 날짜를 빠르게 찾는 용도입니다. 6일 전체 시간별 풍속을 선그래프로 표시하고, 00시·06시·12시·18시를 하단에 표시하고, 일별 최고치는 그래프 위 말풍선으로 표시합니다.</p>
    </section>
  `;
  setTimeout(bindLeafletMap, 0);
}

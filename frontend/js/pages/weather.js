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
  return rows.map(h => {
    const height = Math.max(4, Math.round((h.rain1h / max) * 130));
    return `<div class="rain-hour-col">
      <div class="rain-bar-slot"><div class="rain-graph-bar blue-bar" style="height:${height}px"></div></div>
      <div class="rain-value">${h.rain1h.toFixed(1)}</div>
      <div class="rain-hour">${h.hour}시</div>
    </div>`;
  }).join("");
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
        <h2>WEATHER · 6일 시간별 강수 비교</h2>
        <p>1시간 강수, 예보처 비교, 좌표 기반 Windy 지도, 작업 가능 시간을 확인합니다.</p>
      </div>
      <div class="export-row">
        <button class="secondary-btn" onclick="window.print()">출력 / 저장</button>
        <button class="secondary-btn">CSV 저장</button>
      </div>
    </div>

    <div class="weather-toolbar">
      <button class="location-pill">📍 김제시 (${DEFAULT_LAT}, ${DEFAULT_LON})</button>
      <span>🕒 기준시간: 2025-07-09 06:00 (KST)</span>
      <button class="refresh-pill">↻</button>
    </div>

    <div class="kpi-row weather-kpi">
      <div class="kpi"><span>오늘 예상 강수량</span><strong>${w.maxRain.toFixed(1)}mm</strong><small>${w.peakRain.hour}:00 ~ 17:00</small></div>
      <div class="kpi"><span>체감온도</span><strong>${w.maxApparent.toFixed(1)}℃</strong><small>최고 체감</small></div>
      <div class="kpi"><span>평균 풍속</span><strong>${w.maxWind.toFixed(1)}m/s</strong><small>약간 강함</small></div>
      <div class="kpi"><span>작업 추천 시간</span><strong>${w.workWindow}</strong><small>오전 작업 권장</small></div>
      <div class="kpi"><span>콘크리트 타설 판정</span><strong>${w.concrete.overall}</strong><small>오후 시간 피하세요</small></div>
      <div class="kpi"><span>오늘 일치도</span><strong class="star-text">${w.todayConsistency}</strong><small>예보처 편차 기준</small></div>
    </div>

    ${mapSection()}

    <section class="card ai-weather-card ai-wide-card">
      <h3>AI 오늘 강수 의견</h3>
      <div class="ai-lines">
        ${w.aiOpinion.map(x=>`<p>✓ ${x}</p>`).join("")}
      </div>
      <small>기준: 2025-07-09 06:00 (KST)</small>
    </section>

    <section class="card weather-chart-card">
      <h3>오늘 1시간 강수 그래프</h3>
      <div class="rain-graph-fixed">${graphBars(todayRows)}</div>
      <p class="chart-note">막대 위 숫자는 예보 모델 최대값이며, 오늘 ${w.peakRain.hour}시 강수량이 최대 ${w.maxRain.toFixed(1)}mm로 예상됩니다.</p>
    </section>

    <section class="card">
      <h3>콘크리트 타설 판단</h3>
      <div class="summary-grid">
        ${w.concrete.checks.map(d=>`<article class="summary-card ${riskClass(d.level)}"><div class="label">${d.title}</div><p>${d.text}</p></article>`).join("")}
      </div>
    </section>

    <section class="card">
      <div class="section-head mini-head">
        <div><h3>6일 시간별 강수 비교표</h3><p>예보처 4곳은 동일한 하늘색 계열, 평균/최대/일치도는 별도 열로 구분했습니다.</p></div>
        <span class="unit-label">(단위: mm)</span>
      </div>
      <div class="table-scroll sticky-weather-wrap">
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
                <td class="star-cell">${h.stars}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      <p class="chart-note">0.0mm는 무색, 강수량이 커질수록 옅은 파랑에서 진한 파랑으로 표시됩니다.</p>
    </section>
  `;
  setTimeout(bindLeafletMap, 0);
}

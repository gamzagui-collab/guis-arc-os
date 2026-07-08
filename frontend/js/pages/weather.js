import { getDemoWeatherSummary, riskClass } from "../services/weatherEngine.js";
import { WEATHER_MODELS } from "../services/weatherModels.js";

function blueRainStyle(v){
  if(v <= 0) return "";
  const alpha = Math.min(0.95, 0.12 + v / 12);
  const color = v >= 8 ? "color:#fff;font-weight:1000;" : "color:#0f172a;font-weight:900;";
  return `style="background:rgba(37,99,235,${alpha});${color}"`;
}
function rainCell(value){ return `<td ${blueRainStyle(value)}>${value.toFixed(1)}</td>`; }

function graphBars(rows){
  const max = Math.max(1, ...rows.map(h=>h.rain1h));
  return rows.map(h => {
    const height = Math.max(6, Math.round((h.rain1h / max) * 140));
    return `<div class="rain-graph-col"><div class="rain-graph-bar blue-bar" style="height:${height}px"></div><b>${h.rain1h.toFixed(1)}</b><span>${h.hour}시</span></div>`;
  }).join("");
}

export function renderWeather(root){
  const w = getDemoWeatherSummary();
  const todayRows = w.hourly.filter(h=>h.day===0);
  root.innerHTML = `
    <div class="section-head">
      <div>
        <h2>WEATHER · 6일 1시간 강수 비교</h2>
        <p>GUI's Arc v6.4 형식처럼 6일치 시간별 강수 비교표를 OS 디자인에 맞춰 복원했습니다.</p>
      </div>
      <button class="secondary-btn" onclick="window.print()">출력</button>
    </div>

    <div class="kpi-row">
      <div class="kpi"><span>타설 판단</span><strong>${w.concrete.overall}</strong><small>1시간 최대강수 기준</small></div>
      <div class="kpi"><span>오늘 1시간 최대</span><strong>${w.maxRain.toFixed(1)}mm</strong><small>${w.peakRain.hour}시</small></div>
      <div class="kpi"><span>체감 최고</span><strong>${w.maxApparent.toFixed(1)}℃</strong><small>${w.peakHeat.hour}시</small></div>
      <div class="kpi"><span>작업추천</span><strong>자동</strong><small>07~17 기준</small></div>
    </div>

    <section class="card weather-chart-card">
      <h3>오늘 1시간 강수 그래프</h3>
      <div class="rain-svg-chart">${graphBars(todayRows)}</div>
      <p class="chart-note">막대값은 예보처별 1시간 강수량 중 최대값입니다.</p>
    </section>

    <section class="card">
      <h3>작업시간 추천</h3>
      <p class="big-recommend">${w.workWindow}</p>
    </section>

    <section class="card">
      <h3>콘크리트 타설 판단</h3>
      <div class="summary-grid">
        ${w.concrete.checks.map(d=>`<article class="summary-card ${riskClass(d.level)}"><div class="label">${d.title}</div><p>${d.text}</p></article>`).join("")}
      </div>
    </section>

    <section class="card">
      <h3>6일 시간별 강수 비교표</h3>
      <div class="table-scroll">
        <table class="weather-compare-table">
          <thead>
            <tr>
              <th>날짜</th><th>시간</th>
              ${WEATHER_MODELS.map(m=>`<th>${m.name}<br><small>${m.label}</small></th>`).join("")}
              <th>평균</th><th>최대</th>
            </tr>
          </thead>
          <tbody>
            ${w.hourly.map((h,idx)=>`
              <tr>
                ${h.hour==="00" ? `<th rowspan="24">${h.dateLabel}</th>` : ""}
                <th>${h.hour}시</th>
                ${WEATHER_MODELS.map(m=>rainCell(h.modelRain[m.id] || 0)).join("")}
                ${rainCell(h.avgRain1h)}
                ${rainCell(h.rain1h)}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      <p class="chart-note">강수량이 클수록 옅은 파랑에서 진한 파랑으로 표시됩니다. 0.0mm는 무색입니다.</p>
    </section>
  `;
}

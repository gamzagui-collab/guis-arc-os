import { getDemoWeatherSummary, riskClass } from "../services/weatherEngine.js";
import { WEATHER_MODELS } from "../services/weatherModels.js";

function rainCell(value){
  const cls = value >= 5 ? "rain-heavy" : value >= 2 ? "rain-risk" : value > 0 ? "rain-light" : "";
  return `<td class="${cls}">${value.toFixed(1)}</td>`;
}

function graphBars(rows){
  const max = Math.max(1, ...rows.map(h=>h.rain1h));
  return rows.map(h => {
    const height = Math.max(6, Math.round((h.rain1h / max) * 140));
    const cls = h.rain1h >= 5 ? "bar-danger" : h.rain1h >= 2 ? "bar-warn" : h.rain1h > 0 ? "bar-watch" : "bar-zero";
    return `<div class="rain-graph-col"><div class="rain-graph-bar ${cls}" style="height:${height}px"></div><b>${h.rain1h.toFixed(1)}</b><span>${h.hour}시</span></div>`;
  }).join("");
}

export function renderWeather(root){
  const w = getDemoWeatherSummary();
  root.innerHTML = `
    <div class="section-head">
      <div>
        <h2>WEATHER · 1시간 강수 비교</h2>
        <p>KMA / ECMWF / GFS / JMA를 1시간 강수 기준으로 비교합니다.</p>
      </div>
      <button class="secondary-btn" onclick="window.print()">출력</button>
    </div>

    <div class="kpi-row">
      <div class="kpi"><span>타설 판단</span><strong>${w.concrete.overall}</strong><small>1시간 최대강수 기준</small></div>
      <div class="kpi"><span>1시간 강수</span><strong>${w.maxRain.toFixed(1)}mm</strong><small>${w.peakRain.hour}시</small></div>
      <div class="kpi"><span>체감 최고</span><strong>${w.maxApparent.toFixed(1)}℃</strong><small>${w.peakHeat.hour}시</small></div>
      <div class="kpi"><span>풍속 최고</span><strong>${w.maxWind.toFixed(1)}m/s</strong><small>${w.peakWind.hour}시</small></div>
    </div>

    <section class="card weather-chart-card">
      <h3>1시간 강수 그래프</h3>
      <div class="rain-svg-chart">${graphBars(w.hourly)}</div>
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
      <h3>예보처별 1시간 강수 비교</h3>
      <div class="table-scroll">
        <table class="weather-compare-table">
          <thead><tr><th>시간</th>${WEATHER_MODELS.map(m=>`<th>${m.name}<br><small>${m.label}</small></th>`).join("")}<th>평균</th><th>최대</th></tr></thead>
          <tbody>
            ${w.hourly.map(h=>`<tr><th>${h.hour}시</th>${WEATHER_MODELS.map(m=>rainCell(h.modelRain[m.id] || 0)).join("")}${rainCell(h.avgRain1h)}${rainCell(h.rain1h)}</tr>`).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

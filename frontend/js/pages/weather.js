import { getDemoWeatherSummary, riskClass } from "../services/weatherEngine.js";
import { WEATHER_MODELS } from "../services/weatherModels.js";

function bar(value, max, label){
  const height = Math.max(8, Math.round((value / max) * 120));
  return `<div class="weather-bar-wrap"><div class="weather-bar" style="height:${height}px"></div><span>${label}</span></div>`;
}

function rainCell(value){
  const cls = value >= 10 ? "rain-heavy" : value >= 5 ? "rain-risk" : value > 0 ? "rain-light" : "";
  return `<td class="${cls}">${value.toFixed(1)}</td>`;
}

export function renderWeather(root){
  const w = getDemoWeatherSummary();
  root.innerHTML = `
    <div class="section-head">
      <div>
        <h2>예보처 비교 · Weather Intelligence v8.2</h2>
        <p>KMA / ECMWF / GFS / JMA 예보를 비교해 콘크리트 타설과 현장 작업 판단에 사용합니다.</p>
      </div>
      <button class="secondary-btn" onclick="window.print()">출력</button>
    </div>

    <div class="kpi-row">
      <div class="kpi"><span>타설 판단</span><strong>${w.concrete.overall}</strong><small>예보처 최대값 기준</small></div>
      <div class="kpi"><span>체감 최고</span><strong>${w.maxApparent.toFixed(1)}℃</strong><small>${w.peakHeat.hour}시</small></div>
      <div class="kpi"><span>3시간 강수</span><strong>${w.maxRain.toFixed(1)}mm</strong><small>${w.peakRain.hour}시</small></div>
      <div class="kpi"><span>풍속 최고</span><strong>${w.maxWind.toFixed(1)}m/s</strong><small>${w.peakWind.hour}시</small></div>
      <div class="kpi"><span>작업추천</span><strong>자동</strong><small>07~17 기준</small></div>
    </div>

    <section class="card">
      <h3>오늘 작업시간 추천</h3>
      <p class="big-recommend">${w.workWindow}</p>
    </section>

    <section class="card">
      <h3>콘크리트 타설 판단</h3>
      <div class="summary-grid">
        ${w.concrete.checks.map(d=>`
          <article class="summary-card ${riskClass(d.level)}">
            <div class="label">${d.title}</div>
            <p>${d.text}</p>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="card">
      <h3>예보처별 3시간 강수 비교</h3>
      <div class="table-scroll">
        <table class="weather-compare-table">
          <thead>
            <tr>
              <th>시간</th>
              ${WEATHER_MODELS.map(m=>`<th>${m.name}<br><small>${m.label}</small></th>`).join("")}
              <th>평균</th>
              <th>최대</th>
            </tr>
          </thead>
          <tbody>
            ${w.hourly.map(h=>`
              <tr>
                <th>${h.hour}시</th>
                ${WEATHER_MODELS.map(m=>rainCell(h.modelRain[m.id] || 0)).join("")}
                ${rainCell(h.avgRain3h)}
                ${rainCell(h.maxRain3h)}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      <p class="chart-note">현재는 v8.2 데모 비교값입니다. 다음 단계에서 기존 v6.4의 실제 API 호출부를 이 구조에 연결합니다.</p>
    </section>

    <section class="card weather-chart-card">
      <h3>07~17시 체감온도 흐름</h3>
      <div class="weather-bars">
        ${w.hourly.map(x=>bar(x.apparent, 42, x.hour)).join("")}
      </div>
    </section>

    <section class="card">
      <h3>예보처 연결 상태</h3>
      <div class="summary-grid">
        ${WEATHER_MODELS.map(m=>`
          <div class="summary-card risk-blue">
            <div class="label">${m.name}</div>
            <div class="value">${m.status === "demo" ? "준비" : "예정"}</div>
            <p>${m.desc}</p>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

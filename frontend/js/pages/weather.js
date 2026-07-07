import { getDemoWeatherSummary, riskClass } from "../services/weatherEngine.js";

function bar(value, max, label){
  const height = Math.max(8, Math.round((value / max) * 120));
  return `<div class="weather-bar-wrap"><div class="weather-bar" style="height:${height}px"></div><span>${label}</span></div>`;
}

export function renderWeather(root){
  const w = getDemoWeatherSummary();
  root.innerHTML = `
    <div class="section-head">
      <div>
        <h2>예보처 비교 · Weather Intelligence</h2>
        <p>KMA / ECMWF / GFS / JMA 예보를 현장 의사결정용으로 비교합니다. ${w.sourceMode}</p>
      </div>
      <button class="secondary-btn" onclick="window.print()">출력</button>
    </div>

    <div class="kpi-row">
      <div class="kpi"><span>체감 최고</span><strong>${w.maxApparent.toFixed(1)}℃</strong><small>${w.peakHeat.hour}시</small></div>
      <div class="kpi"><span>3시간 강수</span><strong>${w.maxRain.toFixed(1)}mm</strong><small>${w.peakRain.hour}시</small></div>
      <div class="kpi"><span>풍속 최고</span><strong>${w.maxWind.toFixed(1)}m/s</strong><small>${w.peakWind.hour}시</small></div>
      <div class="kpi"><span>작업시간</span><strong>07~17</strong><small>현장 기준</small></div>
      <div class="kpi"><span>타설판단</span><strong>${w.maxRain >= 5 ? "주의" : "가능"}</strong><small>강수 기준</small></div>
    </div>

    <section class="card">
      <h3>오늘 집중관리</h3>
      <div class="summary-grid">
        ${w.decision.map(d=>`
          <article class="summary-card ${riskClass(d.level)}">
            <div class="label">${d.type}</div>
            <div class="value">${d.level}</div>
            <p>${d.text}</p>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="card weather-chart-card">
      <h3>07~17시 체감온도 흐름</h3>
      <div class="weather-bars">
        ${w.hourly.map(x=>bar(x.apparent, 42, x.hour)).join("")}
      </div>
      <p class="chart-note">막대가 높을수록 체감온도 위험이 큽니다. v7.1 다음 단계에서 실제 v6.4 예보 API를 연결합니다.</p>
    </section>

    <section class="card">
      <h3>예보처 비교 영역</h3>
      <div class="summary-grid">
        <div class="summary-card risk-blue"><div class="label">KMA</div><div class="value">이관 예정</div><p>기상청 초단기/단기예보</p></div>
        <div class="summary-card risk-blue"><div class="label">ECMWF</div><div class="value">이관 예정</div><p>중기 경향 판단</p></div>
        <div class="summary-card risk-blue"><div class="label">GFS</div><div class="value">이관 예정</div><p>강수 패턴 보조</p></div>
        <div class="summary-card risk-blue"><div class="label">JMA</div><div class="value">이관 예정</div><p>동아시아 예보 비교</p></div>
      </div>
    </section>
  `;
}

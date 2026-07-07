export function renderWeather(root){
  root.innerHTML = `<div class="section-head"><div><h2>예보처 비교</h2><p>KMA / ECMWF / GFS / JMA 예보를 현장 의사결정용으로 비교합니다.</p></div></div>
  <section class="card"><h3>강수 판단</h3><p>v7에서도 날씨 비교는 핵심 기능입니다. 기존 GUI's Arc v6.4의 예보 비교 엔진을 이 페이지로 이관합니다.</p>
  <div class="summary-grid"><div class="summary-card risk-blue"><div class="label">KMA</div><div class="value">조회 예정</div></div><div class="summary-card risk-blue"><div class="label">ECMWF</div><div class="value">연동 예정</div></div><div class="summary-card risk-blue"><div class="label">GFS</div><div class="value">연동 예정</div></div><div class="summary-card risk-blue"><div class="label">JMA</div><div class="value">연동 예정</div></div></div></section>`;
}

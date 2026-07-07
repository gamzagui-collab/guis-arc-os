export function renderBriefing(root){
  root.innerHTML = `<div class="section-head"><div><h2>사고·뉴스 브리핑</h2><p>건설사고, 법령개정, 신공법, 업계동향을 카드로 확인합니다.</p></div></div>
  <section class="card"><h3>오늘 사고 브리핑</h3><div class="summary-grid">
  <article class="summary-card risk-red"><div class="label">추락</div><div class="value">포스터</div><p>개구부·작업발판·안전대 확인</p></article>
  <article class="summary-card risk-orange"><div class="label">협착</div><div class="value">장비</div><p>지게차·굴착기 작업반경 통제</p></article>
  <article class="summary-card risk-yellow"><div class="label">붕괴</div><div class="value">굴착</div><p>굴착면·우수 유입·흙막이 확인</p></article>
  <article class="summary-card risk-blue"><div class="label">뉴스</div><div class="value">신공법</div><p>추후 RSS/API 연동</p></article>
  </div></section>`;
}

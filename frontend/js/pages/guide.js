import { state } from "../core/state.js";
export function renderGuide(root){
  root.innerHTML = `<div class="section-head"><div><h2>업무가이드</h2><p>요약 먼저, 상세는 펼쳐서 확인합니다.</p></div><button class="secondary-btn" onclick="navigator.clipboard.writeText(document.body.innerText)">복사</button></div>
  <div class="summary-grid"><article class="summary-card risk-red"><div class="label">안전</div><div class="value">추락</div><p>개구부·안전대·작업발판 우선 확인</p></article><article class="summary-card risk-orange"><div class="label">공사</div><div class="value">작업순서</div><p>타설 전 검측 완료 여부 확인</p></article><article class="summary-card risk-yellow"><div class="label">품질</div><div class="value">공시체</div><p>슬럼프·공기량·공시체 계획 확인</p></article><article class="summary-card risk-blue"><div class="label">자재</div><div class="value">입고</div><p>규격·수량·보관위치 확인</p></article></div>
  <section class="card"><h3>오늘 TBM 요약</h3><div class="action-list">${state.selectedTrades.map(t=>`<label class="action-item"><input type="checkbox"> ${t}: 작업 전 위험요소와 품질 확인사항 공유</label>`).join("")}</div></section>`;
}

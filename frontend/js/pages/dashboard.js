import { state } from "../core/state.js";
export function renderDashboard(root){
  root.innerHTML = `
    <div class="section-head"><div><h2>오늘의 현장 요약</h2><p>${state.site?.siteName || "게스트 현장"} · 07:00~17:00 작업 기준</p></div><button class="secondary-btn" onclick="window.print()">출력</button></div>
    <div class="kpi-row">
      <div class="kpi"><span>현재 위험</span><strong>주의</strong></div><div class="kpi"><span>오늘 공정</span><strong>${state.selectedTrades.length}건</strong></div>
      <div class="kpi"><span>일정</span><strong>${state.schedules.length}건</strong></div><div class="kpi"><span>사고 브리핑</span><strong>5건</strong></div><div class="kpi"><span>TBM</span><strong>생성</strong></div>
    </div>
    <section class="card notice-card"><h3>가장 먼저 확인</h3><div class="action-list">
      <label class="action-item"><input type="checkbox"> 오늘 강수·풍속 확인 후 외부작업 순서 조정</label>
      <label class="action-item"><input type="checkbox"> 선택 공정 기준 안전관리자 TBM 실시</label>
      <label class="action-item"><input type="checkbox"> 자재·장비 반입 일정과 작업반경 통제 확인</label>
    </div></section>`;
}

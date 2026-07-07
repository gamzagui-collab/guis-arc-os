import { state } from "../core/state.js";
import { buildActionsFromSchedule } from "../services/siteManagement.js";

export function renderGuide(root){
  const actions = buildActionsFromSchedule(state.schedules || [], state.weatherRisk);
  const grouped = actions.reduce((acc, a) => {
    acc[a.role] = acc[a.role] || [];
    acc[a.role].push(a);
    return acc;
  }, {});

  root.innerHTML = `
    <div class="section-head">
      <div><h2>업무가이드</h2><p>오늘 일정·공정·날씨를 기준으로 역할별 할 일을 요약합니다.</p></div>
      <button class="secondary-btn" onclick="navigator.clipboard.writeText(document.body.innerText)">복사</button>
    </div>

    <div class="summary-grid">
      <article class="summary-card risk-red"><div class="label">안전</div><div class="value">${(grouped["안전"]||[]).length}건</div><p>위험작업·기상·장비 통제</p></article>
      <article class="summary-card risk-orange"><div class="label">공사</div><div class="value">${(grouped["공사"]||[]).length}건</div><p>작업순서·동선·감리 협의</p></article>
      <article class="summary-card risk-yellow"><div class="label">품질</div><div class="value">${(grouped["품질"]||[]).length}건</div><p>검측·공시체·보양</p></article>
      <article class="summary-card risk-blue"><div class="label">자재/장비</div><div class="value">${((grouped["자재"]||[]).length + (grouped["장비"]||[]).length)}건</div><p>반입·하역·장비점검</p></article>
    </div>

    ${Object.entries(grouped).map(([role, list]) => `
      <section class="card role-action-card">
        <h3>${role} 오늘 할 일</h3>
        <div class="action-list">
          ${list.map(a => `<label class="action-item"><input type="checkbox"><span><b>[${a.category}] ${a.title}</b><br><small>${a.detail}</small></span></label>`).join("")}
        </div>
      </section>
    `).join("") || `<section class="card"><h3>오늘 할 일</h3><p>현장일정에서 타설계획, 자재반입, 장비운영을 추가하면 자동으로 생성됩니다.</p></section>`}

    <section class="card">
      <h3>오늘 TBM 요약</h3>
      <div class="action-list">
        ${state.selectedTrades.map(t=>`<label class="action-item"><input type="checkbox"> ${t}: 작업 전 위험요소와 품질 확인사항 공유</label>`).join("")}
      </div>
    </section>
  `;
}

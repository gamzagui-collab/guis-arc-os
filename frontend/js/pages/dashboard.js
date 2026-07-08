import { buildOsDashboard } from "../services/osCore.js";
import { state } from "../core/state.js";

function riskBadge(level){ return level === "danger" ? "risk-red" : "risk-blue"; }

export function renderDashboard(root){
  const d = buildOsDashboard();
  root.innerHTML = `
    <section class="os-hero">
      <div>
        <span class="eyebrow">Construction Site Operating System</span>
        <h2>${d.siteName}</h2>
        <p>${d.today} · ${d.siteType} · 07:00~17:00 작업 기준</p>
      </div>
      <div class="os-risk">
        <span>오늘 위험도</span>
        <strong>${d.critical.some(x=>x.level==="danger") ? "주의" : "정상"}</strong>
      </div>
    </section>

    
    ${(!state.siteProfile?.siteName && !state.site?.siteName) ? `
      <section class="card risk-yellow">
        <h3>현장정보를 먼저 등록하세요</h3>
        <p>현장관리 탭에서 현장명, 현장형태, 공사규모를 입력하면 공종·위험·품질관리 항목이 자동 구성됩니다.</p>
      </section>
    ` : ""}

    <section class="os-command-grid">
      <article class="command-card command-red"><span>AI 브리핑</span><strong>${d.ai.accidentTop5[0] || "기본 안전관리"}</strong><p>${d.ai.qualityTop3[0] || "품질 중점사항을 확인하세요."}</p></article>
      <article class="command-card command-blue"><span>날씨</span><strong>체감 ${d.weather.maxApparent.toFixed(1)}℃</strong><p>강수 ${d.weather.maxRain.toFixed(1)}mm · 풍속 ${d.weather.maxWind.toFixed(1)}m/s</p></article>
      <article class="command-card command-orange"><span>오늘 일정</span><strong>${d.todaySchedules.length}건</strong><p>${d.todaySchedules.map(x=>x.type + " " + x.title).join(" · ") || "오늘 등록된 일정 없음"}</p></article>
      <article class="command-card command-green"><span>선택 공정</span><strong>${(state.selectedTrades || []).length}건</strong><p>${(state.selectedTrades || []).join(" · ") || "공정을 선택하세요."}</p></article>
    </section>

    <section class="card">
      <div class="section-head"><div><h2>오늘 집중관리</h2><p>현장소장·안전·공사·품질 담당자가 먼저 확인할 항목입니다.</p></div><button class="secondary-btn" onclick="window.print()">출력</button></div>
      <div class="summary-grid">${d.critical.map(x => `<article class="summary-card ${riskBadge(x.level)}"><div class="label">${x.title}</div><p>${x.text}</p></article>`).join("")}</div>
    </section>

    <section class="card"><h3>오늘 기본 체크</h3><div class="action-list">${d.quickTasks.map(x => `<label class="action-item"><input type="checkbox"><span>${x}</span></label>`).join("")}</div></section>

    <section class="card">
      <h3>AI 현장비서 요약</h3>
      <div class="summary-grid">
        <article class="summary-card risk-red"><div class="label">사고위험 TOP5</div><ul>${d.ai.accidentTop5.map(x=>`<li>${x}</li>`).join("")}</ul></article>
        <article class="summary-card risk-orange"><div class="label">품질 TOP3</div><ul>${d.ai.qualityTop3.map(x=>`<li>${x}</li>`).join("")}</ul></article>
        <article class="summary-card risk-yellow"><div class="label">감리지적 TOP3</div><ul>${d.ai.inspectionTop3.map(x=>`<li>${x}</li>`).join("")}</ul></article>
        <article class="summary-card risk-blue"><div class="label">다음 행동</div><p>AI 현장비서 탭에서 역할별 할 일과 TBM 문구를 복사하세요.</p></article>
      </div>
    </section>
  `;
}

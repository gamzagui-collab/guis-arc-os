import { buildAiFieldBriefing } from "../services/aiFieldAssistant.js";

function list(items){
  return items?.length ? items.map(x => `<li>${x}</li>`).join("") : `<li>해당 없음</li>`;
}

export function renderAssistant(root){
  const b = buildAiFieldBriefing();
  root.innerHTML = `
    <div class="section-head">
      <div>
        <h2>AI 현장비서</h2>
        <p>오늘 일정·공종·날씨·사고사례를 묶어 역할별 해야 할 일을 요약합니다.</p>
      </div>
      <div class="export-row">
        <button id="copyAiTbmBtn" class="secondary-btn">TBM 복사</button>
        <button onclick="window.print()" class="secondary-btn">출력</button>
      </div>
    </div>

    <section class="card ai-main-card">
      <h3>오늘 핵심 판단</h3>
      <div class="summary-grid">
        <article class="summary-card risk-red"><div class="label">사고위험 TOP5</div><ul>${list(b.accidentTop5)}</ul></article>
        <article class="summary-card risk-orange"><div class="label">품질문제 TOP3</div><ul>${list(b.qualityTop3)}</ul></article>
        <article class="summary-card risk-yellow"><div class="label">감리지적 TOP3</div><ul>${list(b.inspectionTop3)}</ul></article>
        <article class="summary-card risk-blue"><div class="label">기상 판단</div><p>체감 ${b.weather.maxApparent.toFixed(1)}℃ · 강수 ${b.weather.maxRain.toFixed(1)}mm · 풍속 ${b.weather.maxWind.toFixed(1)}m/s</p></article>
      </div>
    </section>

    <section class="card">
      <h3>역할별 오늘 할 일</h3>
      <div class="role-grid">
        ${Object.entries(b.roleActions).map(([role, actions]) => `
          <article class="role-box">
            <h4>${role}</h4>
            <div class="action-list">
              ${(actions.length ? actions : ["오늘 등록된 자동 할 일이 없습니다."]).map(a => `<label class="action-item"><input type="checkbox"><span>${a}</span></label>`).join("")}
            </div>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="card">
      <h3>연결된 유사 사고사례</h3>
      <div class="summary-grid">
        ${(b.matchedAccidents.length ? b.matchedAccidents : []).map(a => `
          <article class="summary-card risk-red">
            <div class="label">${a.type}</div>
            <h3>${a.title}</h3>
            <p>${a.tbm}</p>
          </article>
        `).join("") || `<article class="summary-card"><p>오늘 공종과 직접 연결된 사고사례가 없습니다.</p></article>`}
      </div>
    </section>

    <section class="card">
      <h3>TBM 자동 문구</h3>
      <pre id="aiTbmText" class="tbm-box">${b.tbm}</pre>
    </section>
  `;

  root.querySelector("#copyAiTbmBtn").addEventListener("click", () => {
    navigator.clipboard.writeText(root.querySelector("#aiTbmText").innerText);
    alert("TBM 문구를 복사했습니다.");
  });
}

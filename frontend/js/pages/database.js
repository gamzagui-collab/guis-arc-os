import { searchTrades, getTradeById } from "../services/knowledgeBase.js";

function card(t){
  return `<article class="summary-card trade-card" data-trade-id="${t.id}">
    <div class="label">${t.category}</div>
    <div class="value trade-title">${t.name}</div>
    <p>${t.summary}</p>
    <b class="point-line">핵심: ${t.keyPoint}</b>
  </article>`;
}

function detail(t){
  return `<section class="card trade-detail">
    <div class="section-head">
      <div><h2>${t.name}</h2><p>${t.summary}</p></div>
      <button class="secondary-btn" id="copyTradeDetailBtn">복사</button>
    </div>
    <div class="summary-grid">
      <article class="summary-card risk-red"><div class="label">사고위험 TOP5</div><ul>${t.safetyTop5.map(x=>`<li>${x}</li>`).join("")}</ul></article>
      <article class="summary-card risk-orange"><div class="label">품질문제 TOP3</div><ul>${t.qualityTop3.map(x=>`<li>${x}</li>`).join("")}</ul></article>
      <article class="summary-card risk-yellow"><div class="label">감리지적 TOP3</div><ul>${t.inspectionTop3.map(x=>`<li>${x}</li>`).join("")}</ul></article>
      <article class="summary-card risk-blue"><div class="label">관련 기준</div><b>KCS</b><ul>${t.kcs.map(x=>`<li>${x}</li>`).join("")}</ul><b>법령</b><ul>${t.laws.map(x=>`<li>${x}</li>`).join("")}</ul></article>
    </div>
    <h3>현장 체크리스트</h3>
    <div class="action-list">${t.checklist.map(x=>`<label class="action-item"><input type="checkbox"><span>${x}</span></label>`).join("")}</div>
    <h3>TBM 문구</h3>
    <pre class="tbm-box">${t.tbm}</pre>
  </section>`;
}

export function renderDatabase(root){
  const trades = searchTrades("");
  root.innerHTML = `
    <div class="section-head">
      <div><h2>공종 데이터베이스</h2><p>시공법 · 품질관리 · 안전관리 · KCS · 법령 · 사고사례를 연결합니다.</p></div>
    </div>
    <section class="card">
      <h3>공종 검색</h3>
      <input id="tradeSearchInput" placeholder="예: 철근, 타설, 크레인, 갱폼, 지게차">
    </section>
    <section class="trade-grid">${trades.map(card).join("")}</section>
    <div id="tradeDetailArea">${detail(trades[0])}</div>
  `;

  const bindCards = () => {
    root.querySelectorAll(".trade-card").forEach(el => {
      el.addEventListener("click", () => {
        const t = getTradeById(el.dataset.tradeId);
        root.querySelector("#tradeDetailArea").innerHTML = detail(t);
        root.querySelector("#copyTradeDetailBtn")?.addEventListener("click", () => navigator.clipboard.writeText(root.querySelector("#tradeDetailArea").innerText));
      });
    });
  };

  root.querySelector("#tradeSearchInput").addEventListener("input", () => {
    const found = searchTrades(root.querySelector("#tradeSearchInput").value);
    root.querySelector(".trade-grid").innerHTML = found.map(card).join("") || `<section class="card"><p>검색 결과가 없습니다.</p></section>`;
    bindCards();
  });
  bindCards();
  root.querySelector("#copyTradeDetailBtn")?.addEventListener("click", () => navigator.clipboard.writeText(root.querySelector("#tradeDetailArea").innerText));
}

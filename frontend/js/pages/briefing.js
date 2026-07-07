import { searchAccidents, getAccidentById, CONSTRUCTION_NEWS } from "../services/accidentBriefing.js";

function poster(a){
  const cls = a.posterStyle === "red" ? "poster-red" : "poster-orange";
  return `<article class="accident-poster ${cls}" data-accident-id="${a.id}">
    <div class="poster-top">
      <span>${a.severity}</span>
      <b>${a.type}</b>
    </div>
    <h3>${a.title}</h3>
    <p>${a.trade} · ${a.region}</p>
    <div class="poster-symbol">${a.type === "추락" ? "↓" : a.type === "낙하" ? "!" : "⚠"}</div>
    <small>${a.cause}</small>
  </article>`;
}

function detail(a){
  return `<section class="card accident-detail-card">
    <div class="section-head">
      <div>
        <h2>${a.type} · ${a.title}</h2>
        <p>${a.trade} · ${a.occurredAt} · ${a.region}</p>
      </div>
      <button id="copyAccidentBtn" class="secondary-btn">복사</button>
    </div>
    <div class="summary-grid">
      <article class="summary-card risk-red"><div class="label">주요 원인</div><p>${a.cause}</p></article>
      <article class="summary-card risk-orange"><div class="label">관련 공종</div><p>${a.relatedTrades.join(" · ")}</p></article>
      <article class="summary-card risk-yellow"><div class="label">우리 현장 확인</div><ul>${a.siteChecks.map(x=>`<li>${x}</li>`).join("")}</ul></article>
      <article class="summary-card risk-blue"><div class="label">연결 예정</div><p>KOSHA 포스터 · KCS · 법령 · 유사 사고 통계</p></article>
    </div>
    <h3>TBM 문구</h3>
    <pre class="tbm-box">${a.tbm}</pre>
  </section>`;
}

export function renderBriefing(root){
  const items = searchAccidents("");
  root.innerHTML = `
    <div class="section-head">
      <div><h2>사고·뉴스 브리핑</h2><p>글보다 먼저 보이는 포스터형 사고 브리핑입니다. 이후 KOSHA 첨부 포스터와 자동 연결합니다.</p></div>
      <button class="secondary-btn" onclick="window.print()">출력</button>
    </div>

    <section class="card">
      <h3>사고 검색</h3>
      <input id="accidentSearchInput" placeholder="예: 추락, 타설, 지게차, 크레인">
    </section>

    <section class="poster-grid">${items.map(poster).join("")}</section>

    <div id="accidentDetailArea">${detail(items[0])}</div>

    <section class="card news-card">
      <h3>건설업계 동향</h3>
      <div class="summary-grid">
        ${CONSTRUCTION_NEWS.map(n => `<article class="summary-card risk-blue"><div class="label">${n.category}</div><h3>${n.title}</h3><p>${n.summary}</p></article>`).join("")}
      </div>
    </section>
  `;

  const bindPosters = () => {
    root.querySelectorAll(".accident-poster").forEach(el => {
      el.addEventListener("click", () => {
        const a = getAccidentById(el.dataset.accidentId);
        root.querySelector("#accidentDetailArea").innerHTML = detail(a);
        root.querySelector("#copyAccidentBtn")?.addEventListener("click", () => navigator.clipboard.writeText(root.querySelector("#accidentDetailArea").innerText));
      });
    });
  };

  root.querySelector("#accidentSearchInput").addEventListener("input", () => {
    const found = searchAccidents(root.querySelector("#accidentSearchInput").value);
    root.querySelector(".poster-grid").innerHTML = found.map(poster).join("") || `<section class="card"><p>검색 결과가 없습니다.</p></section>`;
    bindPosters();
  });

  bindPosters();
  root.querySelector("#copyAccidentBtn")?.addEventListener("click", () => navigator.clipboard.writeText(root.querySelector("#accidentDetailArea").innerText));
}

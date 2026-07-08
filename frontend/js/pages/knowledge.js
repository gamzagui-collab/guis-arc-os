import { searchKnowledge } from "../services/knowledgeGraph.js";

const groups = [
  {key:"director", title:"현장소장", desc:"오늘 판단·지시·리스크 요약"},
  {key:"safety", title:"안전관리", desc:"위험요인·TBM·사고사례"},
  {key:"quality", title:"품질관리", desc:"시험·검측·사진·감리지적"},
  {key:"construction", title:"공사관리", desc:"시공순서·공정·작업간섭"},
  {key:"resource", title:"자재·장비", desc:"반입·검수·하역·장비점검"}
];

function nodeCard(n){
  return `<article class="knowledge-card" data-id="${n.id}">
    <div class="label">${n.tags.join(" · ")}</div>
    <h3>${n.title}</h3>
    <p>${n.summary}</p>
    <b>${n.five.slice(0,3).join(" / ")}</b>
  </article>`;
}

function detail(n){
  return `<section class="card knowledge-detail-card">
    <div class="section-head">
      <div><h2>${n.title}</h2><p>${n.summary}</p></div>
      <button class="secondary-btn" id="copyKnowledgeBtn">복사</button>
    </div>
    <section class="summary-grid">
      ${n.five.map(x=>`<article class="summary-card risk-orange"><div class="label">5초 요약</div><p>${x}</p></article>`).join("")}
    </section>
    <div class="knowledge-section-grid">
      <details open><summary>품질관리</summary><div class="action-list">${n.quality.map(x=>`<label class="action-item"><input type="checkbox"><span>${x}</span></label>`).join("")}</div></details>
      <details open><summary>안전관리</summary><div class="action-list">${n.safety.map(x=>`<label class="action-item"><input type="checkbox"><span>${x}</span></label>`).join("")}</div></details>
      <details><summary>사진 기록</summary><div class="action-list">${n.photo.map(x=>`<label class="action-item"><input type="checkbox"><span>${x}</span></label>`).join("")}</div></details>
      <details><summary>관련 기준</summary><div class="action-list">${n.refs.map(x=>`<label class="action-item"><input type="checkbox"><span>${x}</span></label>`).join("")}</div></details>
    </div>
  </section>`;
}

export function renderKnowledge(root){
  const nodes = searchKnowledge("");
  root.innerHTML = `
    <div class="section-head">
      <div>
        <h2>DB · 건설현장 지식 데이터베이스</h2>
        <p>GUI's Arc 형식처럼 역할별 메뉴는 분리하고, DB는 공종·품질·안전·법령을 연결합니다.</p>
      </div>
    </div>

    <section class="role-menu-grid">
      ${groups.map(g=>`<article class="role-menu-card"><h3>${g.title}</h3><p>${g.desc}</p></article>`).join("")}
    </section>

    <section class="card">
      <h3>공종·품질·안전 DB 검색</h3>
      <input id="knowledgeSearch" placeholder="예: 콘크리트, 공시체, 철근, 크레인, 갱폼, 균열, 파일">
    </section>

    <section class="knowledge-grid">${nodes.map(nodeCard).join("")}</section>
    <div id="knowledgeDetail">${detail(nodes[0])}</div>
  `;

  const bind = () => {
    root.querySelectorAll(".knowledge-card").forEach(el => {
      el.addEventListener("click", () => {
        const n = searchKnowledge("").find(x => x.id === el.dataset.id);
        root.querySelector("#knowledgeDetail").innerHTML = detail(n);
        root.querySelector("#copyKnowledgeBtn")?.addEventListener("click", () => navigator.clipboard.writeText(root.querySelector("#knowledgeDetail").innerText));
      });
    });
  };

  root.querySelector("#knowledgeSearch").addEventListener("input", e => {
    const found = searchKnowledge(e.target.value);
    root.querySelector(".knowledge-grid").innerHTML = found.map(nodeCard).join("") || `<section class="card"><p>검색 결과가 없습니다.</p></section>`;
    if(found[0]) root.querySelector("#knowledgeDetail").innerHTML = detail(found[0]);
    bind();
  });

  bind();
}

import { buildRoleBriefing } from "../services/roleBriefingEngine.js";

function list(items){
  return items?.length
    ? items.map(x => `<label class="action-item"><input type="checkbox"><span>${x}</span></label>`).join("")
    : `<p class="help-text">TODAY에서 작업공종, 자재반입, 장비운영, 타설계획을 입력하면 자동 생성됩니다.</p>`;
}

export function renderRolePage(root, roleKey){
  const r = buildRoleBriefing(roleKey);
  root.innerHTML = `
    <section class="role-hero ${r.def.color}">
      <div>
        <span>GUI's Arc OS Role Briefing</span>
        <h2>${r.def.title}</h2>
        <p>${r.def.subtitle}</p>
      </div>
      <button class="secondary-btn" onclick="window.print()">출력</button>
    </section>

    <section class="summary-grid">
      ${r.def.focus.map(x => `<article class="summary-card risk-blue"><div class="label">중점</div><p>${x}</p></article>`).join("")}
    </section>

    <section class="card">
      <h3>${r.def.title} 오늘 할 일</h3>
      <div class="action-list">${list(r.actions)}</div>
    </section>

    <section class="card">
      <h3>오늘 공통 확인</h3>
      <div class="action-list">${list(r.commonActions)}</div>
    </section>

    ${roleKey === "quality" && r.specimen ? `
      <section class="card risk-orange">
        <h3>콘크리트 공시체</h3>
        <p class="big-recommend">타설량 ${r.today.concrete.volumeM3}㎥ → 시험빈도 ${r.specimen.setCount}회 → 공시체 ${r.specimen.totalPieces}개</p>
      </section>
    ` : ""}

    <section class="card">
      <h3>사진 기록 포인트</h3>
      <div class="action-list">${list(r.photos)}</div>
    </section>

    <section class="card">
      <h3>TBM / 전달문</h3>
      <pre class="tbm-box">${r.tbm || "TODAY에서 작업을 입력하면 역할별 전달문이 생성됩니다."}</pre>
    </section>
  `;
}

export const renderDirector = root => renderRolePage(root, "director");
export const renderSafetyRole = root => renderRolePage(root, "safety");
export const renderConstructionRole = root => renderRolePage(root, "construction");
export const renderResourceRole = root => renderRolePage(root, "resource");

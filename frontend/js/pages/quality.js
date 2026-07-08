import { calculateConcreteSpecimens, buildConcreteQualityBrief, getConcreteQualityChecklist, getConcretePhotoPoints, getConfirmedRules, getFieldOperationDefaults, QUALITY_KNOWLEDGE } from "../services/qualityKnowledge.js";

function checkbox(id, label, checked=true){
  return `<label class="quality-check"><input id="${id}" type="checkbox" ${checked ? "checked" : ""}><span>${label}</span></label>`;
}

function renderTable(result){
  return `<div class="table-scroll">
    <table class="quality-table">
      <thead><tr><th>구분</th><th>시험빈도</th><th>조/회</th><th>총 조</th><th>개/조</th><th>합계</th><th>근거 수준</th></tr></thead>
      <tbody>
        ${result.rows.map(r => `<tr><th>${r.name}</th><td>${r.setCount}회</td><td>${r.groupsPerSet}조</td><td>${r.groupCount}조</td><td>${r.piecesPerGroup}개</td><td><b>${r.pieces}개</b></td><td>${r.confidence}</td></tr>`).join("")}
      </tbody>
      <tfoot><tr><th>합계</th><td>${result.setCount}회</td><td>-</td><td>${result.totalGroups}조</td><td>-</td><td><b>${result.totalPieces}개</b></td><td>현장 조건 확인</td></tr></tfoot>
    </table>
  </div>`;
}

export function renderQuality(root){
  root.innerHTML = `
    <div class="section-head">
      <div>
        <h2>품질관리 · Verified Quality Rules</h2>
        <p>공식 확인 기준과 현장 운영 기본안을 구분해 표시합니다.</p>
      </div>
      <div class="export-row">
        <button id="copyQualityBtn" class="secondary-btn">요약 복사</button>
        <button class="secondary-btn" onclick="window.print()">출력</button>
      </div>
    </div>

    <section class="card risk-yellow">
      <h3>중요 안내</h3>
      <p class="help-text">이 화면은 업무 보조용입니다. 실제 적용은 현장 품질관리계획서, 특기시방서, 감리 지시, 최신 KCS/KS/건설공사 품질관리 업무지침을 우선합니다.</p>
    </section>

    <section class="card">
      <h3>공식 확인 기준</h3>
      <div class="summary-grid">
        ${getConfirmedRules().map(r => `<article class="summary-card risk-blue"><div class="label">${r.confidence}</div><h3>${r.title}</h3><p>${r.rule}</p></article>`).join("")}
      </div>
    </section>

    <section class="card">
      <h3>현장 운영 기본안</h3>
      <div class="summary-grid">
        ${getFieldOperationDefaults().map(r => `<article class="summary-card risk-orange"><div class="label">${r.confidence}</div><h3>${r.title}</h3><p>${r.rule}</p></article>`).join("")}
      </div>
    </section>

    <section class="card">
      <h3>콘크리트 타설 공시체 계산</h3>
      <div class="form-grid">
        <label>1일 타설량 또는 동일 배합 타설량(㎥)<input id="qVolume" type="number" value="120" min="1" step="1"></label>
      </div>
      <div class="quality-option-grid">
        ${checkbox("qVertical", "수직부재 탈형강도 1조(3개)/회", true)}
        ${checkbox("qHorizontal", "수평부재 탈형강도 1조(3개)/회", true)}
        ${checkbox("qStandard", "28일 압축강도 3조(9개)/회", true)}
        ${checkbox("qReserve", "예비 공시체 1조(3개)/회", false)}
        ${checkbox("qEarly", "조기강도 확인 1조(3개)/회", false)}
      </div>
      <div id="specimenResult"></div>
    </section>

    <section class="card">
      <h3>품질관리 체크리스트</h3>
      <div class="action-list">
        ${getConcreteQualityChecklist().map(x => `<label class="action-item"><input type="checkbox"><span>${x}</span></label>`).join("")}
      </div>
    </section>

    <section class="card">
      <h3>사진 기록 포인트</h3>
      <div class="summary-grid">
        ${getConcretePhotoPoints().map(x => `<article class="summary-card risk-yellow"><div class="label">사진</div><p>${x}</p></article>`).join("")}
      </div>
    </section>

    <section class="card">
      <h3>관련 기준</h3>
      <div class="action-list">
        ${QUALITY_KNOWLEDGE.concrete.standards.map(x => `<label class="action-item"><input type="checkbox"><span>${x}</span></label>`).join("")}
      </div>
    </section>

    <section class="card">
      <h3>복사용 요약</h3>
      <pre id="qualityBriefText" class="tbm-box"></pre>
    </section>
  `;

  const update = () => {
    const opts = {
      volumeM3: Number(root.querySelector("#qVolume").value),
      verticalStrip: root.querySelector("#qVertical").checked,
      horizontalStrip: root.querySelector("#qHorizontal").checked,
      standard28d: root.querySelector("#qStandard").checked,
      reserve: root.querySelector("#qReserve").checked,
      earlyStrength: root.querySelector("#qEarly").checked
    };
    const result = calculateConcreteSpecimens(opts);
    root.querySelector("#specimenResult").innerHTML = renderTable(result);
    root.querySelector("#qualityBriefText").innerText = buildConcreteQualityBrief(opts);
  };

  root.querySelectorAll(".quality-check input, #qVolume").forEach(el => el.addEventListener("input", update));
  root.querySelectorAll(".quality-check input").forEach(el => el.addEventListener("change", update));
  root.querySelector("#copyQualityBtn").addEventListener("click", () => {
    navigator.clipboard.writeText(root.querySelector("#qualityBriefText").innerText);
    alert("품질관리 요약을 복사했습니다.");
  });
  update();
}

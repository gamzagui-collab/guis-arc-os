import { calculateConcreteSpecimens, buildConcreteQualityBrief, getConcreteQualityChecklist, getConcretePhotoPoints, QUALITY_KNOWLEDGE } from "../services/qualityKnowledge.js";

function checkbox(id, label, checked=true){
  return `<label class="quality-check"><input id="${id}" type="checkbox" ${checked ? "checked" : ""}><span>${label}</span></label>`;
}

function renderTable(result){
  return `<div class="table-scroll">
    <table class="quality-table">
      <thead><tr><th>구분</th><th>조</th><th>개/조</th><th>합계</th><th>용도</th></tr></thead>
      <tbody>
        ${result.rows.map(r => `<tr><th>${r.name}</th><td>${r.groupCount}</td><td>${r.piecesPerGroup}</td><td><b>${r.pieces}개</b></td><td>${r.description}</td></tr>`).join("")}
      </tbody>
      <tfoot><tr><th>합계</th><td>${result.totalGroups}조</td><td>-</td><td><b>${result.totalPieces}개</b></td><td>현장 조건에 따라 조정</td></tr></tfoot>
    </table>
  </div>`;
}

export function renderQuality(root){
  root.innerHTML = `
    <div class="section-head">
      <div>
        <h2>품질관리 · Quality Knowledge Engine</h2>
        <p>타설·검측·시험·공시체·사진 기록을 현장 업무 방식으로 정리합니다.</p>
      </div>
      <div class="export-row">
        <button id="copyQualityBtn" class="secondary-btn">요약 복사</button>
        <button class="secondary-btn" onclick="window.print()">출력</button>
      </div>
    </div>

    <section class="card">
      <h3>콘크리트 타설 공시체 계산</h3>
      <p class="help-text">기본값은 업무 보조용입니다. 실제 수량은 현장 품질관리계획서, 특기시방서, 감리 지시에 맞춰 조정하세요.</p>
      <div class="quality-option-grid">
        ${checkbox("qVertical", "수직부재 탈형강도 1조(3개)", true)}
        ${checkbox("qHorizontal", "수평부재 탈형강도 1조(3개)", true)}
        ${checkbox("qStandard", "28일 표준양생 압축강도 1조(3개)", true)}
        ${checkbox("qReserve", "예비 공시체 1조(3개)", false)}
        ${checkbox("qEarly", "조기강도 확인 1조(3개)", false)}
      </div>
      <div id="specimenResult"></div>
    </section>

    <section class="card">
      <h3>타설 당일 현장 시험</h3>
      <div class="summary-grid">
        ${QUALITY_KNOWLEDGE.concrete.freshConcreteTests.map(x => `<article class="summary-card risk-blue"><div class="label">시험</div><p>${x}</p></article>`).join("")}
      </div>
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
    const result = calculateConcreteSpecimens({
      verticalStrip: root.querySelector("#qVertical").checked,
      horizontalStrip: root.querySelector("#qHorizontal").checked,
      standard28d: root.querySelector("#qStandard").checked,
      reserve: root.querySelector("#qReserve").checked,
      earlyStrength: root.querySelector("#qEarly").checked
    });
    root.querySelector("#specimenResult").innerHTML = renderTable(result);
    root.querySelector("#qualityBriefText").innerText = buildConcreteQualityBrief({
      verticalStrip: root.querySelector("#qVertical").checked,
      horizontalStrip: root.querySelector("#qHorizontal").checked,
      standard28d: root.querySelector("#qStandard").checked,
      reserve: root.querySelector("#qReserve").checked,
      earlyStrength: root.querySelector("#qEarly").checked
    });
  };

  root.querySelectorAll(".quality-check input").forEach(el => el.addEventListener("change", update));
  root.querySelector("#copyQualityBtn").addEventListener("click", () => {
    navigator.clipboard.writeText(root.querySelector("#qualityBriefText").innerText);
    alert("품질관리 요약을 복사했습니다.");
  });
  update();
}

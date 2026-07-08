import { registerCasting, ensureSpecimenState, getTodayQualityTasks } from "../services/specimenManager.js";

function row(t){
  return `<tr><td>${t.testDate}</td><td>${t.block||""}</td><td>${t.location||""}</td><td>${t.testType}</td><td>${t.curing}</td><td>${t.age}일</td><td>${t.qty}개</td><td>${t.status}</td></tr>`;
}

export function renderQuality(root){
  const s = ensureSpecimenState();
  const todayTasks = getTodayQualityTasks();
  root.innerHTML = `
    <div class="section-head">
      <div><h2>QUALITY · 품질관리</h2><p>타설 등록을 기준으로 공시체, 시험일정, 오늘 품질업무를 자동 생성합니다.</p></div>
      <button class="secondary-btn" onclick="window.print()">출력</button>
    </div>

    <details class="quality-accordion" open>
      <summary>오늘 품질업무</summary>
      <div class="action-list">
        ${todayTasks.length ? todayTasks.map(t=>`<label class="action-item"><input type="checkbox"><span>${t.block} ${t.location} · ${t.testType} · ${t.qty}개 · ${t.testDate}</span></label>`).join("") : "<p class='help-text'>오늘 예정된 품질시험이 없습니다.</p>"}
      </div>
    </details>

    <details class="quality-accordion" open>
      <summary>타설 등록</summary>
      <div class="form-grid">
        <label>타설일<input id="castDate" type="date" value="${new Date().toISOString().slice(0,10)}"></label>
        <label>동<input id="castBlock" placeholder="예: 101동"></label>
        <label>층<input id="castFloor" placeholder="예: 15층"></label>
        <label>부재<input id="castMember" placeholder="예: 슬래브"></label>
        <label>타설량(㎥)<input id="castVolume" type="number" value="120"></label>
        <label>설계강도<input id="castStrength" placeholder="예: 24MPa"></label>
        <label>레미콘회사<input id="castCompany" placeholder="예: ○○레미콘"></label>
        <label>배합번호<input id="castMix" placeholder="예: 24-0708-01"></label>
      </div>
      <button id="registerCastingBtn" class="primary-btn">타설 등록 및 공시체 자동 생성</button>
      <p class="help-text">기본 템플릿: 120㎥당 30개 = 수직 3 + 수평 3 + 필라서포트 3 + 표준양생 28일 9 + 현장양생 28일 9 + 예비 3.</p>
    </details>

    <details class="quality-accordion" open>
      <summary>공시체 관리대장</summary>
      <div class="table-scroll">
        <table class="quality-table">
          <thead><tr><th>시험일</th><th>동</th><th>위치</th><th>시험종류</th><th>양생</th><th>재령</th><th>수량</th><th>상태</th></tr></thead>
          <tbody>${s.tasks.map(row).join("") || "<tr><td colspan='8'>등록된 공시체가 없습니다.</td></tr>"}</tbody>
        </table>
      </div>
    </details>

    <details class="quality-accordion"><summary>레미콘 / 슬럼프 / 공기량 / 염화물</summary>
      <div class="summary-grid">
        <article class="summary-card risk-blue"><div class="label">레미콘</div><p>송장, 배합, 출하/도착/타설시간 기록</p></article>
        <article class="summary-card risk-blue"><div class="label">슬럼프</div><p>타설 전 현장시험 및 사진 기록</p></article>
        <article class="summary-card risk-blue"><div class="label">공기량</div><p>AE제 사용, 내구성, 동결융해 관련 관리</p></article>
        <article class="summary-card risk-blue"><div class="label">염화물</div><p>염화물량 시험 및 철근 부식 위험 관리</p></article>
      </div>
    </details>

    <details class="quality-accordion"><summary>균열 / 재료분리 / 양생관리</summary>
      <div class="summary-grid">
        <article class="summary-card risk-orange"><div class="label">균열</div><p>초기균열, 건조수축, 온도균열, 구조균열 구분 기록</p></article>
        <article class="summary-card risk-orange"><div class="label">재료분리</div><p>낙하고, 다짐, 이어치기, 블리딩 확인</p></article>
        <article class="summary-card risk-orange"><div class="label">양생</div><p>습윤양생, 보온, 보양포, 현장양생 공시체 관리</p></article>
      </div>
    </details>
  `;
  root.querySelector("#registerCastingBtn").addEventListener("click", () => {
    const result = registerCasting({
      castDate:root.querySelector("#castDate").value,
      block:root.querySelector("#castBlock").value,
      floor:root.querySelector("#castFloor").value,
      member:root.querySelector("#castMember").value,
      volumeM3:Number(root.querySelector("#castVolume").value),
      designStrength:root.querySelector("#castStrength").value,
      company:root.querySelector("#castCompany").value,
      mixNo:root.querySelector("#castMix").value
    });
    alert(`공시체 ${result.totalQty}개를 자동 생성했습니다.`);
    renderQuality(root);
  });
}

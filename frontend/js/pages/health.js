import { calculateCSI, CSI_RULES } from "../services/constructionStressIndex.js";

function options(list, selected){
  return list.map(x => `<option value="${x.id}" ${x.id===selected ? "selected" : ""}>${x.name}</option>`).join("");
}

function riskClass(level){
  if(level === "매우위험") return "risk-red";
  if(level === "위험") return "risk-orange";
  if(level === "주의") return "risk-yellow";
  return "risk-blue";
}

export function renderHealth(root){
  root.innerHTML = `
    <div class="section-head">
      <div>
        <h2>작업 체감위험도 · CSI</h2>
        <p>기온·습도·풍속·작업종류·작업위치를 반영해 건설현장 작업 위험도를 계산합니다.</p>
      </div>
      <button class="secondary-btn" onclick="window.print()">출력</button>
    </div>

    <section class="card">
      <h3>입력</h3>
      <div class="form-grid">
        <label>기온(℃)<input id="csiTemp" type="number" value="33"></label>
        <label>습도(%)<input id="csiHumidity" type="number" value="70"></label>
        <label>풍속(m/s)<input id="csiWind" type="number" value="1.0" step="0.1"></label>
        <label>강수(mm)<input id="csiRain" type="number" value="0" step="0.1"></label>
        <label>작업종류<select id="csiWork">${options(CSI_RULES.workTypes, "rebar")}</select></label>
        <label>작업위치<select id="csiLocation">${options(CSI_RULES.locations, "roof")}</select></label>
        <label>직사광선<select id="csiSun"><option value="true">있음</option><option value="false">없음</option></select></label>
      </div>
      <button id="calcCsiBtn" class="primary-btn">계산</button>
    </section>

    <div id="csiResult"></div>
  `;

  const renderResult = () => {
    const result = calculateCSI({
      temp: Number(root.querySelector("#csiTemp").value),
      humidity: Number(root.querySelector("#csiHumidity").value),
      wind: Number(root.querySelector("#csiWind").value),
      rain: Number(root.querySelector("#csiRain").value),
      workType: root.querySelector("#csiWork").value,
      location: root.querySelector("#csiLocation").value,
      directSun: root.querySelector("#csiSun").value === "true"
    });

    root.querySelector("#csiResult").innerHTML = `
      <section class="csi-hero ${riskClass(result.level)}">
        <div>
          <span>Construction Stress Index</span>
          <h2>${result.score}점 · ${result.level}</h2>
          <p>${result.label}</p>
        </div>
        <div class="csi-temp">
          <span>간이 체감</span>
          <strong>${result.apparent.toFixed(1)}℃</strong>
        </div>
      </section>

      <section class="card">
        <h3>현장 체감 설명</h3>
        <p class="big-recommend">${result.feeling}</p>
      </section>

      <section class="summary-grid">
        <article class="summary-card ${riskClass(result.level)}"><div class="label">관리조치</div><p>${result.action}</p></article>
        <article class="summary-card risk-blue"><div class="label">수분</div><p>${result.hydration}</p></article>
        <article class="summary-card risk-yellow"><div class="label">휴식</div><p>${result.rest}</p></article>
        <article class="summary-card risk-orange"><div class="label">작업특성</div><p>${result.workType.note}</p></article>
      </section>

      <section class="card">
        <h3>체크리스트</h3>
        <div class="action-list">
          ${result.checklist.map(x => `<label class="action-item"><input type="checkbox"><span>${x}</span></label>`).join("")}
        </div>
      </section>
    `;
  };

  root.querySelector("#calcCsiBtn").addEventListener("click", renderResult);
  renderResult();
}

import { state, saveLocal } from "../core/state.js";
import { SITE_TYPE_LIBRARY, getSiteType, buildInitialSitePlan } from "../services/siteTypeLibrary.js";
import { createSite, saveSiteProfile } from "../services/api.js";

function options(){
  return SITE_TYPE_LIBRARY.map(t => `<option value="${t.id}" ${state.siteProfile?.siteType===t.id ? "selected" : ""}>${t.name}</option>`).join("");
}

function chips(items){
  return (items || []).map(x => `<span class="plan-chip">${x}</span>`).join("");
}

export function renderSite(root){
  state.siteProfile = state.siteProfile || {};
  const profile = state.siteProfile;
  const type = getSiteType(profile.siteType || "school");
  const plan = buildInitialSitePlan(type.id);

  root.innerHTML = `
    <div class="section-head">
      <div>
        <h2>현장 생성 · 현장관리</h2>
        <p>현장 유형을 선택하면 공법·공종·위험요소·품질관리 항목을 자동 구성합니다.</p>
      </div>
      <div class="export-row">
        <button id="saveLocalSiteBtn" class="secondary-btn">로컬 저장</button>
        <button id="createServerSiteBtn" class="primary-btn">D1 현장 생성</button>
      </div>
    </div>

    <section class="card wizard-card">
      <h3>1. 현장 기본정보</h3>
      <div class="form-grid">
        <label>현장명<input id="siteNameField" value="${profile.siteName || ""}" placeholder="예: 김제초등학교 신축공사"></label>
        <label>현장코드<input id="siteCodeField" value="${profile.siteCode || ""}" placeholder="예: GIMJE-SCHOOL-001"></label>
        <label>PIN<input id="sitePinField" value="${profile.pin || ""}" placeholder="예: 1234"></label>
        <label>공사종류
          <select id="projectCategoryField">
            <option value="건축공사" ${profile.projectCategory==="건축공사"?"selected":""}>건축공사</option>
            <option value="토목공사" ${profile.projectCategory==="토목공사"?"selected":""}>토목공사</option>
            <option value="리모델링" ${profile.projectCategory==="리모델링"?"selected":""}>리모델링</option>
          </select>
        </label>
        <label>현장형태
          <select id="siteTypeField">${options()}</select>
        </label>
        <label>공사규모<input id="scaleTextField" value="${profile.scaleText || ""}" placeholder="예: 지하1층/지상4층, 연면적 8,000㎡"></label>
        <label>발주처<input id="clientNameField" value="${profile.clientName || ""}"></label>
        <label>시공사<input id="contractorNameField" value="${profile.contractorName || ""}"></label>
        <label>감리사<input id="supervisorNameField" value="${profile.supervisorName || ""}"></label>
        <label>공사기간 시작<input id="startDateField" type="date" value="${profile.startDate || ""}"></label>
        <label>공사기간 종료<input id="endDateField" type="date" value="${profile.endDate || ""}"></label>
        <label>공사금액<input id="projectAmountField" value="${profile.projectAmount || ""}" placeholder="예: 120억"></label>
      </div>
    </section>

    <section class="card">
      <h3>2. ${type.name} 현장 자동 구성</h3>
      <div class="auto-plan-grid">
        <article class="auto-plan-box risk-blue"><b>대표 공법</b><div>${chips(plan.methods)}</div></article>
        <article class="auto-plan-box risk-orange"><b>추천 공종</b><div>${chips(plan.trades)}</div></article>
        <article class="auto-plan-box risk-red"><b>주요 위험</b><div>${chips(plan.risks)}</div></article>
        <article class="auto-plan-box risk-yellow"><b>품질 중점</b><div>${chips(plan.quality)}</div></article>
      </div>
    </section>

    <section class="card">
      <h3>3. 시작 체크</h3>
      <div class="action-list">
        ${plan.quickStartTasks.map(x => `<label class="action-item"><input type="checkbox"><span>${x}</span></label>`).join("")}
      </div>
    </section>
  `;

  const collect = () => ({
    siteName: root.querySelector("#siteNameField").value.trim(),
    siteCode: root.querySelector("#siteCodeField").value.trim().toUpperCase(),
    pin: root.querySelector("#sitePinField").value.trim(),
    projectCategory: root.querySelector("#projectCategoryField").value,
    siteType: root.querySelector("#siteTypeField").value,
    scaleText: root.querySelector("#scaleTextField").value.trim(),
    clientName: root.querySelector("#clientNameField").value.trim(),
    contractorName: root.querySelector("#contractorNameField").value.trim(),
    supervisorName: root.querySelector("#supervisorNameField").value.trim(),
    startDate: root.querySelector("#startDateField").value,
    endDate: root.querySelector("#endDateField").value,
    projectAmount: root.querySelector("#projectAmountField").value.trim()
  });

  const applyLocal = () => {
    const data = collect();
    state.siteProfile = data;
    state.site = {siteCode:data.siteCode, pin:data.pin, siteName:data.siteName || "현장", siteType:data.siteType};
    state.selectedTrades = buildInitialSitePlan(data.siteType).trades.slice(0, 3);
    saveLocal();
  };

  root.querySelector("#siteTypeField").addEventListener("change", () => {
    applyLocal();
    renderSite(root);
  });

  root.querySelector("#saveLocalSiteBtn").addEventListener("click", () => {
    applyLocal();
    alert("로컬에 현장정보를 저장했습니다.");
    renderSite(root);
  });

  root.querySelector("#createServerSiteBtn").addEventListener("click", async () => {
    const data = collect();
    if(!data.siteName || !data.siteCode || !data.pin){
      alert("현장명, 현장코드, PIN은 필수입니다.");
      return;
    }
    applyLocal();
    try{
      await createSite(data);
      await saveSiteProfile(data.siteCode, data.pin, data);
      alert("D1 서버에 현장을 생성했습니다.");
    }catch(error){
      alert("D1 생성 실패: " + error.message + "\n로컬 저장은 완료되었습니다.");
    }
  });
}

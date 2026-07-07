import { state, saveLocal } from "../core/state.js";
import { getSitePreset } from "../services/siteManagement.js";
import { createSite, saveSiteProfile } from "../services/api.js";

export function renderSite(root){
  const profile = state.siteProfile || {};
  const preset = getSitePreset(profile.siteType || "school");
  root.innerHTML = `
    <div class="section-head">
      <div>
        <h2>현장관리</h2>
        <p>현장 유형을 선택하면 대표 공법·주요 공종·위험요소를 자동 추천합니다.</p>
      </div>
      <button id="saveSiteProfileBtn" class="primary-btn">현장정보 저장</button>
    </div>

    <section class="card">
      <h3>현장 기본정보</h3>
      <div class="form-grid">
        <label>현장명<input id="siteNameField" value="${profile.siteName || ""}" placeholder="예: 김제초등학교 신축공사"></label>
        <label>현장코드<input id="siteCodeField" value="${profile.siteCode || ""}" placeholder="예: GIMJE-SCHOOL-001"></label>
        <label>PIN<input id="sitePinField" value="${profile.pin || ""}" placeholder="예: 1234"></label>
        <label>현장형태
          <select id="siteTypeField">
            <option value="school" ${profile.siteType==="school"?"selected":""}>학교</option>
            <option value="apartment" ${profile.siteType==="apartment"?"selected":""}>아파트</option>
            <option value="public" ${profile.siteType==="public"?"selected":""}>공공청사</option>
            <option value="commercial" ${profile.siteType==="commercial"?"selected":""}>상가</option>
          </select>
        </label>
        <label>발주처<input id="clientNameField" value="${profile.clientName || ""}"></label>
        <label>시공사<input id="contractorNameField" value="${profile.contractorName || ""}"></label>
        <label>감리사<input id="supervisorNameField" value="${profile.supervisorName || ""}"></label>
        <label>공사기간 시작<input id="startDateField" type="date" value="${profile.startDate || ""}"></label>
        <label>공사기간 종료<input id="endDateField" type="date" value="${profile.endDate || ""}"></label>
      </div>
    </section>

    <section class="card">
      <h3>${preset.name} 현장 자동 추천</h3>
      <div class="summary-grid">
        <article class="summary-card risk-blue"><div class="label">대표 공법</div><p>${preset.methods.join(" · ")}</p></article>
        <article class="summary-card risk-orange"><div class="label">주요 공종</div><p>${preset.trades.join(" · ")}</p></article>
        <article class="summary-card risk-red"><div class="label">주요 위험</div><p>${preset.risks.join(" · ")}</p></article>
        <article class="summary-card risk-yellow"><div class="label">활용</div><p>오늘 공정 선택과 TBM, 안전·품질 체크리스트에 자동 반영됩니다.</p></article>
      </div>
    </section>
  `;

  root.querySelector("#siteTypeField").addEventListener("change", () => {
    state.siteProfile.siteType = root.querySelector("#siteTypeField").value;
    saveLocal();
    renderSite(root);
  });

  root.querySelector("#saveSiteProfileBtn").addEventListener("click", async () => {
    state.siteProfile = {
      siteName: root.querySelector("#siteNameField").value.trim(),
      siteCode: root.querySelector("#siteCodeField").value.trim(),
      pin: root.querySelector("#sitePinField").value.trim(),
      siteType: root.querySelector("#siteTypeField").value,
      clientName: root.querySelector("#clientNameField").value.trim(),
      contractorName: root.querySelector("#contractorNameField").value.trim(),
      supervisorName: root.querySelector("#supervisorNameField").value.trim(),
      startDate: root.querySelector("#startDateField").value,
      endDate: root.querySelector("#endDateField").value
    };
    state.site = {siteName: state.siteProfile.siteName || "현장", siteType: state.siteProfile.siteType};
    saveLocal();
    try{
      if(state.siteProfile.siteCode && state.siteProfile.pin && state.mode === "site"){
        await saveSiteProfile(state.siteProfile.siteCode, state.siteProfile.pin, state.siteProfile);
      }
    }catch(error){
      console.warn("D1 저장 실패, 로컬 저장 유지:", error);
    }
    alert("현장정보를 저장했습니다.");
    renderSite(root);
  });
}

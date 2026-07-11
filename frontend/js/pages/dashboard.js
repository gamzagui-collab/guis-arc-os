import { buildOsDashboard } from "../services/osCore.js";
import { state, saveLocal } from "../core/state.js";
import { buildDailyDecisionBriefing } from "../services/dailyDecisionBriefing.js";
import { buildRoleExecutionDashboard } from "../services/roleExecutionDashboard.js";
import { createSimpleAction, getSimpleActionRecords, updateSimpleActionStatus } from "../services/simpleActionFlow.js";

function riskBadge(level){ return level === "danger" ? "risk-red" : "risk-blue"; }
function esc(value){ return String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch])); }
function todayKey(){ return new Date().toLocaleDateString("sv-SE", { timeZone:"Asia/Seoul" }); }
function actionLabel(status){ return status === "완료" ? "완료됨" : status === "확인" ? "확인됨" : "확인 필요"; }
async function compressPhoto(file){
  if(!file) return "";
  const raw=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});
  const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=raw;});
  const max=1280, scale=Math.min(1,max/Math.max(img.width,img.height));
  const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
  canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
  return canvas.toDataURL("image/jpeg",.72);
}
function simpleActionPanel(){
  const works=(state.workInstances||[]).filter(x=>x.workDate===todayKey());
  const records=getSimpleActionRecords({date:todayKey()}).slice(0,6);
  return `<section class="card simple-action-center">
    <div class="simple-action-heading"><div><span class="eyebrow">PHOTO FIRST ACTION</span><h2>사진으로 현장업무 시작</h2><p>사진을 찍고 작업만 선택하세요. 시간과 기록은 자동 저장됩니다.</p></div><span class="simple-action-count">오늘 ${records.length}건</span></div>
    <div class="simple-action-main">
      <label class="photo-capture-button"><input id="simpleActionPhoto" type="file" accept="image/*" capture="environment"><span class="photo-icon">＋</span><strong>사진 찍기</strong><small>카메라 또는 사진 선택</small></label>
      <div class="simple-action-fields">
        <label>작업 연결<select id="simpleActionWork"><option value="">작업을 선택하세요</option>${works.map(w=>`<option value="${esc(w.workId)}">${esc(w.subProcess||w.title)} · ${esc(w.location||"위치 미입력")}</option>`).join("")}</select></label>
        <label>무엇을 했나요<select id="simpleActionType"><option>위험사항 발견</option><option>현장확인</option><option>조치사진</option><option>완료사진</option><option>품질확인</option><option>공사진행</option></select></label>
        <label class="simple-action-note">짧은 설명 <input id="simpleActionNote" placeholder="선택사항 · 음성입력도 사용 가능"></label>
        <button id="saveSimpleAction" class="primary-btn simple-action-save" disabled>사진을 먼저 찍어주세요</button>
      </div>
      <div id="simpleActionPreview" class="simple-action-preview"><span>사진 미선택</span></div>
    </div>
    <details class="simple-detail-section simple-action-history"><summary>오늘 기록 자세히 보기</summary><div class="simple-action-list">${records.map(row=>`<article class="simple-action-record status-${esc(row.status)}">${row.photoDataUrl?`<img src="${row.photoDataUrl}" alt="현장 기록 사진">`:'<div class="no-photo">사진</div>'}<div><span>${esc(row.actionType)} · ${esc(row.workId==="UNLINKED"?"작업 미연결":row.workId)}</span><b>${esc(row.note||"설명 없이 저장")}</b><small>${new Date(row.createdAt).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"})} · ${actionLabel(row.status)}</small></div><div class="record-actions">${row.status==="확인대기"?`<button data-action-confirm="${esc(row.actionId)}">확인</button>`:""}${row.status!=="완료"?`<button class="complete" data-action-complete="${esc(row.actionId)}">완료</button>`:"<strong>✓ 완료</strong>"}</div></article>`).join("")||'<div class="simple-all-done">오늘 저장된 현장 기록이 없습니다.</div>'}</div></details>
  </section>`;
}


export function renderDashboard(root){
  const d = buildOsDashboard();
  const briefing = buildDailyDecisionBriefing();
  const roleDashboard = buildRoleExecutionDashboard();
  root.innerHTML = `
    <section class="os-hero">
      <div>
        <span class="eyebrow">Construction Site Operating System</span>
        <h2>${d.siteName}</h2>
        <p>${d.today} · ${d.siteType} · 07:00~17:00 작업 기준</p>
      </div>
      <div class="os-risk">
        <span>오늘 위험도</span>
        <strong>${d.critical.some(x=>x.level==="danger") ? "주의" : "정상"}</strong>
      </div>
    </section>

    
    ${state.uiSimpleMode !== false ? simpleActionPanel() : ""}

    ${(!state.siteProfile?.siteName && !state.site?.siteName) ? `
      <section class="card risk-yellow">
        <h3>현장정보를 먼저 등록하세요</h3>
        <p>현장관리 탭에서 현장명, 현장형태, 공사규모를 입력하면 공종·위험·품질관리 항목이 자동 구성됩니다.</p>
      </section>
    ` : ""}

    <section class="card decision-briefing ${briefing.urgent.length ? "has-urgent" : briefing.caution.length ? "has-caution" : "is-ready"}">
      <div class="decision-briefing-head">
        <div><span class="eyebrow">TODAY DECISION BRIEFING</span><h2>오늘 의사결정 브리핑</h2><p>${briefing.headline}</p></div>
        <div class="decision-readiness"><strong>${briefing.averageReadiness}</strong><span>평균 준비도</span></div>
      </div>
      <div class="decision-kpi-grid">
        <article><span>전체 작업</span><strong>${briefing.ranked.length}</strong></article>
        <article class="danger"><span>긴급</span><strong>${briefing.urgent.length}</strong></article>
        <article class="warn"><span>주의</span><strong>${briefing.caution.length}</strong></article>
        <article class="ok"><span>정상</span><strong>${briefing.normal.length}</strong></article>
      </div>
      ${briefing.top ? `<div class="decision-top-work"><div><b>1순위 · ${briefing.top.work.workId}</b><strong>${briefing.top.work.subProcess||briefing.top.work.title}</strong><p>${(briefing.top.evaluation.reasons||[]).slice(0,3).join(" · ") || "필수 준비사항 충족"}</p></div><button class="primary-btn" data-open-page="workHubPage">WORK HUB에서 조치</button></div>` : ""}
      <div class="decision-action-grid">${briefing.actions.map(x=>`<article><span>${x.owner}</span><strong>${x.reason}</strong><p>${x.count}개 작업 · ${x.highestLevel}</p></article>`).join("") || '<p class="help-text">현재 자동 조치대상이 없습니다.</p>'}</div>
    </section>

    <section class="card role-execution-board">
      <div class="section-head"><div><span class="eyebrow">ROLE EXECUTION DASHBOARD</span><h2>역할별 지금 해야 할 일</h2><p>같은 Work ID에서 담당자별 미조치 항목만 우선 표시합니다.</p></div><div class="role-execution-summary"><b>${roleDashboard.total}</b><span>전체 실행항목</span><em>${roleDashboard.critical} 긴급</em></div></div>
      <div class="role-execution-grid">
        ${roleDashboard.roles.map(role=>`<article class="role-execution-card ${role.critical?'has-critical':role.items.length?'has-work':'is-clear'}"><header><div><span>${role.label}</span><h3>${role.role}</h3></div><b>${role.items.length}</b></header><div class="role-action-list">${role.items.slice(0,4).map((item,index)=>`<button class="role-action-item ${item.severity}" data-role-page="${item.targetPage}" data-role-work="${item.workId}" data-role-date="${item.workDate}"><span>${index+1}</span><div><b>${item.title}</b><strong>${item.workTitle}</strong><small>${[item.startTime,item.location,item.workId].filter(Boolean).join(' · ')}</small><p>${item.detail}</p></div></button>`).join('') || '<p class="role-clear-message">현재 우선 실행항목이 없습니다.</p>'}</div>${role.items.length>4?`<small class="role-more">외 ${role.items.length-4}건 · 담당 탭에서 계속 확인</small>`:''}<button class="secondary-btn role-open-page" data-role-page="${role.page}">${role.role} 열기</button></article>`).join('')}
      </div>
    </section>

    <section class="os-command-grid">
      <article class="command-card command-red"><span>AI 브리핑</span><strong>${d.ai.accidentTop5[0] || "기본 안전관리"}</strong><p>${d.ai.qualityTop3[0] || "품질 중점사항을 확인하세요."}</p></article>
      <article class="command-card command-blue"><span>날씨 · 작업 체감위험</span><strong>체감 ${d.weather.maxApparent.toFixed(1)}℃</strong><p>강수 ${d.weather.maxRain.toFixed(1)}mm · 풍속 ${d.weather.maxWind.toFixed(1)}m/s</p></article>
      <article class="command-card command-orange"><span>오늘 일정</span><strong>${d.todaySchedules.length}건</strong><p>${d.todaySchedules.map(x=>x.type + " " + x.title).join(" · ") || "오늘 등록된 일정 없음"}</p></article>
      <article class="command-card command-green"><span>선택 공정</span><strong>${(state.selectedTrades || []).length}건</strong><p>${(state.selectedTrades || []).join(" · ") || "공정을 선택하세요."}</p></article>
    </section>

    <section class="card">
      <div class="section-head"><div><h2>오늘 집중관리</h2><p>현장소장·안전·공사·품질 담당자가 먼저 확인할 항목입니다.</p></div><button class="secondary-btn" onclick="window.print()">출력</button></div>
      <div class="summary-grid">${d.critical.map(x => `<article class="summary-card ${riskBadge(x.level)}"><div class="label">${x.title}</div><p>${x.text}</p></article>`).join("")}</div>
    </section>

    <section class="card"><h3>오늘 기본 체크</h3><div class="action-list">${d.quickTasks.map(x => `<label class="action-item"><input type="checkbox"><span>${x}</span></label>`).join("")}</div></section>

    <section class="card">
      <h3>AI 현장비서 요약</h3>
      <div class="summary-grid">
        <article class="summary-card risk-red"><div class="label">사고위험 TOP5</div><ul>${d.ai.accidentTop5.map(x=>`<li>${x}</li>`).join("")}</ul></article>
        <article class="summary-card risk-orange"><div class="label">품질 TOP3</div><ul>${d.ai.qualityTop3.map(x=>`<li>${x}</li>`).join("")}</ul></article>
        <article class="summary-card risk-yellow"><div class="label">감리지적 TOP3</div><ul>${d.ai.inspectionTop3.map(x=>`<li>${x}</li>`).join("")}</ul></article>
        <article class="summary-card risk-blue"><div class="label">다음 행동</div><p>AI 현장비서 탭에서 역할별 할 일과 TBM 문구를 복사하세요.</p></article>
      </div>
    </section>
  `;
  let pendingPhoto="";
  let pendingPhotoName="";
  const photoInput=root.querySelector("#simpleActionPhoto");
  const saveActionBtn=root.querySelector("#saveSimpleAction");
  photoInput?.addEventListener("change", async()=>{
    const file=photoInput.files?.[0]; if(!file) return;
    pendingPhotoName=file.name||`현장사진-${Date.now()}.jpg`;
    pendingPhoto=await compressPhoto(file);
    const preview=root.querySelector("#simpleActionPreview");
    if(preview) preview.innerHTML=`<img src="${pendingPhoto}" alt="선택한 현장 사진"><span>사진 준비 완료</span>`;
    if(saveActionBtn){saveActionBtn.disabled=false;saveActionBtn.textContent="확인하고 저장";}
  });
  saveActionBtn?.addEventListener("click",()=>{
    if(!pendingPhoto) return;
    createSimpleAction({workId:root.querySelector("#simpleActionWork")?.value||"",actionType:root.querySelector("#simpleActionType")?.value||"현장확인",note:root.querySelector("#simpleActionNote")?.value||"",photoDataUrl:pendingPhoto,photoName:pendingPhotoName});
    renderDashboard(root);
  });
  root.querySelectorAll("[data-action-confirm]").forEach(btn=>btn.addEventListener("click",()=>{updateSimpleActionStatus(btn.dataset.actionConfirm,"확인");renderDashboard(root);}));
  root.querySelectorAll("[data-action-complete]").forEach(btn=>btn.addEventListener("click",()=>{updateSimpleActionStatus(btn.dataset.actionComplete,"완료");renderDashboard(root);}));

  root.querySelectorAll("[data-open-page]").forEach(btn => btn.addEventListener("click", () => {
    document.querySelector(`.main-tabs .tab[data-page="${btn.dataset.openPage}"]`)?.click();
  }));
  root.querySelectorAll("[data-role-page]").forEach(btn => btn.addEventListener("click", () => {
    const workId=btn.dataset.roleWork||"";
    if(workId){ state.workHubSelectedId=workId; state.workHubDate=btn.dataset.roleDate||roleDashboard.date; state.focusWorkId=workId; saveLocal(); }
    document.querySelector(`.main-tabs .tab[data-page="${btn.dataset.rolePage}"]`)?.click();
    if(workId) requestAnimationFrame(()=>document.querySelector(`[data-work-id="${workId}"]`)?.scrollIntoView({behavior:"smooth",block:"center"}));
  }));
}

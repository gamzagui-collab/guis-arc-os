import { state, saveLocal } from "../core/state.js";
import { ensureWorkInstanceStore, tasksForWork, todayYmd } from "../services/workInstanceDatabase.js";
import { auditWorkInstance } from "../services/complianceAudit.js";
import { ensureEvidenceState, evidenceFor } from "../services/evidenceManagement.js";
import { ensureQualityState } from "../services/qualityManagement.js";
import { ensureConstructionState } from "../services/constructionManagement.js";
import { ensureResourceState } from "../services/resourceManagement.js";
import { evaluateWorkPriority, rankWorks } from "../services/workPriorityEngine.js";
import { ensureDirectorInstructionState, instructionForWork, updateDirectorInstruction, targetPageForInstruction, instructionTiming } from "../services/directorInstructions.js";
import { evaluateWorkStartConditions } from "../services/workStartConditionEngine.js";

const esc=v=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const done=t=>t?.status==="완료"||((t?.items||[]).length>0&&(t.items||[]).every((_,i)=>Boolean(t.checkedItems?.[i])));
function gotoPage(page){document.querySelector(`.main-tabs .tab[data-page='${page}']`)?.click();}
function ensureHubState(){ensureWorkInstanceStore();ensureEvidenceState();ensureQualityState();ensureConstructionState();ensureResourceState();ensureDirectorInstructionState();state.workHubDate=state.workHubDate||todayYmd();state.workHubSelectedId=state.workHubSelectedId||"";}
function summary(work){
 const audit=auditWorkInstance(work), priority=evaluateWorkPriority(work), start=evaluateWorkStartConditions(work), tasks=tasksForWork(work.workId), evidence=evidenceFor(work.workId);
 const quality=tasks.filter(x=>x.type==="QUALITY_CHECK"), construction=tasks.filter(x=>x.type==="CONSTRUCTION_CHECK"), instructions=instructionForWork(work.workId);
 const resources=(state.workResources||[]).filter(x=>x.workId===work.workId), equipment=resources.filter(x=>x.type==="장비");
 const inspection=(state.constructionInspections||[]).find(x=>x.workId===work.workId);
 const constructionRecord=(state.constructionRecords||[]).find(x=>x.workId===work.workId);
 return {audit,priority,start,tasks,evidence,quality,construction,instructions,resources,equipment,inspection,constructionRecord,
   taskDone:tasks.filter(done).length, qualityDone:quality.filter(done).length, constructionDone:construction.filter(done).length,
   resourceReady:resources.filter(x=>["준비완료","사용중","반출완료"].includes(x.status)).length};
}
function meter(label,value,total,page){const pct=total?Math.round(value/total*100):0;return `<button class="work-hub-meter" data-go="${page}"><span><b>${esc(label)}</b><em>${value}/${total}</em></span><i><u style="width:${pct}%"></u></i></button>`;}
function detail(work){
 const s=summary(work), a=s.audit, p=s.priority;
 if(state.uiSimpleMode!==false){
  const next=a.openMissing?.slice(0,4)||[];
  return `<section class="work-hub-detail simple-hub-detail">
   <header><div><span class="work-id-chip">작업 상세</span><h3>${esc(work.subProcess||work.title)}</h3><p>${esc([work.workDate,work.location,work.startTime].filter(Boolean).join(" · ")||"세부정보 미입력")}</p></div><span class="hub-health ${a.openMissing.length?'danger':'ok'}">${a.openMissing.length?`확인 ${a.openMissing.length}건`:'준비 완료'}</span></header>
   <section class="start-gate-simple status-${s.start.status.replaceAll(" ","-")}"><div><span>작업 시작판정</span><strong>${esc(s.start.status)}</strong></div><p>필수조건 ${s.start.completed}/${s.start.total} 완료 · 시작 준비 ${s.start.readiness}%</p></section>
   <section class="simple-next-actions"><div class="card-title-row"><div><h4>${s.start.blockingCount?"시작 전 확인할 일":"지금 확인할 일"}</h4><p>${s.start.blockingCount?"아래 필수조건을 완료한 뒤 작업을 시작하세요.":"중요 준비사항이 완료되었습니다."}</p></div></div>${s.start.blocking.slice(0,5).map(c=>`<button class="simple-action-row" data-go="${esc(c.targetPage)}"><span class="simple-action-mark">!</span><span><b>${esc(c.title)}</b><small>${esc(c.ownerRole)} · ${esc(c.detail)}</small></span><strong>열기</strong></button>`).join("")||next.map(c=>`<button class="simple-action-row" data-go="${esc(c.targetPage)}"><span class="simple-action-mark">!</span><span><b>${esc(c.title)}</b><small>${esc(c.target)}에서 확인</small></span><strong>열기</strong></button>`).join("")||'<div class="simple-all-done">✓ 작업을 시작할 수 있습니다.</div>'}</section>
   <section class="simple-hub-buttons"><button class="primary-btn" data-go="todayPage">오늘업무 열기</button><button class="secondary-btn" data-go="safetyPage">안전</button><button class="secondary-btn" data-go="qualityPage">품질</button><button class="secondary-btn" data-go="constructionPage">공사</button><button class="secondary-btn" data-go="resourcePage">자재·장비</button></section>
   <details class="simple-detail-section"><summary>전체 관리상태 자세히 보기</summary><div class="simple-status-grid">${meter("전체 업무",s.taskDone,s.tasks.length,"todayPage")}${meter("품질",s.qualityDone,s.quality.length,"qualityPage")}${meter("공사",s.constructionDone,s.construction.length,"constructionPage")}${meter("자재·장비",s.resourceReady,s.resources.length,"resourcePage")}</div><div class="simple-record-summary"><span>현장소장 지시 <b>${s.instructions.filter(x=>x.status!=="완료").length}건</b></span><span>증빙 <b>${s.evidence.length}건</b></span><span>공사 검측 <b>${esc(s.inspection?.status||"미요청")}</b></span></div></details>
  </section>`;
 }
 return `<section class="work-hub-detail">
  <header><div><span class="work-id-chip">${esc(work.workId)}</span><h3>${esc(work.subProcess||work.title)}</h3><p>${esc([work.workDate,work.location,work.contractor,work.workers?`${work.workers}명`:""].filter(Boolean).join(" · ")||"세부정보 미입력")}</p></div><span class="hub-health ${a.openMissing.length?'danger':'ok'}">${a.openMissing.length?`미조치 ${a.openMissing.length}건`:'정상'}</span></header>
  <section class="hub-priority-panel ${p.level}"><div><span class="eyebrow">AI PRIORITY</span><h4>${esc(p.level)} · 준비도 ${p.readiness}%</h4><p>${esc(p.reasons.slice(0,4).join(" · ")||"필수 준비사항이 충족되었습니다.")}</p></div><div class="hub-score"><b>${p.priorityScore}</b><span>우선점수</span></div></section>
  <section class="start-condition-panel status-${s.start.status.replaceAll(" ","-")}"><header><div><span class="eyebrow">START GATE</span><h4>${esc(s.start.status)} · ${s.start.readiness}%</h4><p>필수조건 ${s.start.completed}/${s.start.total} 완료</p></div><b>${s.start.blockingCount}건 확인</b></header><div class="start-condition-list">${s.start.conditions.map(c=>`<button data-go="${esc(c.targetPage)}" class="start-condition-row ${c.ok?'done':'blocked'}"><span>${c.ok?'✓':'!'}</span><div><b>${esc(c.title)}</b><small>${esc(c.ownerRole)} · ${esc(c.detail)}</small></div><em>${c.ok?'완료':'확인'}</em></button>`).join("")||'<p>시작조건 없음</p>'}</div></section>
  <div class="work-hub-meters">
   ${meter("통합 Task",s.taskDone,s.tasks.length,"todayPage")}
   ${meter("품질체크",s.qualityDone,s.quality.length,"qualityPage")}
   ${meter("공사체크",s.constructionDone,s.construction.length,"constructionPage")}
   ${meter("자재·장비 준비",s.resourceReady,s.resources.length,"resourcePage")}
  </div>
  <div class="work-hub-grid">
   <article><h4>안전·누락 상태</h4>${a.checks.map(c=>`<div class="hub-row"><span>${c.ok?'✓':'!'} ${esc(c.title)}</span><b class="${c.ok?'ok':'danger'}">${c.ok?'완료':esc(c.action?.status||'미조치')}</b></div>`).join("")||'<p>검사항목 없음</p>'}<button class="secondary-btn" data-go="safetyPage">안전관리 열기</button></article>
   <article><h4>품질관리</h4><div class="hub-row"><span>검측 협조상태</span><b>${esc(s.inspection?.status||"미요청")}</b></div><div class="hub-row"><span>공시체</span><b>${(state.specimenTasks||[]).filter(x=>x.workId===work.workId).length}건</b></div><div class="hub-row"><span>품질 Task</span><b>${s.qualityDone}/${s.quality.length}</b></div><button class="secondary-btn" data-go="qualityPage">품질관리 열기</button></article>
   <article><h4>공사관리</h4><div class="hub-row"><span>검측</span><b>${esc(s.inspection?.status||"미요청")}</b></div><div class="hub-row"><span>진행상태</span><b>${esc(s.constructionRecord?.status||"준비")}</b></div><div class="hub-row"><span>도면 확인</span><b>${(state.constructionDrawings||[]).filter(x=>x.workId===work.workId&&x.confirmed).length}건</b></div><div class="hub-row"><span>인수인계</span><b>${(state.constructionHandovers||[]).filter(x=>x.workId===work.workId).length}건</b></div><button class="secondary-btn" data-go="constructionPage">공사관리 열기</button></article>
   <article><h4>자재·장비</h4><div class="hub-row"><span>전체 자원</span><b>${s.resources.length}건</b></div><div class="hub-row"><span>장비 점검</span><b>${s.equipment.filter(x=>x.inspection).length}/${s.equipment.length}</b></div><div class="hub-row"><span>준비완료 이상</span><b>${s.resourceReady}건</b></div><button class="secondary-btn" data-go="resourcePage">자재·장비 열기</button></article>
   <article class="wide hub-command-panel"><h4>현장소장 지시·조치</h4><div class="hub-row"><span>전체 지시</span><b>${s.instructions.length}건 · 미완료 ${s.instructions.filter(x=>x.status!=="완료").length}건</b></div><div class="hub-command-list">${s.instructions.map(x=>{const timing=instructionTiming(x);return `<div class="hub-command-row status-${esc(x.status)} timing-${esc(timing.level)}"><div><span>${esc(x.priority)} · ${esc(x.role)} <em class="command-timing ${esc(timing.level)}">${esc(timing.label)}</em></span><b>${esc(x.text)}</b><small>${esc([x.assignee||"담당자 미지정",x.dueDate,x.dueTime].filter(Boolean).join(" · "))}</small></div><select data-hub-command-status="${esc(x.instructionId)}"><option ${x.status==="지시"?"selected":""}>지시</option><option ${x.status==="진행"?"selected":""}>진행</option><option ${x.status==="완료"?"selected":""}>완료</option><option ${x.status==="보류"?"selected":""}>보류</option></select><button class="secondary-btn small" data-command-target="${esc(targetPageForInstruction(x))}">담당화면</button></div>`}).join("")||'<p>등록된 현장소장 지시가 없습니다.</p>'}</div></article>
   <article class="wide"><h4>증빙·결재</h4><div class="hub-row"><span>통합 증빙</span><b>${s.evidence.length}건</b></div><div class="hub-evidence">${s.evidence.slice(-8).reverse().map(e=>`<span>${esc(e.type)} · ${esc(e.name)}${e.author?` · ${esc(e.author)}`:""}</span>`).join("")||'<p>등록된 증빙이 없습니다.</p>'}</div></article>
  </div>
 </section>`;
}
export function renderWorkHub(root){
 ensureHubState();const date=state.workHubDate;const ranked=rankWorks((state.workInstances||[]).filter(x=>x.workDate===date));const works=ranked.map(x=>x.work);if(!works.some(x=>x.workId===state.workHubSelectedId))state.workHubSelectedId=works[0]?.workId||"";const selected=works.find(x=>x.workId===state.workHubSelectedId);
 root.innerHTML=`<div class="section-head"><div><h2>${state.uiSimpleMode!==false?"작업별 준비상태":"WORK HUB · 통합 작업 상세"}</h2><p>${state.uiSimpleMode!==false?"작업을 선택하면 지금 확인할 일만 먼저 보여드립니다.":"하나의 Work ID에서 안전·품질·공사·자재·장비·증빙 상태를 함께 확인합니다."}</p></div><label>작업일<input id="hubDate" type="date" value="${esc(date)}"></label></div>
 <section class="work-hub-layout"><aside class="work-hub-list"><div class="card-title-row"><div><span class="eyebrow">WORK INSTANCES</span><h3>${esc(date)} 작업 ${works.length}건</h3></div></div>${ranked.map(({work:w,evaluation:p},index)=>`<button class="work-hub-item ${w.workId===state.workHubSelectedId?'active':''}" data-work="${esc(w.workId)}"><span><strong>${index+1}순위</strong>${state.uiSimpleMode===false?` · ${esc(w.workId)}`:""}</span><b>${esc(w.subProcess||w.title)}</b><small>${esc([w.startTime,w.location||"위치 미입력"].filter(Boolean).join(" · "))}</small><em class="priority-${p.level}">${state.uiSimpleMode!==false?`${esc(evaluateWorkStartConditions(w).status)} · ${evaluateWorkStartConditions(w).readiness}%`:`${esc(p.level)} · 준비도 ${p.readiness}%`}</em></button>`).join("")||'<p class="help-text">선택한 날짜에 등록된 작업이 없습니다.</p>'}</aside><main>${selected?detail(selected):'<section class="card"><h3>작업을 등록하세요</h3><p>일정 또는 오늘업무에서 작업을 등록하면 통합 작업 상세가 생성됩니다.</p></section>'}</main></section>`;
 root.querySelector("#hubDate")?.addEventListener("change",e=>{state.workHubDate=e.target.value;state.workHubSelectedId="";saveLocal();renderWorkHub(root);});
 root.querySelectorAll("[data-work]").forEach(b=>b.addEventListener("click",()=>{state.workHubSelectedId=b.dataset.work;saveLocal();renderWorkHub(root);}));
 root.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>gotoPage(b.dataset.go)));
 root.querySelectorAll("[data-hub-command-status]").forEach(el=>el.addEventListener("change",()=>{updateDirectorInstruction(el.dataset.hubCommandStatus,{status:el.value});renderWorkHub(root);}));
 root.querySelectorAll("[data-command-target]").forEach(b=>b.addEventListener("click",()=>gotoPage(b.dataset.commandTarget)));
}

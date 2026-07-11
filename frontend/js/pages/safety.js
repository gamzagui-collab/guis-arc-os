import { state, saveLocal } from "../core/state.js";
import { buildSafetyDashboard, buildSafetyMonthlyReport, markSafetyRoutineDone, resetSafetyRoutineDone } from "../services/safetyManagement.js";
import { APP_VERSION } from "../services/version.js";
import { buildComplianceAudit, setComplianceAction } from "../services/complianceAudit.js";
import { addWorkEvidence, setWorkApproval } from "../services/evidenceManagement.js";
import { DEFAULT_MORNING_SAFETY_CARDS, SAFETY_PROCESS_CHECKLIST_DB, SERIOUS_ACCIDENT_13_CARDS, CRITICAL_EVIDENCE_PRIORITY_DB, COMPLIANCE_CORE_DB, INVESTIGATION_FLOW_DB } from "../data/safetyChecklistDatabase.js";

function escapeHtml(value){
  return String(value ?? "").replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
}
function levelClass(level){
  if(level === "danger") return "risk-red";
  if(level === "warn") return "risk-orange";
  if(level === "safe") return "risk-blue";
  return "risk-yellow";
}
function todayKey(){ return new Date().toLocaleDateString("sv-SE", { timeZone:"Asia/Seoul" }); }
function ensureSafetyState(){
  state.safetyChecks = state.safetyChecks || {};
  state.safetyEvidence = state.safetyEvidence || {};
  state.safetyCustomCards = state.safetyCustomCards || [];
  state.safetySelectedProcessIds = state.safetySelectedProcessIds || ["process-rc-form", "process-rc-rebar", "process-rc-concrete", "process-scaffold", "process-crane"];
  state.safetyDiaryUploads = state.safetyDiaryUploads || {};
  state.safetyDiaryCounts = state.safetyDiaryCounts || {};
  state.safetyHazards = state.safetyHazards || {};
  state.safetyDiaryChecks = state.safetyDiaryChecks || {};
  state.safetyJournalMeta = state.safetyJournalMeta || {};
  state.safetyTbmExtras = state.safetyTbmExtras || {};
  state.safetyTodayCustomTasks = (state.safetyTodayCustomTasks && typeof state.safetyTodayCustomTasks === "object" && !Array.isArray(state.safetyTodayCustomTasks))
    ? state.safetyTodayCustomTasks
    : {};
  state.safetyRoutineHistory = (state.safetyRoutineHistory && typeof state.safetyRoutineHistory === "object" && !Array.isArray(state.safetyRoutineHistory)) ? state.safetyRoutineHistory : {};
  state.safetyRoutineNotes = (state.safetyRoutineNotes && typeof state.safetyRoutineNotes === "object" && !Array.isArray(state.safetyRoutineNotes)) ? state.safetyRoutineNotes : {};
  state.safetyRoutineRecords = (state.safetyRoutineRecords && typeof state.safetyRoutineRecords === "object" && !Array.isArray(state.safetyRoutineRecords)) ? state.safetyRoutineRecords : {};
  state.safetyAccordionOpen = (state.safetyAccordionOpen && typeof state.safetyAccordionOpen === "object" && !Array.isArray(state.safetyAccordionOpen)) ? state.safetyAccordionOpen : {};
}

const ROUTINE_DOCUMENT_IDS = new Set([
  "daily-tbm", "weekly-risk", "weekly-equipment", "weekly-contractor",
  "biweekly-inspection", "biweekly-highrisk", "twice-monthly-doc",
  "monthly-education", "monthly-risk", "monthly-safety-cost", "monthly-msds",
  "bimonthly-labor-management", "quarter-osh-committee", "half-major-law",
  "annual-plan", "annual-manager-training", "annual-emergency-drill"
]);
function isRoutineDocumentDuty(item){ return ROUTINE_DOCUMENT_IDS.has(item?.id); }
const ROUTINE_DOCUMENT_GUIDE = {
  "daily-tbm": {purpose:"작업 시작 전에 금일 작업·위험요인·안전조치를 작업자에게 공유했다는 기록입니다.", method:"작업반별 작업내용, 핵심 위험요인, 조치사항, 참석인원을 기록하고 참석자 서명 또는 별도 TBM 참석명부를 함께 보관합니다.", required:"TBM 일지, 참석자 명부, 전달사항, 필요 시 사진", omission:"날씨·고위험 작업 내용 누락, 실제 참석인원과 기록 인원 불일치, 사후 일괄작성"},
  "weekly-risk": {purpose:"위험성평가에서 정한 감소대책이 현장에서 실제로 이행되는지 확인하는 기록입니다.", method:"미조치 위험요인, 담당자, 조치기한, 완료 여부를 갱신하고 조치 전·후 사진과 회의 내용을 연결합니다.", required:"주간 이행점검표, 개선조치대장, 회의록, 전·후 사진", omission:"평가서만 있고 개선조치 완료 증빙이 없음, 담당자·기한 누락"},
  "weekly-equipment": {purpose:"장비·가설재·안전시설의 정기 상태를 확인하고 결함을 추적하기 위한 서류입니다.", method:"대상 장비와 시설을 구분해 점검하고 불량사항은 사용중지·보수·재점검 결과까지 기록합니다.", required:"장비점검표, 가설시설 점검표, 안전시설 사진", omission:"점검자 서명 누락, 불량사항을 적고 조치완료 확인이 없음"},
  "weekly-contractor": {purpose:"협력업체에 위험정보와 지적사항을 공식 전달하고 이행책임을 명확히 하는 회의기록입니다.", method:"업체별 위험공종, 지적사항, 담당자, 완료기한을 기록하고 다음 회의에서 조치결과를 확인합니다.", required:"안전회의록, 참석자명부, 지시사항 이행대장", omission:"참석자·협력업체 확인 누락, 이전 지적사항의 후속확인 없음"},
  "biweekly-inspection": {purpose:"원·하청이 함께 현장을 점검했다는 사실과 반복위험의 개선 흐름을 남기는 기록입니다.", method:"합동점검 참여자, 점검구역, 지적사항, 책임자, 조치기한, 완료사진을 한 묶음으로 관리합니다.", required:"합동점검표, 참석자명부, 조치결과 사진", omission:"지적사항만 있고 완료일·확인자가 없음"},
  "biweekly-highrisk": {purpose:"고위험 작업의 특별교육·작업계획·허가서가 최신 작업조건과 일치하는지 확인합니다.", method:"작업 변경사항이 있으면 교육과 계획서를 갱신하고 작업자·장비·작업순서를 실제 현장과 대조합니다.", required:"특별교육일지, 작업계획서, 작업허가서, 참석자 서명", omission:"다른 현장 양식 복사, 작업위치·장비·인원 변경 미반영"},
  "twice-monthly-doc": {purpose:"분산된 교육·점검·허가 서류의 누락과 서명 오류를 정기적으로 정리하기 위한 내부 점검기록입니다.", method:"기간 내 작성대상 목록과 실제 보관서류를 대조하고 누락·미서명·사진부족 항목에 보완기한을 지정합니다.", required:"서류점검표, 누락목록, 보완완료 확인", omission:"체크만 하고 보완결과를 남기지 않음"},
  "monthly-education": {purpose:"근로자 정기안전보건교육을 실시하고 교육내용·시간·참석자를 입증하는 서류입니다.", method:"대상자와 법정시간을 확인한 뒤 교육내용, 강사, 일시, 참석자 서명, 교육사진을 보관합니다.", required:"교육일지, 교육자료, 참석자명부, 사진", omission:"교육시간 부족, 참석자 서명 누락, 현장 작업과 무관한 교육내용"},
  "monthly-risk": {purpose:"월간 예정 공종과 반복작업의 위험요인·감소대책을 체계적으로 정리하는 기록입니다.", method:"예정 공정표와 연계해 위험요인, 대책, 담당자, 기한을 정하고 TBM·점검·개선조치 자료와 연결합니다.", required:"월간 위험성평가표, 개선대책, 참석자 서명, 조치사진", omission:"공종 누락, 대책이 추상적임, 현장 이행자료와 연결되지 않음"},
  "monthly-safety-cost": {purpose:"산업안전보건관리비가 허용 목적에 적정하게 사용되었음을 입증합니다.", method:"품목·금액·사용일·사용장소를 정리하고 세금계산서와 현장 설치·지급 사진을 연결합니다.", required:"사용내역서, 세금계산서, 거래명세서, 설치·지급 사진", omission:"증빙과 현장사진 불일치, 허용항목 여부 미확인"},
  "monthly-msds": {purpose:"현장 화학물질의 MSDS 비치·경고표지·교육 상태를 최신으로 유지합니다.", method:"반입목록과 MSDS를 대조하고 신규물질 교육, 용기표지, 보관장소를 확인합니다.", required:"MSDS 목록, 최신 MSDS, 교육일지, 비치·표지 사진", omission:"폐기물질이 목록에 남음, 신규 반입물질 교육 누락"},
  "bimonthly-labor-management": {purpose:"법정 대상 현장의 노사협의체 논의와 의결사항을 공식 보존합니다.", method:"안건, 참석자, 논의내용, 의결사항, 담당자, 이행기한을 회의록에 기록하고 후속조치를 관리합니다.", required:"회의록, 참석자명부, 의결사항 이행자료", omission:"정족수·참석자 누락, 의결사항 후속조치 미관리"},
  "quarter-osh-committee": {purpose:"산업안전보건위원회 대상 사업장의 분기별 심의·의결 내용을 보존합니다.", method:"법정 심의안건을 준비하고 근로자·사용자위원 참석, 의결사항과 이행결과를 기록합니다.", required:"위원회 회의록, 참석명부, 안건자료, 이행결과", omission:"법정 안건 누락, 회의록 서명·보존 미흡"},
  "half-major-law": {purpose:"안전·보건 관계 법령 의무가 실제로 이행되는지 반기 단위로 점검하는 핵심 증거입니다.", method:"의무 목록, 담당부서, 이행자료, 미이행 사유, 개선기한을 경영책임자에게 보고하고 완료까지 추적합니다.", required:"반기 의무이행 점검표, 보고서, 개선조치 결과", omission:"체크만 있고 근거자료·개선완료 확인이 없음"},
  "annual-plan": {purpose:"연간 안전보건 목표·예산·교육·점검 계획을 수립해 관리방향을 명확히 합니다.", method:"공사일정과 주요 위험공종을 반영해 월별 실행계획, 담당자, 예산, 성과지표를 설정합니다.", required:"연간 안전보건계획서, 교육계획표, 예산계획", omission:"현장 공정과 무관한 일반계획, 담당자·기한 없음"},
  "annual-manager-training": {purpose:"관리감독자의 법정교육 이수 여부와 현장 역할 수행 역량을 관리합니다.", method:"대상자 명단, 교육시간, 이수증 유효성을 확인하고 미이수자는 교육계획을 등록합니다.", required:"이수증, 교육대장, 대상자명단", omission:"퇴직자·신규자 명단 미갱신, 교육시간 확인 누락"},
  "annual-emergency-drill": {purpose:"화재·붕괴·질식 등 비상상황의 대응절차가 실제로 작동하는지 검증합니다.", method:"시나리오, 역할, 대피경로, 연락체계를 정해 훈련하고 문제점과 개선조치를 결과보고서에 남깁니다.", required:"훈련계획, 참석자명부, 사진, 결과보고서, 개선조치", omission:"사진만 있고 평가·개선내용 없음"}
};

function cardKey(id){ return `${todayKey()}:${id}`; }
function isChecked(cardId, idx){ ensureSafetyState(); return Boolean(state.safetyChecks[`${cardKey(cardId)}:${idx}`]); }
function evidenceList(cardId){ ensureSafetyState(); return state.safetyEvidence[cardKey(cardId)] || []; }
function completion(card){
  const total = card.items?.length || 0;
  const done = (card.items || []).filter((_, idx) => isChecked(card.id, idx)).length;
  return { done, total, pct: total ? Math.round(done / total * 100) : 0 };
}
function selectedProcessCards(){
  ensureSafetyState();
  return SAFETY_PROCESS_CHECKLIST_DB
    .filter(x => state.safetySelectedProcessIds.includes(x.id))
    .map(x => ({...x, title:x.name, category:x.group, owner:"안전관리자/공사관리자", printGroup:"공정별 기본점검"}));
}
function customCards(){
  ensureSafetyState();
  return state.safetyCustomCards.map(x => ({...x, category:x.category || "현장 추가", owner:x.owner || "안전관리자", printGroup:"현장 추가점검"}));
}
function allChecklistCards(){
  return [
    ...DEFAULT_MORNING_SAFETY_CARDS,
    ...selectedProcessCards(),
    ...customCards()
  ];
}
function taskList(items){
  return items.length ? items.map((item, idx) => `
    <article class="safety-task ${levelClass(item.level)}">
      <div class="task-rank">${idx + 1}</div>
      <div><span>${escapeHtml(item.source)}</span><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.detail)}</p></div>
    </article>
  `).join("") : `<p class="help-text">오늘 등록된 일정이 없습니다. 일정탭에서 타설·작업·장비·자재·점검 일정을 등록하면 자동 반영됩니다.</p>`;
}
function scheduleChecklist(items){
  if(!items.length) return `<p class="help-text">오늘 일정 기준 안전 체크리스트가 없습니다.</p>`;
  return items.map(item => `
    <details class="safety-check-detail" open>
      <summary>${escapeHtml(item.schedule.type)} · ${escapeHtml(item.schedule.title)} <em>${escapeHtml(item.schedule.subTrade)}</em></summary>
      <div class="action-list compact-action-list">
        ${item.checklist.map(x => `<label class="action-item"><input type="checkbox"><span>${escapeHtml(x)}</span></label>`).join("")}
      </div>
    </details>
  `).join("");
}
function aiSummary(lines){
  return lines.map(line => `<p>${escapeHtml(line)}</p>`).join("");
}
function dutyDatabaseSummary(d){
  const total = d.dutyDatabase?.length || 0;
  const recurring = d.routines?.length || 0;
  const events = d.eventDuties?.length || 0;
  return `<div class="safety-db-summary"><b>안전업무 DB ${total}건</b><span>정기 ${recurring}건 · 발생/작업전 ${events}건</span><small>서류명, 증빙사진, 법정/실무 구분, 담당자를 기준키로 관리합니다.</small></div>`;
}
function renderProcessPicker(){
  ensureSafetyState();
  return `<div class="process-picker-grid">
    ${SAFETY_PROCESS_CHECKLIST_DB.map(p => `
      <label class="process-chip ${state.safetySelectedProcessIds.includes(p.id) ? "active" : ""}">
        <input type="checkbox" data-action="toggleProcess" value="${escapeHtml(p.id)}" ${state.safetySelectedProcessIds.includes(p.id) ? "checked" : ""}>
        <span>${escapeHtml(p.group)}</span><strong>${escapeHtml(p.name)}</strong>
      </label>
    `).join("")}
  </div>`;
}
function renderEvidence(card){
  const list = evidenceList(card.id);
  return `<div class="evidence-strip">
    ${list.map((ev, idx) => `<figure><img src="${escapeHtml(ev.dataUrl)}" alt="증빙사진"><figcaption>${escapeHtml(ev.name || `사진 ${idx+1}`)}</figcaption><button type="button" class="photo-remove" data-action="removeEvidence" data-card="${escapeHtml(card.id)}" data-index="${idx}">×</button></figure>`).join("")}
    <label class="photo-add">사진첨부<input type="file" accept="image/*" capture="environment" data-action="addEvidence" data-card="${escapeHtml(card.id)}"></label>
  </div>`;
}
function renderChecklistCard(card){
  const c = completion(card);
  return `<article class="safety-work-card" data-card-id="${escapeHtml(card.id)}">
    <div class="work-card-head">
      <div><span>${escapeHtml(card.category || card.group || "안전")}</span><strong>${escapeHtml(card.title || card.name)}</strong><small>담당 ${escapeHtml(card.owner || "안전관리자")} · ${escapeHtml(card.evidenceHint || "사진/서류 증빙")}</small></div>
      <b class="complete-pill ${c.pct === 100 ? "done" : ""}">${c.done}/${c.total}</b>
    </div>
    ${card.risk ? `<p class="risk-note">중점위험: ${escapeHtml(card.risk)}</p>` : ""}
    <div class="checkline-list">
      ${(card.items || []).map((item, idx) => `<label class="checkline ${isChecked(card.id, idx) ? "checked" : ""}"><input type="checkbox" data-action="toggleCheck" data-card="${escapeHtml(card.id)}" data-index="${idx}" ${isChecked(card.id, idx) ? "checked" : ""}><span>${escapeHtml(item)}</span></label>`).join("")}
    </div>
    ${renderEvidence(card)}
  </article>`;
}
function renderMorningChecklist(){
  const groups = new Map();
  allChecklistCards().forEach(card => {
    const group = card.printGroup || "안전 체크";
    if(!groups.has(group)) groups.set(group, []);
    groups.get(group).push(card);
  });
  return [...groups.entries()].map(([group, cards]) => `<section class="safety-check-group"><div class="mini-head"><h3>${escapeHtml(group)}</h3><span>${cards.length}개 카드</span></div><div class="safety-work-grid">${cards.map(renderChecklistCard).join("")}</div></section>`).join("");
}
function renderSeriousAccidentCards(){
  return SERIOUS_ACCIDENT_13_CARDS.map(card => renderChecklistCard({
    ...card,
    category:"중대재해처벌법",
    owner:"경영책임자/현장대리인/안전관리자",
    evidenceHint:card.cycle,
    printGroup:"중대재해처벌법 13개 관리카드"
  })).join("");
}
function renderComplianceProgress(){
  const total = SERIOUS_ACCIDENT_13_CARDS.length;
  const done = SERIOUS_ACCIDENT_13_CARDS.filter(card => completion(card).pct === 100).length;
  const partial = SERIOUS_ACCIDENT_13_CARDS.filter(card => { const pct = completion(card).pct; return pct > 0 && pct < 100; }).length;
  const pct = total ? Math.round(done / total * 100) : 0;
  return `<div class="compliance-progress-card">
    <div><span>중대재해 13대 의무 이행률</span><strong>${pct}%</strong><p>완료 ${done} · 진행 ${partial} · 미착수 ${total - done - partial}</p></div>
    <div class="compliance-bar"><i style="width:${pct}%"></i></div>
    <small>서류는 면책용이 아니라 실제 관리 이행의 증거입니다. 작성일시·작성자·사진·수정이력을 함께 남기는 구조로 확장합니다.</small>
  </div>`;
}
function renderEvidencePriority(){
  return `<div class="evidence-priority-grid">${CRITICAL_EVIDENCE_PRIORITY_DB.map(item => `
    <article class="evidence-priority-card ${item.grade.includes("★★★★★") ? "top" : item.grade.includes("★★★★") ? "high" : "normal"}">
      <b>${escapeHtml(item.grade)}</b><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.why)}</p>
      <small>${escapeHtml(item.docs.join(" · "))}</small>
    </article>
  `).join("")}</div>`;
}
function renderComplianceCoreDb(){
  return `<div class="compliance-db-grid">${COMPLIANCE_CORE_DB.map((name, idx) => `<span><b>${String(idx+1).padStart(2,"0")}</b>${escapeHtml(name)}</span>`).join("")}</div>`;
}
function renderInvestigationFlow(){
  return `<div class="investigation-flow">${INVESTIGATION_FLOW_DB.map((x, idx) => `<span><b>${idx+1}</b>${escapeHtml(x)}</span>`).join("")}</div>`;
}
function renderComplianceCard(card){
  const c = completion(card);
  const level = c.pct === 100 ? "done" : c.pct > 0 ? "working" : "empty";
  return `<article class="compliance-duty-card ${level}" data-card-id="${escapeHtml(card.id)}">
    <div class="compliance-duty-head"><div><span>${escapeHtml(card.legalRef || "중대재해처벌법")}</span><strong>${escapeHtml(card.title)}</strong><small>${escapeHtml(card.cycle)} · 담당 ${escapeHtml(card.owner || "경영책임자/현장")}</small></div><b>${c.done}/${c.total}</b></div>
    <div class="compliance-proof"><em>주요 증거자료</em>${(card.proof || []).map(x => `<small>${escapeHtml(x)}</small>`).join("")}</div>
    <div class="checkline-list">${(card.items || []).map((item, idx) => `<label class="checkline ${isChecked(card.id, idx) ? "checked" : ""}"><input type="checkbox" data-action="toggleCheck" data-card="${escapeHtml(card.id)}" data-index="${idx}" ${isChecked(card.id, idx) ? "checked" : ""}><span>${escapeHtml(item)}</span></label>`).join("")}</div>
    ${renderEvidence(card)}
  </article>`;
}
function renderComplianceCenter(){
  return `<section class="card compliance-center-board">
    <div class="mini-head"><div><h3>중대재해처벌법 Compliance Center</h3><p class="help-text">사고 발생 시 수사기관이 확인하는 핵심 자료를 기준으로, 13대 의무 이행현황·증거서류·감독 대응자료를 한 화면에서 관리합니다.</p></div><button class="secondary-btn small" onclick="window.print()">감사자료 출력</button></div>
    <div class="compliance-overview-grid">${renderComplianceProgress()}<div class="compliance-note"><b>관리 원칙</b><p>서류는 사고 후 처벌을 피하기 위한 문서가 아니라, 위험을 발견하고 조치하고 공유했다는 실제 이행 증거입니다.</p><small>작성일시·작성자·사진·서명·수정이력·관련 공종 연결을 우선 관리합니다.</small></div></div>
    <div class="compliance-section"><div class="mini-head"><h4>수사·감독 대응 우선자료</h4><span>위험성평가/TBM/작업계획/작업허가/개선조치 우선</span></div>${renderEvidencePriority()}</div>
    <div class="compliance-section"><div class="mini-head"><h4>사고 발생 시 일반 조사 흐름</h4><span>현장 보존 → 조사 → 서류 확보</span></div>${renderInvestigationFlow()}</div>
    <div class="compliance-section"><div class="mini-head"><h4>최우선 구축 DB 15개</h4><span>각 DB는 일정·날씨·공종·사진증빙과 연결 예정</span></div>${renderComplianceCoreDb()}</div>
    <div class="compliance-section"><div class="mini-head"><h4>중대재해 13대 의무 현황</h4><span>${SERIOUS_ACCIDENT_13_CARDS.length}개 관리카드</span></div><div class="compliance-duty-grid">${SERIOUS_ACCIDENT_13_CARDS.map(renderComplianceCard).join("")}</div></div>
  </section>`;
}
function routineTable(items){
  if(!items?.length) return `<p class="help-text">정기업무 DB가 없습니다.</p>`;
  const groups = [...new Set(items.map(x => x.group))];
  return groups.map(group => {
    const rows = items.filter(x => x.group === group);
    return `<section class="card safety-routine-card">
      <div class="mini-head"><h3>${escapeHtml(group)}</h3><span>${rows.length}건</span></div>
      <div class="routine-list">
        ${rows.map(item => `
          <article class="routine-row ${item.done ? "done" : item.dueNow ? "due-now" : item.soon ? "due-soon" : ""}">
            <div>
              <strong>${escapeHtml(item.title)}</strong>
              <p>${escapeHtml(item.periodLabel || item.dueHint)} · ${escapeHtml(item.dueText || "처리기한 확인")} · 담당 ${escapeHtml(item.owner)}</p>
              <small>${escapeHtml(item.roundLabel || item.type || "정기")} · ${escapeHtml((item.documents || []).slice(0,3).join(" / "))}</small>
              <small>대상기간: ${escapeHtml(item.due)} ~ ${escapeHtml(item.dueEnd || item.nextDue)}</small>
            </div>
            <button class="mini-btn" data-action="toggleRoutine" data-id="${escapeHtml(item.id)}" data-done="${item.done ? "1" : "0"}">${item.done ? "완료취소" : "완료"}</button>
          </article>
        `).join("")}
      </div>
    </section>`;
  }).join("");
}

function diaryUploads(field){
  ensureSafetyState();
  const day = todayKey();
  state.safetyDiaryUploads[day] = state.safetyDiaryUploads[day] || {};
  state.safetyDiaryUploads[day][field] = state.safetyDiaryUploads[day][field] || [];
  return state.safetyDiaryUploads[day][field];
}
function diaryCounts(){
  ensureSafetyState();
  const day = todayKey();
  state.safetyDiaryCounts[day] = state.safetyDiaryCounts[day] || { reportWorkers:"", tbmWorkers:"" };
  return state.safetyDiaryCounts[day];
}
function diaryCheck(key){
  ensureSafetyState();
  return Boolean(state.safetyDiaryChecks[`${todayKey()}:${key}`]);
}
function hazardsToday(){
  ensureSafetyState();
  const day = todayKey();
  state.safetyHazards[day] = state.safetyHazards[day] || [];
  return state.safetyHazards[day];
}
function lastRoutineDoneInfo(task){
  ensureSafetyState();
  const keys = Object.keys(state.safetyRoutineDone || {}).filter(k => k.startsWith(`${task.id}:`));
  if(!keys.length) return { date:"기록 없음", days:null, text:"마지막 실시 기록 없음" };
  const latest = keys.map(k => k.split(":")[1]).sort().pop();
  const ms = new Date(`${todayKey()}T00:00:00+09:00`) - new Date(`${latest}T00:00:00+09:00`);
  const days = Math.max(0, Math.round(ms / 86400000));
  return { date:latest, days, text:`마지막 실시 ${days}일 경과` };
}
function renderDiaryUploadBlock(field, title, help){
  const files = diaryUploads(field);
  return `<article class="diary-upload-card">
    <div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(help)}</p></div>
    <div class="diary-file-list">
      ${files.map((f, idx)=>`<span class="diary-file-chip"><b>${escapeHtml(f.name || `파일 ${idx+1}`)}</b><small>${escapeHtml((f.createdAt || "").slice(0,16).replace("T"," "))}</small><button type="button" data-action="removeDiaryUpload" data-field="${escapeHtml(field)}" data-index="${idx}">×</button></span>`).join("")}
      <label class="diary-file-add">업로드<input type="file" accept="image/*,.pdf" data-action="addDiaryUpload" data-field="${escapeHtml(field)}"></label>
    </div>
  </article>`;
}
function renderManpowerCheck(){
  const c = diaryCounts();
  const a = Number(c.reportWorkers || 0);
  const b = Number(c.tbmWorkers || 0);
  const hasBoth = c.reportWorkers !== "" && c.tbmWorkers !== "";
  const matched = hasBoth && a === b;
  return `<div class="diary-manpower-box ${hasBoth ? (matched ? "matched" : "mismatch") : ""}">
    <label>공사일보 출력인원<input type="number" min="0" data-action="updateDiaryCount" data-field="reportWorkers" value="${escapeHtml(c.reportWorkers)}" placeholder="명"></label>
    <label>TBM일지 참석인원<input type="number" min="0" data-action="updateDiaryCount" data-field="tbmWorkers" value="${escapeHtml(c.tbmWorkers)}" placeholder="명"></label>
    <strong>${hasBoth ? (matched ? "인원 일치" : `불일치 ${Math.abs(a-b)}명`) : "인원 확인 필요"}</strong>
  </div>`;
}
function renderDailyRiskChecklist(d){
  const items = [
    ...d.scheduleItems.map(x => ({ key:`sch-${x.schedule.id || x.title}`, source:"주요공정", title:x.title, detail:x.detail })),
    ...d.weatherItems.map((x, idx) => ({ key:`weather-${idx}`, source:"날씨", title:x.title, detail:x.detail }))
  ];
  return `<div class="diary-risk-list">
    ${items.length ? items.map(item=>`<label class="diary-risk-row ${diaryCheck(item.key) ? "checked" : ""}"><input type="checkbox" data-action="toggleDiaryCheck" data-key="${escapeHtml(item.key)}" ${diaryCheck(item.key) ? "checked" : ""}><span><b>${escapeHtml(item.source)} · ${escapeHtml(item.title)}</b><small>${escapeHtml(item.detail)}</small></span></label>`).join("") : `<p class="help-text">오늘 일정과 날씨에서 자동 생성된 위험 체크포인트가 없습니다.</p>`}
  </div>`;
}
function hazardSummary(h){
  const what = h.type === "violation" ? "위반사항" : "위험발견";
  const target = h.target ? `: ${h.target}` : "";
  const action = h.action ? ` / 조치: ${h.action}` : "";
  return `${what}${target}${action}`;
}
function renderHazardList(){
  const list = hazardsToday();
  return `<div class="hazard-board">
    <div class="hazard-form no-print">
      <select id="hazardType"><option value="hazard">위험발견사항</option><option value="violation">위반사항</option></select>
      <input id="hazardTarget" placeholder="예: 201동 옥상층 갱폼 단차 / 미장공종 홍길동">
      <input id="hazardAction" placeholder="예: 난간 설치 완료 / 벌점 3점 부과">
      <button class="primary-btn small" data-action="addHazard">추가</button>
    </div>
    <div class="hazard-list">
      ${list.length ? list.map((h, idx)=>`<article class="hazard-card"><div class="hazard-summary"><b>${idx+1}</b><span>${escapeHtml(hazardSummary(h))}</span><button class="mini-btn danger" data-action="removeHazard" data-index="${idx}">삭제</button></div>
        <div class="hazard-photo-row">
          ${["before","after"].map(kind=>`<div class="hazard-photo-slot"><strong>${kind === "before" ? "조치 전" : "조치 후"}</strong>${h[kind]?.dataUrl ? `<img src="${escapeHtml(h[kind].dataUrl)}" alt="${kind}">` : `<em>사진 없음</em>`}<label>사진첨부<input type="file" accept="image/*" capture="environment" data-action="addHazardPhoto" data-index="${idx}" data-kind="${kind}"></label></div>`).join("")}
        </div>
      </article>`).join("") : `<p class="help-text">금일 안전 위험 발견사항 및 조치사항이 없습니다. 발견 시 한 줄 요약과 조치 전·후 사진을 남기세요.</p>`}
    </div>
  </div>`;
}
function renderRoutineMonitor(d){
  const rows = (d.routines || []).filter(x => ["매일","주 1회","2주 1회","월 2회","월 1회","2개월","분기","반기","연간"].includes(x.group) || x.type === "정기");
  return `<div class="diary-routine-monitor">
    ${rows.map(item=>{ const last = lastRoutineDoneInfo(item); return `<article class="routine-monitor-row ${item.done ? "done" : item.dueNow ? "due-now" : item.soon ? "due-soon" : ""}">
      <div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.roundLabel || item.group)} · ${escapeHtml(item.dueText)} · ${escapeHtml(last.text)}</p><small>필요서류: ${escapeHtml((item.documents || []).slice(0,4).join(" / "))}</small></div>
      <button class="mini-btn" data-action="toggleRoutine" data-id="${escapeHtml(item.id)}" data-done="${item.done ? "1" : "0"}">${item.done ? "오늘 완료취소" : "금일 실시/갱신"}</button>
    </article>`; }).join("")}
  </div>`;
}
function journalMeta(){
  ensureSafetyState();
  const key = todayKey();
  state.safetyJournalMeta[key] = state.safetyJournalMeta[key] || {
    siteName:"",
    reportWorkers:"",
    tbmWorkers:"",
    education:{newHire:"", special:"", regular:"", changed:"", other:""},
    tbmEdited:""
  };
  return state.safetyJournalMeta[key];
}
function tbmExtras(){
  ensureSafetyState();
  const key = todayKey();
  state.safetyTbmExtras[key] = state.safetyTbmExtras[key] || [];
  return state.safetyTbmExtras[key];
}
function autoTbmLines(d){
  const work = d.scheduleItems.flatMap(x => { const head = `작업 · ${x.title}: ${x.detail}`; const points = (x.checklist || []).slice(0,4).map(v => `고위험 포인트 · ${x.title}: ${v}`); return [head, ...points]; });
  const weather = d.weatherItems.map(x => `날씨 · ${x.title}: ${x.detail}`);
  return [...work, ...weather];
}
function renderJournalHeader(d){
  const m = journalMeta();
  const edu = m.education || {};
  const eduTotal = [edu.newHire,edu.special,edu.regular,edu.changed,edu.other].reduce((a,v)=>a+(Number(v)||0),0);
  return `<div class="journal-paper-head">
    <div class="journal-doc-title"><span>GUI's Arc OS</span><h3>안 전 일 지</h3><p>Safety Daily Journal</p></div>
    <table class="journal-sign-table"><thead><tr><th>작성자</th><th>관리감독자</th><th>현장소장</th></tr></thead><tbody><tr><td>서명</td><td>서명</td><td>서명</td></tr></tbody></table>
  </div>
  <table class="journal-info-table journal-info-two-row">
    <colgroup><col class="site"><col class="date"><col class="count"><col class="count"></colgroup>
    <thead><tr><th>현장명</th><th>금일 날짜</th><th>출력인원</th><th>TBM 참여인원</th></tr></thead>
    <tbody><tr><td><input data-journal-field="siteName" value="${escapeHtml(m.siteName)}" placeholder="현장명을 입력하세요"></td><td>${escapeHtml(d.date)}</td><td><div class="journal-count-field"><input type="number" min="0" data-journal-field="reportWorkers" value="${escapeHtml(m.reportWorkers)}" placeholder="0"><span>명</span></div></td><td><div class="journal-count-field"><input type="number" min="0" data-journal-field="tbmWorkers" value="${escapeHtml(m.tbmWorkers)}" placeholder="0"><span>명</span></div></td></tr></tbody>
  </table>
  <table class="journal-education-table"><thead><tr><th>신규자 교육</th><th>특별안전 교육</th><th>정기안전 교육</th><th>작업내용 변경교육</th><th>기타 교육</th><th>교육 합계</th></tr></thead><tbody><tr>
    ${['newHire','special','regular','changed','other'].map(k=>`<td><input type="number" min="0" data-education-field="${k}" value="${escapeHtml(edu[k]||'')}" placeholder="0"> 명</td>`).join('')}
    <td class="education-total">${eduTotal} 명</td></tr></tbody></table>`;
}
function renderTbmJournalSection(d){
  const m = journalMeta();
  const automatic = autoTbmLines(d);
  const edited = m.tbmEdited || automatic.join("\n");
  const extras = tbmExtras();
  return `<section class="journal-block journal-tbm-block"><div class="journal-block-title"><b>1</b><h4>주요 안전업무 및 TBM 전달사항</h4><span>작업·날씨·고위험 작업 핵심 포인트</span></div>
    <div class="tbm-edit-grid"><div><textarea id="journalTbmEdited" rows="${Math.max(5,Math.min(10,edited.split('\n').length+1))}">${escapeHtml(edited)}</textarea><button class="secondary-btn small no-print" data-action="saveJournalTbm">수정내용 저장</button></div>
    <div><strong>추가 전달사항</strong><div class="tbm-extra-input no-print"><input id="tbmExtraInput" placeholder="추가 전달사항 입력"><button class="primary-btn small" data-action="addTbmExtra">입력</button></div><ol class="tbm-extra-list">${extras.length?extras.map((x,i)=>`<li><span>${escapeHtml(x)}</span><button class="mini-btn danger no-print" data-action="removeTbmExtra" data-index="${i}">삭제</button></li>`).join(''):'<li class="empty">추가 전달사항 없음</li>'}</ol></div></div>
  </section>`;
}
function renderHazardSummaryTable(){
  const list = hazardsToday();
  return `<section class="journal-block"><div class="journal-block-title"><b>2</b><h4>금일 현장 위험발견 및 안전조치 사항</h4><span>상세 및 사진은 뒷면 백업페이지 참조</span></div>
    <table class="journal-hazard-summary"><thead><tr><th>번호</th><th>구분</th><th>위험발견 내용 요약</th><th>조치내용 요약</th><th>위치</th><th>상태</th></tr></thead><tbody>
    ${list.length?list.map((h,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(h.category|| (h.type==='violation'?'보호구/위반':'시설/위험'))}</td><td>${escapeHtml(h.target||'')}</td><td>${escapeHtml(h.action||'')}</td><td>${escapeHtml(h.location||'')}</td><td>${h.completed===false?'진행중':'완료'}</td></tr>`).join(''):'<tr><td colspan="6">금일 위험발견 및 조치사항 없음</td></tr>'}</tbody></table>
  </section>`;
}
function routineRecords(id){ ensureSafetyState(); if(!Array.isArray(state.safetyRoutineRecords[id])) state.safetyRoutineRecords[id]=[]; return state.safetyRoutineRecords[id]; }
function addCycleDate(dateStr, cycle){
  if(!dateStr) return "-";
  const d=new Date(`${dateStr}T00:00:00`);
  const addDays=n=>d.setDate(d.getDate()+n), addMonths=n=>d.setMonth(d.getMonth()+n);
  if(cycle==="daily") addDays(1); else if(cycle==="weekly") addDays(7); else if(cycle==="biweekly") addDays(14); else if(cycle==="twiceMonthly") addDays(15); else if(cycle==="monthly") addMonths(1); else if(cycle==="bimonthly") addMonths(2); else if(cycle==="quarterly") addMonths(3); else if(cycle==="halfYear") addMonths(6); else if(cycle==="yearly") addMonths(12); else return "-";
  return d.toLocaleDateString("sv-SE",{timeZone:"Asia/Seoul"});
}
function latestRoutineRecord(item){
  const records=routineRecords(item.id).filter(r=>r.performed!==false && r.date).slice().sort((a,b)=>a.date.localeCompare(b.date));
  if(records.length) return records.at(-1);
  const dates=routineHistory(item.id).slice().sort();
  return dates.length?{date:dates.at(-1),checker:"",note:"",performed:true}:null;
}
function renderRoutineJournalSection(d){
  const rows = (d.dutyDatabase || []).filter(isRoutineDocumentDuty);
  return `<section class="journal-block"><div class="journal-block-title"><b>3</b><h4>정기 안전서류 실시현황</h4><span>정기업무 관리섹션의 기록을 불러옵니다</span></div>
    <div class="journal-routine-wrap"><table class="journal-routine-table compact readonly"><thead><tr><th>서류 업무</th><th>주기</th><th>최근 실시</th><th>다음 예정일</th></tr></thead><tbody>${rows.map(item=>{const rec=latestRoutineRecord(item);const next=rec?addCycleDate(rec.date,item.cycle):'-';const dash=(d.routines||[]).find(x=>x.id===item.id);const cls=dash?.dueNow?'overdue':dash?.soon?'soon':'';return `<tr class="${cls}"><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.trigger||item.group)}</td><td>${escapeHtml(rec?.date||'-')}</td><td>${escapeHtml(next)}</td></tr>`}).join('')}</tbody></table></div>
  </section>`;
}
function renderHazardBackupPage(){
  const list=hazardsToday();
  return `<section class="journal-backup-page"><div class="backup-page-head"><div><span>안전일지 백업 페이지</span><h3>위험발견 및 안전조치 상세</h3></div><strong>${escapeHtml(todayKey())}</strong></div>
    <div class="hazard-entry-form no-print"><select id="hazardType"><option value="hazard">위험발견</option><option value="violation">위반사항</option></select><select id="hazardCategory"><option>시설</option><option>보호구</option><option>작업방법</option><option>장비</option><option>통로/정리정돈</option><option>기타</option></select><input id="hazardLocation" placeholder="위치"><input id="hazardOccurredAt" type="datetime-local"><input id="hazardTarget" placeholder="위험발견 내용"><input id="hazardAction" placeholder="조치내용"><button class="primary-btn small" data-action="addHazard">항목 추가</button></div>
    <div class="hazard-backup-list">${list.length?list.map((h,i)=>`<article class="hazard-backup-item"><div class="hazard-backup-meta"><b>${i+1}</b><span>${escapeHtml(h.category||'시설')}</span><strong>${escapeHtml(h.location||'위치 미입력')}</strong><time>${escapeHtml(h.occurredAt||h.createdAt||'')}</time><button class="mini-btn danger no-print" data-action="removeHazard" data-index="${i}">삭제</button></div><div class="hazard-backup-text"><div><small>위험발견 내용</small><p>${escapeHtml(h.target||'')}</p></div><div><small>조치내용</small><p>${escapeHtml(h.action||'')}</p></div></div><div class="hazard-photo-row">${['before','after'].map(kind=>`<div class="hazard-photo-slot"><strong>${kind==='before'?'조치 전 사진':'조치 후 사진'}</strong>${h[kind]?.dataUrl?`<img src="${escapeHtml(h[kind].dataUrl)}" alt="${kind}">`:'<em>사진 미첨부</em>'}<label class="no-print">사진첨부<input type="file" accept="image/*" capture="environment" data-action="addHazardPhoto" data-index="${i}" data-kind="${kind}"></label></div>`).join('')}</div></article>`).join(''):'<p class="help-text">등록된 위험발견 및 조치사항이 없습니다. 사진 없이 내용만 등록할 수도 있습니다.</p>'}</div>
  </section>`;
}
function renderSafetyDailyJournal(d){
  return `<section class="card safety-daily-journal journal-two-page">
    <div class="journal-toolbar no-print"><button class="primary-btn small" data-action="printSafetyJournal">안전일지 2장 출력</button></div>
    <section class="journal-front-page">${renderJournalHeader(d)}${renderTbmJournalSection(d)}${renderHazardSummaryTable()}${renderRoutineJournalSection(d)}<div class="journal-attachment-line"><b>첨부파일</b><span>사진대지</span></div><div class="journal-page-number">안전일지 1/2</div></section>
    ${renderHazardBackupPage()}
  </section>`;
}

function accordionSection(id, title, subtitle, body, open=false){
  ensureSafetyState();
  const saved = state.safetyAccordionOpen[id];
  const isOpen = typeof saved === "boolean" ? saved : open;
  return `<details class="safety-accordion" data-section="${escapeHtml(id)}" ${isOpen ? "open" : ""}>
    <summary><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(subtitle)}</small></div><span class="accordion-arrow">⌄</span></summary>
    <div class="safety-accordion-body">${body}</div>
  </details>`;
}
function todayCustomTasks(){
  ensureSafetyState();
  const day=todayKey();
  if (!Array.isArray(state.safetyTodayCustomTasks[day])) state.safetyTodayCustomTasks[day] = [];
  return state.safetyTodayCustomTasks[day];
}
function todayTaskKey(id){ return `${todayKey()}:today:${id}`; }
function todayTaskDone(id){ ensureSafetyState(); return Boolean(state.safetyDiaryChecks[todayTaskKey(id)]); }
function renderTodayWorkChecklist(d){
  const fieldBase = [
    {id:"field-patrol",title:"현장 순회점검",detail:"추락·낙하·협착·전도·개구부·통로 상태 확인"},
    {id:"field-ppe",title:"보호구 및 출입통제 확인",detail:"안전모·안전화·안전대·고위험구역 통제 확인"},
    {id:"field-weather",title:"날씨에 따른 작업조정 확인",detail:"강우·풍속·폭염·한랭에 따른 중지 또는 순서조정 검토"}
  ];
  const documentBase = [
    {id:"doc-journal",title:"안전일지 작성 및 기록",detail:"금일 인원·교육·위험발견·조치·정기업무 현황 기록"},
    {id:"doc-tbm",title:"TBM 일지 정리",detail:"참여인원·전달사항·서명 또는 별도 보관서류 확인"},
    {id:"doc-daily-risk",title:"금일 위험성평가 및 개선조치 기록",detail:"주요 공종 위험요인·조치사항·담당자 확인"},
    {id:"doc-equipment",title:"장비 및 작업허가 서류 확인",detail:"금일 사용 장비 점검표와 고위험 작업허가서 누락 확인"}
  ];
  const routine = (d.routines||[]).filter(x=>x.group==="매일"||x.dueNow||x.soon).map(x=>({id:`routine-${x.id}`,title:x.title,detail:x.dueText||x.periodLabel||"기한 확인"}));
  const schedule = (d.scheduleItems||[]).map((x,i)=>({id:`schedule-${x.schedule?.id||i}`,title:x.title,detail:x.detail,checklist:x.checklist||[]}));
  const weather = (d.weatherItems||[]).map((x,i)=>({id:`weather-${i}`,title:x.title,detail:x.detail}));
  const custom = todayCustomTasks().map(x=>({...x,custom:true}));
  const row = (item, cls="") => `<label class="today-work-row ${cls} ${todayTaskDone(item.id)?'done':''}"><input type="checkbox" data-action="toggleTodayTask" data-id="${escapeHtml(item.id)}" ${todayTaskDone(item.id)?'checked':''}><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail||'')}</small></span>${item.custom?`<button type="button" class="mini-btn danger" data-action="removeTodayTask" data-id="${escapeHtml(item.id)}">삭제</button>`:''}</label>`;
  const scheduleRows = schedule.map(item=>`<details class="today-process-task"><summary>${row(item,"schedule-parent")}</summary><div class="today-process-checkpoints">${item.checklist.length?item.checklist.map(x=>`<p>• ${escapeHtml(x)}</p>`).join(''):'<p>등록된 세부 예방조치가 없습니다.</p>'}</div></details>`).join('');
  return `<div class="today-work-toolbar"><input id="todayCustomTaskTitle" placeholder="오늘 직접 추가할 업무"><input id="todayCustomTaskDetail" placeholder="간단한 설명 또는 확인사항"><button class="primary-btn small" data-action="addTodayTask">추가</button></div>
    <div class="today-work-columns"><section><h3>현장업무</h3><div class="today-work-list">${fieldBase.map(x=>row(x)).join('')}${scheduleRows}${weather.map(x=>row(x,'weather-task')).join('')}</div></section><section><h3>서류업무</h3><div class="today-work-list">${documentBase.map(x=>row(x)).join('')}${routine.map(x=>row(x,'routine-task')).join('')}${custom.map(x=>row(x,'custom-task')).join('')}</div></section></div>`;
}
function renderRoutineInformation(d){
  const rows=(d.dutyDatabase||[]).filter(isRoutineDocumentDuty);
  return `<div class="routine-document-guide">${rows.map(item=>{const g=ROUTINE_DOCUMENT_GUIDE[item.id]||{};return `<details><summary><div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.trigger||item.group)}</span></div><em>관리방법 보기</em></summary><div class="document-guide-body"><p><b>목적</b>${escapeHtml(g.purpose||'해당 안전서류의 작성·보존 상태를 정기적으로 확인합니다.')}</p><p><b>관리 방법</b>${escapeHtml(g.method||((item.actions||[]).join(' · ')))}</p><p><b>필수 보관자료</b>${escapeHtml(g.required||(item.documents||[]).join(' / '))}</p><p class="document-warning"><b>자주 누락되는 부분</b>${escapeHtml(g.omission||'작성일, 작성자, 확인자, 첨부 증빙과 후속조치 기록을 확인하세요.')}</p></div></details>`}).join('')}</div>`;
}
function routineHistory(id){ ensureSafetyState(); if(!Array.isArray(state.safetyRoutineHistory[id])) state.safetyRoutineHistory[id]=[]; return state.safetyRoutineHistory[id]; }
function renderRoutineManagement(d){
  const rows=(d.dutyDatabase||[]).filter(isRoutineDocumentDuty);
  return `<div class="routine-management-list">${rows.map(item=>{const records=routineRecords(item.id).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));const recent=latestRoutineRecord(item);const next=recent?addCycleDate(recent.date,item.cycle):'-';const dash=(d.routines||[]).find(x=>x.id===item.id);return `<article class="routine-management-card ${dash?.dueNow?'overdue':dash?.soon?'soon':''}"><div class="routine-management-head"><div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.trigger||item.group)}</span></div><b>다음 예정일 ${escapeHtml(next)} · ${escapeHtml(dash?.dueText||'기록 필요')}</b></div>
    <div class="routine-record-entry"><label>실시일<input type="date" data-routine-record="${escapeHtml(item.id)}" data-field="date"></label><label>확인자<input data-routine-record="${escapeHtml(item.id)}" data-field="checker" placeholder="성명"></label><label>실시여부<select data-routine-record="${escapeHtml(item.id)}" data-field="performed"><option value="true">O</option><option value="false">X</option></select></label><label class="routine-record-note">기타사항<input data-routine-record="${escapeHtml(item.id)}" data-field="note" placeholder="미실시 사유·특이사항"></label><button class="primary-btn small" data-action="addRoutineRecord" data-id="${escapeHtml(item.id)}">기록 추가</button></div>
    <div class="routine-record-table-wrap"><table class="routine-record-table"><thead><tr><th>실시일</th><th>확인자</th><th>실시여부</th><th>기타사항</th><th>다음 예정일</th><th></th></tr></thead><tbody>${records.length?records.map((r,i)=>`<tr><td>${escapeHtml(r.date||'-')}</td><td>${escapeHtml(r.checker||'-')}</td><td>${r.performed===false?'X':'O'}</td><td>${escapeHtml(r.note||'')}</td><td>${r.performed===false?'-':escapeHtml(addCycleDate(r.date,item.cycle))}</td><td><button class="mini-btn danger" data-action="removeRoutineRecord" data-id="${escapeHtml(item.id)}" data-index="${i}">삭제</button></td></tr>`).join(''):'<tr><td colspan="6">실시기록 없음</td></tr>'}</tbody></table></div>
    <div class="routine-docs"><b>주요 서류</b><span>${escapeHtml((item.documents||[]).join(' / '))}</span></div></article>`}).join('')}</div>`;
}
function renderProcessKnowledge(){
  return `<div class="process-knowledge-list">${SAFETY_PROCESS_CHECKLIST_DB.map(p=>`<details><summary><b>${escapeHtml(p.group)}</b><strong>${escapeHtml(p.name)}</strong><span>확인 포인트 보기</span></summary><div><p>${p.risk?`중점위험: ${escapeHtml(p.risk)}`:''}</p><ol>${(p.items||[]).map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ol></div></details>`).join('')}</div>`;
}
function renderComplianceGuide(){
  return `<div class="compliance-guide"><article><h3>Compliance Center란?</h3><p>중대재해처벌법 대응을 위해 안전보건관리체계, 법정서류, 위험성평가, TBM, 개선조치, 협력업체 관리 등 실제 이행 흐름을 이해하고 준비하는 정보 열람 영역입니다.</p></article><article><h3>현장 관리 원칙</h3><p>서류를 많이 만드는 것보다 위험을 발견하고, 조치하고, 작업자에게 공유하고, 그 기록을 날짜·작성자·사진·서명과 함께 남기는 것이 핵심입니다.</p></article><div class="compliance-guide-grid">${SERIOUS_ACCIDENT_13_CARDS.map((c,i)=>`<details><summary><b>${i+1}</b>${escapeHtml(c.title)}</summary><p><strong>권장 관리:</strong> ${escapeHtml((c.items||[]).join(' · '))}</p><p><strong>주요 증거:</strong> ${escapeHtml((c.proof||[]).join(' · '))}</p></details>`).join('')}</div><h3>수사·감독 대응 우선자료</h3>${renderEvidencePriority()}<h3>사고 발생 시 일반 조사 흐름</h3>${renderInvestigationFlow()}<h3>향후 구축 권장 DB</h3>${renderComplianceCoreDb()}</div>`;
}
function renderMonthlyApprovalReport(){
  const report = buildSafetyMonthlyReport();
  const doneRate = report.total ? Math.round(report.done / report.total * 100) : 0;
  const missedRows = report.rows.filter(x => !x.done).slice(0,14);
  const doneRows = report.rows.filter(x => x.done).slice(0,14);
  const rowHtml = rows => rows.length ? rows.map(x => `<tr><td>${escapeHtml(x.group)}</td><td>${escapeHtml(x.title)}</td><td>${escapeHtml(x.label)}</td><td>${escapeHtml(x.periodStart)}~${escapeHtml(x.periodEnd)}</td><td>${x.done ? "완료" : "누락"}</td></tr>`).join("") : `<tr><td colspan="5">해당 없음</td></tr>`;
  return `<section class="card monthly-approval-card">
    <div class="mini-head"><div><h3>월간 안전관리 업무 취합·결재서류</h3><p class="help-text">이번 달 정기업무 수행/누락 현황을 모아 출력하고 현장소장 확인 서명을 받을 수 있는 기록유지용 카드입니다.</p></div><button class="secondary-btn small" onclick="window.print()">월간 결재서류 출력</button></div>
    <div class="monthly-summary-grid">
      <span><b>${escapeHtml(report.monthKey)}</b><small>대상월</small></span>
      <span><b>${report.done}/${report.total}</b><small>완료/전체</small></span>
      <span><b>${doneRate}%</b><small>완료율</small></span>
      <span><b>${report.missing}</b><small>누락건수</small></span>
    </div>
    <div class="monthly-report-tables">
      <div><h4>이번 달 누락 업무</h4><table class="approval-table"><thead><tr><th>구분</th><th>업무</th><th>회차</th><th>기간</th><th>상태</th></tr></thead><tbody>${rowHtml(missedRows)}</tbody></table></div>
      <div><h4>이번 달 수행 업무</h4><table class="approval-table"><thead><tr><th>구분</th><th>업무</th><th>회차</th><th>기간</th><th>상태</th></tr></thead><tbody>${rowHtml(doneRows)}</tbody></table></div>
    </div>
    <div class="approval-sign-row"><div><b>작성</b><span>안전관리자</span><i>서명</i></div><div><b>검토</b><span>현장대리인/관리감독자</span><i>서명</i></div><div><b>승인</b><span>현장소장</span><i>서명</i></div></div>
    <p class="help-text print-note">현재 단계에서는 종이 출력 후 서명 보관을 기본으로 두는 것이 현장 적용성이 좋습니다. 전자서명은 작성자·시간·수정이력·권한관리·PDF 고정 보관까지 붙인 뒤 도입하는 편이 안전합니다.</p>
  </section>`;
}
function eventDutyTable(items){
  if(!items?.length) return `<p class="help-text">발생 시 업무 DB가 없습니다.</p>`;
  const groups = ["작업 전", "발생 시", "발생 즉시"];
  return groups.map(group => {
    const rows = items.filter(x => x.group === group);
    if(!rows.length) return "";
    return `<section class="card safety-routine-card safety-event-card">
      <div class="mini-head"><h3>${group} 안전업무 DB</h3><span>${rows.length}건</span></div>
      <div class="routine-list">
        ${rows.map(item => `
          <article class="routine-row event-row"><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.trigger)} · 담당 ${escapeHtml(item.owner)}</p><small>${escapeHtml(item.type || "실무")} · ${escapeHtml((item.documents || []).slice(0,3).join(" / "))}</small></div></article>
        `).join("")}
      </div>
    </section>`;
  }).join("");
}
function addCustomCardFromForm(root){
  const title = root.querySelector("#customSafetyTitle")?.value.trim();
  const items = root.querySelector("#customSafetyItems")?.value.split("\n").map(x => x.trim()).filter(Boolean) || [];
  if(!title || !items.length){ alert("점검명과 체크항목을 입력하세요."); return; }
  ensureSafetyState();
  state.safetyCustomCards.push({ id:`custom-${Date.now()}`, title, category:"현장 추가", owner:"안전관리자", items, evidenceHint:"현장 추가점검 사진" });
  saveLocal();
  renderSafety(root);
}
function handlePhoto(file, cardId, root){
  if(!file || !cardId) return;
  const reader = new FileReader();
  reader.onload = () => {
    ensureSafetyState();
    const key = cardKey(cardId);
    state.safetyEvidence[key] = state.safetyEvidence[key] || [];
    state.safetyEvidence[key].push({ name:file.name, dataUrl:String(reader.result), createdAt:new Date().toISOString() });
    saveLocal();
    renderSafety(root);
  };
  reader.readAsDataURL(file);
}

function complianceActionButtons(workId,c){
  const status=c.action?.status||"미조치";
  return `<div class="audit-actions"><span class="audit-action-status ${status==='미조치'?'open':'managed'}">${escapeHtml(status)}</span><span class="audit-evidence-count">증빙 ${c.evidence?.length||0}</span><span class="audit-approval-stage">${escapeHtml(c.approval?.stage||"미결재")}</span><button class="mini-btn" data-audit-move="${escapeHtml(c.targetPage)}">${escapeHtml(c.target)} 이동</button><button class="mini-btn" data-evidence-add="1" data-work-id="${escapeHtml(workId)}" data-rule-id="${escapeHtml(c.ruleId)}">증빙등록</button><button class="mini-btn" data-approval-set="검토완료" data-work-id="${escapeHtml(workId)}" data-rule-id="${escapeHtml(c.ruleId)}">검토</button><button class="mini-btn" data-approval-set="현장소장 승인" data-work-id="${escapeHtml(workId)}" data-rule-id="${escapeHtml(c.ruleId)}">소장결재</button><button class="mini-btn" data-audit-action="완료" data-work-id="${escapeHtml(workId)}" data-rule-id="${escapeHtml(c.ruleId)}">완료보고</button><button class="mini-btn" data-audit-action="보류" data-work-id="${escapeHtml(workId)}" data-rule-id="${escapeHtml(c.ruleId)}">보류</button><button class="mini-btn" data-audit-action="예외" data-work-id="${escapeHtml(workId)}" data-rule-id="${escapeHtml(c.ruleId)}">예외</button></div>`;
}
function renderAutomaticComplianceAudit(audit){
  if(!audit.totalWorks) return `<p class="help-text">오늘 등록된 Work Instance가 없습니다.</p>`;
  const safetyTargets=new Set(["안전관리"]);
  const safetyRows=audit.works.map(w=>({...w,missing:w.missing.filter(c=>safetyTargets.has(c.target)),openMissing:w.openMissing.filter(c=>safetyTargets.has(c.target))}));
  const referenceRows=audit.works.map(w=>({...w,missing:w.missing.filter(c=>!safetyTargets.has(c.target))})).filter(w=>w.missing.length);
  const safetyOpen=safetyRows.reduce((n,w)=>n+w.openMissing.length,0);
  return `<div class="compliance-summary"><article><span>오늘 작업</span><strong>${audit.totalWorks}</strong></article><article class="danger"><span>안전 미조치</span><strong>${safetyOpen}</strong></article><article><span>타 부서 참고</span><strong>${referenceRows.reduce((n,w)=>n+w.missing.length,0)}</strong></article></div>
  <div class="role-owner-guide"><b>안전관리 주담당만 체크합니다.</b><span>품질·공사·장비 자체관리 항목은 담당 부서의 참고 알림으로만 표시됩니다.</span></div>
  <div class="compliance-work-list">${safetyRows.map(w=>`<article class="compliance-work ${w.openMissing.length?"has-critical":"all-ok"}"><header><div><span class="work-id-chip">${escapeHtml(w.workId)}</span><h4>${escapeHtml(w.subProcess||w.title)}</h4><p>${escapeHtml(w.location||"위치 미입력")}</p></div><b>${w.openMissing.length?`안전 미조치 ${w.openMissing.length}건`:"안전업무 이상 없음"}</b></header>${w.missing.length?`<ul>${w.missing.map(c=>`<li><div class="audit-item-main"><strong>${escapeHtml(c.title)}</strong><span>${escapeHtml(c.detail)}</span></div>${complianceActionButtons(w.workId,c)}</li>`).join("")}</ul>`:`<p class="audit-clear">안전관리 필수기록이 모두 연결되었습니다.</p>`}</article>`).join("")}</div>
  ${referenceRows.length?`<details class="reference-alerts"><summary>타 부서 참고 알림 ${referenceRows.reduce((n,w)=>n+w.missing.length,0)}건</summary>${referenceRows.map(w=>`<article><b>${escapeHtml(w.subProcess||w.title)}</b><ul>${w.missing.map(c=>`<li><span>${escapeHtml(c.target)} 담당</span> · ${escapeHtml(c.title)} — ${escapeHtml(c.detail)}</li>`).join("")}</ul></article>`).join("")}</details>`:""}`;
}

function bindComplianceActions(root){
  root.querySelectorAll("[data-audit-move]").forEach(btn=>btn.addEventListener("click",()=>document.querySelector(`.main-tabs .tab[data-page='${btn.dataset.auditMove}']`)?.click()));
  root.querySelectorAll("[data-evidence-add]").forEach(btn=>btn.addEventListener("click",()=>{const name=prompt("증빙명 또는 파일명을 입력하세요.")||"";if(!name)return;const type=prompt("증빙 유형을 입력하세요. (사진/문서/서명)","사진")||"사진";const author=prompt("작성자 또는 등록자를 입력하세요.")||"";addWorkEvidence({workId:btn.dataset.workId,ruleId:btn.dataset.ruleId,type,name,author});renderSafety(root);}));
  root.querySelectorAll("[data-approval-set]").forEach(btn=>btn.addEventListener("click",()=>{const person=prompt(`${btn.dataset.approvalSet} 담당자명을 입력하세요.`)||"";if(!person)return;setWorkApproval(btn.dataset.workId,btn.dataset.ruleId,btn.dataset.approvalSet,person);renderSafety(root);}));
  root.querySelectorAll("[data-audit-action]").forEach(btn=>btn.addEventListener("click",()=>{const status=btn.dataset.auditAction;const reason=status==="완료"?"":prompt(`${status} 사유를 입력하세요.`)||"";if(status!=="완료"&&!reason)return;setComplianceAction(btn.dataset.workId,btn.dataset.ruleId,status,reason);renderSafety(root);}));
}


function renderWorkDocumentGuide(){
  return `<section class="card safety-document-guide"><div class="mini-head"><h3>작업계획서와 작업허가서</h3><span>같은 서류가 아닙니다</span></div><div class="document-compare-grid"><article class="risk-green"><span>공사관리 주담당 · 안전관리 협조</span><h4>작업계획서</h4><strong>이 작업을 어떻게 수행할 것인가?</strong><p>작업순서, 작업방법, 장비, 인원, 위험요인과 안전대책을 사전에 정합니다.</p></article><article class="risk-red"><span>안전관리 주담당 · 공사관리 협조</span><h4>작업허가서</h4><strong>오늘 이 작업을 시작해도 되는가?</strong><p>작업 직전 현장조건, 안전시설, 감시자·신호수, 가스·화재·전기 등 작업별 통제조건을 확인합니다.</p></article></div><p class="help-text">모든 작업허가서가 일률적인 법정 의무인 것은 아닙니다. 법령상 의무, 발주처·회사 규정, 현장 작업허가제를 구분해서 적용합니다.</p></section>`;
}

export function renderSafety(root){
  ensureSafetyState();
  const d = buildSafetyDashboard();
  const complianceAudit = buildComplianceAudit();
  root.innerHTML = `
    <div class="section-head safety-headline">
      <div><span class="eyebrow">Safety Management · v${APP_VERSION}</span><h2>안전관리</h2><p>오늘 해야 할 일을 먼저 확인하고, 안전일지 작성·정기업무 관리·업무지식 열람 순서로 운영합니다.</p></div>
      <button class="secondary-btn" onclick="window.print()">현재 화면 출력</button>
    </div>
    <div class="safety-section-stack">
      ${renderWorkDocumentGuide()}
      ${accordionSection("automatic-audit","0. 누락 자동검사","안전관리 주담당 업무 자동확인 · 타 부서 항목은 참고 알림", `<section class="card compliance-center">${renderAutomaticComplianceAudit(complianceAudit)}</section>`, true)}
      ${accordionSection("today","1. 오늘 할 일","현장업무와 서류업무를 구분한 출근 체크리스트", `<section class="card today-work-board"><div class="today-work-guide"><b>오늘 업무 체크리스트</b><span>완료한 항목을 체크하면 취소선으로 정리됩니다. 공정 항목을 펼치면 세부 예방조치를 확인할 수 있습니다.</span></div>${renderTodayWorkChecklist(d)}</section>`, true)}
      ${accordionSection("journal","2. 안전일지","현장소장 결재용 2장 요약 양식", `<section class="card safety-daily-journal journal-two-page"><div class="journal-toolbar no-print"><button class="primary-btn small" data-action="printSafetyJournal">안전일지 출력</button></div><section class="journal-front-page">${renderJournalHeader(d)}${renderTbmJournalSection(d)}${renderHazardSummaryTable()}${renderRoutineJournalSection(d)}<div class="journal-attachment-line"><b>첨부파일</b><span>사진대지</span></div><div class="journal-page-number">안전일지 1/2</div></section></section>`)}
      ${accordionSection("journal-backup","3. 안전일지 백업데이터","위험발견·조치 상세 및 전후 사진", `<section class="card safety-daily-journal">${renderHazardBackupPage()}</section>`)}
      ${accordionSection("information","4. 안전관리 정보 열람","신규 안전관리자가 업무와 공정별 점검 포인트를 학습하는 참고영역", `<section class="card info-library"><h3>안전관리자 정기업무 안내</h3><p class="help-text">업무의 목적·주기·확인 포인트와 필요한 서류를 열람하는 영역입니다.</p>${renderRoutineInformation(d)}<h3>공정별 기본점검 DB</h3><p class="help-text">공정을 펼치면 현장에서 확인해야 할 위험요인과 점검 포인트를 볼 수 있습니다.</p>${renderProcessKnowledge()}</section>`)}
      ${accordionSection("routine-management","5. 안전관리자 정기업무 일정 관리","업무별 실시일·다음기한·서류·확인자·기타사항 기록", `<section class="card routine-management-board">${renderRoutineManagement(d)}</section>`, true)}
      ${accordionSection("compliance","6. 중대재해처벌법 Compliance Center의 이해와 관리방법","13대 의무·우선자료·관리방법을 설명하는 정보 열람영역", `<section class="card">${renderComplianceGuide()}</section>`)}
    </div>
  `;

  bindComplianceActions(root);
  root.querySelectorAll(".safety-accordion").forEach(section => {
    section.addEventListener("toggle", () => {
      ensureSafetyState();
      state.safetyAccordionOpen[section.dataset.section] = section.open;
      saveLocal();
    });
  });
  root.querySelectorAll("[data-action='printSafetyJournal']").forEach(btn => btn.addEventListener("click", () => {
    document.body.classList.add("print-safety-journal-only");
    const cleanup = () => { document.body.classList.remove("print-safety-journal-only"); window.removeEventListener("afterprint", cleanup); };
    window.addEventListener("afterprint", cleanup);
    window.print();
    setTimeout(cleanup, 1500);
  }));

  root.querySelector("#copySafetyTbmBtn")?.addEventListener("click", async () => {
    const text = root.querySelector("#safetyTbmText")?.innerText || "";
    try{ await navigator.clipboard.writeText(text); alert("TBM 전달사항을 복사했습니다."); }
    catch{ alert("복사 권한이 없어 직접 선택해서 복사하세요."); }
  });
  root.querySelectorAll("[data-action='toggleRoutine']").forEach(btn => {
    btn.addEventListener("click", () => { if(btn.dataset.done === "1") resetSafetyRoutineDone(btn.dataset.id); else markSafetyRoutineDone(btn.dataset.id); renderSafety(root); });
  });
  root.querySelectorAll("[data-action='toggleCheck']").forEach(input => {
    input.addEventListener("change", () => {
      ensureSafetyState();
      const key = `${cardKey(input.dataset.card)}:${input.dataset.index}`;
      if(input.checked) state.safetyChecks[key] = new Date().toISOString(); else delete state.safetyChecks[key];
      saveLocal(); renderSafety(root);
    });
  });
  root.querySelectorAll("[data-action='toggleProcess']").forEach(input => {
    input.addEventListener("change", () => {
      ensureSafetyState();
      const id = input.value;
      if(input.checked && !state.safetySelectedProcessIds.includes(id)) state.safetySelectedProcessIds.push(id);
      if(!input.checked) state.safetySelectedProcessIds = state.safetySelectedProcessIds.filter(x => x !== id);
      saveLocal(); renderSafety(root);
    });
  });
  root.querySelectorAll("[data-action='addEvidence']").forEach(input => input.addEventListener("change", () => handlePhoto(input.files?.[0], input.dataset.card, root)));
  root.querySelectorAll("[data-action='removeEvidence']").forEach(btn => btn.addEventListener("click", () => {
    const key = cardKey(btn.dataset.card); state.safetyEvidence[key] = (state.safetyEvidence[key] || []).filter((_, i) => i !== Number(btn.dataset.index)); saveLocal(); renderSafety(root);
  }));
  root.querySelector("[data-action='addCustomCard']")?.addEventListener("click", () => addCustomCardFromForm(root));
  root.querySelector("[data-action='clearTodayChecks']")?.addEventListener("click", () => {
    if(!confirm("오늘 체크와 오늘 첨부사진을 초기화할까요?")) return;
    const prefix = `${todayKey()}:`;
    Object.keys(state.safetyChecks || {}).forEach(k => { if(k.startsWith(prefix)) delete state.safetyChecks[k]; });
    Object.keys(state.safetyEvidence || {}).forEach(k => { if(k.startsWith(prefix)) delete state.safetyEvidence[k]; });
    saveLocal(); renderSafety(root);
  });
  root.querySelectorAll("[data-action='updateDiaryCount']").forEach(input => input.addEventListener("input", () => {
    const c = diaryCounts(); c[input.dataset.field] = input.value; saveLocal(); renderSafety(root);
  }));
  root.querySelectorAll("[data-action='toggleDiaryCheck']").forEach(input => input.addEventListener("change", () => {
    const key = `${todayKey()}:${input.dataset.key}`;
    if(input.checked) state.safetyDiaryChecks[key] = new Date().toISOString(); else delete state.safetyDiaryChecks[key];
    saveLocal(); renderSafety(root);
  }));
  root.querySelectorAll("[data-action='addDiaryUpload']").forEach(input => input.addEventListener("change", () => {
    const file = input.files?.[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = () => { diaryUploads(input.dataset.field).push({ name:file.name, type:file.type, dataUrl:String(reader.result), createdAt:new Date().toISOString() }); saveLocal(); renderSafety(root); };
    reader.readAsDataURL(file);
  }));
  root.querySelectorAll("[data-action='removeDiaryUpload']").forEach(btn => btn.addEventListener("click", () => {
    const list = diaryUploads(btn.dataset.field); list.splice(Number(btn.dataset.index), 1); saveLocal(); renderSafety(root);
  }));
  root.querySelector("[data-action='addHazard']")?.addEventListener("click", () => {
    const type = root.querySelector("#hazardType")?.value || "hazard";
    const category = root.querySelector("#hazardCategory")?.value || "시설";
    const location = root.querySelector("#hazardLocation")?.value.trim() || "";
    const occurredAt = root.querySelector("#hazardOccurredAt")?.value || new Date().toISOString();
    const target = root.querySelector("#hazardTarget")?.value.trim();
    const action = root.querySelector("#hazardAction")?.value.trim();
    if(!target || !action){ alert("위험발견 내용과 조치사항을 입력하세요."); return; }
    hazardsToday().push({ id:`hazard-${Date.now()}`, type, category, location, occurredAt, target, action, completed:true, createdAt:new Date().toISOString() });
    saveLocal(); renderSafety(root);
  });
  root.querySelectorAll("[data-action='removeHazard']").forEach(btn => btn.addEventListener("click", () => {
    hazardsToday().splice(Number(btn.dataset.index), 1); saveLocal(); renderSafety(root);
  }));
  root.querySelectorAll("[data-action='addHazardPhoto']").forEach(input => input.addEventListener("change", () => {
    const file = input.files?.[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = () => { const h = hazardsToday()[Number(input.dataset.index)]; if(h){ h[input.dataset.kind] = { name:file.name, dataUrl:String(reader.result), createdAt:new Date().toISOString() }; saveLocal(); renderSafety(root); } };
    reader.readAsDataURL(file);
  }));
  root.querySelectorAll("[data-journal-field]").forEach(input => input.addEventListener("input", () => { const m=journalMeta(); m[input.dataset.journalField]=input.value; saveLocal(); }));
  root.querySelectorAll("[data-education-field]").forEach(input => input.addEventListener("input", () => { const m=journalMeta(); m.education=m.education||{}; m.education[input.dataset.educationField]=input.value; saveLocal(); }));
  root.querySelector("[data-action='saveJournalTbm']")?.addEventListener("click", () => { journalMeta().tbmEdited=root.querySelector("#journalTbmEdited")?.value||""; saveLocal(); alert("TBM 전달사항을 저장했습니다."); });
  root.querySelector("[data-action='addTbmExtra']")?.addEventListener("click", () => { const input=root.querySelector("#tbmExtraInput"); const value=input?.value.trim(); if(!value) return; tbmExtras().push(value); saveLocal(); renderSafety(root); });
  root.querySelectorAll("[data-action='removeTbmExtra']").forEach(btn=>btn.addEventListener("click",()=>{tbmExtras().splice(Number(btn.dataset.index),1);saveLocal();renderSafety(root);}));
  root.querySelectorAll("[data-action='toggleTodayTask']").forEach(input=>input.addEventListener("change",()=>{const key=todayTaskKey(input.dataset.id);if(input.checked)state.safetyDiaryChecks[key]=new Date().toISOString();else delete state.safetyDiaryChecks[key];saveLocal();const row=input.closest('.today-work-row');row?.classList.toggle('done',input.checked);}));
  root.querySelector("[data-action='addTodayTask']")?.addEventListener("click",()=>{const title=root.querySelector('#todayCustomTaskTitle')?.value.trim();const detail=root.querySelector('#todayCustomTaskDetail')?.value.trim();if(!title)return;todayCustomTasks().push({id:`custom-${Date.now()}`,title,detail});saveLocal();renderSafety(root);});
  root.querySelectorAll("[data-action='removeTodayTask']").forEach(btn=>btn.addEventListener("click",e=>{e.preventDefault();const list=todayCustomTasks();const i=list.findIndex(x=>x.id===btn.dataset.id);if(i>=0)list.splice(i,1);saveLocal();renderSafety(root);}));

  root.querySelectorAll("[data-action='addRoutineRecord']").forEach(btn=>btn.addEventListener("click",()=>{const fields=[...root.querySelectorAll(`[data-routine-record="${btn.dataset.id}"]`)];const data=Object.fromEntries(fields.map(x=>[x.dataset.field,x.value]));if(!data.date){alert("실시일을 선택하세요.");return;}routineRecords(btn.dataset.id).push({date:data.date,checker:data.checker||"",performed:data.performed!=="false",note:data.note||"",createdAt:new Date().toISOString()});saveLocal();renderSafety(root);}));
  root.querySelectorAll("[data-action='removeRoutineRecord']").forEach(btn=>btn.addEventListener("click",()=>{const list=routineRecords(btn.dataset.id);list.splice(Number(btn.dataset.index),1);saveLocal();renderSafety(root);}));

}

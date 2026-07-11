import { upsertWorkInstance, removeWorkInstanceBySource } from "../services/workInstanceDatabase.js";
import { state, saveLocal } from "../core/state.js";
import { saveSchedule as saveScheduleApi } from "../services/api.js";

const STORAGE_KEY = "guisArcScheduleUiV949";
const CATEGORY_META = {
  "타설": { label:"콘크리트 타설", tone:"concrete", order: 10 },
  "점검": { label:"점검", tone:"inspection", order: 20 },
  "작업": { label:"작업", tone:"work", order: 30 },
  "장비": { label:"장비", tone:"equipment", order: 40 },
  "자재": { label:"자재", tone:"material", order: 50 }
};
let cardSortDirection = "asc";
function categoryOrder(type){ return CATEGORY_META[type]?.order ?? 90; }
function compareScheduleBase(a,b){
  const order = categoryOrder(a.type) - categoryOrder(b.type);
  if(order) return order;
  return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
}
function compareScheduleCards(a,b){
  const base = compareScheduleBase(a,b);
  return cardSortDirection === "asc" ? base : -base;
}
const STATUS_LIST = ["미확정", "확정"];
function normalizeConfirmStatus(status){
  if(status === "확정") return "확정";
  if(status === "진행" || status === "완료") return "확정";
  return "미확정";
}
const TRADE_LIST = ["점검", "철근콘크리트공사", "가설공사", "토공사", "지정공사", "철골공사", "조적공사", "방수공사", "마감공사", "기계설비", "전기통신", "기타"];
const SUBTRADE_BY_TRADE = {
  "점검": ["국토안전부", "안전보건공단", "노동부"],
  "철근콘크리트공사": ["콘크리트 타설", "거푸집공사", "철근공사", "동바리", "양생", "해체", "검측"],
  "가설공사": ["비계", "가설울타리", "안전시설", "양중계획"],
  "토공사": ["터파기", "되메우기", "흙막이", "배수"],
  "지정공사": ["파일천공", "파일항타", "두부정리", "기초정리"],
  "철골공사": ["반입", "양중", "세우기", "볼팅", "용접"],
  "조적공사": ["블록", "벽돌", "ALC", "미장"],
  "방수공사": ["바탕정리", "도막", "시트", "담수시험"],
  "마감공사": ["타일", "도장", "수장", "창호", "금속"],
  "기계설비": ["배관", "덕트", "장비반입", "시운전"],
  "전기통신": ["배관", "입선", "분전반", "통신"],
  "기타": ["일반", "협의", "검측", "회의"]
};

const SUBTRADE_STANDARDS = {
  "콘크리트 타설": {
    priority: "critical",
    safety: "펌프카·타설구간 통제, 슬래브 개구부·단부 추락방지, 우천·강풍 시 작업중지 검토",
    quality: "타설 전 검측, 슬럼프·공기량·염화물, 공시체, 이어치기·다짐·양생 계획 확인",
    construction: "타설구획·타설순서·레미콘 배차·펌프 위치·진입동선·후속 미장/양생 인력 확인"
  },
  "거푸집공사": { safety: "동바리·작업발판·단부 안전난간, 해체 순서 관리", quality: "치수·수직도·레벨·박리제·긴결재 상태 확인", construction: "자재 반입·설치구간·해체구간·동바리 존치기간 확인" },
  "철근공사": { safety: "철근 절단·가공부 협착, 돌출철근 보호캡, 양중구간 통제", quality: "배근간격·정착·이음·피복두께·스페이서·개구부 보강 확인", construction: "반입량·가공도·구간별 선후행 공정·검측 요청일 확인" },
  "동바리": { safety: "침하방지, 수평연결재, 상하부 받침, 해체 전 강도 확인", quality: "설치간격·수직도·잭베이스·멍에/장선 상태 확인", construction: "설치구간·존치기간·해체 가능일·타설하중 검토" },
  "양생": { safety: "보양재 설치·해체 시 추락/전도, 급열장비 화재위험 확인", quality: "습윤양생·보온양생·온도기록·탈형강도 확인", construction: "양생기간·후속공정 착수 가능일·기상조건 확인" },
  "비계": { safety: "작업발판·난간·벽이음·승강설비·낙하물 방지 확인", quality: "설치상태·고정상태·허용하중·사용전 점검", construction: "설치/해체구간·사용기간·타공정 간섭 확인" },
  "파일천공": { safety: "장비 회전반경 통제, 지반침하, 항타/천공 소음·비산 관리", quality: "위치·수직도·천공심도·지지층 확인", construction: "장비동선·토사처리·인접구조물 영향 확인" },
  "파일항타": { safety: "항타기 전도·낙하물·소음진동·출입통제", quality: "관입량·리바운드·파일 손상·시공기록 확인", construction: "파일반입·항타순서·검측 및 기록관리" },
  "두부정리": { safety: "브레이커 비산·소음·분진·철근 절단 안전", quality: "두부레벨·파손부 보수·정착철근 손상 확인", construction: "폐기물 반출·기초철근 후속작업 간섭 확인" },
  "반입": { safety: "하역구역 통제, 지게차/크레인 동선 분리", quality: "규격·수량·성적서·보관상태 확인", construction: "반입시간·야적장·후속작업 투입계획 확인" },
  "양중": { safety: "신호수·줄걸이·인양하중·작업반경 통제", quality: "부재 손상·체결부 상태·검수 확인", construction: "크레인 위치·양중순서·타공정 간섭 확인" },
  "일반": { safety: "작업 전 위험성평가와 작업구역 통제 확인", quality: "시방서·도면·검측기준 확인", construction: "선후행 공정·인력·자재·장비 투입계획 확인" }
};

function getSubtradeStandard(subTrade){
  return SUBTRADE_STANDARDS[subTrade] || SUBTRADE_STANDARDS["일반"];
}

const INSPECTION_STANDARDS = {
  "국토안전부": {
    adminTargets: ["공사관리", "품질관리", "안전관리"],
    focus: "구조체 시공상태, 품질시험·검측기록, 공정 대비 현장관리 이행자료 중심으로 준비",
    concreteFocus: "철근콘크리트 주공정일 경우 배근검측, 콘크리트 타설기록, 공시체·강도관리, 거푸집·동바리 존치자료를 우선 정리"
  },
  "안전보건공단": {
    adminTargets: ["안전관리", "공사관리"],
    focus: "위험성평가, TBM, 추락·낙하·장비동선, 고위험작업 작업계획서 중심으로 준비",
    concreteFocus: "타설 작업 시 펌프카 아웃트리거, 타설구간 통제, 단부·개구부 추락방지, 호스 요동·협착 위험을 중점 점검"
  },
  "노동부": {
    adminTargets: ["안전관리", "노무관리", "공사관리"],
    focus: "산업안전보건법 이행, 교육·보호구·작업허가·사고예방 조치와 근로자 관리자료 중심으로 준비",
    concreteFocus: "콘크리트 타설 전후 고위험작업 교육, 장시간 작업 휴식, 야간/우천 작업 중지 판단 기록을 우선 확인"
  }
};
function getInspectionStandard(subTrade){ return INSPECTION_STANDARDS[subTrade] || INSPECTION_STANDARDS["국토안전부"]; }

const HOLIDAYS_2026 = {
  "2026-01-01":"신정", "2026-02-16":"설날 연휴", "2026-02-17":"설날", "2026-02-18":"설날 연휴",
  "2026-03-01":"삼일절", "2026-03-02":"삼일절 대체공휴일", "2026-05-05":"어린이날·부처님오신날",
  "2026-05-25":"대체공휴일", "2026-06-06":"현충일", "2026-08-15":"광복절", "2026-08-17":"광복절 대체공휴일",
  "2026-09-24":"추석 연휴", "2026-09-25":"추석", "2026-09-26":"추석 연휴", "2026-10-03":"개천절",
  "2026-10-05":"개천절 대체공휴일", "2026-10-09":"한글날", "2026-12-25":"성탄절"
};

let scheduleUi = { month: null, selectedDate: null };
let selectedScheduleIds = new Set();
let activeScheduleRoot = null;

function ymd(date){
  const y = date.getFullYear();
  const m = String(date.getMonth()+1).padStart(2,"0");
  const d = String(date.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}
function parseYmd(value){
  const [y,m,d] = String(value).split("-").map(Number);
  return new Date(y, (m||1)-1, d||1);
}
function monthKey(date){ return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`; }
function escapeHtml(value){
  return String(value ?? "").replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
}
function normalizeSchedules(){
  state.schedules = Array.isArray(state.schedules) ? state.schedules : [];
  state.schedules = state.schedules.map((item, index) => ({
    id: item.id ?? `${Date.now()}-${index}`,
    type: CATEGORY_META[item.type || item.category] ? (item.type || item.category) : (String(item.title||"").includes("타설") ? "타설" : "작업"),
    date: item.date || ymd(new Date()),
    title: item.title || "제목 없음",
    description: item.description || "",
    trade: item.trade || (item.type === "점검" ? "점검" : (item.type === "타설" ? "철근콘크리트공사" : "기타")),
    subTrade: item.subTrade || (item.type === "점검" ? "국토안전부" : (item.type === "타설" ? "콘크리트 타설" : "일반")),
    location: item.location || "",
    status: normalizeConfirmStatus(item.status),
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString(),
    checklist: item.checklist || {},
    processId: item.processId || item.process?.id || null
  }));
}
function loadUi(){
  try { scheduleUi = { ...scheduleUi, ...(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}) }; } catch {}
  const today = new Date();
  scheduleUi.month = scheduleUi.month || monthKey(today);
  scheduleUi.selectedDate = scheduleUi.selectedDate || ymd(today);
}
function saveUi(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(scheduleUi)); }
async function persistSchedule(item){
  if(state.mode === "site" && state.site?.siteCode && state.site?.pin){
    try{ await saveScheduleApi(state.site.siteCode, state.site.pin, item); }
    catch(error){ console.warn("D1 일정 저장 실패, 로컬 저장 유지:", error); }
  }
}
function schedulesOn(date){ return state.schedules.filter(item => item.date === date); }
function setMonthOffset(offset){
  const [y,m] = scheduleUi.month.split("-").map(Number);
  const next = new Date(y, m - 1 + offset, 1);
  scheduleUi.month = monthKey(next);
  saveUi();
}
function setToday(){
  const today = new Date();
  scheduleUi.month = monthKey(today);
  scheduleUi.selectedDate = ymd(today);
  saveUi();
}
function monthMatrix(){
  const [y,m] = scheduleUi.month.split("-").map(Number);
  const first = new Date(y, m-1, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  return Array.from({length:42}, (_,i) => { const d = new Date(start); d.setDate(start.getDate()+i); return d; });
}
function categoryClass(type){ return CATEGORY_META[type]?.tone || "work"; }
function scheduleChip(item){
  const meta = CATEGORY_META[item.type] || CATEGORY_META["작업"];
  return `<div class="sch-chip sch-${meta.tone}" title="${escapeHtml(item.type)} · ${escapeHtml(item.title)}">
    <b>${escapeHtml(item.type)}</b><em>${escapeHtml(item.title)}</em>
  </div>`;
}
function renderCalendar(){
  const [y,m] = scheduleUi.month.split("-").map(Number);
  return `<section class="card schedule-calendar-card">
    <div class="schedule-toolbar">
      <button class="secondary-btn small" data-action="prevMonth">◀ 이전달</button>
      <div class="schedule-month-title">${y}년 ${m}월</div>
      <button class="secondary-btn small" data-action="nextMonth">다음달 ▶</button>
      <button class="primary-btn small" data-action="today">오늘</button>
    </div>
    <div class="month-weekdays"><span class="sun">일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span class="sat">토</span></div>
    <div class="month-grid">${monthMatrix().map(d => {
      const date = ymd(d);
      const list = schedulesOn(date).sort(compareScheduleBase);
      const inMonth = d.getMonth() === m-1;
      const dow = d.getDay();
      const holiday = HOLIDAYS_2026[date];
      const today = ymd(new Date());
      const cls = ["month-day", inMonth?"":"outside", date===today?"today":"", date===scheduleUi.selectedDate?"selected":"", dow===0?"sun":"", dow===6?"sat":"", holiday?"holiday":""].filter(Boolean).join(" ");
      return `<button class="${cls}" data-date="${date}" title="${holiday ? escapeHtml(holiday) : ""}">
        <div class="day-top"><strong>${d.getDate()}</strong>${list.length ? `<span class="day-count">${list.length}건</span>` : ""}</div>
        <div class="day-items">${list.slice(0,4).map(scheduleChip).join("")}${list.length>4 ? `<div class="more-line">+${list.length-4}건 더보기</div>` : ""}</div>
      </button>`;
    }).join("")}</div>
  </section>`;
}
function renderDetailCards(){
  const list = schedulesOn(scheduleUi.selectedDate).sort(compareScheduleCards);
  if(!list.length) return `<div class="empty-detail">선택한 날짜의 일정이 없습니다. 아래 새 일정에서 바로 추가할 수 있습니다.</div>`;
  return list.map(item => {
    const meta = CATEGORY_META[item.type] || CATEGORY_META["작업"];
    const checked = selectedScheduleIds.has(String(item.id));
    return `<article class="schedule-detail-card detail-${meta.tone} ${checked ? "selected-card" : ""}" draggable="true" data-drag-id="${item.id}">
      <label class="card-select" title="여러 장 선택"><input type="checkbox" data-action="selectCard" data-id="${item.id}" ${checked ? "checked" : ""}></label>
      <div class="detail-main">
        <div class="detail-type"><span class="type-bar"></span>${escapeHtml(meta.label)} · ${escapeHtml(item.workId || "WORK 연결중")}</div>
        <h4>${escapeHtml(item.title)}</h4>
        <div class="detail-line">
          ${item.location ? `<span>위치 ${escapeHtml(item.location)}</span>` : ""}
          <span>${escapeHtml(item.trade)} / ${escapeHtml(item.subTrade)}</span>
        </div>
        ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ""}
      </div>
      <div class="card-status-slot"><span class="status-pill ${item.status === "확정" ? "confirmed" : "unconfirmed"}">${escapeHtml(item.status)}</span></div>
      <div class="detail-actions">
        <button class="mini-btn" data-action="edit" data-id="${item.id}">수정</button>
        <button class="mini-btn danger" data-action="delete" data-id="${item.id}">삭제</button>
      </div>
    </article>`;
  }).join("");
}
function renderDetailGuide(){
  const selectedCount = selectedScheduleIds.size;
  return `<div class="schedule-detail-guide">
    <span>카드는 왼쪽 달력 날짜로 드래그하면 일정 날짜가 이동됩니다.</span>
    <span>체크 후 드래그하면 여러 장을 묶어서 이동할 수 있습니다.</span>
    ${selectedCount ? `<b>${selectedCount}건 선택됨</b>` : ""}
  </div>`;
}
function renderSidePanel(){
  const d = parseYmd(scheduleUi.selectedDate);
  const holiday = HOLIDAYS_2026[scheduleUi.selectedDate];
  const list = schedulesOn(scheduleUi.selectedDate);
  return `<aside class="card schedule-detail-panel">
    <div class="detail-head">
      <div><span class="eyebrow">선택 날짜</span><h3>${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")}</h3></div>
      <div class="detail-head-actions"><button class="mini-btn sort-btn" data-action="toggleSort">정렬 ${cardSortDirection === "asc" ? "↓" : "↑"}</button><button class="mini-btn danger" data-action="deleteSelected">체크삭제</button><button class="mini-btn danger" data-action="deleteAllDay">전체삭제</button><strong>${list.length}건</strong></div>
    </div>
    ${renderDetailGuide()}<div class="detail-list">${renderDetailCards()}</div>
  </aside>`;
}
function subtradeOptions(trade){
  return (SUBTRADE_BY_TRADE[trade] || SUBTRADE_BY_TRADE["기타"]).map((name)=>`<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
}
function renderStandardPreview(){ return ""; }
function renderForm(){
  const selected = scheduleUi.selectedDate;
  const defaultTrade = "철근콘크리트공사";
  const defaultSubTrade = "콘크리트 타설";
  const tradeOptions = TRADE_LIST.map(t=>`<option value="${escapeHtml(t)}" ${t===defaultTrade?"selected":""}>${escapeHtml(t)}</option>`).join("");
  return `<section class="card schedule-form-card">
    <div class="form-title"><h3>새 일정</h3><p>세부공종은 자유입력이 아니라 기준 DB에서 선택합니다. 기준에 없는 공종은 먼저 DB에 추가한 뒤 일정에 반영합니다.</p></div>
    <form id="scheduleForm" class="schedule-inline-form">
      <label>날짜<input name="date" type="date" value="${selected}"></label>
      <label>구분<select name="type"><option value="타설">콘크리트 타설</option><option value="점검">점검</option><option value="작업">작업</option><option value="장비">장비</option><option value="자재">자재</option></select></label>
      <label class="wide">제목<input name="title" placeholder="예: 3층 슬래브 타설 / 철근 D13 반입" required></label>
      <label>공종<select name="trade">${tradeOptions}</select></label>
      <label>세부공종<select name="subTrade">${subtradeOptions(defaultTrade)}</select></label>
      <label>위치<input name="location" placeholder="예: 3층 A구간"></label>
      <label>확정여부<select name="status">${STATUS_LIST.map(s=>`<option value="${s}">${s}</option>`).join("")}</select></label>
      <label class="wide note">내용<input name="description" placeholder="예: 우천 시 다음 작업 가능일로 이동"></label>
      <button class="primary-btn" type="submit">일정 추가</button>
    </form>
  </section>`;
}
function renderAll(root){
  normalizeSchedules();
  root.innerHTML = `<div class="section-head schedule-headline"><div><span class="eyebrow">Schedule Decision Board</span><h2>현장 일정</h2><p>작업 · 자재 · 장비 · 콘크리트 타설 일정을 월간 달력에서 바로 조정합니다.</p></div></div>
  <div class="schedule-layout"><div>${renderCalendar()}${renderForm()}</div>${renderSidePanel()}</div>`;
}
function addSchedule(form){
  const data = Object.fromEntries(new FormData(form).entries());
  const type = data.type || "작업";
  const trade = data.trade || (type === "점검" ? "점검" : (type === "타설" ? "철근콘크리트공사" : "기타"));
  const allowedSubtrades = SUBTRADE_BY_TRADE[trade] || SUBTRADE_BY_TRADE["기타"];
  const subTrade = allowedSubtrades.includes(data.subTrade) ? data.subTrade : allowedSubtrades[0];
  const item = { id: Date.now(), type, date: data.date || scheduleUi.selectedDate, title: data.title?.trim() || "새 일정", description: data.description?.trim() || "", trade, subTrade, location: data.location?.trim() || "", status: normalizeConfirmStatus(data.status), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const work = upsertWorkInstance({...item, sourceId:item.id}, "schedule", false);
  item.workId = work.workId;
  state.schedules.push(item);
  scheduleUi.selectedDate = item.date;
  scheduleUi.month = monthKey(parseYmd(item.date));
  persistSchedule(item);
  saveLocal(); saveUi();
}
function editSchedule(id){
  const item = state.schedules.find(x => String(x.id) === String(id));
  if(!item) return;
  openScheduleEditModal(String(id));
}
function openScheduleEditModal(id){
  const item = state.schedules.find(x => String(x.id) === String(id));
  if(!item) return;
  const existing = document.querySelector(".schedule-modal-backdrop");
  existing?.remove();
  const trade = item.trade || (item.type === "점검" ? "점검" : "기타");
  const subTradeOptions = subtradeOptions(trade);
  const backdrop = document.createElement("div");
  backdrop.className = "schedule-modal-backdrop";
  backdrop.innerHTML = `<div class="schedule-edit-modal" role="dialog" aria-modal="true">
    <div class="form-title modal-form-title"><h3>일정 수정</h3><p>날짜 변경은 카드를 달력으로 드래그해서 처리합니다.</p></div>
    <form id="scheduleEditForm" class="schedule-inline-form schedule-edit-form">
      <label>구분<select name="type">${Object.keys(CATEGORY_META).map(type => `<option value="${escapeHtml(type)}" ${item.type===type ? "selected" : ""}>${escapeHtml(CATEGORY_META[type].label)}</option>`).join("")}</select></label>
      <label class="wide">제목<input name="title" value="${escapeHtml(item.title)}" required></label>
      <label>공종<select name="trade">${TRADE_LIST.map(t=>`<option value="${escapeHtml(t)}" ${t===trade?"selected":""}>${escapeHtml(t)}</option>`).join("")}</select></label>
      <label>세부공종<select name="subTrade">${subTradeOptions}</select></label>
      <label>위치<input name="location" value="${escapeHtml(item.location || "")}" placeholder="예: 3층 A구간"></label>
      <label class="status-choice-field">확정여부<div class="status-choice-grid confirm-choice-grid">${STATUS_LIST.map(status => `<label class="status-choice"><input type="radio" name="status" value="${status}" ${normalizeConfirmStatus(item.status) === status ? "checked" : ""}><span>${status}</span></label>`).join("")}</div></label>
      <label class="wide note">내용<input name="description" value="${escapeHtml(item.description || "")}" placeholder="예: 우천 시 다음 작업 가능일로 이동"></label>
      <div class="status-modal-actions edit-modal-actions"><button class="mini-btn" type="button" data-modal="cancel">취소</button><button class="primary-btn small" type="submit">저장</button></div>
    </form>
  </div>`;
  document.body.appendChild(backdrop);
  const form = backdrop.querySelector("#scheduleEditForm");
  if(form?.elements.subTrade) form.elements.subTrade.value = item.subTrade || (SUBTRADE_BY_TRADE[trade] || [])[0] || "일반";
  backdrop.addEventListener("click", (event) => {
    if(event.target.dataset.modal === "cancel" || event.target === backdrop){ backdrop.remove(); }
  });
  form.addEventListener("change", (event) => {
    if(event.target.name === "type"){
      if(event.target.value === "점검"){
        form.elements.trade.value = "점검";
        form.elements.subTrade.innerHTML = subtradeOptions("점검");
      }
      if(event.target.value === "타설"){
        form.elements.trade.value = "철근콘크리트공사";
        form.elements.subTrade.innerHTML = subtradeOptions("철근콘크리트공사");
        form.elements.subTrade.value = "콘크리트 타설";
      }
    }
    if(event.target.name === "trade"){
      form.elements.subTrade.innerHTML = subtradeOptions(event.target.value);
    }
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const target = state.schedules.find(x => String(x.id) === id);
    if(!target) { backdrop.remove(); return; }
    const data = Object.fromEntries(new FormData(form).entries());
    const allowedSubtrades = SUBTRADE_BY_TRADE[data.trade] || SUBTRADE_BY_TRADE["기타"];
    target.type = CATEGORY_META[data.type] ? data.type : target.type;
    target.title = data.title?.trim() || target.title;
    target.trade = data.trade || target.trade;
    target.subTrade = allowedSubtrades.includes(data.subTrade) ? data.subTrade : allowedSubtrades[0];
    target.location = data.location?.trim() || "";
    target.status = normalizeConfirmStatus(data.status);
    target.description = data.description?.trim() || "";
    target.updatedAt = new Date().toISOString();
    const work = upsertWorkInstance({...target, sourceId:target.id, workId:target.workId}, "schedule", false);
    target.workId = work.workId;
    scheduleUi.selectedDate = target.date;
    scheduleUi.month = monthKey(parseYmd(target.date));
    persistSchedule(target);
    saveLocal(); saveUi();
    backdrop.remove();
    if(activeScheduleRoot) renderSchedule(activeScheduleRoot);
  });
}
function deleteSchedule(id){
  const item = state.schedules.find(x => String(x.id) === String(id));
  if(!item || !confirm(`일정을 삭제할까요?\n${item.title}`)) return;
  selectedScheduleIds.delete(String(id));
  state.schedules = state.schedules.filter(x => String(x.id) !== String(id));
  removeWorkInstanceBySource("schedule", id, false);
  saveLocal();
}
function deleteAllSelectedDate(){
  const list = schedulesOn(scheduleUi.selectedDate);
  if(!list.length) return;
  if(!confirm(`${scheduleUi.selectedDate} 일정 ${list.length}건을 모두 삭제할까요?`)) return;
  const dayIds = new Set(list.map(item => String(item.id)));
  state.schedules = state.schedules.filter(item => !dayIds.has(String(item.id)));
  list.forEach(item => removeWorkInstanceBySource("schedule", item.id, false));
  selectedScheduleIds = new Set([...selectedScheduleIds].filter(id => !dayIds.has(id)));
  saveLocal();
}
function deleteSelectedSchedules(){
  const selected = [...selectedScheduleIds];
  if(!selected.length){ alert("삭제할 카드를 먼저 체크하세요."); return; }
  if(!confirm(`선택한 일정 ${selected.length}건을 삭제할까요?`)) return;
  const idSet = new Set(selected.map(String));
  state.schedules.filter(item => idSet.has(String(item.id))).forEach(item => removeWorkInstanceBySource("schedule", item.id, false));
  state.schedules = state.schedules.filter(item => !idSet.has(String(item.id)));
  selectedScheduleIds.clear();
  saveLocal();
}
function moveSchedule(id, date){
  moveSchedules([id], date);
}
function moveSchedules(ids, date){
  const idSet = new Set(ids.map(String));
  const moved = [];
  state.schedules.forEach(item => {
    if(idSet.has(String(item.id))){
      item.date = date;
      item.updatedAt = new Date().toISOString();
      upsertWorkInstance({...item, sourceId:item.id, workId:item.workId}, "schedule", false);
      moved.push(item);
    }
  });
  if(!moved.length) return;
  scheduleUi.selectedDate = date;
  scheduleUi.month = monthKey(parseYmd(date));
  moved.forEach(item => persistSchedule(item));
  selectedScheduleIds.clear();
  saveLocal(); saveUi();
}
function bindEvents(root){
  root.addEventListener("click", (event) => {
    const monthAction = event.target.closest("[data-action='prevMonth'],[data-action='nextMonth'],[data-action='today']");
    if(monthAction){
      const action = monthAction.dataset.action;
      if(action === "prevMonth") setMonthOffset(-1);
      if(action === "nextMonth") setMonthOffset(1);
      if(action === "today") setToday();
      renderSchedule(root); return;
    }
    const sortButton = event.target.closest("[data-action='toggleSort']");
    if(sortButton){ cardSortDirection = cardSortDirection === "asc" ? "desc" : "asc"; renderSchedule(root); return; }
    const deleteSelectedButton = event.target.closest("[data-action='deleteSelected']");
    if(deleteSelectedButton){ deleteSelectedSchedules(); renderSchedule(root); return; }
    const deleteAllButton = event.target.closest("[data-action='deleteAllDay']");
    if(deleteAllButton){ deleteAllSelectedDate(); renderSchedule(root); return; }
    const selectBox = event.target.closest("[data-action='selectCard']");
    if(selectBox){
      if(selectBox.checked) selectedScheduleIds.add(String(selectBox.dataset.id));
      else selectedScheduleIds.delete(String(selectBox.dataset.id));
      renderSchedule(root); return;
    }
    const day = event.target.closest(".month-day[data-date]");
    if(day){ scheduleUi.selectedDate = day.dataset.date; saveUi(); renderSchedule(root); return; }
    const btn = event.target.closest("[data-action='edit'],[data-action='delete']");
    if(btn){
      if(btn.dataset.action === "edit") editSchedule(btn.dataset.id);
      if(btn.dataset.action === "delete") deleteSchedule(btn.dataset.id);
      renderSchedule(root);
    }
  });
  root.addEventListener("submit", (event) => {
    if(event.target.id !== "scheduleForm") return;
    event.preventDefault();
    addSchedule(event.target);
    renderSchedule(root);
  });
  root.addEventListener("change", (event) => {
    const form = event.target.closest("#scheduleForm");
    if(!form) return;
    if(event.target.name === "type"){
      if(event.target.value === "점검"){
        form.elements.trade.value = "점검";
        form.elements.subTrade.innerHTML = subtradeOptions("점검");
      }
      if(event.target.value === "타설"){
        form.elements.trade.value = "철근콘크리트공사";
        form.elements.subTrade.innerHTML = subtradeOptions("철근콘크리트공사");
        form.elements.subTrade.value = "콘크리트 타설";
      }
    }
    if(event.target.name === "trade"){
      const subTrade = form.elements.subTrade;
      subTrade.innerHTML = subtradeOptions(event.target.value);
    }
  });
  root.addEventListener("dragstart", (event) => {
    const card = event.target.closest(".schedule-detail-card[draggable='true']");
    if(!card) return;
    const dragId = String(card.dataset.dragId);
    const ids = selectedScheduleIds.has(dragId) ? [...selectedScheduleIds] : [dragId];
    event.dataTransfer.setData("text/plain", ids.join(","));
    event.dataTransfer.effectAllowed = "move";
    card.classList.add("dragging");
  });
  root.addEventListener("dragend", (event) => event.target.closest(".schedule-detail-card")?.classList.remove("dragging"));
  root.addEventListener("dragover", (event) => {
    const day = event.target.closest(".month-day[data-date]");
    if(!day) return;
    event.preventDefault();
    day.classList.add("drop-ready");
  });
  root.addEventListener("dragleave", (event) => event.target.closest(".month-day")?.classList.remove("drop-ready"));
  root.addEventListener("drop", (event) => {
    const day = event.target.closest(".month-day[data-date]");
    if(!day) return;
    event.preventDefault();
    day.classList.remove("drop-ready");
    const ids = event.dataTransfer.getData("text/plain").split(",").map(v => v.trim()).filter(Boolean);
    if(ids.length) { moveSchedules(ids, day.dataset.date); renderSchedule(root); }
  });
}

const boundRoots = new WeakSet();

export function renderSchedule(root){
  activeScheduleRoot = root;
  loadUi();
  renderAll(root);
  if(!boundRoots.has(root)){
    bindEvents(root);
    boundRoots.add(root);
  }
}

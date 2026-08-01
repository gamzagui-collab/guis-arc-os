import {escapeHtml,errorState,loadingSkeleton} from "../../../packages/ui/components.js";

const kstDate=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const monthKey=date=>date.slice(0,7);
const monthRange=month=>{
 const [year,value]=month.split("-").map(Number),last=new Date(Date.UTC(year,value,0)).getUTCDate();
 return {from:`${month}-01`,to:`${month}-${String(last).padStart(2,"0")}`,year,month:value,last};
};
const addMonth=(month,amount)=>{const [year,value]=month.split("-").map(Number),date=new Date(Date.UTC(year,value-1+amount,1));return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,"0")}`};
const statusLabel=value=>({SCHEDULED:"예정",CHANGED:"변경",CANCELLED:"취소",CONFIRMED:"확정"}[value]||"예정");
const sourceLabel=value=>value==="CONFIRMED_DAILY_REPORT"?"확정 공사일보":"월간계획";
const weekday=date=>new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",weekday:"long"}).format(new Date(`${date}T12:00:00+09:00`));
const shortDate=date=>{const [,month,day]=date.split("-").map(Number);return `${month}월 ${day}일 ${weekday(date)}`};
const timeText=item=>item.startTime&&item.endTime?`${item.startTime}~${item.endTime}`:item.startTime?`${item.startTime} 시작`:item.endTime?`${item.endTime} 종료`:"시간 미정";

export const scheduleCardView=item=>({
 company:String(item.company||"").trim()||null,
 trade:String(item.trade||"").trim()||"공종 미기재",
 workforce:item.plannedWorkforce===null||item.plannedWorkforce===undefined?"인원 미정":`${Number(item.plannedWorkforce)}명`,
 location:String(item.location||"").trim()||"위치 정보 없음",
 description:String(item.description||""),
 time:timeText(item),
 caution:String(item.caution||"").trim()||null,
 status:statusLabel(item.status)
});
export const scheduleCard=item=>{
 const view=scheduleCardView(item);
 return `<article class="card construction-schedule-card" data-schedule-id="${escapeHtml(item.id||"")}">
 <header><div class="construction-schedule-card__identity">${view.company?`<p class="construction-schedule-card__company">${escapeHtml(view.company)}</p>`:""}<h3>${escapeHtml(view.trade)} <span aria-hidden="true">·</span> <strong>${escapeHtml(view.workforce)}</strong></h3></div><span class="status-badge">${escapeHtml(view.status)}</span></header>
 <p class="construction-schedule-card__location ${String(item.location||"").trim()?"":"is-missing"}">${escapeHtml(view.location)}</p>
 <p class="construction-schedule-card__description">${escapeHtml(view.description)}</p>
 <div class="construction-schedule-card__meta"><span>${escapeHtml(view.time)}</span>${view.company?"":'<span class="construction-schedule-card__missing-company">회사 미지정</span>'}</div>
 ${view.caution?`<section class="construction-schedule-card__caution" aria-label="주의사항"><h4>주의사항</h4><p>${escapeHtml(view.caution)}</p></section>`:""}
</article>`;
};

export const constructionScheduleHtml=data=>{
 const sections=[["today","오늘"],["tomorrow","내일"],["dayAfterTomorrow","모레"]];
 return `<section class="construction-today-grid">${sections.map(([key,label])=>{
  const section=data.schedule?.[key]||{date:kstDate(),entries:[]},items=section.entries||[];
  return `<article class="construction-day-section"><header><div><span>${label}</span><h2>${escapeHtml(shortDate(section.date))}</h2></div><small>${escapeHtml(section.notice||sourceLabel(section.source))}</small></header><div>${items.length?items.map(scheduleCard).join(""):'<p class="state-message">등록된 공사 일정이 없습니다.</p>'}</div></article>`;
 }).join("")}</section>`;
};
export const refreshConstructionSchedule=async({api,draw,viewport=globalThis})=>{
 const x=Number(viewport.scrollX||0),y=Number(viewport.scrollY||0);
 try{draw(await api("/today-schedule"))}finally{viewport.scrollTo?.(x,y)}
};

export async function renderConstructionTodayPage({content,api,header}){
 content.innerHTML=loadingSkeleton();
 try{
  const draw=data=>{content.innerHTML=header("공사 Today","오늘·내일·모레의 실제 공사 일정을 확인합니다.")+constructionScheduleHtml(data)};
  draw(await api("/today-schedule"));
  const timer=setInterval(async()=>{if(!content.isConnected){clearInterval(timer);return}try{await refreshConstructionSchedule({api,draw})}catch{}},60000);
 }catch(error){content.innerHTML=header("공사 Today","허용된 현장의 일정만 표시합니다.")+errorState(error.message)}
}

const optionRows=(items,value,label)=>`<option value="">${label}</option>${items.map(item=>`<option value="${escapeHtml(item[value])}">${escapeHtml(item.display_name||item.name)}</option>`).join("")}`;
export const resolveCompanyTradeSelection=(trades,selectedTrade,{initial=false}={})=>{
 const available=Array.isArray(trades)?trades:[],selected=available.some(item=>item.trade_key===selectedTrade)?selectedTrade:"";
 const message=selected||!selectedTrade?(available.length?"":"현재 현장에서 사용할 수 있는 공종이 없습니다."):(initial?"현재 계약에서 사용할 수 없는 기존 공종입니다. 공종을 다시 선택해 주세요.":"선택한 회사에서 사용할 공종을 다시 선택해 주세요.");
 return {available,selected,message};
};
const planCard=(plan,editable)=>`<article class="construction-plan-row" data-plan-id="${escapeHtml(plan.id)}">
 <button type="button" class="construction-plan-summary" aria-expanded="false" aria-controls="plan-${escapeHtml(plan.id)}">
  <span><strong>${escapeHtml(plan.tradeLabel)} · ${plan.plannedWorkforce===null?"인원 미정":`${Number(plan.plannedWorkforce)}명`}</strong><small>${escapeHtml(plan.workDescription)}</small></span>
  <span class="status-badge">${escapeHtml(statusLabel(plan.status))}</span>
 </button>
 <div id="plan-${escapeHtml(plan.id)}" class="construction-plan-detail" hidden>
  <dl><div><dt>기간</dt><dd>${escapeHtml(plan.startDate===plan.endDate?plan.startDate:`${plan.startDate} ~ ${plan.endDate}`)}</dd></div><div><dt>회사</dt><dd>${escapeHtml(plan.contractorCompanyName||"회사 미지정")}</dd></div><div><dt>위치</dt><dd>${escapeHtml(plan.locationText||"위치 미지정")}</dd></div><div><dt>시간</dt><dd>${escapeHtml(timeText(plan))}</dd></div><div><dt>주의사항</dt><dd>${escapeHtml(plan.cautionText||"없음")}</dd></div><div><dt>메모</dt><dd>${escapeHtml(plan.note||"없음")}</dd></div>${plan.status==="CANCELLED"?`<div><dt>취소 사유</dt><dd>${escapeHtml(plan.cancellationReason||"기존 취소 일정에는 취소 사유 정보가 없습니다.")}</dd></div>`:""}</dl>
  ${editable&&plan.status!=="CANCELLED"?`<div class="action-row"><button type="button" class="secondary" data-edit-plan="${escapeHtml(plan.id)}">수정</button><label>취소 사유<input data-cancel-reason="${escapeHtml(plan.id)}" maxlength="500" placeholder="취소 사유를 입력해 주세요."></label><button type="button" class="secondary" data-cancel-plan="${escapeHtml(plan.id)}">일정 취소</button><p data-cancel-status="${escapeHtml(plan.id)}" role="status"></p></div>`:""}
 </div>
</article>`;

function planForm(options,plan={},selectedDate=kstDate()){
 const start=plan.startDate||selectedDate,end=plan.endDate||start;
 return `<form id="monthly-plan-form" class="card construction-plan-form">
  <input type="hidden" name="id" value="${escapeHtml(plan.id||"")}"><input type="hidden" name="revision" value="${Number(plan.revision||0)}">
  <div class="section-title"><h2>${plan.id?"일정 수정":"일정 등록"}</h2><button type="button" class="text-button" id="close-plan-form">취소</button></div>
  <div class="construction-grid">
   <label>시작일<input name="startDate" type="date" value="${escapeHtml(start)}" required></label>
   <label>종료일<input name="endDate" type="date" value="${escapeHtml(end)}" required></label>
   <label>공종<select name="trade" required>${optionRows(options.trades||[],"trade_key","공종 선택")}</select></label>
   <label>회사<select name="contractorCompanyId">${optionRows(options.companies||[],"id","회사 미지정")}</select></label>
   <label>위치<input name="locationText" maxlength="200" value="${escapeHtml(plan.locationText||"")}" placeholder="예: 1동 18층"></label>
   <label>예정 인원<input name="plannedWorkforce" type="number" min="0" step="1" value="${plan.plannedWorkforce??""}"></label>
   <label>시작 시간<input name="startTime" type="time" value="${escapeHtml(plan.startTime||"")}"></label>
   <label>종료 시간<input name="endTime" type="time" value="${escapeHtml(plan.endTime||"")}"></label>
   <label>상태<select name="status"><option value="SCHEDULED">예정</option><option value="CHANGED">변경</option></select></label>
  </div>
  <label>작업내용<textarea name="workDescription" rows="4" maxlength="2000" required>${escapeHtml(plan.workDescription||"")}</textarea></label>
  <label>주의사항<textarea name="cautionText" rows="2" maxlength="1000">${escapeHtml(plan.cautionText||"")}</textarea></label>
  <label>메모<textarea name="note" rows="2" maxlength="1000">${escapeHtml(plan.note||"")}</textarea></label>
  <div class="action-row"><button class="primary" type="submit">저장</button><button class="secondary" type="button" id="cancel-plan-form">취소</button><p id="monthly-plan-status" role="status"></p></div>
 </form>`;
}

function calendarHtml(month,plans,selected){
 const {year,month:value,last}=monthRange(month),firstDay=new Date(Date.UTC(year,value-1,1)).getUTCDay(),cells=[];
 for(let index=0;index<firstDay;index++)cells.push('<div class="construction-calendar-blank" aria-hidden="true"></div>');
 for(let day=1;day<=last;day++){
  const date=`${month}-${String(day).padStart(2,"0")}`,items=plans.filter(plan=>plan.startDate<=date&&plan.endDate>=date&&plan.status!=="CANCELLED");
  cells.push(`<button type="button" class="construction-calendar-day ${date===kstDate()?"is-today":""} ${date===selected?"is-selected":""}" data-calendar-date="${date}" aria-pressed="${date===selected}">
   <strong>${day}</strong>${items.slice(0,2).map(item=>`<span>${escapeHtml(item.tradeLabel)} · ${escapeHtml(item.workDescription)}</span>`).join("")}${items.length>2?`<small>외 ${items.length-2}건</small>`:""}
  </button>`);
 }
 return `<div class="construction-calendar-weekdays">${["일","월","화","수","목","금","토"].map(day=>`<span>${day}</span>`).join("")}</div><div class="construction-calendar-grid">${cells.join("")}</div>`;
}

export async function renderMonthlyPlanPage({content,api,header,editable}){
 content.innerHTML=loadingSkeleton();
 let month=monthKey(kstDate()),selected=kstDate(),plans=[],options={trades:[],companies:[]};
 const load=async()=>{
  const range=monthRange(month),filters=new URLSearchParams({from:range.from,to:range.to,search:document.querySelector("#plan-search")?.value||"",trade:document.querySelector("#plan-trade-filter")?.value||"",company:document.querySelector("#plan-company-filter")?.value||"",status:document.querySelector("#plan-status-filter")?.value||""});
  const result=await api(`/monthly-plans?${filters}`);plans=result.items;render();
 };
 const bindForm=async plan=>{
  const area=document.querySelector("#monthly-plan-editor");area.innerHTML=planForm(options,plan,selected);area.scrollIntoView({behavior:"smooth",block:"start"});
  const trade=area.querySelector('[name="trade"]'),company=area.querySelector('[name="contractorCompanyId"]'),status=area.querySelector('[name="status"]');
  company.value=plan.contractorCompanyId||"";status.value=plan.status==="CHANGED"?"CHANGED":"SCHEDULED";
  const statusNode=area.querySelector("#monthly-plan-status"),saveButton=area.querySelector('button[type="submit"]'),refreshTrades=async({initial=false}={})=>{
   const selectedTrade=initial?plan.tradeKey||"":trade.value;
   trade.disabled=true;saveButton.disabled=true;
   try{
    const filtered=await api(`/options?${new URLSearchParams({companyId:company.value})}`),choice=resolveCompanyTradeSelection(filtered.trades,selectedTrade,{initial}),available=choice.available;
    trade.innerHTML=optionRows(available,"trade_key",available.length?"공종 선택":"현재 현장에서 사용할 수 있는 공종이 없습니다.");
    trade.value=choice.selected;statusNode.textContent=choice.message;
   }catch{statusNode.textContent="공사 일정 선택 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."}
   finally{trade.disabled=false;saveButton.disabled=false}
  };
  company.onchange=()=>refreshTrades();
  const close=()=>{area.innerHTML=""};area.querySelector("#close-plan-form").onclick=close;area.querySelector("#cancel-plan-form").onclick=close;
  area.querySelector("form").onsubmit=async event=>{
   event.preventDefault();const form=new FormData(event.currentTarget),body={startDate:form.get("startDate"),endDate:form.get("endDate"),tradeKey:form.get("trade"),contractorCompanyId:form.get("contractorCompanyId"),locationText:form.get("locationText"),plannedWorkforce:form.get("plannedWorkforce"),startTime:form.get("startTime"),endTime:form.get("endTime"),status:form.get("status"),workDescription:form.get("workDescription"),cautionText:form.get("cautionText"),note:form.get("note"),revision:Number(form.get("revision"))};
   try{if(plan.id)await api(`/monthly-plans/${plan.id}`,{method:"PATCH",body:JSON.stringify(body)});else await api("/monthly-plans",{method:"POST",headers:{"idempotency-key":crypto.randomUUID()},body:JSON.stringify(body)});close();await load()}catch(error){statusNode.textContent=error.message}
  };
  await refreshTrades({initial:true});
 };
 const render=()=>{
  const selectedPlans=plans.filter(plan=>plan.startDate<=selected&&plan.endDate>=selected);
  content.innerHTML=header("월간계획","미래 공사 일정을 날짜별로 등록하고 공사 Today에 제공합니다.",editable?'<button id="new-monthly-plan" class="primary" type="button">일정 등록</button>':"")+`
   <section class="card construction-calendar-toolbar"><button id="previous-plan-month" class="secondary" type="button">이전 달</button><h2>${escapeHtml(month.replace("-","년 "))}월</h2><button id="next-plan-month" class="secondary" type="button">다음 달</button><button id="current-plan-month" class="secondary" type="button">오늘로 이동</button></section>
   <section class="card construction-plan-filters"><label>검색<input id="plan-search" type="search" placeholder="작업내용 또는 위치"></label><label>공종<select id="plan-trade-filter">${optionRows(options.trades||[],"trade_key","전체 공종")}</select></label><label>회사<select id="plan-company-filter">${optionRows(options.companies||[],"id","전체 회사")}</select></label><label>상태<select id="plan-status-filter"><option value="">전체 상태</option><option value="SCHEDULED">예정</option><option value="CHANGED">변경</option><option value="CANCELLED">취소</option></select></label></section>
   <section class="card construction-calendar" aria-label="${escapeHtml(month)} 월간 공사계획">${calendarHtml(month,plans,selected)}</section>
   <section class="construction-selected-plans"><div class="section-title"><h2>${escapeHtml(shortDate(selected))} 일정</h2>${editable?'<button id="new-plan-for-date" class="secondary" type="button">이 날짜에 등록</button>':""}</div><div>${selectedPlans.length?selectedPlans.map(plan=>planCard(plan,editable)).join(""):'<p class="state-message">등록된 월간 공사계획이 없습니다.<br>일정을 등록하면 공사 Today에서 확인할 수 있습니다.</p>'}</div></section>
   <section id="monthly-plan-editor"></section>`;
  content.querySelector("#previous-plan-month").onclick=()=>{month=addMonth(month,-1);selected=`${month}-01`;load()};
  content.querySelector("#next-plan-month").onclick=()=>{month=addMonth(month,1);selected=`${month}-01`;load()};
  content.querySelector("#current-plan-month").onclick=()=>{selected=kstDate();month=monthKey(selected);load()};
  content.querySelector("#new-monthly-plan")?.addEventListener("click",()=>bindForm({}));
  content.querySelector("#new-plan-for-date")?.addEventListener("click",()=>bindForm({}));
  content.querySelectorAll("[data-calendar-date]").forEach(button=>button.onclick=()=>{selected=button.dataset.calendarDate;render()});
  content.querySelectorAll(".construction-plan-summary").forEach(button=>button.onclick=()=>{const panel=content.querySelector(`#${CSS.escape(button.getAttribute("aria-controls"))}`),open=button.getAttribute("aria-expanded")!=="true";button.setAttribute("aria-expanded",String(open));panel.hidden=!open});
  content.querySelectorAll("[data-edit-plan]").forEach(button=>button.onclick=()=>bindForm(plans.find(plan=>plan.id===button.dataset.editPlan)));
  content.querySelectorAll("[data-cancel-plan]").forEach(button=>button.onclick=async()=>{const plan=plans.find(item=>item.id===button.dataset.cancelPlan),reason=content.querySelector(`[data-cancel-reason="${CSS.escape(plan.id)}"]`).value,status=content.querySelector(`[data-cancel-status="${CSS.escape(plan.id)}"]`);if(!reason.trim()){status.textContent="취소 사유를 입력해 주세요.";return}button.disabled=true;try{await api(`/monthly-plans/${plan.id}`,{method:"DELETE",body:JSON.stringify({revision:plan.revision,reason})});await load()}catch(error){status.textContent=error.message;button.disabled=false}});
  ["plan-search","plan-trade-filter","plan-company-filter","plan-status-filter"].forEach(id=>content.querySelector(`#${id}`).onchange=load);
 };
 try{options=await api("/options");await load()}catch(error){content.innerHTML=header("월간계획","허용된 현장의 일정만 표시합니다.")+errorState(error.message)}
}

import {escapeHtml,errorState,loadingSkeleton} from "../../../packages/ui/components.js";
import {errorMessage,moduleLabel,roleLabel,statusLabel} from "./i18n/ko.js";
import {constructionWorkItemHtml} from "./construction-work-item.js";

const mark=name=>globalThis.performance?.mark?.(name);
const measure=(name,start,end)=>{try{globalThis.performance?.measure?.(name,start,end)}catch{/* 지원하지 않는 브라우저 */}};
const issueStatus={OPEN:"미조치",ASSIGNED:"담당자 지정",ACTION_IN_PROGRESS:"조치 중",COMPLETION_REQUESTED:"완료 확인",REWORK_REQUIRED:"재조치",COMPLETED:"완료",CANCELLED:"취소"};
const empty=message=>`<p class="today-empty">${escapeHtml(message)}</p>`;
const taskRow=task=>`<a class="today-task-row priority-${escapeHtml(task.priority||"B")}" href="${escapeHtml(task.href)}"><span class="today-task-type">${escapeHtml(task.moduleLabel||"업무")}</span><span class="today-task-title">${escapeHtml(task.label)}</span><strong>${Number(task.count)||0}건</strong><span class="today-row-arrow" aria-hidden="true">›</span></a>`;
const urgentRow=item=>`<a class="today-urgent-row" href="${escapeHtml(item.href)}"><span class="today-urgent-title">${escapeHtml(item.title)}</span><span class="today-urgent-meta">${escapeHtml(item.location||"위치 미지정")} · ${escapeHtml(item.assignee||"담당자 미지정")}</span><span class="today-urgent-status">${escapeHtml(issueStatus[item.status]||"상태 확인")}</span><span class="today-row-arrow" aria-hidden="true">›</span></a>`;
const analysisRow=item=>`<a class="today-analysis-row" href="${escapeHtml(item.href)}"><span>${escapeHtml(item.group)} · ${escapeHtml(item.label)}</span><span class="today-analysis-track"><i style="width:${Math.min(100,Math.max(4,Number(item.value)*8))}%"></i></span><strong>${Number(item.value)||0}건</strong></a>`;
const issueSourceHref=context=>{const query=new URLSearchParams({sourceType:context.sourceType,sourceId:context.sourceId,sourceRevision:String(context.sourceRevision)}),sourceItemIds=(context.sourceItemRefs||[]).map(ref=>ref.itemId).filter(Boolean);if(sourceItemIds.length)query.set("sourceItemIds",sourceItemIds.join(","));return `/issues/new?${query}`};
const constructionWorkRow=work=>`<div class="today-work-item">
 <button class="today-work-toggle" type="button" aria-expanded="false" aria-controls="${escapeHtml(work.id)}-content">
  <span><span aria-hidden="true">▸</span> ${constructionWorkItemHtml(work)}</span><span class="today-work-chevron" aria-hidden="true">▼</span>
 </button>
 <div class="today-work-content" id="${escapeHtml(work.id)}-content" hidden>
  <dl><div><dt>작업내용</dt><dd>${escapeHtml(work.isFallbackWorkItem?"노코멘트":work.name)}</dd></div><div><dt>작업 위치</dt><dd>${escapeHtml(work.location||"위치 미등록")}</dd></div>${(work.trades||[]).length?`<div><dt>공종</dt><dd>${escapeHtml(work.trades.join(", "))}</dd></div>`:""}<div><dt>예정 인원</dt><dd>${work.workforceRegistered===false||work.total===null?"인원 확인 필요":`${Number(work.total)}명`}</dd></div></dl>
  ${work.companyBreakdownAvailable===false?empty("회사별 인원 정보가 원본 공사일보에 없습니다."):(work.companies||[]).length&&Number(work.total)>0?`<div class="today-work-companies"><h3>회사별 예정 인원</h3>${work.companies.map(company=>`<div><span>${escapeHtml(company.name)}</span><strong>${Number(company.count)||0}명</strong></div>`).join("")}</div>`:empty("예정 인원 정보가 등록되지 않았습니다.")}
  ${work.canCreateIssue&&work.sourceContext?`<a class="secondary today-work-create-issue" href="${escapeHtml(issueSourceHref(work.sourceContext))}">이 작업으로 이슈 등록</a>`:""}
 </div>
</div>`;
const buildConstructionWorks=(sections,canCreateIssue=false)=>{
 const module=(sections.modules||[]).find(item=>item.code==="construction"),construction=sections.constructionSummary;
 if(module?.state==="ERROR")return {count:0,body:empty("공사일보를 불러오지 못했습니다.<br>잠시 후 다시 시도해 주세요.")};
 if(module?.state==="NO_PERMISSION")return {count:0,body:empty("이 정보를 볼 권한이 없습니다.")};
 if(!construction)return {count:0,body:empty("공사일보가 업데이트되지 않았습니다.")};
 const planSchedule=construction.schedule?.today,usingPlan=construction.reportStatus!=="FINALIZED"&&planSchedule?.source==="MONTHLY_PLAN";
 if(!usingPlan&&(construction.reportStatus==="ANALYZING"||construction.reportStatus==="ANALYZED"))return {count:0,body:empty("공사일보를 분석하고 있습니다.")};
 if(!usingPlan&&construction.reportStatus==="FAILED")return {count:0,body:empty("공사일보 양식을 인식하지 못했습니다.")};
 const works=(usingPlan?(planSchedule.entries||[]).map((entry,index)=>({id:`today-monthly-plan-${entry.id||index}`,name:entry.description,location:entry.location||"위치 정보 없음",trades:entry.trade?[entry.trade]:[],total:entry.plannedWorkforce,workforceRegistered:entry.plannedWorkforce!==null&&entry.plannedWorkforce!==undefined,companies:entry.company&&entry.plannedWorkforce!==null?[{name:entry.company,count:Number(entry.plannedWorkforce)}]:[],companyBreakdownAvailable:Boolean(entry.company),isFallbackWorkItem:false,sourceContext:entry.sourceContext})):(construction.majorWorks||[])).map(work=>({...work,canCreateIssue}));
 if(!works.length&&construction.reportStatus!=="FINALIZED")return {count:0,body:empty("등록된 공사 일정이 없습니다.")};
 const total=usingPlan?works.reduce((sum,work)=>sum+Number(work.total||0),0):Number(construction.todayWorkforceTotal)||0;
 const workforceHeader=`<div class="today-workforce-total"><strong>${usingPlan?"총 예정 인원":"금일 총 출력인원"} ${total}명</strong><span>${usingPlan?"월간계획 기준":"공사일보 기준"}</span>${!usingPlan&&Number(construction.employeeWorkforce)>0?`<small>기타 인원 · 직원 ${Number(construction.employeeWorkforce)}명</small>`:""}</div>`;
 const warning=(construction.workforceWarnings||[]).some(item=>["TRADE_MATCH_REVIEW_REQUIRED","TRADE_MATCH_MULTIPLE_CANDIDATES","WORKFORCE_TOTAL_MISMATCH"].includes(item.code))?'<p class="warning">출력현황과 작업예정 공종명이 달라 일부 항목의 확인이 필요합니다.</p>':"";
 return {count:works.length,body:workforceHeader+warning+(works.length?works.map(constructionWorkRow).join(""):empty("오늘 등록된 주요 작업이 없습니다."))};
};

const summaryState=(module,data,emptyMessage)=>{
 if(module?.state==="ERROR")return {kind:"error",html:empty("데이터를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.")};
 if(module?.state==="NO_PERMISSION")return {kind:"denied",html:empty("이 정보를 볼 권한이 없습니다.")};
 if(!data)return {kind:"empty",html:empty(emptyMessage)};
 return {kind:"ready",html:""};
};
const safeId=value=>String(value||"item").replace(/[^a-zA-Z0-9_-]/g,"-");
const detailList=details=>details?.length?`<dl>${details.slice(0,7).map(detail=>`<div><dt>${escapeHtml(detail.label)}</dt><dd>${escapeHtml(String(detail.value))}</dd></div>`).join("")}</dl>`:empty("확인할 상세 정보가 없습니다.");
const inlineItem=({id,label,value,details})=>`<div class="today-inline-item" data-inline-item="${escapeHtml(id)}">
 <button class="today-inline-toggle" type="button" aria-expanded="false" aria-controls="${escapeHtml(id)}-content">
  <span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value||""))}</strong><span class="today-inline-chevron" aria-hidden="true">▼</span>
 </button>
 <div class="today-inline-content" id="${escapeHtml(id)}-content" hidden>${detailList(details)}</div>
</div>`;
const summaryItems=items=>items.slice(0,5).map(item=>inlineItem(item)).join("");
const summaryCard=({id,eyebrow,title,count,body,state})=>`<article class="today-panel today-summary-card" data-summary-card="${escapeHtml(id)}" data-summary-state="${escapeHtml(state)}">
 <header class="today-summary-card-header"><span><span class="today-eyebrow">${escapeHtml(eyebrow)}</span><span class="today-summary-title">${escapeHtml(title)}</span></span><strong>${escapeHtml(count)}</strong></header>
 <div class="today-summary-body">${body}</div>
</article>`;

const buildSummaryCards=sections=>{
 const modules=sections.modules||[],workforce=sections.workforceSummary,construction=sections.constructionSummary;
 const workforceModule=modules.find(module=>module.code==="workforce"),constructionModule=modules.find(module=>module.code==="construction");
 const safety=modules.find(module=>module.code==="safety"),quality=modules.find(module=>module.code==="quality");
 const scheduleCards=[...(safety?.cards||[]).map(card=>({...card,moduleLabel:"안전"})),...(quality?.cards||[]).map(card=>({...card,moduleLabel:"품질"}))].filter(card=>Number(card.count)>0);
 const workforceState=summaryState(workforceModule,workforce,"출역 현황 데이터가 없습니다.");
 const constructionState=summaryState(constructionModule,construction,"오늘 등록된 공사 현황이 없습니다.");
 const scheduleDenied=[safety,quality].every(module=>!module||module.state==="NO_PERMISSION");
 const scheduleError=[safety,quality].some(module=>module?.state==="ERROR");
 const scheduleState=scheduleError?{kind:"error",html:empty("예정 업무를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.")}:scheduleDenied?{kind:"denied",html:empty("예정 업무를 볼 권한이 없습니다.")}:scheduleCards.length?{kind:"ready",html:""}:{kind:"empty",html:empty("오늘 예정된 안전·품질 업무가 없습니다.")};
 const topCompanies=(workforce?.byCompany||[]).slice(0,5).map(row=>`${row.name} ${Number(row.total)||0}명`).join(" · ");
 const workforceRows=workforce?[
  {id:"today-workforce-present",label:"현재 출역",value:`${Number(workforce.present)||0}명`,details:[{label:"기준일",value:workforce.workDate},{label:"현재 출역",value:`${Number(workforce.present)||0}명`},workforce.latestCheckIn?{label:"최근 출역 시각",value:workforce.latestCheckIn}:null,topCompanies?{label:"회사별 상위 인원",value:topCompanies}:null].filter(Boolean)},
  {id:"today-workforce-pending",label:"승인 대기",value:`${Number(workforce.pending)||0}명`,details:[{label:"승인 대기",value:`${Number(workforce.pending)||0}명`}]},
  {id:"today-workforce-differences",label:"출력일보 차이",value:`${Number(workforce.differences)||0}건`,details:[{label:"작성된 출력일보",value:`${Number(workforce.reports)||0}건`},{label:"출역 인원 차이",value:`${Number(workforce.differences)||0}건`}]},
  ...(workforce.byCompany||[]).map((row,index)=>({id:`today-workforce-company-${index}-${safeId(row.name)}`,label:`회사별 · ${row.name}`,value:`${Number(row.total)||0}명`,details:[{label:"회사",value:row.name},{label:"현재 출역",value:`${Number(row.total)||0}명`}]}))
 ]:[];
 const reportStatus=construction?.reportStatus==="FINALIZED"?"확정":construction?.reportStatus==="REVISION_REQUESTED"?"수정 요청":construction?.reportStatus==="SUBMITTED"?"제출":"작성 전·중";
 const constructionRows=construction?[
  {id:"today-construction-report",label:"공사일보",value:reportStatus,details:[{label:"상태",value:reportStatus},{label:"현장 집계",value:construction.message}]},
  {id:"today-construction-missing",label:"미제출 회사",value:`${Number(construction.missingCompanies)||0}개`,details:[{label:"미제출 회사",value:`${Number(construction.missingCompanies)||0}개`}]},
  {id:"today-construction-difference",label:"인원 차이 회사",value:`${Number(construction.differenceCompanies)||0}개`,details:[{label:"인원 차이 회사",value:`${Number(construction.differenceCompanies)||0}개`}]}
 ]:[];
 const scheduleRows=scheduleCards.map(card=>({id:`today-schedule-${safeId(card.code)}`,label:`${card.moduleLabel} · ${card.label}`,value:`${Number(card.count)||0}건`,details:[{label:"업무 구분",value:card.moduleLabel},{label:"상태",value:card.label},{label:"대상 건수",value:`${Number(card.count)||0}건`}]}));
 return [
  summaryCard({id:"today-summary-workforce",eyebrow:"인력",title:"출역·교육 현황",count:workforce?`${Number(workforce.present)||0}명`:"확인 필요",body:workforceState.html||summaryItems(workforceRows),state:workforceState.kind}),
  summaryCard({id:"today-summary-construction",eyebrow:"공사",title:"오늘 주요 공정",count:construction?`${Number(construction.missingCompanies||0)+Number(construction.differenceCompanies||0)}건`:"확인 필요",body:constructionState.html||summaryItems(constructionRows),state:constructionState.kind}),
  summaryCard({id:"today-summary-schedule",eyebrow:"예정",title:"예정 업무·검측",count:`${scheduleCards.reduce((sum,card)=>sum+Number(card.count||0),0)}건`,body:scheduleState.html||summaryItems(scheduleRows),state:scheduleState.kind})
 ].join("");
};

const buildNotices=sections=>{
 const tasks=sections.todayTasks||[],alerts=sections.alerts||[];
 const notices=[
  ...tasks.filter(item=>item.priority==="A").slice(0,4).map(item=>({id:`today-notice-task-${safeId(item.code)}`,label:item.moduleLabel||"업무",message:`${item.label} ${Number(item.count)||0}건을 확인해 주세요.`,details:[{label:"업무",value:item.label},{label:"건수",value:`${Number(item.count)||0}건`},{label:"우선순위",value:"우선 확인"}]})),
  ...alerts.filter(item=>item.state==="ERROR").map(item=>({id:`today-notice-alert-${safeId(item.code)}`,label:item.label,message:item.message,details:[{label:"상태",value:"데이터 오류"},{label:"안내",value:item.message}]}))
 ].slice(0,6);
 return notices.length?notices.map(note=>inlineItem({id:note.id,label:`${note.label} · ${note.message}`,value:"",details:note.details})).join(""):empty("현재 Provider 데이터로 확인된 주의사항이 없습니다.");
};

function bindInlineAccordions(content){
 const toggles=[...content.querySelectorAll(".today-inline-toggle,.today-work-toggle")],collapseAll=content.querySelector("#today-summary-collapse-all");
 const setExpanded=(button,expanded)=>{
  const panel=content.querySelector(`#${button.getAttribute("aria-controls")}`);
  button.setAttribute("aria-expanded",String(expanded));
  if(panel)panel.hidden=!expanded;
 };
 toggles.forEach(button=>{
  const toggle=()=>setExpanded(button,button.getAttribute("aria-expanded")!=="true");
  button.addEventListener("click",toggle);
  button.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "||event.key==="Spacebar"){event.preventDefault();toggle()}});
 });
 if(collapseAll&&!collapseAll.dataset.bound){collapseAll.dataset.bound="true";collapseAll.addEventListener("click",()=>content.querySelectorAll("#today-summary-grid .today-inline-toggle").forEach(button=>setExpanded(button,false)))}
}

async function refreshSummaryCards(content){
 const grid=content.querySelector("#today-summary-grid"),notices=content.querySelector("#today-notice-list"),worksList=content.querySelector("#today-construction-works"),worksCount=content.querySelector("#today-construction-work-count");
 if(!grid||!notices||!worksList||!worksCount||!content.isConnected)return;
 const expanded=new Set([...content.querySelectorAll(".today-inline-toggle[aria-expanded='true'],.today-work-toggle[aria-expanded='true']")].map(button=>button.getAttribute("aria-controls")));
 const scrollX=globalThis.scrollX,scrollY=globalThis.scrollY;
 try{
  grid.setAttribute("aria-busy","true");
  const response=await fetch("/api/v1/today",{credentials:"include",cache:"no-store"});
  const data=await response.json();
  if(!response.ok)throw new Error(errorMessage(data,response.status));
  grid.innerHTML=buildSummaryCards(data.sections||{});
  notices.innerHTML=buildNotices(data.sections||{});
  const works=buildConstructionWorks(data.sections||{},content.dataset.canEditIssue==="true");
  worksList.innerHTML=works.body;
  worksCount.textContent=`${works.count}개 작업`;
  bindInlineAccordions(content);
  expanded.forEach(id=>{
   const button=content.querySelector(`[aria-controls="${id}"]`),panel=content.querySelector(`#${id}`);
   if(button&&panel){button.setAttribute("aria-expanded","true");panel.hidden=false}
  });
 }catch{
  content.querySelectorAll(".today-inline-content").forEach(panel=>{panel.innerHTML=empty("데이터를 갱신하지 못했습니다. 다음 갱신 때 다시 확인해 주세요.")});
 }finally{grid.removeAttribute("aria-busy");globalThis.scrollTo?.(scrollX,scrollY)}
}

export async function renderTodayPage({content,session}){
 mark("today-route-start");content.innerHTML=loadingSkeleton();
 try{
  mark("today-api-start");
  const response=await fetch("/api/v1/today",{credentials:"include",cache:"no-store"});
  mark("today-api-response");
  const data=await response.json();
  if(!response.ok)throw Object.assign(new Error(errorMessage(data,response.status)),{status:response.status,code:data.error});
  const context=data.context||{},attendance=context.attendance||{},pending=context.approvalStatus==="PENDING",sections=data.sections||{},modules=sections.modules||[],tasks=sections.todayTasks||[],urgentItems=sections.urgentItems||[],alerts=sections.alerts||[],analysis=sections.analysis||[],workforce=sections.workforceSummary,construction=sections.constructionSummary;
  const canEditIssue=["EDIT","MANAGE"].includes(session?.context?.boardAccess?.ISSUE?.accessLevel);
  content.dataset.canEditIssue=String(canEditIssue);
  const constructionWorks=buildConstructionWorks(sections,canEditIssue);
  const actions=(data.actions||[]).filter(action=>action.href!=="/issues/new"||canEditIssue);
  const weather=modules.find(module=>module.code==="weather");
  content.innerHTML=`
   <header class="page-header today-header">
    <div><div class="breadcrumb">오늘 / 직원 업무</div><h1>오늘</h1><p class="page-description">${escapeHtml(data.workDate)} · ${escapeHtml(context.site?.name||"현장 미배정")}</p></div>
    <div class="today-header-side"><span>${weather?.state==="READY"?escapeHtml(weather.message):"날씨 연결 준비 중"}</span><strong>${escapeHtml(context.user?.name||"사용자")}</strong></div>
   </header>
   ${pending?'<section class="card pending-membership"><h2>승인 요청 중</h2><p>관리자의 가입 승인 후 현장 업무를 처리할 수 있습니다.</p></section>':""}
   <section class="today-command-bar" aria-label="주요 행동">
    <div><span>현장에서 바로 볼 정보와 해야 할 일을 한 화면에 모았습니다.</span><small>${escapeHtml((context.roles||[]).map(roleLabel).join(", ")||"현장 역할 없음")} · ${escapeHtml(context.company?.name||"회사 미배정")}</small></div>
    ${canEditIssue?'<a class="primary today-create-issue" href="/issues/new">+ 이슈 등록</a>':""}
   </section>
   <section class="today-focus-grid">
    <article class="today-panel today-tasks"><header><div><span class="today-eyebrow">주요 작업</span><h2>오늘 해야 할 일</h2></div><strong id="today-construction-work-count">${constructionWorks.count}개 작업</strong></header>
     <div class="today-list" id="today-construction-works">${constructionWorks.body}</div>
    </article>
    <article class="today-panel today-urgent"><header><div><span class="today-eyebrow danger">긴급</span><h2>긴급·미조치 이슈</h2></div><a href="/issues/open">전체 보기</a></header>
     <div class="today-list">${urgentItems.length?urgentItems.map(urgentRow).join(""):empty("현재 확인할 긴급 이슈가 없습니다.")}</div>
    </article>
   </section>
   <section class="today-panel today-notices"><header><div><span class="today-eyebrow">현장 안내</span><h2>오늘 주의·알림</h2></div></header>
    <div class="today-notice-list" id="today-notice-list">${buildNotices(sections)}</div>
   </section>
   <div class="today-summary-heading"><h2>현장 요약</h2><button id="today-summary-collapse-all" type="button">모두 접기</button></div>
   <section class="today-summary-grid" id="today-summary-grid">
    ${buildSummaryCards(sections)}
   </section>
   <section class="today-quick-links" aria-label="업무 바로가기">
    <h2>업무 바로가기</h2><div>${actions.map(action=>`<a href="${escapeHtml(action.href)}">${escapeHtml(action.label)}<span aria-hidden="true">›</span></a>`).join("")||empty("현재 권한으로 사용할 수 있는 바로가기가 없습니다.")}</div>
   </section>
   <section class="today-lower-grid">
    <article class="today-panel"><header><div><span class="today-eyebrow">보조 분석</span><h2>미완료 업무 현황</h2></div></header>
     <div class="today-analysis">${analysis.length?analysis.map(analysisRow).join(""):empty("표시할 미완료 업무 집계가 없습니다.")}</div>
    </article>
    <article class="today-panel today-site-context"><header><div><span class="today-eyebrow">현재 Context</span><h2>현장 정보</h2></div></header>
     <dl><dt>현장</dt><dd>${escapeHtml(context.site?.name||"미배정")}</dd><dt>회사</dt><dd>${escapeHtml(context.company?.name||"미배정")}</dd><dt>공종</dt><dd>${escapeHtml(context.trade?.name||"미지정")}</dd><dt>팀 또는 반</dt><dd>${escapeHtml(context.team?.name||"미지정")}</dd><dt>오늘 출역</dt><dd>${attendance.checkedIn?"출역 완료":"미출역"}</dd><dt>출역 시각</dt><dd>${escapeHtml(attendance.checkInAt||"미출역")}</dd><dt>접근 메뉴</dt><dd>${escapeHtml((context.accessibleModules||[]).map(moduleLabel).join(", ")||"오늘")}</dd></dl>
    </article>
   </section>`;
  bindInlineAccordions(content);
  const refreshTimer=setInterval(()=>{if(!content.isConnected){clearInterval(refreshTimer);return}refreshSummaryCards(content)},60000);
  mark("today-first-render");mark("today-first-usable");measure("today-route-to-first-usable","today-route-start","today-first-usable");measure("today-api-to-first-usable","today-api-start","today-first-usable");
 }catch(error){content.innerHTML=errorState(error.message);mark("today-error")}
}

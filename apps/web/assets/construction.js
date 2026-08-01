import {escapeHtml,errorState,loadingSkeleton} from "../../../packages/ui/components.js";
import {errorMessage,statusLabel} from "./i18n/ko.js";
import {constructionWorkItemHtml,constructionWorkItemParts} from "./construction-work-item.js";
import {renderConstructionTodayPage,renderMonthlyPlanPage} from "./construction-schedule.js";
import {bindConstructionWarningToggles,constructionWarningsHtml} from "./construction-warnings.js";

let state={content:null,session:null,csrf:"",options:null};
const dateValue=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const can=(key,required)=>{const rank={VIEW:1,EDIT:2,MANAGE:3};return (rank[state.session.context.boardAccess?.[key]?.accessLevel]||0)>=(rank[required]||0)};
const currentCsrf=()=>state.csrf||sessionStorage.getItem("integrated.csrf")||"";
async function api(path,options={}){const isForm=options.body instanceof FormData,response=await fetch(`/api/v1/construction${path}`,{credentials:"include",cache:"no-store",...options,headers:{...(isForm?{}:{"content-type":"application/json"}),"x-csrf-token":currentCsrf(),"x-context-version":String(state.session.context.contextVersion),...(options.headers||{})}}),body=await response.json().catch(()=>({}));if(response.status===401){sessionStorage.clear();location.replace("/login")}if(!response.ok)throw Object.assign(new Error(errorMessage(body,response.status)),{status:response.status,code:body.error});return body}
const header=(title,description,action="")=>`<header class="page-header"><div><div class="breadcrumb">공사 관리 / ${escapeHtml(title)}</div><h1>${escapeHtml(title)}</h1><p class="page-description">${escapeHtml(description)}</p></div>${action}</header>`;
const constructionErrorView=(error,title="공사일보")=>header(title,error?.status===403?"공사일보 열람 권한이 필요합니다.":"공사일보 정보를 불러오지 못했습니다.")+errorState(error.message);
const fmtTime=value=>value?new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(value)):"-";
const outputStatusLabel=value=>({MISSING:"미제출",DRAFT:"작성 중",SUBMITTED:"제출 완료",REVISION_REQUESTED:"수정 요청"}[value]||value);
const locationOptions=(selected="")=>`<option value="">위치 미지정</option>${state.options.locations.map(v=>`<option value="${v.id}" ${v.id===selected?"selected":""}>${escapeHtml(v.display_name)}</option>`).join("")}`;
const companyOptions=(selected="")=>`<option value="">회사 미지정</option>${state.options.companies.map(v=>`<option value="${v.id}" ${v.id===selected?"selected":""}>${escapeHtml(v.name)}</option>`).join("")}`;

function statusSummary(data){
 return `<section class="summary-grid construction-summary"><article class="card"><span>전체 참여 회사</span><strong>${data.summary.total}개</strong></article><article class="card"><span>제출 완료</span><strong>${data.summary.submitted}개</strong></article><article class="card"><span>작성 중</span><strong>${data.summary.draft}개</strong></article><article class="card"><span>미제출</span><strong>${data.summary.missing}개</strong></article><article class="card"><span>수정 요청</span><strong>${data.summary.revisionRequested}개</strong></article><article class="card"><span>인원 차이</span><strong>${data.summary.differences}개</strong></article></section>`;
}
function statusRows(data,filter="ALL"){
 const items=data.items.filter(v=>filter==="ALL"||(filter==="DIFFERENCE"?v.difference!==0:v.output_status===filter));
 return `<div class="construction-status-list">${items.map(v=>`<article class="card output-company-row"><div><strong>${escapeHtml(v.company_name)}</strong><span class="status-badge">${outputStatusLabel(v.output_status)}</span></div><p>출역 ${v.attendance_count}명 · 출력일보 ${v.output_count}명${v.difference?` · 차이 ${Math.abs(v.difference)}명`:""}</p><small>${v.submitted_at?`제출 ${escapeHtml(fmtTime(v.submitted_at))}`:"제출 시각 없음"}</small></article>`).join("")||'<p class="state-message">조건에 맞는 업체가 없습니다.</p>'}</div>`;
}
async function outputPage(content){
 content.innerHTML=loadingSkeleton();try{const data=await api(`/output-status?workDate=${dateValue()}`);content.innerHTML=header("출력일보 제출 현황","현재 현장의 회사별 출역·출력일보 제출 상태입니다.")+`<section class="card construction-filter"><label>날짜<input id="output-date" type="date" value="${dateValue()}"></label><label>상태<select id="output-filter"><option value="ALL">전체</option><option value="SUBMITTED">제출 완료</option><option value="DRAFT">작성 중</option><option value="MISSING">미제출</option><option value="REVISION_REQUESTED">수정 요청</option><option value="DIFFERENCE">인원 차이 있음</option></select></label></section><div id="output-summary">${statusSummary(data)}</div><div id="output-rows">${statusRows(data)}</div>`;const load=async()=>{const next=await api(`/output-status?workDate=${document.querySelector("#output-date").value}`);document.querySelector("#output-summary").innerHTML=statusSummary(next);document.querySelector("#output-rows").innerHTML=statusRows(next,document.querySelector("#output-filter").value)};document.querySelector("#output-date").onchange=load;document.querySelector("#output-filter").onchange=load}catch(error){content.innerHTML=header("출력일보 제출 현황","허용된 현장의 제출 상태만 표시합니다.")+errorState(error.message)}
}
function reportList(items){
 return items.map(v=>`<article class="card construction-report-row"><div><strong>${escapeHtml(v.work_date_kst)}</strong><span class="status-badge">${statusLabel(v.status)}</span></div><p>${escapeHtml(v.created_by_name)} · 작업 ${Number(v.submitted_company_count)}개</p><small>개정 ${v.revision} · 최근 수정 ${escapeHtml(fmtTime(v.updated_at))}</small><button class="secondary" data-report-id="${v.id}">열기</button></article>`).join("")||'<p class="state-message">작성된 공사일보가 없습니다.</p>';
}
async function dailyPage(content){
 content.innerHTML=loadingSkeleton();try{const [list,options,output]=await Promise.all([api("/daily-reports"),api("/options"),api(`/output-status?workDate=${dateValue()}`)]);state.options=options;content.innerHTML=header("공사일보","출역과 출력일보를 불러와 현장 공사일보를 작성합니다.")+statusSummary(output)+`<section class="card report-create"><label>공사일보 날짜<input id="report-date" type="date" value="${dateValue()}"></label>${can("CONSTRUCTION_DAILY_REPORT","EDIT")?'<button id="create-report" class="primary">공사일보 작성 시작</button>':""}<p role="status"></p></section><section><h2>공사일보 목록</h2><div class="construction-report-list">${reportList(list.items)}</div></section><div id="construction-editor"></div><dialog id="photo-viewer" class="construction-photo-viewer"><button id="photo-close" class="secondary">닫기</button><img alt="공사일보 현장 사진 확대"></dialog>`;document.querySelector("#create-report")?.addEventListener("click",async event=>{const status=event.currentTarget.parentElement.querySelector('[role="status"]');event.currentTarget.disabled=true;try{renderEditor(await api("/daily-reports",{method:"POST",body:JSON.stringify({workDate:document.querySelector("#report-date").value})}))}catch(error){status.textContent=error.message}finally{event.currentTarget.disabled=false}});document.querySelectorAll("[data-report-id]").forEach(button=>button.onclick=async()=>renderEditor(await api(`/daily-reports/${button.dataset.reportId}`)));document.querySelector("#photo-close").onclick=()=>document.querySelector("#photo-viewer").close()}catch(error){content.innerHTML=header("공사일보","공사일보 열람 권한이 필요합니다.")+errorState(error.message)}
}
const itemCard=item=>`<details class="card construction-work-item" open><summary><strong>${escapeHtml(item.company_name)} · ${escapeHtml(item.trade_name)} · ${item.workforce_count}명</strong><span>${item.stale?`변경됨 ${item.source_output_revision}→${item.current_source_revision}`:`출력일보 개정 ${item.source_output_revision}`}</span></summary><dl><dt>팀</dt><dd>${escapeHtml(item.team_name||"팀 전체")}</dd><dt>작업 위치</dt><dd>${escapeHtml(item.location_name||"위치 미지정")}</dd><dt>출력일보 원문</dt><dd>${escapeHtml(item.work_description)}</dd><dt>비고</dt><dd>${escapeHtml(item.notes||"-")}</dd><dt>제출 시각</dt><dd>${escapeHtml(fmtTime(item.source_submitted_at))}</dd></dl>${item.stale?'<p class="warning">참조 중인 출력일보가 변경되었습니다. 최신 내용을 확인해 주세요.</p>':""}<label>공사일보 정리 문구<textarea data-item-summary="${item.id}" rows="2">${escapeHtml(item.manager_summary||item.work_description)}</textarea></label><label>공사일보 비고<textarea data-item-notes="${item.id}" rows="2">${escapeHtml(item.notes||"")}</textarea></label></details>`;
const materialRow=(m={})=>`<div class="repeat-row material-row"><input name="materialName" placeholder="자재명" value="${escapeHtml(m.material_name||"")}" required><input name="specification" placeholder="규격" value="${escapeHtml(m.specification||"")}"><input name="quantity" type="number" min="0" step="any" placeholder="수량" value="${m.quantity??""}" required><input name="unit" placeholder="단위" value="${escapeHtml(m.unit||"")}" required><label class="inline-check"><input name="received" type="checkbox" ${m.received?"checked":""}>반입</label><select name="locationId">${locationOptions(m.location_id)}</select><select name="supplierCompanyId">${companyOptions(m.supplier_company_id)}</select><input name="notes" placeholder="비고" value="${escapeHtml(m.notes||"")}"><button type="button" class="text-button remove-row">삭제</button></div>`;
const equipmentRow=(e={})=>`<div class="repeat-row equipment-row"><input name="equipmentName" placeholder="장비명" value="${escapeHtml(e.equipment_name||"")}" required><input name="specification" placeholder="규격·기종" value="${escapeHtml(e.specification||"")}"><input name="quantity" type="number" min="0" step="any" placeholder="수량" value="${e.quantity??""}" required><input name="operatingHours" type="number" min="0" step=".1" placeholder="작업시간" value="${e.operating_hours??""}"><select name="locationId">${locationOptions(e.location_id)}</select><select name="companyId">${companyOptions(e.company_id)}</select><input name="notes" placeholder="비고" value="${escapeHtml(e.notes||"")}"><button type="button" class="text-button remove-row">삭제</button></div>`;
const rowsData=(selector,names)=>[...document.querySelectorAll(selector)].map(row=>Object.fromEntries(names.map(name=>{const element=row.querySelector(`[name="${name}"]`);return[name,element.type==="checkbox"?element.checked:element.value]})));
function bindRows(){document.querySelectorAll(".remove-row").forEach(button=>button.onclick=()=>button.closest(".repeat-row").remove());document.querySelector("#add-material").onclick=()=>{document.querySelector("#materials").insertAdjacentHTML("beforeend",materialRow());bindRows()};document.querySelector("#add-equipment").onclick=()=>{document.querySelector("#equipment").insertAdjacentHTML("beforeend",equipmentRow());bindRows()}}
async function makeThumbnail(file){const bitmap=await createImageBitmap(file),scale=Math.min(1,960/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement("canvas");canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext("2d").drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error("사진 크기 조정에 실패했습니다.")),"image/webp",.78));return new File([blob],"thumbnail.webp",{type:"image/webp"})}
function reportFormBody(data){
 const form=document.querySelector("#construction-form"),values=Object.fromEntries(new FormData(form)),specialNotes={construction:values.specialConstruction,complaint:values.specialComplaint,workDelay:values.specialWorkDelay,materialDelay:values.specialMaterialDelay,equipmentFailure:values.specialEquipmentFailure,safetyReference:values.specialSafetyReference,qualityReference:values.specialQualityReference,other:values.specialOther};
 return {revision:data.report.revision,weatherSummary:values.weatherSummary,minTemperature:values.minTemperature,maxTemperature:values.maxTemperature,precipitationNote:values.precipitationNote,yesterdaySummary:values.yesterdaySummary,todaySummary:values.todaySummary,tomorrowPlan:values.tomorrowPlan,missingOutputReason:values.missingOutputReason,differenceReason:values.differenceReason,specialNotes,items:data.items.map(item=>({id:item.id,managerSummary:document.querySelector(`[data-item-summary="${item.id}"]`).value,notes:document.querySelector(`[data-item-notes="${item.id}"]`).value})),materials:rowsData(".material-row",["materialName","specification","quantity","unit","received","locationId","supplierCompanyId","notes"]),equipment:rowsData(".equipment-row",["equipmentName","specification","quantity","operatingHours","locationId","companyId","notes"])};
}
async function renderEditor(data){
 const {report:r}=data,editable=can("CONSTRUCTION_DAILY_REPORT","EDIT")&&!["FINALIZED","CANCELLED"].includes(r.status),manage=can("CONSTRUCTION_DAILY_REPORT","MANAGE"),special=(()=>{try{return JSON.parse(r.special_notes||"{}")}catch{return{}}})();const editor=document.querySelector("#construction-editor");
 editor.innerHTML=`<section class="construction-editor"><header class="card report-meta"><div><h2>${escapeHtml(r.site_name)} 공사일보</h2><p>${escapeHtml(r.work_date_kst)} · ${escapeHtml(r.created_by_name)} · ${statusLabel(r.status)} · revision ${r.revision}</p></div>${data.items.some(v=>v.stale)?'<button id="refresh-outputs" class="secondary">최신 출력일보 반영</button>':""}</header>${data.items.some(v=>v.stale)?'<p class="warning stale-banner">참조 중인 출력일보가 변경되었습니다. 확인 후 최신 내용을 반영해 주세요.</p>':""}<form id="construction-form"><section class="card"><h3>기상 정보</h3><p class="state-message">날씨 자동 연동 준비 중 · 현재는 관리자가 직접 입력합니다.</p><div class="construction-grid"><label>날씨<input name="weatherSummary" value="${escapeHtml(r.weather_summary||"")}"></label><label>최저기온<input name="minTemperature" type="number" step=".1" value="${r.min_temperature??""}"></label><label>최고기온<input name="maxTemperature" type="number" step=".1" value="${r.max_temperature??""}"></label><label>강수·특이 기상<input name="precipitationNote" value="${escapeHtml(r.precipitation_note||"")}"></label></div></section><section class="card"><h3>작일·금일·익일 작업</h3><label>작일 작업<textarea name="yesterdaySummary" rows="3">${escapeHtml(r.yesterday_summary||"")}</textarea></label><label>금일 작업<textarea name="todaySummary" rows="4">${escapeHtml(r.today_summary||data.items.map(v=>v.manager_summary||v.work_description).join("\n"))}</textarea></label><label>익일 예정<textarea name="tomorrowPlan" rows="3">${escapeHtml(r.tomorrow_plan||"")}</textarea></label></section><section><h3>회사별 작업</h3><div class="construction-work-list">${data.items.map(itemCard).join("")||'<p class="state-message">제출된 출력일보가 없습니다.</p>'}</div></section><section class="card"><h3>제출 확인 사유</h3><label>미제출 업체 사유<textarea name="missingOutputReason" rows="2">${escapeHtml(r.missing_output_reason||"")}</textarea></label><label>인원 차이 사유<textarea name="differenceReason" rows="2">${escapeHtml(r.difference_reason||"")}</textarea></label></section><section class="card"><div class="section-title"><h3>자재</h3>${editable?'<button id="add-material" type="button" class="secondary">자재 추가</button>':""}</div><p class="state-message">Materials 정식 모듈과 연결되지 않은 공사일보 임시 기록입니다.</p><div id="materials">${data.materials.map(materialRow).join("")}</div></section><section class="card"><div class="section-title"><h3>장비</h3>${editable?'<button id="add-equipment" type="button" class="secondary">장비 추가</button>':""}</div><p class="state-message">Equipment 정식 모듈과 연결되지 않은 공사일보 일일 기록입니다.</p><div id="equipment">${data.equipment.map(equipmentRow).join("")}</div></section><section class="card"><h3>특이사항</h3><div class="construction-grid">${[["specialConstruction","공사 특이사항","construction"],["specialComplaint","민원","complaint"],["specialWorkDelay","작업 지연","workDelay"],["specialMaterialDelay","자재 지연","materialDelay"],["specialEquipmentFailure","장비 고장","equipmentFailure"],["specialSafetyReference","안전 관련 참고","safetyReference"],["specialQualityReference","품질 관련 참고","qualityReference"],["specialOther","기타","other"]].map(([name,label,key])=>`<label>${label}<textarea name="${name}" rows="2">${escapeHtml(special[key]||"")}</textarea></label>`).join("")}</div></section></form><section class="card"><h3>현장 사진</h3>${editable?'<div class="photo-actions"><label class="primary">사진 촬영<input id="construction-camera" class="visually-hidden" type="file" accept="image/*" capture="environment"></label><label class="secondary">파일 선택<input id="construction-file" class="visually-hidden" type="file" accept="image/*"></label></div><div class="construction-grid"><label>위치<select id="photo-location">'+locationOptions()+'</select></label><label>설명<input id="photo-description"></label></div><button id="photo-upload" type="button" class="secondary" disabled>사진 업로드</button>':""}<p id="photo-status" role="status"></p><div class="construction-gallery">${data.media.map(m=>`<figure><button type="button" data-photo="${m.originalUrl}"><img src="${m.thumbnailUrl}" alt="${escapeHtml(m.description||"현장 사진")}"></button><figcaption>${escapeHtml(m.description||m.original_name)}</figcaption></figure>`).join("")||'<p class="state-message">첨부된 현장 사진이 없습니다.</p>'}</div></section><section class="card action-row">${editable?'<button id="save-report" class="secondary">저장</button>':""}${editable&&r.status==="DRAFT"?'<button id="submit-report" class="primary">제출</button>':""}${editable&&r.status==="REVISION_REQUESTED"?'<button id="resubmit-report" class="primary">보완 재제출</button>':""}${manage&&["SUBMITTED","RESUBMITTED"].includes(r.status)?'<label>수정 요청 내용<input id="revision-text"></label><label>대상 구역<input id="revision-section"></label><label>기한<input id="revision-due" type="date"></label><button id="request-revision" class="secondary">수정 요청</button><button id="finalize-report" class="primary">확정</button>':""}${manage&&r.status==="FINALIZED"?'<label>재개방 사유<input id="reopen-reason"></label><button id="reopen-report" class="secondary">재개방</button>':""}<p id="construction-status" role="status"></p></section>${data.revisionRequests.filter(v=>v.status==="OPEN").map(v=>`<section class="card revision-request"><h3>수정 요청</h3><p>${escapeHtml(v.request_text)}</p><small>${escapeHtml(v.target_section||"전체")} · ${escapeHtml(v.due_date||"기한 없음")} · ${escapeHtml(v.requested_by_name)}</small></section>`).join("")}</section>`;
 if(!editable){document.querySelectorAll("#construction-editor input,#construction-editor textarea,#construction-editor select").forEach(v=>v.disabled=true);document.querySelectorAll("#construction-editor .remove-row").forEach(v=>v.hidden=true)}else bindRows();
 document.querySelector("#refresh-outputs")?.addEventListener("click",async()=>renderEditor(await api(`/daily-reports/${r.id}/refresh-outputs`,{method:"POST",body:JSON.stringify({revision:r.revision})})));
 const save=async()=>{const status=document.querySelector("#construction-status");try{const updated=await api(`/daily-reports/${r.id}`,{method:"PATCH",body:JSON.stringify(reportFormBody(data))});status.textContent="공사일보를 저장했습니다.";renderEditor(updated);return updated}catch(error){status.textContent=error.message;throw error}};
 document.querySelector("#save-report")?.addEventListener("click",save);
 const transition=async(action,extra={})=>{const status=document.querySelector("#construction-status");try{let current=data;if(editable)current=await save();renderEditor(await api(`/daily-reports/${r.id}/${action}`,{method:"POST",body:JSON.stringify({revision:current.report.revision,...extra})}))}catch(error){status.textContent=error.message}};
 document.querySelector("#submit-report")?.addEventListener("click",()=>transition("submit"));document.querySelector("#resubmit-report")?.addEventListener("click",()=>transition("resubmit"));document.querySelector("#finalize-report")?.addEventListener("click",()=>transition("finalize"));
 document.querySelector("#request-revision")?.addEventListener("click",()=>transition("revision-request",{requestText:document.querySelector("#revision-text").value,targetSection:document.querySelector("#revision-section").value,dueDate:document.querySelector("#revision-due").value}));
 document.querySelector("#reopen-report")?.addEventListener("click",()=>transition("reopen",{reason:document.querySelector("#reopen-reason").value}));
 let selectedPhoto=null;for(const input of [document.querySelector("#construction-camera"),document.querySelector("#construction-file")].filter(Boolean))input.onchange=()=>{selectedPhoto=input.files?.[0]||null;document.querySelector("#photo-upload").disabled=!selectedPhoto;document.querySelector("#photo-status").textContent=selectedPhoto?`${selectedPhoto.name} 선택됨`:"사진을 선택해 주세요."};
 document.querySelector("#photo-upload")?.addEventListener("click",async event=>{const status=document.querySelector("#photo-status"),photo=selectedPhoto,locationId=document.querySelector("#photo-location").value,description=document.querySelector("#photo-description").value;event.currentTarget.disabled=true;try{const thumbnail=await makeThumbnail(photo);status.textContent="작성 내용을 저장하는 중";await api(`/daily-reports/${r.id}`,{method:"PATCH",body:JSON.stringify(reportFormBody(data))});const form=new FormData();form.set("photo",photo);form.set("thumbnail",thumbnail);form.set("locationId",locationId);form.set("description",description);status.textContent="사진 업로드 중";renderEditor(await api(`/daily-reports/${r.id}/media`,{method:"POST",body:form}))}catch(error){status.textContent=error.message;event.currentTarget.disabled=false}});
 document.querySelectorAll("[data-photo]").forEach(button=>button.onclick=()=>{const dialog=document.querySelector("#photo-viewer");dialog.querySelector("img").src=button.dataset.photo;dialog.showModal()});editor.scrollIntoView({behavior:"smooth",block:"start"});
}
function plannedPage(content,title){content.innerHTML=header(title,"최소 데이터 계약만 준비되어 있으며 실제 기능은 준비 중입니다.")+'<p class="state-message">현재 준비 중인 기능입니다.</p>'}
const uploadStatus=value=>({ANALYZED:"분석 완료·확인 대기",CONFIRMED:"확정",FAILED:"양식 분석 실패",ANALYZING:"분석 중"}[value]||value);
const uploadRows=items=>items.map(item=>`<article class="card construction-upload-row"><div><strong>${escapeHtml(item.work_date_kst)} · Revision ${item.revision}</strong><span class="status-badge">${escapeHtml(uploadStatus(item.parse_status))}</span></div><p>${escapeHtml(item.original_file_name)} · ${Math.ceil(Number(item.size_bytes)/1024).toLocaleString()}KB</p><small>${escapeHtml(item.uploaded_by_name)} · ${escapeHtml(fmtTime(item.uploaded_at))} · 주요 작업 ${Number(item.work_count)}개 · 총 예정 ${Number(item.total_workforce)}명</small><div class="upload-row-actions"><button class="secondary" data-upload-id="${item.id}">날짜별 내용 보기</button><a class="secondary" href="${escapeHtml(item.downloadUrl)}">원본 다운로드</a></div></article>`).join("")||'<p class="state-message">업로드된 공사일보가 없습니다.</p>';
async function legacyExcelDailyPage(content){
 content.innerHTML=loadingSkeleton();try{const list=await api("/daily-report-uploads");content.innerHTML=header("공사일보","회사 보고용 공사일보 엑셀을 분석하고 확인 후 해당 날짜의 공식 원본으로 확정합니다.")+`<section class="card construction-upload-form"><div class="construction-grid"><label>공사일보 날짜<input id="excel-work-date" type="date" value="${dateValue()}"></label><label>엑셀 파일<input id="excel-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label></div><p class="state-message">.xlsx 파일만 지원합니다. .xls와 CSV는 지원하지 않습니다.</p>${can("CONSTRUCTION_DAILY_REPORT","EDIT")?'<button id="analyze-excel" class="primary">엑셀 업로드·분석</button>':""}<p id="excel-status" role="status"></p><div id="excel-preview"></div></section><section><h2>최근 업로드</h2><div class="construction-report-list">${uploadRows(list.items)}</div></section><section id="upload-detail"></section>`;
 const bindUploadDetails=()=>document.querySelectorAll("[data-upload-id]").forEach(button=>button.onclick=async()=>{const detail=await api(`/daily-report-uploads/${button.dataset.uploadId}`),target=document.querySelector("#upload-detail");target.innerHTML=`<article class="card"><h2>${escapeHtml(detail.upload.work_date_kst)} 공사일보 상세</h2><p>${escapeHtml(detail.upload.original_file_name)} · Revision ${detail.upload.revision} · ${escapeHtml(uploadStatus(detail.upload.parse_status))}</p><div class="construction-import-items">${detail.items.map(item=>`<article class="construction-work-item">${constructionWorkItemHtml({trade:item.trade_name_snapshot,displayTrade:item.displayTrade,plannedWorkforce:item.workforce_count,description:item.work_description,isFallbackWorkItem:item.is_fallback_work_item})}<small>${escapeHtml(item.location_text||"위치 미기재")} · ${escapeHtml(item.company_name_snapshot||"회사 연결 필요")}</small></article>`).join("")||'<p>오늘 등록된 주요 작업이 없습니다.</p>'}</div><h3>Revision 이력</h3>${detail.revisions.map(revision=>`<p>Revision ${revision.revision} · ${escapeHtml(uploadStatus(revision.parse_status))} · ${escapeHtml(fmtTime(revision.uploaded_at))}</p>`).join("")}<a class="secondary" href="${escapeHtml(detail.upload.downloadUrl)}">원본 엑셀 다운로드</a></article>`;target.scrollIntoView({behavior:"smooth",block:"start"})});bindUploadDetails();
 document.querySelector("#analyze-excel")?.addEventListener("click",async event=>{const status=document.querySelector("#excel-status"),preview=document.querySelector("#excel-preview"),file=document.querySelector("#excel-file").files?.[0];if(!file){status.textContent="공사일보 엑셀 파일을 선택해 주세요.";return}event.currentTarget.disabled=true;status.textContent="공사일보를 분석하고 있습니다.";const form=new FormData();form.set("workDate",document.querySelector("#excel-work-date").value);form.set("file",file);try{const result=await api("/daily-report-uploads/analyze",{method:"POST",body:form});status.textContent="공사일보 분석이 완료되었습니다.";preview.innerHTML=`${result.warning?`<p class="warning">${escapeHtml(result.warning)}</p>`:""}<div class="construction-analysis-summary"><strong>주요 작업 ${result.items.length}개</strong><strong>총 예정 인원 ${Number(result.totalWorkforce)}명</strong><span>문서 현장명 ${escapeHtml(result.upload.documentSiteName||"미기재")}</span></div><div class="construction-import-items">${result.items.map(item=>`<article class="construction-work-item">${constructionWorkItemHtml({trade:item.tradeNameSnapshot,plannedWorkforce:item.workforceCount,description:item.workDescription,isFallbackWorkItem:item.isFallbackWorkItem})}<small>${escapeHtml(item.locationText||"위치 미기재")} · 회사 연결 필요</small></article>`).join("")||'<p>오늘 등록된 주요 작업이 없습니다.</p>'}</div><button id="confirm-excel" class="primary">이 공사일보 확정</button>`;document.querySelector("#confirm-excel").onclick=async confirmButton=>{confirmButton.currentTarget.disabled=true;try{await api(`/daily-report-uploads/${result.upload.id}/confirm`,{method:"POST",body:"{}"});status.textContent="공사일보를 확정했습니다.";return excelDailyPage(content)}catch(error){status.textContent=error.message;confirmButton.currentTarget.disabled=false}}}catch(error){status.textContent=error.message}finally{event.currentTarget.disabled=false}});
 }catch(error){content.innerHTML=constructionErrorView(error)}
}
const fileSha256=async file=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",await file.arrayBuffer()))].map(value=>value.toString(16).padStart(2,"0")).join("");
export const monthlyWorkLabel=item=>{
 const {trade,workforce,description}=constructionWorkItemParts(item);
 return `${trade}(${workforce}) - ${description}`;
};
export const monthlyWorkRows=items=>(items||[]).map(item=>`<p class="construction-work-item">${constructionWorkItemHtml(item)}</p>`).join("")||"<p>등록된 주요 작업이 없습니다.</p>";
const monthlyDateRow=row=>`<article class="card construction-upload-date">
 <label><input type="checkbox" data-upload-date="${escapeHtml(row.workDate||"")}" ${row.selectable?"checked":"disabled"}> <strong>${escapeHtml(row.workDate||"날짜 확인 불가")}</strong></label>
 <span>${row.selectable?(row.existingRevision?`기존 공사일보 있음 · Revision ${row.nextRevision}로 저장`:"신규"):"저장 불가"}</span>
 <p>주요 작업 ${Number(row.workCount)}건 · 공종 ${Number(row.tradeCount)}개 · 금일 총 출력인원 ${Number(row.totalWorkforce)}명 · 경고 ${Number(row.warningCount)}건</p>
 ${row.workforceTotalMatchesSource===false?'<p class="warning">원본 총계와 계산 총계가 일치하지 않습니다. 개별 유효 행의 계산값을 사용합니다.</p>':""}
 <details><summary>작업 원문 확인</summary>${monthlyWorkRows(row.items)}</details>
</article>`;
const comparisonLabel=value=>({NEW:"신규",UNCHANGED:"동일",CHANGED:"변경",REVIEW_REQUIRED:"확인 필요",WARNING:"확인 필요",INVALID:"분석 불가",FUTURE:"미래 날짜"}[value]||value);
const comparisonText=value=>value===null||value===undefined?"없음":typeof value==="string"?value:Number.isFinite(Number(value))?String(value):"변경 내용이 있습니다.";
const comparisonList=value=>Array.isArray(value)?`<ul>${value.map(item=>`<li>${escapeHtml(typeof item==="string"?item:item?.trade?`${item.trade}(${item.plannedWorkforce===null?"인원 확인 필요":`${item.plannedWorkforce}명`})`:"변경 내용")}</li>`).join("")}</ul>`:`<p>${escapeHtml(comparisonText(value))}</p>`;
const comparisonWorkItems=value=>Array.isArray(value)?value.map(item=>constructionWorkItemHtml(item)).join(""):value?constructionWorkItemHtml(value):"<p>없음</p>";
const comparisonSide=(label,value,workItem=false)=>`<div class="construction-diff-item__${label==="기존"?"before":"after"}"><small>${label}</small>${workItem?comparisonWorkItems(value):comparisonList(value)}</div>`;
export const plannedWorkItemsDiffHtml=changes=>{
 return changes.map(change=>`<article class="construction-diff-item"><strong class="construction-diff-item__type">${escapeHtml(change.type)}</strong>${change.explanationKo?`<p class="warning">${escapeHtml(change.explanationKo)}</p>`:""}<div class="construction-grid">${comparisonSide("기존",change.before,true)}${comparisonSide("업로드",change.after,true)}</div></article>`).join("")||'<p>사용자가 확인할 작업 변경이 없습니다.</p>';
};
const comparisonChangeHtml=change=>change.field==="금일 주요 작업"?plannedWorkItemsDiffHtml([change]):`<article class="construction-diff-item"><strong class="construction-diff-item__type">${escapeHtml(change.field)}</strong><div class="construction-grid">${comparisonSide("기존",change.before)}${comparisonSide("업로드",change.after)}</div></article>`;
export const confirmationAvailability=status=>({
 NEW:{selectable:true,label:"확정 가능"},
 CHANGED:{selectable:true,label:"확인 후 확정 권장"}
}[status]||{selectable:false,label:"확정 불가"});
export const partitionConfirmationDates=rows=>(rows||[]).reduce((result,row)=>{
 if(row.comparisonStatus==="NEW")result.newDates.push(row.workDate);
 if(row.comparisonStatus==="CHANGED")result.changedDates.push(row.workDate);
 return result;
},{newDates:[],changedDates:[]});
const confirmationDateLabel=workDate=>{
 const [year,month,day]=String(workDate||"").split("-").map(Number);
 return year&&month&&day?`${year}년 ${month}월 ${day}일`:workDate||"날짜 확인 불가";
};
export const comparedDateRow=row=>{
 const availability=confirmationAvailability(row.comparisonStatus),workDate=escapeHtml(row.workDate||"");
 return `<article class="card construction-upload-date" data-comparison="${escapeHtml(row.comparisonStatus)}" data-confirm-date-card="${workDate}">
 <div class="construction-upload-date__heading"><div class="construction-upload-date__title">${row.editable?`<input type="checkbox" data-confirm-date="${workDate}" aria-label="${escapeHtml(confirmationDateLabel(row.workDate))} 확정 선택" ${availability.selectable?"":"disabled"}>`:""}<strong>${escapeHtml(row.workDate||"날짜 확인 불가")}</strong> <span class="status-badge">${escapeHtml(comparisonLabel(row.comparisonStatus))}</span></div>${row.editable&&availability.selectable?`<button class="secondary construction-confirm-one" type="button" data-confirm-one-date="${workDate}" aria-label="${escapeHtml(confirmationDateLabel(row.workDate))} 확정">이 날짜 확정</button>`:""}</div>
 <p>주요 작업 ${Number(row.workCount)}건 · 공종 ${Number(row.tradeCount)}개 · 예정 인원 ${Number(row.totalWorkforce)}명 · 경고 ${Number(row.warningCount)}건</p>
 ${row.comparisonStatus==="NEW"?'<p>기존 확정본이 없어 자동 반영할 수 있습니다.</p>':""}
 ${row.comparisonStatus==="UNCHANGED"?`<p>기존 Revision ${Number(row.existingRevision)}과 내용이 같습니다. 새 Revision을 만들지 않습니다.</p>`:""}
 ${row.comparisonStatus==="REVIEW_REQUIRED"?`<p class="warning">기존 Revision의 공종별 인원 근거가 부족해 자동으로 동일 여부를 확정할 수 없습니다.</p>${plannedWorkItemsDiffHtml(row.reviewItems||[])}`:""}
 ${row.comparisonStatus==="WARNING"?'<p class="warning">자동 반영할 수 없는 문서 구조 문제가 있습니다. 원본 날짜와 필수 항목을 확인해 주세요.</p>':""}
 ${row.comparisonStatus==="FUTURE"?'<p class="warning">오늘 이후 날짜이므로 자동 반영하지 않습니다.</p>':""}
 ${row.comparisonStatus==="INVALID"?'<p class="warning">날짜 또는 필수 항목을 확인할 수 없습니다.</p>':""}
 ${constructionWarningsHtml(row)}
 <p class="confirmation-availability" data-confirmation-availability>${row.comparisonStatus==="UNCHANGED"&&row.existingRevision?`Revision ${Number(row.existingRevision)} · 확정됨 · 출처 확정 공사일보`:escapeHtml(confirmationAvailability(row.comparisonStatus).label)}</p>
 ${row.comparisonStatus==="CHANGED"?`<details data-confirm-detail="${workDate}:changes"><summary>변경 항목 비교 · ${(row.changes||[]).length}건</summary>${(row.changes||[]).map(comparisonChangeHtml).join("")}</details>`:""}
 <details data-confirm-detail="${workDate}:source"><summary>작업 원문 확인</summary>${monthlyWorkRows(row.items)}</details>
</article>`};
const comparisonSummary=counts=>`신규 ${Number(counts.NEW||0)} · 동일 ${Number(counts.UNCHANGED||0)} · 변경 ${Number(counts.CHANGED||0)} · 확인 필요 ${Number(counts.REVIEW_REQUIRED||0)+Number(counts.WARNING||0)} · 분석 불가 ${Number(counts.INVALID||0)} · 미래 날짜 ${Number(counts.FUTURE||0)}`;
export const confirmationPreviewHtml=({preview,editable,title,meta=""})=>{
 const selectable=(preview?.dates||[]).some(row=>confirmationAvailability(row.comparisonStatus).selectable);
 return `<article class="card construction-confirmation-preview"><h2>${escapeHtml(title)}</h2>${meta?`<p>${escapeHtml(meta)}</p>`:""}${preview?.warning?`<p class="state-message">${escapeHtml(preview.warning)}</p>`:""}<p><strong>${escapeHtml(comparisonSummary(preview?.counts||{}))}</strong></p>${editable?`<div class="construction-confirm-controls"><strong data-selected-date-count aria-live="polite">선택 0일</strong><div class="construction-confirm-controls__actions"><button class="secondary" type="button" data-select-all-dates>전체 선택</button><button class="secondary" type="button" data-clear-all-dates>전체 해제</button><button class="primary" type="button" data-confirm-selected-dates disabled>선택 날짜 확정</button></div></div>${selectable?"":'<p class="state-message">선택할 수 있는 날짜가 없습니다.</p>'}`:""}<p data-confirm-status role="status"></p><details open data-confirm-detail="date-list"><summary>날짜별 상세 보기</summary><div class="construction-upload-dates">${(preview?.dates||[]).map(row=>comparedDateRow({...row,editable})).join("")}</div></details></article>`;
};
const confirmationErrorMessage=error=>error?.code==="CONSTRUCTION_UPLOAD_COMPARISON_STALE"?"비교 결과가 변경되었습니다. 파일 내용을 다시 확인해 주세요.":"선택한 날짜를 확정하지 못했습니다. 잠시 후 다시 시도해 주세요.";
export async function submitConfirmationGroups({sessionId,rows,request=api,keyFactory=()=>crypto.randomUUID()}){
 const groups=partitionConfirmationDates(rows),results=[],failures=[];
 for(const [action,dates] of [["AUTO_NEW",groups.newDates],["CONFIRM_CHANGED",groups.changedDates]]){
  if(!dates.length)continue;
  try{const response=await request(`/daily-report-upload-sessions/${sessionId}/confirm`,{method:"POST",headers:{"idempotency-key":keyFactory()},body:JSON.stringify({action,dates})});results.push(...response.results)}
  catch(error){failures.push({action,dates,error})}
 }
 return {results,failures};
}
export const singleConfirmationExecution=()=>{
 let running=false;
 return async work=>{if(running)return false;running=true;try{await work();return true}finally{running=false}};
};
export const syncConfirmationSelection=container=>{
 const inputs=[...container.querySelectorAll("[data-confirm-date]:not(:disabled)")],selected=inputs.filter(input=>input.checked).length,count=container.querySelector("[data-selected-date-count]"),button=container.querySelector("[data-confirm-selected-dates]");
 if(count)count.textContent=`선택 ${selected}일`;
 if(button)button.disabled=selected===0;
 return selected;
};
export const bindConfirmationSelectionChanges=container=>{
 container.querySelectorAll("[data-confirm-date]:not(:disabled)").forEach(input=>input.addEventListener("change",()=>syncConfirmationSelection(container)));
 return syncConfirmationSelection(container);
};
export const bindIndividualConfirmationButtons=(container,preview,executeRows)=>{
 container.querySelectorAll("[data-confirm-one-date]").forEach(button=>button.addEventListener("click",()=>executeRows((preview?.dates||[]).filter(row=>row.workDate===button.dataset.confirmOneDate))));
};
export const captureConfirmationViewState=(container,viewport=globalThis.window)=>({
 scrollY:Number(viewport?.scrollY||0),
 checkedDates:[...container.querySelectorAll("[data-confirm-date]:not(:disabled)")].filter(input=>input.checked).map(input=>input.dataset.confirmDate),
 openDetails:[...container.querySelectorAll("details[data-confirm-detail][open]")].map(detail=>detail.dataset.confirmDetail)
});
export const restoreConfirmationViewState=(container,state={},viewport=globalThis.window)=>{
 const checked=new Set(state.checkedDates||[]),opened=new Set(state.openDetails||[]);
 container.querySelectorAll("[data-confirm-date]:not(:disabled)").forEach(input=>{input.checked=checked.has(input.dataset.confirmDate)});
 container.querySelectorAll("details[data-confirm-detail]").forEach(detail=>{detail.open=opened.has(detail.dataset.confirmDetail)});
 syncConfirmationSelection(container);
 if(viewport?.scrollTo)viewport.scrollTo({top:Number(state.scrollY||0),left:0,behavior:"auto"});
};
const setConfirmationBusy=(container,busy)=>{
 container.querySelector(".construction-confirmation-preview")?.setAttribute("aria-busy",String(busy));
 container.querySelectorAll("[data-select-all-dates],[data-clear-all-dates],[data-confirm-selected-dates],[data-confirm-one-date],[data-confirm-date]").forEach(control=>{control.disabled=busy||control.dataset.confirmDate&&control.closest?.("[data-comparison]")&&!confirmationAvailability(control.closest("[data-comparison]").dataset.comparison).selectable});
 if(!busy)syncConfirmationSelection(container);
};
export function renderConfirmationPreview({container,sessionId,preview,editable,title,meta="",request=api,reloadPreview,viewport=globalThis.window,restoreState=null}){
 container.innerHTML=confirmationPreviewHtml({preview,editable,title,meta});bindConstructionWarningToggles(container);
 if(!editable)return;
 const selectable=()=>[...container.querySelectorAll("[data-confirm-date]:not(:disabled)")],confirmButton=container.querySelector("[data-confirm-selected-dates]");
 container.querySelector("[data-select-all-dates]")?.addEventListener("click",()=>{selectable().forEach(input=>{input.checked=true});syncConfirmationSelection(container)});
 container.querySelector("[data-clear-all-dates]")?.addEventListener("click",()=>{selectable().forEach(input=>{input.checked=false});syncConfirmationSelection(container)});
 const runOnce=singleConfirmationExecution();
 const executeRows=selectedRows=>runOnce(async()=>{
  const status=container.querySelector("[data-confirm-status]");
  if(!selectedRows.length){status.textContent="확정할 날짜를 하나 이상 선택해 주세요.";return}
  const state=captureConfirmationViewState(container,viewport);
  setConfirmationBusy(container,true);status.textContent=selectedRows.length===1?`${confirmationDateLabel(selectedRows[0].workDate)}을 확정하고 있습니다.`:"선택한 날짜를 확정하고 있습니다.";
  const outcome=await submitConfirmationGroups({sessionId,rows:selectedRows,request}),failedDates=outcome.failures.flatMap(item=>item.dates);
  let refreshed=null;
  try{refreshed=await reloadPreview()}catch{}
  if(refreshed){
   const completed=new Set(outcome.results.map(item=>item.workDate)),nextState={...state,checkedDates:state.checkedDates.filter(date=>!completed.has(date))};
   failedDates.forEach(date=>{if(!nextState.checkedDates.includes(date))nextState.checkedDates.push(date)});
   renderConfirmationPreview({container,sessionId,preview:refreshed.preview,editable,title,meta,request,reloadPreview,viewport,restoreState:nextState});
   const nextStatus=container.querySelector("[data-confirm-status]"),nextButton=container.querySelector("[data-confirm-selected-dates]");
   if(outcome.failures.length&&outcome.results.length)nextStatus.textContent="일부 날짜만 확정되었습니다. 실패한 날짜를 확인해 주세요.";
   else if(outcome.failures.length)nextStatus.textContent=confirmationErrorMessage(outcome.failures[0].error);
   else nextStatus.textContent=selectedRows.length===1?`${confirmationDateLabel(selectedRows[0].workDate)} 공사일보를 확정했습니다.`:`선택한 공사일보 ${outcome.results.length}개 날짜를 확정했습니다.`;
   if(nextButton)nextButton.disabled=!failedDates.length;
  }else{
   status.textContent=outcome.results.length?"일부 날짜만 확정되었습니다. 서버 상태 확인을 위해 화면을 새로고침해 주세요.":confirmationErrorMessage(outcome.failures[0]?.error);
   setConfirmationBusy(container,false);
  }
 });
 confirmButton?.addEventListener("click",()=>executeRows(selectable().filter(input=>input.checked).map(input=>preview.dates.find(row=>row.workDate===input.dataset.confirmDate)).filter(Boolean)));
 bindIndividualConfirmationButtons(container,preview,executeRows);
 bindConfirmationSelectionChanges(container);
 if(restoreState)restoreConfirmationViewState(container,restoreState,viewport);
}
const monthlySessionRows=items=>items.map(item=>`<article class="card construction-upload-row"><div><strong>${escapeHtml(item.month)} 월간 공사일보</strong></div><p>${escapeHtml(item.fileName)} · 포함 날짜 ${Number(item.dateCount)}일</p><small>${escapeHtml(comparisonSummary(item.counts||{}))} · 최근 업로드 ${escapeHtml(fmtTime(item.createdAt))} · ${escapeHtml(item.uploadedByName)}</small><div class="upload-row-actions"><button class="secondary" type="button" data-monthly-session="${escapeHtml(item.id)}">날짜별 내용 보기</button><a class="secondary" href="${escapeHtml(item.downloadUrl)}">원본 다운로드</a></div></article>`).join("")||'<p class="state-message">업로드된 월간 공사일보가 없습니다.</p>';

async function excelDailyPage(content){
 content.innerHTML=loadingSkeleton();
 try{
  const list=await api("/daily-report-upload-sessions");
  content.innerHTML=header("공사일보","월간 회사 공사일보를 업로드하고 파일 안의 날짜를 선택해 공식 원본으로 확정합니다.")+`
   <section class="card construction-upload-form">
    <label>엑셀 파일<input id="excel-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label>
    <p class="state-message">.xlsx 파일만 지원하며 최대 50MB까지 업로드할 수 있습니다.</p>
    ${can("CONSTRUCTION_DAILY_REPORT","EDIT")?'<button id="analyze-excel" class="primary">엑셀 업로드·분석</button>':""}
    <p id="excel-status" role="status"></p><div id="excel-preview"></div>
   </section>
   <section><h2>최근 월간 업로드</h2><div class="construction-report-list">${monthlySessionRows(list.items)}</div></section><section id="upload-detail"></section>`;
  bindUploadDetailsForMonthly();
  document.querySelector("#analyze-excel")?.addEventListener("click",async event=>{
   const button=event.currentTarget,status=document.querySelector("#excel-status"),preview=document.querySelector("#excel-preview"),file=document.querySelector("#excel-file")?.files?.[0];
   if(!file){status.textContent="공사일보 엑셀 파일을 선택해 주세요.";return}
   if(!/\.xlsx$/i.test(file.name)){status.textContent="지원하지 않는 파일입니다. .xlsx 파일을 선택해 주세요.";return}
   if(file.size>50*1024*1024){status.textContent="파일 크기가 너무 큽니다. 50MB 이하의 .xlsx 파일을 선택해 주세요.";return}
   button.disabled=true;
   try{
    status.textContent="파일 확인값을 만들고 있습니다.";
    const sha256=await fileSha256(file);
    const created=await api("/daily-report-upload-sessions",{method:"POST",body:JSON.stringify({fileName:file.name,mimeType:file.type||"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",sizeBytes:file.size,sha256})});
    status.textContent="공사일보 파일을 업로드하고 있습니다.";
    const uploaded=await fetch(created.upload.url,{method:"PUT",headers:{"content-type":created.upload.contentType},body:file});
    if(!uploaded.ok)throw Object.assign(new Error("공사일보 파일을 업로드하지 못했습니다. 잠시 후 다시 시도해 주세요."),{status:uploaded.status});
    status.textContent="월간 공사일보를 분석하고 있습니다.";
    const result=await api(`/daily-report-upload-sessions/${created.session.id}/complete`,{method:"POST",body:"{}"});
    status.textContent=`이 파일에서 ${result.preview.blockCount}개의 공사일보를 찾았습니다.`;
    const analysisMonth=(result.preview.dates.find(row=>row.workDate)?.workDate||"").slice(0,7),validDateCount=result.preview.dates.filter(row=>row.comparisonStatus!=="INVALID").length,reloadPreview=()=>api(`/daily-report-upload-sessions/${created.session.id}`);
    renderConfirmationPreview({container:preview,sessionId:created.session.id,preview:result.preview,editable:true,title:`${analysisMonth} 월간 공사일보 분석 결과`,meta:`파일 내 유효 날짜: ${validDateCount}일`,reloadPreview});
   }catch(error){status.textContent=error.message||"공사일보 정보를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요."}
   finally{if(button?.isConnected)button.disabled=false}
  });
 }catch(error){content.innerHTML=constructionErrorView(error)}
}
function bindUploadDetailsForMonthly(){
 document.querySelectorAll("[data-monthly-session]").forEach(button=>button.onclick=async()=>{
  const detail=await api(`/daily-report-upload-sessions/${button.dataset.monthlySession}`),target=document.querySelector("#upload-detail");
  const sessionId=detail.session.id,reloadPreview=()=>api(`/daily-report-upload-sessions/${sessionId}`);
  renderConfirmationPreview({container:target,sessionId,preview:detail.preview,editable:can("CONSTRUCTION_DAILY_REPORT","EDIT"),title:`${detail.session.fileName} 날짜별 내용`,reloadPreview});
  target.scrollIntoView({behavior:"smooth",block:"start"});
 });
 document.querySelectorAll("[data-upload-id]").forEach(button=>button.onclick=async()=>{
  const detail=await api(`/daily-report-uploads/${button.dataset.uploadId}`),target=document.querySelector("#upload-detail");
  target.innerHTML=`<article class="card"><h2>${escapeHtml(detail.upload.work_date_kst)} 공사일보 상세</h2><p>${escapeHtml(detail.upload.original_file_name)} · Revision ${detail.upload.revision} · ${escapeHtml(uploadStatus(detail.upload.parse_status))}</p><div class="construction-import-items">${detail.items.map(item=>`<article><strong>${escapeHtml(item.work_description)}</strong><span>${escapeHtml(item.trade_name_snapshot||"공종 미기재")} · 예정 ${Number(item.workforce_count)||0}명</span><small>${escapeHtml(item.location_text||"위치 정보 없음")} · 회사별 인원 정보 없음</small></article>`).join("")||"<p>등록된 주요 작업이 없습니다.</p>"}</div><a class="secondary" href="${escapeHtml(detail.upload.downloadUrl)}">원본 엑셀 다운로드</a></article>`;
  target.scrollIntoView({behavior:"smooth",block:"start"});
 });
}
const archiveCards=items=>items.map(item=>`<article class="card output-archive-card"><header><div><strong>${escapeHtml(item.company_name)} · ${escapeHtml(item.work_date_kst)}</strong><span class="status-badge">${item.status==="ACTIVE"?"보관 중":"무효"}</span></div><small>${escapeHtml(item.uploaded_by_name)} · ${escapeHtml(fmtTime(item.uploaded_at))}</small></header><p>${escapeHtml(item.note||"메모 없음")}</p><div class="construction-gallery">${(item.photos||[]).map(photo=>`<figure><button type="button" data-output-photo="${escapeHtml(photo.originalUrl)}"><img src="${escapeHtml(photo.thumbnailUrl)}" alt="출력일보 사진"></button><figcaption><a href="${escapeHtml(photo.originalUrl)}">원본 보기</a></figcaption></figure>`).join("")}</div>${item.status==="ACTIVE"&&can("CONSTRUCTION_OUTPUT_STATUS","EDIT")?`<div class="action-row"><input data-invalidate-reason="${item.id}" placeholder="무효 처리 사유"><button class="secondary" data-invalidate="${item.id}">잘못 올린 자료 무효 처리</button></div>`:""}</article>`).join("")||'<p class="state-message">등록된 출력일보 사진이 없습니다.</p>';
async function outputArchivePage(content){
 content.innerHTML=loadingSkeleton();try{const options=await api("/options");state.options=options;content.innerHTML=header("출력일보 보관함","수기로 작성한 출력일보 사진을 날짜·회사별 증빙자료로 보관합니다.")+`<section class="card output-upload-form"><div class="construction-grid"><label>날짜<input id="archive-date" type="date" value="${dateValue()}"></label><label>회사<select id="archive-company">${companyOptions(state.session.context.company?.id||"")}</select></label><label>사진 촬영<input id="archive-camera" type="file" accept="image/*" capture="environment" multiple></label><label>파일 선택<input id="archive-files" type="file" accept="image/*" multiple></label></div><label>간단 메모<textarea id="archive-note" rows="2"></textarea></label>${can("CONSTRUCTION_OUTPUT_STATUS","EDIT")?'<button id="archive-upload" class="primary">출력일보 사진 업로드</button>':""}<p id="archive-status" role="status"></p></section><section class="card construction-filter"><label>조회 날짜<input id="archive-filter-date" type="date" value="${dateValue()}"></label><label>회사 필터<select id="archive-filter-company"><option value="">전체 회사</option>${companyOptions().replace('<option value="">회사 미지정</option>',"")}</select></label></section><div id="archive-list"></div><dialog id="output-photo-viewer" class="construction-photo-viewer"><button class="secondary">닫기</button><img alt="출력일보 사진 확대"></dialog>`;
 const bindViewer=()=>{document.querySelectorAll("[data-output-photo]").forEach(button=>button.onclick=()=>{const dialog=document.querySelector("#output-photo-viewer");dialog.querySelector("img").src=button.dataset.outputPhoto;dialog.showModal()});document.querySelector("#output-photo-viewer>button").onclick=()=>document.querySelector("#output-photo-viewer").close();document.querySelectorAll("[data-invalidate]").forEach(button=>button.onclick=async()=>{const reason=document.querySelector(`[data-invalidate-reason="${button.dataset.invalidate}"]`).value;try{await api(`/output-sheets/${button.dataset.invalidate}/invalidate`,{method:"POST",body:JSON.stringify({reason})});await load()}catch(error){document.querySelector("#archive-status").textContent=error.message}})};
 const load=async()=>{const date=document.querySelector("#archive-filter-date").value,company=document.querySelector("#archive-filter-company").value,data=await api(`/output-sheets?workDate=${encodeURIComponent(date)}&companyId=${encodeURIComponent(company)}`);document.querySelector("#archive-list").innerHTML=archiveCards(data.items);bindViewer()};document.querySelector("#archive-filter-date").onchange=load;document.querySelector("#archive-filter-company").onchange=load;await load();
 document.querySelector("#archive-upload")?.addEventListener("click",async event=>{const status=document.querySelector("#archive-status"),files=[...document.querySelector("#archive-camera").files,...document.querySelector("#archive-files").files];if(!files.length){status.textContent="출력일보 사진을 선택해 주세요.";return}event.currentTarget.disabled=true;status.textContent="출력일보 사진을 업로드하고 있습니다.";try{const form=new FormData();form.set("workDate",document.querySelector("#archive-date").value);form.set("companyId",document.querySelector("#archive-company").value);form.set("note",document.querySelector("#archive-note").value);for(let index=0;index<files.length;index++){form.set(`photo${index}`,files[index]);form.set(`thumbnail${index}`,await makeThumbnail(files[index]))}await api("/output-sheets",{method:"POST",body:form});status.textContent="출력일보 사진을 보관했습니다.";document.querySelector("#archive-filter-date").value=document.querySelector("#archive-date").value;await load()}catch(error){status.textContent=error.message}finally{event.currentTarget.disabled=false}});
 }catch(error){content.innerHTML=header("출력일보 보관함","허용된 현장과 회사 범위의 자료만 표시합니다.")+errorState(error.message)}
}
export async function renderConstructionPage({content,path,session,csrf}){state={content,session,csrf,options:null};if(path==="/construction")return renderConstructionTodayPage({content,api,header});if(path==="/construction/monthly-plan")return renderMonthlyPlanPage({content,api,header,editable:can("CONSTRUCTION_DAILY_REPORT","EDIT")});if(path==="/construction/output-status"||path==="/construction/contractors")return outputArchivePage(content);if(path==="/construction/daily")return excelDailyPage(content);if(path==="/construction/plans")return plannedPage(content,"작업 계획");if(path==="/construction/records")return plannedPage(content,"공사 기록");content.innerHTML=errorState("연결된 공사 관리 화면이 없습니다.")}

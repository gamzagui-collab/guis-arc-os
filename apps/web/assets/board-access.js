import {escapeHtml,errorState,loadingSkeleton} from "../../../packages/ui/components.js";
import {companyTypeLabel,errorMessage,roleLabel} from "./i18n/ko.js";

let state,filters={companyType:"",companyId:"",roleCode:"",accountStatus:"ACTIVE",approvalStatus:"APPROVED",q:""},selected=new Set(),primaryUserId=null,pendingCopy=null;
async function api(path,options={}){const response=await fetch(`/api/v1/admin/board-access${path}`,{credentials:"include",cache:"no-store",...options,headers:{"content-type":"application/json","x-csrf-token":state.csrf(),"x-context-version":String(state.session.context.contextVersion),...(options.headers||{})}}),body=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(new Error(errorMessage(body,response.status)),{status:response.status,code:body.error});return body}
const header=()=>`<header class="page-header"><div><div class="breadcrumb">통합 관리 / 게시판 권한</div><h1>게시판 권한</h1><p class="page-description">회사를 선택하고 역할별 사용자를 확인한 뒤 게시판 권한을 설정합니다.</p></div></header>`;
const roles=user=>user.roleCodes.map(roleLabel).join(", ")||"역할 없음";
const statusLabel=value=>({ACTIVE:"활성",INACTIVE:"비활성",APPROVED:"승인",PENDING:"승인 요청 중",REJECTED:"승인 거절"}[value]||value);
const levelLabel=value=>({NONE:"권한 없음",VIEW:"열람",EDIT:"수정",MANAGE:"관리"}[value]||value);
const revisions=()=>Object.fromEntries(state.data.items.map(user=>[user.id,Object.fromEntries(state.data.boards.map(board=>[board.board_key,user.permissions[board.board_key]?.revision||0]))]));

function filterBar(){
 const companies=state.data.companies.filter(company=>!filters.companyType||company.companyType===filters.companyType);
 return `<div class="board-admin-filters">
 <select id="company-type"><option value="">회사 유형 전체</option><option value="GENERAL_CONTRACTOR">원도급사</option><option value="SUBCONTRACTOR">협력업체</option></select>
 <select id="company-filter"><option value="">전체 회사</option>${companies.map(company=>`<option value="${company.id}">${escapeHtml(company.name)}</option>`).join("")}</select>
 <select id="role-filter"><option value="">현장 역할 전체</option>${state.roles.map(role=>`<option value="${role}">${roleLabel(role)}</option>`).join("")}</select>
 <select id="account-status"><option value="">계정 상태 전체</option><option value="ACTIVE">활성</option><option value="INACTIVE">비활성</option></select>
 <select id="approval-status"><option value="">승인 상태 전체</option><option value="APPROVED">승인</option><option value="PENDING">승인 요청 중</option><option value="REJECTED">승인 거절</option></select>
 <input id="board-user-search" type="search" placeholder="이름 검색" value="${escapeHtml(filters.q)}">
 </div>`;
}

const userRow=user=>`<label class="board-user-row ${primaryUserId===user.id?"active":""}">
 <input type="checkbox" data-user-check="${user.id}" ${selected.has(user.id)?"checked":""}>
 <button type="button" class="board-user-open" data-user-open="${user.id}">
  <strong>${escapeHtml(user.display_name)}</strong>
  <span>${escapeHtml(roles(user))} · ${escapeHtml(user.company_name)}</span>
  <small>${statusLabel(user.account_status)} · ${statusLabel(user.approval_status)}${user.phone_last4?` · 연락처 끝 ${escapeHtml(user.phone_last4)}`:""}</small>
  <small>${user.permissionSummary.length?escapeHtml(user.permissionSummary.map(item=>item.replace("VIEW","열람").replace("EDIT","수정").replace("MANAGE","관리")).join(" · ")):"오늘만 열람"}</small>
 </button>
 </label>`;

function companyGroups(){
 const byCompany=new Map;
 for(const user of state.data.items){if(!byCompany.has(user.company_id))byCompany.set(user.company_id,[]);byCompany.get(user.company_id).push(user)}
 const ordered=[...byCompany.entries()];
 if(!ordered.length)return `<div class="empty-state"><strong>검색 결과 없음</strong><span>필터 조건을 변경해 주세요.</span></div>`;
 return ordered.map(([companyId,users])=>{const company=users[0],rolesMap=new Map;for(const user of users)for(const role of user.roleCodes.length?user.roleCodes:["NO_ROLE"]){if(!rolesMap.has(role))rolesMap.set(role,[]);rolesMap.get(role).push(user)}
  return `<details class="board-company-group" open><summary><span>${companyTypeLabel(company.company_type)} · ${escapeHtml(company.company_name)}</span><span>${users.length}명</span></summary>
  <button type="button" class="text-button" data-company-select="${companyId}">회사 전체 선택</button>
  ${[...rolesMap.entries()].map(([role,members])=>`<section class="board-role-group"><h3>${role==="NO_ROLE"?"역할 없음":roleLabel(role)} <span>${members.length}명</span></h3>${members.map(userRow).join("")}</section>`).join("")}
  </details>`}).join("");
}

const permissionSelect=(board,user)=>{const value=user?.permissions[board.board_key]?.accessLevel||"NONE",manager=user?.roleCodes.some(role=>["PLATFORM_OWNER","INTEGRATED_OWNER","SITE_MANAGER"].includes(role));return `<label class="permission-control"><span>${escapeHtml(board.display_name)}</span><select data-permission="${board.board_key}"><option value="NONE" ${value==="NONE"?"selected":""}>권한 없음</option><option value="VIEW" ${value==="VIEW"?"selected":""}>열람</option><option value="EDIT" ${value==="EDIT"?"selected":""}>수정</option>${manager?`<option value="MANAGE" ${value==="MANAGE"?"selected":""}>관리</option>`:""}</select></label>`};

function permissionPanel(){
 const user=state.data.items.find(item=>item.id===primaryUserId)||state.data.items[0];if(user&&!primaryUserId)primaryUserId=user.id;
 if(!user)return `<div class="empty-state"><strong>사용자를 선택해 주세요</strong></div>`;
 return `<section class="board-permission-panel">
 <header><h2>${escapeHtml(user.display_name)}</h2><p>${escapeHtml(user.company_name)} · ${escapeHtml(roles(user))}</p><small>계정 ${statusLabel(user.account_status)} · 가입 ${statusLabel(user.approval_status)}</small></header>
 <div class="permission-list"><div class="permission-fixed"><strong>오늘</strong><span>전체 열람 · 변경 불가</span></div>${state.data.boards.map(board=>permissionSelect(board,user)).join("")}</div>
 <section class="planned-permissions"><h3>준비 중인 모듈</h3>${state.data.plannedModules.map(module=>`<p><span>${escapeHtml(module.displayName)}</span><small>준비 중 · 권한 설정 비활성화</small></p>`).join("")}</section>
 <div class="board-selection-summary"><strong>선택 사용자 ${selected.size||1}명</strong><span>선택하지 않으면 현재 사용자에게 적용합니다.</span></div>
 <div class="permission-actions">
  <button type="button" class="primary" id="apply-permissions">선택 사용자에게 적용</button>
  <button type="button" class="secondary" id="copy-permissions">이 사용자의 권한 복사</button>
  <select id="default-role"><option value="">역할 기본 권한 선택</option>${user.roleCodes.filter(role=>state.roleDefaults[role]!==undefined).map(role=>`<option value="${role}">${roleLabel(role)} 기본 권한</option>`).join("")}</select>
  <button type="button" class="secondary" id="apply-default">기본 권한 적용</button>
 </div><p id="board-access-status" role="status"></p>
 </section>`;
}

function copyDialog(){
 if(!pendingCopy)return "";
 const targets=[...selected].filter(id=>id!==primaryUserId);
 return `<div class="modal-backdrop"><section class="card copy-dialog" role="dialog" aria-modal="true" aria-labelledby="copy-title"><h2 id="copy-title">권한 복사</h2>
 <p>기준 사용자: ${escapeHtml(state.data.items.find(user=>user.id===primaryUserId)?.display_name||"")}</p><p>대상 사용자: ${targets.length}명</p>
 <fieldset><legend>복사 방식</legend><label><input type="radio" name="copy-mode" value="REPLACE_ALL" checked>전체 게시판 권한 확인 후 기존 권한 교체</label><label><input type="radio" name="copy-mode" value="REPLACE_SELECTED">선택한 게시판만 교체</label><label><input type="radio" name="copy-mode" value="ADD_ONLY">선택한 권한만 추가</label></fieldset>
 <div id="copy-board-choices">${state.data.boards.map(board=>`<label><input type="checkbox" data-copy-board="${board.board_key}" checked>${escapeHtml(board.display_name)}</label>`).join("")}</div>
 <div id="copy-comparison"></div><div class="form-actions"><button type="button" class="secondary" id="copy-cancel">취소</button><button type="button" class="secondary" id="copy-preview">변경 비교</button><button type="button" class="primary" id="copy-confirm" disabled>적용</button></div><p id="copy-status" role="status"></p></section></div>`;
}

function render(){
 state.content.innerHTML=header()+filterBar()+`<div class="board-admin-layout"><aside class="board-user-browser"><div class="board-list-actions"><button type="button" class="secondary" id="select-visible">현재 검색 결과 전체 선택</button><button type="button" class="text-button" id="clear-selection">선택 해제</button></div>${companyGroups()}</aside><main>${permissionPanel()}</main></div>${copyDialog()}`;
 for(const [id,value] of Object.entries({"company-type":filters.companyType,"company-filter":filters.companyId,"role-filter":filters.roleCode,"account-status":filters.accountStatus,"approval-status":filters.approvalStatus}))document.querySelector(`#${id}`).value=value;
 bind();
}

async function reload(){const query=new URLSearchParams({siteId:state.session.context.selectedSiteId,...Object.fromEntries(Object.entries(filters).filter(([,value])=>value))});state.content.innerHTML=loadingSkeleton();state.data=await api(`/users?${query}`);state.roles=state.data.roles||[];if(primaryUserId&&!state.data.items.some(user=>user.id===primaryUserId))primaryUserId=null;render()}
const selectedTargets=()=>selected.size?[...selected]:primaryUserId?[primaryUserId]:[];
const panelPermissions=()=>Object.fromEntries([...document.querySelectorAll("[data-permission]")].map(select=>[select.dataset.permission,select.value]));

function bind(){
 const reloadFilter=(key,value)=>{filters[key]=value;if(key==="companyType")filters.companyId="";reload().catch(showPageError)};
 for(const [id,key] of Object.entries({"company-type":"companyType","company-filter":"companyId","role-filter":"roleCode","account-status":"accountStatus","approval-status":"approvalStatus"}))document.querySelector(`#${id}`).onchange=event=>reloadFilter(key,event.target.value);
 document.querySelector("#board-user-search").onchange=event=>reloadFilter("q",event.target.value.trim());
 document.querySelectorAll("[data-user-check]").forEach(input=>input.onchange=()=>{input.checked?selected.add(input.dataset.userCheck):selected.delete(input.dataset.userCheck);render()});
 document.querySelectorAll("[data-user-open]").forEach(button=>button.onclick=()=>{primaryUserId=button.dataset.userOpen;render()});
 document.querySelectorAll("[data-company-select]").forEach(button=>button.onclick=()=>{state.data.items.filter(user=>user.company_id===button.dataset.companySelect).forEach(user=>selected.add(user.id));render()});
 document.querySelector("#select-visible").onclick=()=>{state.data.items.forEach(user=>selected.add(user.id));render()};
 document.querySelector("#clear-selection").onclick=()=>{selected.clear();render()};
 document.querySelector("#apply-permissions")?.addEventListener("click",async()=>{const output=document.querySelector("#board-access-status"),targets=selectedTargets();output.textContent="저장 중";try{const result=await api("/batch",{method:"POST",body:JSON.stringify({siteId:state.session.context.selectedSiteId,userIds:targets,permissions:panelPermissions(),revisions:revisions()})});output.textContent=`${result.affectedUsers}명 · ${result.changed}건 반영됨`;selected.clear();await reload()}catch(error){output.textContent=`저장 실패: ${error.message}`}});
 document.querySelector("#copy-permissions")?.addEventListener("click",()=>{if(!selected.size||selected.size===1&&selected.has(primaryUserId)){document.querySelector("#board-access-status").textContent="복사 대상 사용자를 선택해 주세요.";return}pendingCopy={};render()});
 document.querySelector("#apply-default")?.addEventListener("click",async()=>{const roleCode=document.querySelector("#default-role").value,output=document.querySelector("#board-access-status");if(!roleCode){output.textContent="적용할 역할 기본 권한을 선택해 주세요.";return}output.textContent="적용 중";try{const result=await api("/apply-default",{method:"POST",body:JSON.stringify({siteId:state.session.context.selectedSiteId,roleCode,userIds:selectedTargets(),revisions:revisions()})});output.textContent=`${result.affectedUsers}명 · ${result.changed}건 반영됨`;selected.clear();await reload()}catch(error){output.textContent=`적용 실패: ${error.message}`}});
 bindCopy();
}

function copyPayload(dryRun){const mode=document.querySelector("[name=copy-mode]:checked").value,boardKeys=[...document.querySelectorAll("[data-copy-board]:checked")].map(input=>input.dataset.copyBoard);return {siteId:state.session.context.selectedSiteId,sourceUserId:primaryUserId,targetUserIds:[...selected].filter(id=>id!==primaryUserId),mode,boardKeys,revisions:revisions(),dryRun}}
function bindCopy(){
 document.querySelector("#copy-cancel")?.addEventListener("click",()=>{pendingCopy=null;render()});
 document.querySelector("#copy-preview")?.addEventListener("click",async()=>{const output=document.querySelector("#copy-status");output.textContent="변경 내용을 확인하는 중";try{const result=await api("/copy",{method:"POST",body:JSON.stringify(copyPayload(true))});document.querySelector("#copy-comparison").innerHTML=result.comparisons.length?`<h3>변경 비교 ${result.changed}건</h3><ul>${result.comparisons.slice(0,100).map(item=>`<li>${escapeHtml(state.data.items.find(user=>user.id===item.targetUserId)?.display_name||"")} · ${escapeHtml(state.data.boards.find(board=>board.board_key===item.boardKey)?.display_name||item.boardKey)}: ${levelLabel(item.previousAccess)} → ${levelLabel(item.newAccess)}</li>`).join("")}</ul>`:"<p>변경되는 권한이 없습니다.</p>";document.querySelector("#copy-confirm").disabled=!result.changed;output.textContent="비교 결과를 확인한 뒤 적용해 주세요."}catch(error){output.textContent=`비교 실패: ${error.message}`}});
 document.querySelector("#copy-confirm")?.addEventListener("click",async()=>{const button=document.querySelector("#copy-confirm"),output=document.querySelector("#copy-status");button.disabled=true;output.textContent="적용 중";try{const result=await api("/copy",{method:"POST",body:JSON.stringify(copyPayload(false))});pendingCopy=null;selected.clear();await reload();document.querySelector("#board-access-status").textContent=`권한 복사 ${result.changed}건 반영됨`}catch(error){output.textContent=`적용 실패: ${error.message}`}});
}
function showPageError(error){state.content.innerHTML=header()+errorState(error.message)}

export async function renderBoardAccessPage(input){
 state={...input,csrf:()=>input.csrf||sessionStorage.getItem("integrated.csrf")||""};
 try{const definitions=await api(`?siteId=${encodeURIComponent(state.session.context.selectedSiteId)}`);state.roleDefaults=definitions.roleDefaults||{};await reload()}catch(error){showPageError(error)}
}

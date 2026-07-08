import { ensureTodayData, addTodayTrade, addMaterial, addEquipment, setConcretePlan, buildTodayBriefing, ROLE_LIST } from "../services/todayWorkEngine.js";
import { saveLocal } from "../core/state.js";
import { TRADE_KNOWLEDGE } from "../services/knowledgeBase.js";

function actionList(items){return items?.length?items.map(x=>`<label class="action-item"><input type="checkbox"><span>${x}</span></label>`).join(""):`<p class="help-text">등록된 항목이 없습니다.</p>`;}

export function renderToday(root){
 const today=ensureTodayData(); const b=buildTodayBriefing();
 root.innerHTML=`
 <div class="section-head"><div><h2>TODAY · 오늘 업무</h2><p>오늘 작업공종, 자재반입, 장비운영, 타설계획을 입력하면 역할별 해야 할 일을 자동 정리합니다.</p></div><div class="export-row"><button id="copyTodayBtn" class="secondary-btn">오늘 브리핑 복사</button><button class="secondary-btn" onclick="window.print()">출력</button></div></div>
 <section class="today-hero"><div><span>오늘 현장 입력</span><h2>${today.date}</h2><p>작업공종 ${today.trades.length}개 · 자재 ${today.materials.length}건 · 장비 ${today.equipment.length}건</p></div><label>내 역할<select id="todayRoleSelect">${ROLE_LIST.map(r=>`<option ${today.role===r?"selected":""}>${r}</option>`).join("")}</select></label></section>
 <section class="today-input-grid">
  <article class="card"><h3>작업공종 선택</h3><select id="tradeSelect">${TRADE_KNOWLEDGE.map(t=>`<option>${t.name}</option>`).join("")}</select><button id="addTradeBtn" class="primary-btn">공종 추가</button><div class="chip-line">${today.trades.map(t=>`<span class="plan-chip">${t}</span>`).join("")}</div></article>
  <article class="card"><h3>콘크리트 타설</h3><div class="form-grid one"><label>타설량(㎥)<input id="concreteVolume" type="number" value="${today.concrete?.volumeM3||120}"></label><label>타설부위<input id="concretePart" value="${today.concrete?.part||"슬래브"}"></label><label>펌프카<input id="concretePump" value="${today.concrete?.pump||"52M"}"></label></div><button id="saveConcreteBtn" class="primary-btn">타설계획 반영</button></article>
  <article class="card"><h3>자재반입</h3><label>자재명<input id="matName" placeholder="예: 철근 D13"></label><label>수량<input id="matQty" placeholder="예: 20Ton"></label><button id="addMaterialBtn" class="secondary-btn">자재 추가</button></article>
  <article class="card"><h3>장비운영</h3><label>장비명<input id="eqName" placeholder="예: 25톤 크레인"></label><label>작업내용<input id="eqTask" placeholder="예: 철근 양중"></label><button id="addEquipmentBtn" class="secondary-btn">장비 추가</button></article>
 </section>
 <section class="card"><h3>5초 요약</h3><div class="summary-grid">${b.actions.slice(0,4).map(x=>`<article class="summary-card risk-orange"><div class="label">오늘 확인</div><p>${x}</p></article>`).join("")||`<article class="summary-card"><p>오늘 작업을 입력하세요.</p></article>`}</div></section>
 <section class="card"><h3>역할별 오늘 할 일</h3><div class="role-grid">${Object.entries(b.roleActions).map(([role,list])=>`<article class="role-box ${role===today.role?"role-selected":""}"><h4>${role}</h4><div class="action-list">${actionList(list)}</div></article>`).join("")}</div></section>
 <section class="card"><h3>사진 기록 포인트</h3><div class="action-list">${actionList(b.photoPoints)}</div></section>
 <section class="card"><h3>TBM 자동 문구</h3><pre id="todayBriefText" class="tbm-box">${b.tbm||"오늘 작업을 입력하면 TBM 문구가 생성됩니다."}</pre></section>`;
 root.querySelector("#todayRoleSelect").addEventListener("change",e=>{today.role=e.target.value;saveLocal();renderToday(root);});
 root.querySelector("#addTradeBtn").addEventListener("click",()=>{addTodayTrade(root.querySelector("#tradeSelect").value);renderToday(root);});
 root.querySelector("#saveConcreteBtn").addEventListener("click",()=>{setConcretePlan({volumeM3:Number(root.querySelector("#concreteVolume").value),part:root.querySelector("#concretePart").value,pump:root.querySelector("#concretePump").value});renderToday(root);});
 root.querySelector("#addMaterialBtn").addEventListener("click",()=>{addMaterial({name:root.querySelector("#matName").value,qty:root.querySelector("#matQty").value});renderToday(root);});
 root.querySelector("#addEquipmentBtn").addEventListener("click",()=>{addEquipment({name:root.querySelector("#eqName").value,task:root.querySelector("#eqTask").value});renderToday(root);});
 root.querySelector("#copyTodayBtn").addEventListener("click",()=>{navigator.clipboard.writeText(root.querySelector("#todayBriefText").innerText);alert("오늘 브리핑을 복사했습니다.");});
}

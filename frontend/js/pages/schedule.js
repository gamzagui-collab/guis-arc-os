import { state, saveLocal } from "../core/state.js";
export function renderSchedule(root){
  const today = new Date();
  const days = Array.from({length:14},(_,i)=>{const d=new Date(today); d.setDate(today.getDate()+i); return d;});
  root.innerHTML = `<div class="section-head"><div><h2>현장일정</h2><p>자재반입 · 타설계획 · 장비운영 · 공정일정을 기록합니다.</p></div><div class="export-row"><button id="addConcretePlanBtn" class="primary-btn">타설계획 추가</button><button id="addMaterialPlanBtn" class="secondary-btn">자재반입 추가</button><button id="addEquipmentPlanBtn" class="secondary-btn">장비운영 추가</button></div></div>
  <section class="card"><div class="calendar-grid">${days.map(d=>`<div class="day-cell"><strong>${d.getMonth()+1}/${d.getDate()}</strong>${(state.schedules||[]).filter(x=>x.date===d.toISOString().slice(0,10)).map(x=>`<span class="chip">${x.type} · ${x.title}</span>`).join("")}</div>`).join("")}</div></section>`;
  
  root.querySelector("#addMaterialPlanBtn").addEventListener("click", ()=>{
    const title = prompt("반입 자재를 입력하세요. 예: 철근 D13 20Ton"); if(!title) return;
    state.schedules.push({id:Date.now(), type:"자재", title, date:new Date().toISOString().slice(0,10), checklist:{method:"지게차", signal:false, storage:"미입력"}});
    saveLocal(); renderSchedule(root);
  });

  root.querySelector("#addEquipmentPlanBtn").addEventListener("click", ()=>{
    const title = prompt("운영 장비를 입력하세요. 예: 25톤 크레인"); if(!title) return;
    state.schedules.push({id:Date.now(), type:"장비", title, date:new Date().toISOString().slice(0,10), checklist:{radius:"미입력", signal:false, windCheck:false}});
    saveLocal(); renderSchedule(root);
  });

  root.querySelector("#addConcretePlanBtn").addEventListener("click", ()=>{
    const title = prompt("타설 구간을 입력하세요. 예: 3층 슬래브"); if(!title) return;
    state.schedules.push({id:Date.now(), type:"타설", title, date:new Date().toISOString().slice(0,10), checklist:{pumpSize:"미입력", readySpace:false, roadClear:false, outrigger:false, soilType:"미입력"}});
    saveLocal(); renderSchedule(root);
  });
}

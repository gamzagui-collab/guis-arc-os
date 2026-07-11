import { state, saveLocal } from "../core/state.js";

export function ensureSpecimenState(){
  state.castings = state.castings || [];
  state.specimenTasks = state.specimenTasks || [];
  return {castings: state.castings, tasks: state.specimenTasks};
}

function addDays(dateString, days){
  const d = new Date(dateString);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0,10);
}
function pad(n){return String(n).padStart(3,"0");}

export function generateSpecimenTasks(casting){
  const base = `${casting.castDate.replaceAll("-","")}-${casting.block || "SITE"}-${casting.floor || ""}`;
  const setCount = Math.max(1, Math.ceil(Number(casting.volumeM3 || 120) / 120));
  const tasks = [];
  const add = (name, curing, age, qty) => {
    for(let i=1;i<=setCount;i++){
      tasks.push({
        id:`${base}-${name}-${i}`,
        castingId:casting.id,
        workId:casting.workId || null,
        testDate:addDays(casting.castDate, age),
        block:casting.block,
        location:`${casting.floor || ""} ${casting.member || ""}`.trim(),
        testType:name,
        curing,age,qty,setNo:i,status:"예정",
        specimenNos:Array.from({length:qty},(_,k)=>`${base}-${name}-${pad((i-1)*qty+k+1)}`),
        strengths:[]
      });
    }
  };
  add("수직부재 탈형강도","현장양생",1,3);
  add("수평부재 탈형강도","현장양생",1,3);
  add("필라서포트 확인","현장양생",7,3);
  add("28일 압축강도","표준양생",28,9);
  add("28일 압축강도","현장양생",28,9);
  add("예비 공시체","예비",28,3);
  return {setCount,tasks,totalQty:tasks.reduce((s,t)=>s+t.qty,0)};
}

export function registerCasting(data){
  const s = ensureSpecimenState();
  const casting = {id:Date.now(),createdAt:new Date().toISOString(),...data};
  const generated = generateSpecimenTasks(casting);
  casting.setCount = generated.setCount;
  casting.totalSpecimens = generated.totalQty;
  s.castings.push(casting);
  s.tasks.push(...generated.tasks);
  saveLocal();
  return {casting,...generated};
}

export function getTodayQualityTasks(date = new Date().toISOString().slice(0,10)){
  ensureSpecimenState();
  return state.specimenTasks.filter(t => t.testDate <= date && t.status !== "완료");
}

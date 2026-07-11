import { state, saveLocal } from "../core/state.js";

const nowIso=()=>new Date().toISOString();
const todayYmd=()=>new Date().toLocaleDateString("sv-SE",{timeZone:"Asia/Seoul"});
const clean=v=>String(v??"").trim();
const STATUS=["지시","진행","완료","보류"];
const ROLE_PAGE={"안전관리":"safetyPage","품질관리":"qualityPage","공사관리":"constructionPage","자재·장비":"resourcePage","현장소장":"directorPage"};

export function ensureDirectorInstructionState(){
  state.directorInstructions=Array.isArray(state.directorInstructions)?state.directorInstructions:[];
  return state.directorInstructions;
}

export function instructionForWork(workId){
  ensureDirectorInstructionState();
  return state.directorInstructions.filter(x=>x.workId===workId).sort((a,b)=>String(b.updatedAt||"").localeCompare(String(a.updatedAt||"")));
}

export function allOpenInstructions(date=""){
  ensureDirectorInstructionState();
  return state.directorInstructions.filter(x=>(!date||x.workDate===date)&&x.status!=="완료");
}

export function addDirectorInstruction(input={}){
  ensureDirectorInstructionState();
  const workId=clean(input.workId); const text=clean(input.text);
  if(!workId||!text) return null;
  const item={
    instructionId:`DIR-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
    workId, workDate:input.workDate||todayYmd(), text,
    role:clean(input.role)||"공사관리", assignee:clean(input.assignee),
    dueDate:input.dueDate||input.workDate||todayYmd(), dueTime:clean(input.dueTime),
    priority:["긴급","중요","일반"].includes(input.priority)?input.priority:"중요",
    status:"지시", handoverNote:"", resultNote:"", createdBy:clean(input.createdBy)||"현장소장",
    createdAt:nowIso(), updatedAt:nowIso(), completedAt:null
  };
  state.directorInstructions.push(item); saveLocal(); return item;
}

export function updateDirectorInstruction(id,patch={}){
  ensureDirectorInstructionState(); const item=state.directorInstructions.find(x=>x.instructionId===id); if(!item)return null;
  const nextStatus=STATUS.includes(patch.status)?patch.status:item.status;
  Object.assign(item,patch,{status:nextStatus,updatedAt:nowIso()});
  if(nextStatus==="완료"&&!item.completedAt)item.completedAt=nowIso();
  if(nextStatus!=="완료")item.completedAt=null;
  saveLocal(); return item;
}

export function deleteDirectorInstruction(id){
  ensureDirectorInstructionState(); state.directorInstructions=state.directorInstructions.filter(x=>x.instructionId!==id); saveLocal();
}

export function instructionSummary(workId){
  const rows=instructionForWork(workId); return {total:rows.length,open:rows.filter(x=>x.status!=="완료").length,done:rows.filter(x=>x.status==="완료").length,rows};
}


export function instructionTiming(item, now=new Date()){
  if(!item) return {code:"none",label:"정보없음",level:"normal",minutesLeft:null};
  if(item.status==="완료") return {code:"done",label:"완료",level:"done",minutesLeft:null};
  const dueDate=clean(item.dueDate)||clean(item.workDate)||todayYmd();
  const dueTime=clean(item.dueTime)||"23:59";
  const due=new Date(`${dueDate}T${dueTime}:00+09:00`);
  const minutesLeft=Number.isFinite(due.getTime())?Math.floor((due.getTime()-now.getTime())/60000):null;
  const updated=new Date(item.updatedAt||item.createdAt||nowIso());
  const holdHours=Number.isFinite(updated.getTime())?(now.getTime()-updated.getTime())/3600000:0;
  if(item.status==="보류"&&holdHours>=24) return {code:"longHold",label:"장기 보류",level:"critical",minutesLeft};
  if(minutesLeft!==null&&minutesLeft<0) return {code:item.status==="지시"?"overdueNotStarted":"overdue",label:item.status==="지시"?"기한초과·미착수":"기한초과",level:"critical",minutesLeft};
  if(item.status==="지시"&&minutesLeft!==null&&minutesLeft<=240) return {code:"notStarted",label:"미착수",level:"warn",minutesLeft};
  if(minutesLeft!==null&&minutesLeft<=120) return {code:"dueSoon",label:"기한 임박",level:"warn",minutesLeft};
  if(item.status==="보류") return {code:"hold",label:"보류",level:"warn",minutesLeft};
  if(item.status==="진행") return {code:"progress",label:"진행 중",level:"info",minutesLeft};
  return {code:"assigned",label:"지시됨",level:"normal",minutesLeft};
}

export function instructionTrackingSummary(date="", now=new Date()){
  ensureDirectorInstructionState();
  const rows=state.directorInstructions.filter(x=>(!date||x.workDate===date)).map(item=>({item,timing:instructionTiming(item,now)}));
  const open=rows.filter(x=>x.item.status!=="완료");
  return {rows,open,total:rows.length,overdue:open.filter(x=>x.timing.code.includes("overdue")).length,notStarted:open.filter(x=>x.timing.code==="notStarted"||x.timing.code==="overdueNotStarted").length,dueSoon:open.filter(x=>x.timing.code==="dueSoon").length,longHold:open.filter(x=>x.timing.code==="longHold").length};
}

export function targetPageForInstruction(item){return ROLE_PAGE[item?.role]||"workHubPage";}

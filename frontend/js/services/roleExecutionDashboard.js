import { workInstancesForDate, todayYmd } from "./workInstanceDatabase.js";
import { auditWorkInstance } from "./complianceAudit.js";
import { evaluateWorkPriority } from "./workPriorityEngine.js";
import { state } from "../core/state.js";

const ROLE_META = {
  "현장소장": { page:"directorPage", label:"전체 조정", order:0 },
  "안전관리": { page:"safetyPage", label:"안전 실행", order:1 },
  "품질관리": { page:"qualityPage", label:"품질 실행", order:2 },
  "공사관리": { page:"constructionPage", label:"공사 실행", order:3 },
  "자재·장비": { page:"resourcePage", label:"자원 실행", order:4 }
};
const LEVEL_WEIGHT = { critical:4, warn:2, ok:0 };

function add(bucket, role, work, title, detail, severity="warn", targetPage=ROLE_META[role]?.page || "workHubPage", ruleId=""){
  bucket.push({
    role, workId:work.workId, workDate:work.workDate, title, detail,
    workTitle:work.subProcess || work.title, location:work.location || "위치 미입력",
    startTime:work.startTime || "", severity, targetPage, ruleId
  });
}

function resourceActions(work, bucket){
  const rows=(state.workResources||[]).filter(x=>x.workId===work.workId);
  const notReady=rows.filter(x=>!["준비완료","사용중","반출완료"].includes(x.status));
  const equipment=rows.filter(x=>x.type==="장비" && !x.inspection);
  if(notReady.length) add(bucket,"자재·장비",work,"자재·장비 준비",`${notReady.length}건 준비상태 확인 필요`,"warn","resourcePage","resource-ready");
  if(equipment.length) add(bucket,"자재·장비",work,"장비 사전점검",`${equipment.length}건 검수·점검 미완료`,"critical","resourcePage","equipment");
}

function qualityActions(work, bucket){
  const inspection=(state.constructionInspections||[]).find(x=>x.workId===work.workId);
  if(inspection && inspection.status!=="검측완료") add(bucket,"공사관리",work,"검측 상태 확인",`현재 상태: ${inspection.status||"미검측"}`,"critical","constructionPage","inspection");
}

function constructionActions(work, bucket){
  const record=(state.constructionRecords||[]).find(x=>x.workId===work.workId);
  if(record?.status==="중지") add(bucket,"공사관리",work,"중지 작업 확인","중지 사유와 재개조건 확인 필요","critical","constructionPage","construction-stop");
}

export function buildRoleExecutionDashboard(date=todayYmd()){
  const works=workInstancesForDate(date);
  const actions=[];
  works.forEach(work=>{
    const audit=auditWorkInstance(work);
    const priority=evaluateWorkPriority(work);
    audit.openMissing.forEach(check=>add(actions,check.target,work,check.title,check.detail,check.severity,check.targetPage,check.ruleId));
    resourceActions(work,actions);
    qualityActions(work,actions);
    constructionActions(work,actions);
    if(priority.level!=="정상") add(actions,"현장소장",work,`${priority.level} 작업 종합조정`,(priority.reasons||[]).slice(0,3).join(" · ")||"담당자 조치상태 확인",priority.level==="긴급"?"critical":"warn","workHubPage","priority");
  });

  actions.sort((a,b)=>(LEVEL_WEIGHT[b.severity]||0)-(LEVEL_WEIGHT[a.severity]||0) || String(a.startTime||"99:99").localeCompare(String(b.startTime||"99:99")) || String(a.workId).localeCompare(String(b.workId)));
  const roles=Object.entries(ROLE_META).sort((a,b)=>a[1].order-b[1].order).map(([role,meta])=>{
    const items=actions.filter(x=>x.role===role);
    return {role,...meta,items,critical:items.filter(x=>x.severity==="critical").length,warn:items.filter(x=>x.severity==="warn").length};
  });
  return {date,works,actions,roles,total:actions.length,critical:actions.filter(x=>x.severity==="critical").length};
}

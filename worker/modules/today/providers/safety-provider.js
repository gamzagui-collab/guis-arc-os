export async function safetyProvider({env,ctx,scope}){
 if(!ctx.modules.includes("safety")||!ctx.boardAccess?.SAFETY_DASHBOARD?.accessLevel)return {code:"safety",label:"안전 업무",implementationStatus:"IMPLEMENTED",state:"NO_PERMISSION",message:"안전 현황을 볼 권한이 없습니다.",cards:[]};
 const contractor=scope.roles?.some(v=>["CONTRACTOR_MANAGER","CONTRACTOR_SITE_MANAGER","CONTRACTOR_FOREMAN","CONTRACTOR_EMPLOYEE","FIELD_WORKER"].includes(v))&&!scope.roles?.some(v=>["PLATFORM_OWNER","INTEGRATED_OWNER","SITE_MANAGER","SAFETY_MANAGER"].includes(v)),args=contractor?[scope.siteId,scope.companyId]:[scope.siteId],company=contractor?" AND company_id=?2":"";
 const [cases,periodic]=await env.DB.batch([
  env.DB.prepare(`SELECT SUM(status NOT IN ('FINALIZED','CANCELLED')) open,SUM(status='REVIEW_PENDING') review,SUM(due_date<date('now') AND status NOT IN ('FINALIZED','CANCELLED')) overdue FROM safety_cases WHERE site_id=?1${company}`).bind(...args),
  env.DB.prepare("SELECT SUM(i.status IN ('AVAILABLE','IN_PROGRESS','REVISION_REQUESTED','OVERDUE')) pending,SUM(i.status IN ('OVERDUE','MISSED')) overdue,SUM(i.status='REVIEW_PENDING') review,SUM(i.status='REVISION_REQUESTED') revision,SUM(i.recurrence_type='DAILY' AND i.status IN ('AVAILABLE','IN_PROGRESS','OVERDUE')) daily,SUM(i.recurrence_type='WEEKLY' AND i.status IN ('AVAILABLE','IN_PROGRESS','OVERDUE')) weekly,SUM(i.recurrence_type='MONTHLY' AND i.status IN ('AVAILABLE','IN_PROGRESS','OVERDUE')) monthly FROM periodic_task_instances i JOIN periodic_task_definitions d ON d.id=i.definition_id WHERE i.site_id=?1 AND d.module_key='safety'").bind(scope.siteId)
 ]);
 const c=cases.results[0]||{},p=periodic.results[0]||{};
 return {code:"safety",label:"안전 업무",implementationStatus:"IMPLEMENTED",state:"LOADED",message:`진행 중 ${Number(c.open||0)}건 · 주간 ${Number(p.weekly||0)}건 · 월간 ${Number(p.monthly||0)}건 · 검토 대기 ${Number(p.review||0)}건`,href:"/safety",cards:[
  {code:"SAFETY_OPEN",label:"진행 중 안전 사례",count:Number(c.open||0),href:"/safety/cases",priority:"A"},
  {code:"SAFETY_REVIEW",label:"검토 대기",count:Number(c.review||0),href:"/safety/cases?status=REVIEW_PENDING",priority:"A"},
  {code:"SAFETY_OVERDUE",label:"기한 초과 개선조치",count:Number(c.overdue||0),href:"/safety/cases?view=overdue",priority:"A"},
  {code:"SAFETY_PERIODIC_DAILY",label:"일간 안전 업무",count:Number(p.daily||0),href:"/safety/periodic?recurrenceType=DAILY",priority:Number(p.overdue||0)?"A":"B"},
  {code:"SAFETY_PERIODIC_WEEKLY",label:"주간 안전 업무",count:Number(p.weekly||0),href:"/safety/periodic?recurrenceType=WEEKLY",priority:"B"},
  {code:"SAFETY_PERIODIC_MONTHLY",label:"월간 안전 업무",count:Number(p.monthly||0),href:"/safety/periodic?recurrenceType=MONTHLY",priority:"B"},
  {code:"SAFETY_PERIODIC_REVIEW",label:"안전 업무 검토 대기",count:Number(p.review||0),href:"/safety/periodic?status=REVIEW_PENDING",priority:"A"},
  {code:"SAFETY_PERIODIC_REVISION",label:"안전 업무 보완 요청",count:Number(p.revision||0),href:"/safety/periodic?status=REVISION_REQUESTED",priority:"A"}
 ]};
}

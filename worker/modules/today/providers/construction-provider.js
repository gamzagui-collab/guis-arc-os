import {kstWorkDate} from "../today-policy.js";
import {reconcileWorkforceTrades,resolveCanonicalTrade} from "../../construction/trade-matcher.js";
import {listMonthlyPlansForRange} from "../../construction/monthly-plan.js";
import {normalizeSourceItemRefs} from "../../issue-source-reference.js";

const addDate=(date,days)=>{
 const value=new Date(`${date}T00:00:00Z`);value.setUTCDate(value.getUTCDate()+days);return value.toISOString().slice(0,10);
};
const planEntry=(plan,date)=>({
 id:plan.id,date,source:"MONTHLY_PLAN",trade:plan.tradeLabel,company:plan.contractorCompanyName,
 location:plan.locationText,description:plan.workDescription,plannedWorkforce:plan.plannedWorkforce,
 startTime:plan.startTime,endTime:plan.endTime,caution:plan.cautionText,status:plan.status
});

export function aggregateMajorWorks(rows=[]){
 const grouped=new Map();
 for(const row of rows){
  const name=String(row.manager_summary||row.work_description||"").trim();
  if(!name)continue;
  const key=row.is_fallback_work_item?`${row.trade_name_snapshot}::${name}`:name;
  if(!grouped.has(key))grouped.set(key,{id:`construction-work-${grouped.size+1}`,name,locations:[],companies:new Map(),sourceItems:[],total:0,workforceRegistered:false,companyBreakdownAvailable:true,isFallbackWorkItem:Boolean(row.is_fallback_work_item)});
  const work=grouped.get(key),location=String(row.location_name||row.location_text||"").trim(),company=String(row.company_name||row.company_name_snapshot||"").trim();
  const hasWorkforce=row.workforce_count!==null&&row.workforce_count!==undefined&&row.workforce_count!==""&&Number.isFinite(Number(row.workforce_count));
  const count=hasWorkforce?Math.max(0,Number(row.workforce_count)):0;
  const displayTrade=row.trade_name_snapshot?resolveCanonicalTrade(row.trade_name_snapshot).baseTradeRaw:null;
  if(displayTrade&&!work.trades)work.trades=[];
  if(displayTrade&&!work.trades.includes(displayTrade))work.trades.push(displayTrade);
  if(location&&!work.locations.includes(location))work.locations.push(location);
  if(hasWorkforce){work.total+=count;work.workforceRegistered=true}
  if(company)work.companies.set(company,(work.companies.get(company)||0)+count);
  else work.companyBreakdownAvailable=false;
  if(row.id)work.sourceItems.push(row);
 }
 return [...grouped.values()].map(work=>{
  const companies=[...work.companies].map(([name,count])=>({name,count}));
  return {id:work.id,name:work.name,location:work.locations.join(", ")||"위치 정보 없음",trades:work.trades||[],total:work.workforceRegistered?work.total:null,workforceRegistered:work.workforceRegistered,companies:work.companyBreakdownAvailable?companies:[],companyBreakdownAvailable:work.companyBreakdownAvailable,isFallbackWorkItem:work.isFallbackWorkItem,sourceItemRefs:normalizeSourceItemRefs(work.sourceItems).refs};
 });
}

export async function constructionProvider({env,ctx,scope}){
 const dailyAccess=ctx.boardAccess?.CONSTRUCTION_DAILY_REPORT?.accessLevel,outputAccess=ctx.boardAccess?.CONSTRUCTION_OUTPUT_STATUS?.accessLevel;
 if(!dailyAccess&&!outputAccess)return {code:"construction",label:"오늘 공사일보",implementationStatus:"NO_PERMISSION",state:"NO_PERMISSION",message:"공사일보 열람 권한이 없습니다."};
 const date=kstWorkDate(),tomorrow=addDate(date,1),dayAfterTomorrow=addDate(date,2),plans=dailyAccess?await listMonthlyPlansForRange(env,scope.siteId,date,dayAfterTomorrow):[];
 const activePlans=plans.filter(plan=>plan.status!=="CANCELLED"),report=dailyAccess?await env.DB.prepare("SELECT id,revision,parse_status,status,today_workforce_total,employee_workforce,trade_workforce_total,workforce_warnings_json,content_snapshot_json FROM construction_daily_report_uploads WHERE site_id=?1 AND work_date_kst=?2 AND parse_status='CONFIRMED' AND status='ACTIVE' ORDER BY revision DESC LIMIT 1").bind(scope.siteId,date).first():null;
 let workRows=report?.parse_status==="CONFIRMED"&&report.status==="ACTIVE"?await env.DB.prepare(`SELECT i.work_description,i.workforce_count,i.company_name_snapshot,i.trade_name_snapshot,i.location_text,i.is_fallback_work_item,c.name company_name
  FROM construction_daily_report_imported_items i LEFT JOIN companies c ON c.id=i.company_id
  WHERE i.upload_id=?1 AND i.section_type='TODAY_PLAN' ORDER BY i.sort_order`).bind(report.id).all():{results:[]};
 let derived=null;
 if(report&&report.today_workforce_total===null&&report.content_snapshot_json){
  try{
   const snapshot=JSON.parse(report.content_snapshot_json);derived=reconcileWorkforceTrades(snapshot.trades||[],snapshot.plannedWorkItems||[]);
   workRows={results:derived.plannedWorkItems.map(item=>({work_description:item.description,workforce_count:item.plannedWorkforce,company_name_snapshot:null,trade_name_snapshot:item.trade,location_text:null,is_fallback_work_item:item.isFallbackWorkItem?1:0,company_name:null}))};
  }catch{}
 }
 const majorWorks=aggregateMajorWorks(workRows.results);
 const reportStatus=report?.parse_status==="CONFIRMED"&&report.status==="ACTIVE"?"FINALIZED":report?.parse_status||null;
 let workforceWarnings=[];try{workforceWarnings=derived?.workforceWarnings||JSON.parse(report?.workforce_warnings_json||"[]")}catch{}
 const finalized=reportStatus==="FINALIZED",plansFor=target=>activePlans.filter(plan=>plan.startDate<=target&&plan.endDate>=target).map(plan=>planEntry(plan,target));
 const reportEntries=majorWorks.map(work=>({id:work.id,date,source:"CONFIRMED_DAILY_REPORT",trade:(work.trades||[]).join(", "),company:null,location:work.location,description:work.name,plannedWorkforce:work.total,startTime:null,endTime:null,caution:null,status:"CONFIRMED"}));
 const plannedToday=plansFor(date),todayEntries=finalized?reportEntries:plannedToday;
 const schedule={
  today:{date,source:finalized?"CONFIRMED_DAILY_REPORT":"MONTHLY_PLAN",entries:todayEntries,notice:finalized?(plannedToday.length?`확정 공사일보 기준 · 월간계획 ${plannedToday.length}건은 중복 표시하지 않습니다.`:"확정 공사일보 기준"):"오늘 공사일보가 아직 확정되지 않아 월간계획을 표시합니다."},
  tomorrow:{date:tomorrow,source:"MONTHLY_PLAN",entries:plansFor(tomorrow),notice:"월간계획 기준"},
  dayAfterTomorrow:{date:dayAfterTomorrow,source:"MONTHLY_PLAN",entries:plansFor(dayAfterTomorrow),notice:"월간계획 기준"}
 };
 return {code:"construction",label:"공사 일정",implementationStatus:"IMPLEMENTED",state:reportStatus||"NOT_CREATED",message:reportStatus==="FINALIZED"?"공사일보 엑셀 확정":reportStatus==="ANALYZED"?"공사일보 확인 대기":reportStatus==="FAILED"?"공사일보 양식 분석 실패":reportStatus==="ANALYZING"?"공사일보 분석 중":"공사일보 미작성",href:dailyAccess?"/construction":"/construction/output-status",reportStatus,majorWorks,todayWorkforceTotal:derived?.todayWorkforceTotal??report?.today_workforce_total??majorWorks.reduce((sum,work)=>sum+Number(work.total||0),0),employeeWorkforce:derived?.employeeWorkforce??report?.employee_workforce??0,tradeWorkforceTotal:derived?.tradeWorkforceTotal??report?.trade_workforce_total??0,workforceWarnings,schedule,missingCompanies:0,differenceCompanies:0};
}

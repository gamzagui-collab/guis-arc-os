import {ApiError,json,parseJson,requestId} from "../../core/response.js";

const DATE_PATTERN=/^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
const STATUS_VALUES=new Set(["SCHEDULED","CHANGED","CANCELLED"]);
const text=(value,max,required=false,label="입력값")=>{
 const result=String(value??"").trim();
 if(required&&!result)throw new ApiError(400,"CONSTRUCTION_MONTHLY_PLAN_REQUIRED",`${label}을(를) 입력해 주세요.`);
 if(result.length>max)throw new ApiError(400,"CONSTRUCTION_MONTHLY_PLAN_TEXT_TOO_LONG",`${label}은(는) ${max}자 이하로 입력해 주세요.`);
 return result;
};
const dateOnly=(value,label)=>{
 const result=String(value??"").trim();
 const match=result.match(DATE_PATTERN),year=Number(result.slice(0,4)),month=Number(result.slice(5,7)),day=Number(result.slice(8,10));
 const parsed=match?new Date(Date.UTC(year,month-1,day)):null;
 if(!match||parsed.getUTCFullYear()!==year||parsed.getUTCMonth()!==month-1||parsed.getUTCDate()!==day)throw new ApiError(400,"CONSTRUCTION_MONTHLY_PLAN_DATE_INVALID",`${label}을(를) 확인해 주세요.`);
 return result;
};
const timeOnly=(value,label)=>{
 const result=String(value??"").trim();
 if(result&&!TIME_PATTERN.test(result))throw new ApiError(400,"CONSTRUCTION_MONTHLY_PLAN_TIME_INVALID",`${label}은(는) 24시간 형식으로 입력해 주세요.`);
 return result||null;
};
const auditStatement=(env,actor,action,id,meta)=>env.DB.prepare("INSERT INTO audit_logs(id,actor_user_id,action,outcome,request_id,metadata_json) VALUES(?1,?2,?3,'ALLOWED',?4,?5)").bind(crypto.randomUUID(),actor,action,id,JSON.stringify(meta));
const stale=()=>new ApiError(409,"CONSTRUCTION_MONTHLY_PLAN_STALE","다른 사용자가 먼저 일정을 변경했습니다. 최신 내용을 확인한 후 다시 시도해 주세요.");
const mutationTimestamp=()=>new Date().toISOString().replace("Z",`${BigInt(`0x${crypto.randomUUID().replaceAll("-","")}`).toString().padStart(39,"0")}Z`);
const revisionNumber=value=>{
 const revision=Number(value);
 if(!Number.isInteger(revision)||revision<1)throw stale();
 return revision;
};
const conditionalAuditStatement=(env,{actor,action,id,before,cancellationReason=null,expectedRevision,processedAt})=>env.DB.prepare(`INSERT INTO audit_logs(id,actor_user_id,action,outcome,request_id,metadata_json)
 SELECT ?1,?2,?3,'ALLOWED',?4,json_object(
  'siteId',site_id,'planId',id,'actorUserId',?2,'before',json(?5),
  'after',json_object('id',id,'siteId',site_id,'startDate',start_date,'endDate',end_date,'tradeKey',trade_key,'tradeLabel',trade_label,
   'contractorCompanyId',contractor_company_id,'contractorCompanyName',contractor_company_name_snapshot,'locationText',location_text,
   'workDescription',work_description,'plannedWorkforce',planned_workforce,'startTime',start_time,'endTime',end_time,
   'cautionText',caution_text,'note',note,'cancellationReason',cancellation_reason,'status',status,'revision',revision,'createdAt',created_at,'updatedAt',updated_at),
  'beforeRevision',?6,'afterRevision',revision,'processedAt',updated_at,'cancellationReason',?7)
 FROM construction_monthly_plans WHERE id=?8 AND site_id=?9 AND revision=?10 AND updated_at=?11`)
 .bind(crypto.randomUUID(),actor,action,id,JSON.stringify(before),Number(before.revision),cancellationReason,before.id,before.siteId,expectedRevision,processedAt);
export async function executeRevisionMutation(env,update,audit){
 const results=await env.DB.batch([update,audit]);
 if(Number(results?.[0]?.meta?.changes)!==1||Number(results?.[1]?.meta?.changes)!==1)throw stale();
}
const payloadHash=async value=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(value))))].map(byte=>byte.toString(16).padStart(2,"0")).join("");

export function validateMonthlyPlan(body={}){
 const startDate=dateOnly(body.startDate,"시작일"),endDate=dateOnly(body.endDate||body.startDate,"종료일");
 if(endDate<startDate)throw new ApiError(400,"CONSTRUCTION_MONTHLY_PLAN_RANGE_INVALID","종료일은 시작일보다 빠를 수 없습니다.");
 const plannedWorkforce=body.plannedWorkforce===""||body.plannedWorkforce===null||body.plannedWorkforce===undefined?null:Number(body.plannedWorkforce);
 if(plannedWorkforce!==null&&(!Number.isInteger(plannedWorkforce)||plannedWorkforce<0))throw new ApiError(400,"CONSTRUCTION_MONTHLY_PLAN_WORKFORCE_INVALID","예정 인원은 0 이상의 정수로 입력해 주세요.");
 const status=String(body.status||"SCHEDULED").toUpperCase();
 if(!STATUS_VALUES.has(status))throw new ApiError(400,"CONSTRUCTION_MONTHLY_PLAN_STATUS_INVALID","일정 상태를 확인해 주세요.");
 return {
  startDate,endDate,
  tradeKey:text(body.tradeKey,80,true,"공종"),
  tradeLabel:text(body.tradeLabel,120),
  contractorCompanyId:text(body.contractorCompanyId,80)||null,
  locationText:text(body.locationText,200),
  workDescription:text(body.workDescription,2000,true,"작업내용"),
  plannedWorkforce,
  startTime:timeOnly(body.startTime,"시작 시간"),
  endTime:timeOnly(body.endTime,"종료 시간"),
  cautionText:text(body.cautionText,1000),
  note:text(body.note,1000),
  status
 };
}

const mapPlan=row=>({
 id:row.id,siteId:row.site_id,startDate:row.start_date,endDate:row.end_date,
 tradeKey:row.trade_key,tradeLabel:row.trade_label,
 contractorCompanyId:row.contractor_company_id,
 contractorCompanyName:row.contractor_company_name_snapshot,
 locationText:row.location_text,workDescription:row.work_description,
 plannedWorkforce:row.planned_workforce===null?null:Number(row.planned_workforce),
 startTime:row.start_time,endTime:row.end_time,cautionText:row.caution_text,
 note:row.note,cancellationReason:row.cancellation_reason??null,status:row.status,revision:Number(row.revision),
 createdAt:row.created_at,updatedAt:row.updated_at
});

export async function listMonthlyPlansForRange(env,siteId,from,to,{search="",trade="",company="",status=""}={}){
 const rows=await env.DB.prepare(`SELECT * FROM construction_monthly_plans
  WHERE site_id=?1 AND start_date<=?3 AND end_date>=?2
   AND (?4='' OR trade_key=?4 OR trade_label=?4)
   AND (?5='' OR contractor_company_id=?5)
   AND (?6='' OR status=?6)
   AND (?7='' OR work_description LIKE '%'||?7||'%' OR location_text LIKE '%'||?7||'%')
  ORDER BY start_date,start_time,created_at`).bind(siteId,from,to,trade,company,status,search).all();
 return rows.results.map(mapPlan);
}

async function companySnapshot(env,siteId,companyId){
 if(!companyId)return null;
 const company=await env.DB.prepare(`SELECT c.name FROM company_site_contracts sc
  JOIN companies c ON c.id=sc.company_id
  WHERE sc.site_id=?1 AND sc.company_id=?2 AND sc.status='ACTIVE' AND c.status='ACTIVE'`).bind(siteId,companyId).first();
 if(!company)throw new ApiError(400,"CONSTRUCTION_MONTHLY_PLAN_COMPANY_INVALID","현재 현장 참여 회사를 선택해 주세요.");
 return company.name;
}

async function officialTradeSnapshot(env,siteId,tradeKey,requestedLabel,companyId){
 const trade=await env.DB.prepare(`SELECT DISTINCT tm.trade_key,tm.display_name
  FROM trade_master tm
  JOIN company_site_contract_trades ct ON ct.trade_id=tm.id AND ct.status='ACTIVE'
  JOIN company_site_contracts sc ON sc.id=ct.site_contract_id AND sc.status='ACTIVE'
  WHERE sc.site_id=?1 AND tm.trade_key=?2 AND tm.status='ACTIVE' AND tm.is_selectable=1
   AND (?3 IS NULL OR sc.company_id=?3)`).bind(siteId,tradeKey,companyId).first();
 if(!trade)throw new ApiError(400,"CONSTRUCTION_MONTHLY_PLAN_TRADE_INVALID","현재 현장에서 사용할 수 있는 공종을 다시 선택해 주세요.");
 if(requestedLabel&&requestedLabel!==trade.display_name)throw new ApiError(400,"CONSTRUCTION_MONTHLY_PLAN_TRADE_MISMATCH","선택한 공종 정보가 일치하지 않습니다. 공종을 다시 선택해 주세요.");
 return {tradeKey:trade.trade_key,tradeLabel:trade.display_name};
}

async function planRow(env,id,siteId){
 return env.DB.prepare("SELECT * FROM construction_monthly_plans WHERE id=?1 AND site_id=?2").bind(id,siteId).first();
}

export async function createPlan(request,env,auth){
 const body=await parseJson(request),input=validateMonthlyPlan(body),trade=await officialTradeSnapshot(env,auth.siteId,input.tradeKey,input.tradeLabel,input.contractorCompanyId),value={...input,...trade},clientRequestId=text(request.headers.get("idempotency-key"),120,true,"중복 제출 방지 값");
 const hash=await payloadHash(value);
 const replay=await env.DB.prepare("SELECT * FROM construction_monthly_plans WHERE site_id=?1 AND created_by_user_id=?2 AND client_request_id=?3").bind(auth.siteId,auth.userId,clientRequestId).first();
 if(replay){if(replay.client_payload_hash!==hash)throw new ApiError(409,"IDEMPOTENCY_PAYLOAD_MISMATCH","같은 요청 키로 다른 내용을 처리할 수 없습니다.");return json({plan:mapPlan(replay),idempotent:true})}
 const companyName=await companySnapshot(env,auth.siteId,value.contractorCompanyId),id=crypto.randomUUID();
 await env.DB.batch([
  env.DB.prepare(`INSERT INTO construction_monthly_plans
   (id,site_id,start_date,end_date,trade_key,trade_label,contractor_company_id,contractor_company_name_snapshot,location_text,work_description,planned_workforce,start_time,end_time,caution_text,note,status,client_request_id,client_payload_hash,created_by_user_id,updated_by_user_id)
   VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?19)`)
   .bind(id,auth.siteId,value.startDate,value.endDate,value.tradeKey,value.tradeLabel,value.contractorCompanyId,companyName,value.locationText||null,value.workDescription,value.plannedWorkforce,value.startTime,value.endTime,value.cautionText||null,value.note||null,value.status,clientRequestId,hash,auth.userId),
  auditStatement(env,auth.userId,"CONSTRUCTION_MONTHLY_PLAN_CREATED",requestId(request),{siteId:auth.siteId,planId:id,after:value})
 ]);
 return json({plan:mapPlan(await planRow(env,id,auth.siteId))},201);
}

export async function updatePlan(request,env,auth,id){
 const before=await planRow(env,id,auth.siteId);
 if(!before)throw new ApiError(404,"CONSTRUCTION_MONTHLY_PLAN_NOT_FOUND","월간 공사계획을 찾을 수 없습니다.");
 const body=await parseJson(request);
 const revision=revisionNumber(body.revision);
 if(revision!==Number(before.revision))throw stale();
 if(before.status==="CANCELLED")throw new ApiError(409,"CONSTRUCTION_MONTHLY_PLAN_CANCELLED","취소된 일정은 수정할 수 없습니다.");
 const merged={...mapPlan(before),...body};
 if(Object.hasOwn(body,"tradeKey")&&!Object.hasOwn(body,"tradeLabel"))merged.tradeLabel="";
 const input=validateMonthlyPlan(merged),trade=await officialTradeSnapshot(env,auth.siteId,input.tradeKey,input.tradeLabel,input.contractorCompanyId),value={...input,...trade},companyName=await companySnapshot(env,auth.siteId,value.contractorCompanyId);
 const nextRevision=revision+1,processedAt=mutationTimestamp();
 await executeRevisionMutation(env,
  env.DB.prepare(`UPDATE construction_monthly_plans SET start_date=?3,end_date=?4,trade_key=?5,trade_label=?6,
   contractor_company_id=?7,contractor_company_name_snapshot=?8,location_text=?9,work_description=?10,
   planned_workforce=?11,start_time=?12,end_time=?13,caution_text=?14,note=?15,status=?16,
   revision=revision+1,updated_by_user_id=?17,updated_at=?19
   WHERE id=?1 AND site_id=?2 AND revision=?18 AND status<>'CANCELLED'`)
   .bind(id,auth.siteId,value.startDate,value.endDate,value.tradeKey,value.tradeLabel,value.contractorCompanyId,companyName,value.locationText||null,value.workDescription,value.plannedWorkforce,value.startTime,value.endTime,value.cautionText||null,value.note||null,value.status,auth.userId,revision,processedAt),
  conditionalAuditStatement(env,{actor:auth.userId,action:"CONSTRUCTION_MONTHLY_PLAN_UPDATED",id:requestId(request),before:mapPlan(before),expectedRevision:nextRevision,processedAt})
 );
 return json({plan:mapPlan(await planRow(env,id,auth.siteId))});
}

export async function cancelPlan(request,env,auth,id){
 const before=await planRow(env,id,auth.siteId);
 if(!before)throw new ApiError(404,"CONSTRUCTION_MONTHLY_PLAN_NOT_FOUND","월간 공사계획을 찾을 수 없습니다.");
 if(before.status==="CANCELLED")return json({plan:mapPlan(before),idempotent:true});
 const body=await parseJson(request),revision=revisionNumber(body.revision),cancellationReason=text(body.reason,500,true,"취소 사유");
 if(revision!==Number(before.revision))throw stale();
 const nextRevision=revision+1,processedAt=mutationTimestamp();
 await executeRevisionMutation(env,
  env.DB.prepare(`UPDATE construction_monthly_plans SET status='CANCELLED',cancellation_reason=?3,
   revision=revision+1,updated_by_user_id=?4,cancelled_by_user_id=?4,cancelled_at=?6,updated_at=?6
   WHERE id=?1 AND site_id=?2 AND revision=?5 AND status<>'CANCELLED'`).bind(id,auth.siteId,cancellationReason,auth.userId,revision,processedAt),
  conditionalAuditStatement(env,{actor:auth.userId,action:"CONSTRUCTION_MONTHLY_PLAN_CANCELLED",id:requestId(request),before:mapPlan(before),cancellationReason,expectedRevision:nextRevision,processedAt})
 );
 return json({plan:mapPlan(await planRow(env,id,auth.siteId))});
}

export async function handleMonthlyPlanRequest(request,env,url,{authorize}){
 const path=url.pathname,method=request.method;
 if(method==="GET"&&path==="/api/v1/construction/monthly-plans"){
  const auth=await authorize(request,env),from=dateOnly(url.searchParams.get("from"),"조회 시작일"),to=dateOnly(url.searchParams.get("to"),"조회 종료일");
  if(to<from)throw new ApiError(400,"CONSTRUCTION_MONTHLY_PLAN_RANGE_INVALID","조회 종료일은 시작일보다 빠를 수 없습니다.");
  return json({items:await listMonthlyPlansForRange(env,auth.siteId,from,to,{search:text(url.searchParams.get("search"),100),trade:text(url.searchParams.get("trade"),120),company:text(url.searchParams.get("company"),80),status:text(url.searchParams.get("status"),20)})});
 }
 if(method==="POST"&&path==="/api/v1/construction/monthly-plans"){const auth=await authorize(request,env,{required:"EDIT",write:true});return createPlan(request,env,auth)}
 const match=path.match(/^\/api\/v1\/construction\/monthly-plans\/([^/]+)$/);
 if(!match)return null;
 if(method==="GET"){const auth=await authorize(request,env),row=await planRow(env,match[1],auth.siteId);if(!row)throw new ApiError(404,"CONSTRUCTION_MONTHLY_PLAN_NOT_FOUND","월간 공사계획을 찾을 수 없습니다.");return json({plan:mapPlan(row)})}
 if(method==="PATCH"){const auth=await authorize(request,env,{required:"EDIT",write:true});return updatePlan(request,env,auth,match[1])}
 if(method==="DELETE"){const auth=await authorize(request,env,{required:"EDIT",write:true});return cancelPlan(request,env,auth,match[1])}
 return null;
}

import {ApiError,json,parseJson,requestId} from "../core/response.js";
import {authenticate,context} from "../core/session.js";
import {BOARD_KEYS,requireBoardAccess} from "../core/board-access.js";

const MANAGE_ROLES=new Set(["PLATFORM_OWNER","INTEGRATED_OWNER","SITE_MANAGER","CONSTRUCTION_MANAGER"]);
const clean=(value,max=2000)=>String(value??"").trim().slice(0,max);
const audit=(env,userId,action,request,meta)=>env.DB.prepare("INSERT INTO audit_logs(id,actor_user_id,action,outcome,request_id,metadata_json) VALUES(?1,?2,?3,'ALLOWED',?4,?5)").bind(crypto.randomUUID(),userId,action,requestId(request),JSON.stringify(meta));
const kstDate=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());

async function authorize(request,env,{required="VIEW",write=false}={}){
 const row=await authenticate(request,env,{csrf:write}),ctx=await context(env,row),siteId=ctx.selectedSiteId;
 if(!siteId)throw new ApiError(400,"SITE_CONTEXT_REQUIRED","현장을 선택해 주세요.");
 if(write&&Number(request.headers.get("x-context-version"))!==ctx.contextVersion)throw new ApiError(409,"CONTEXT_VERSION_STALE","현장 정보가 변경되었습니다. 새로고침해 주세요.");
 const membership=await env.DB.prepare("SELECT company_id FROM memberships WHERE user_id=?1 AND site_id=?2 AND status='ACTIVE'").bind(row.user_id,siteId).first();
 if(!membership)throw new ApiError(403,"CONSTRUCTION_INSPECTION_SITE_DENIED","현재 현장의 시공 검측에 접근할 수 없습니다.");
 await requireBoardAccess(env,{userId:row.user_id,siteId,boardKey:BOARD_KEYS.CONSTRUCTION_INSPECTION,required,requestId:requestId(request)});
 const roles=(await env.DB.prepare("SELECT r.code FROM user_site_roles usr JOIN roles r ON r.id=usr.role_id WHERE usr.user_id=?1 AND usr.site_id=?2 AND usr.status='ACTIVE'").bind(row.user_id,siteId).all()).results.map(v=>v.code);
 return {userId:row.user_id,siteId,companyId:membership.company_id,manage:roles.some(v=>MANAGE_ROLES.has(v))};
}
async function inspection(env,id,auth){
 const row=await env.DB.prepare(`SELECT i.*,t.title inspection_type_name,c.name company_name,tr.display_name trade_name,l.display_name location_name,cu.display_name created_by_name
 FROM construction_inspections i JOIN construction_inspection_types t ON t.id=i.inspection_type_id JOIN companies c ON c.id=i.company_id JOIN trade_master tr ON tr.id=i.trade_id
 LEFT JOIN site_locations l ON l.id=i.location_id JOIN users cu ON cu.id=i.created_by_user_id
 WHERE i.id=?1 AND i.site_id=?2`).bind(id,auth.siteId).first();
 if(!row)throw new ApiError(404,"CONSTRUCTION_INSPECTION_NOT_FOUND","시공 검측을 찾을 수 없습니다.");
 if(!auth.manage&&row.company_id!==auth.companyId)throw new ApiError(403,"CONSTRUCTION_INSPECTION_SCOPE_DENIED","소속 회사의 시공 검측만 볼 수 있습니다.");
 const [items,reviews]=await Promise.all([
  env.DB.prepare("SELECT * FROM construction_inspection_items WHERE inspection_id=?1 ORDER BY created_at").bind(id).all(),
  env.DB.prepare("SELECT r.*,u.display_name reviewed_by_name FROM construction_inspection_reviews r JOIN users u ON u.id=r.reviewed_by_user_id WHERE r.inspection_id=?1 ORDER BY r.reviewed_at DESC").bind(id).all()
 ]);
 return {inspection:row,items:items.results,reviews:reviews.results};
}
async function options(env,auth){
 const [types,companies,trades,companyTrades,locations,reports]=await Promise.all([
  env.DB.prepare("SELECT id,type_key,title,description FROM construction_inspection_types WHERE is_active=1 ORDER BY title").all(),
  env.DB.prepare("SELECT c.id,c.name,c.company_type FROM company_site_contracts sc JOIN companies c ON c.id=sc.company_id WHERE sc.site_id=?1 AND sc.status='ACTIVE' AND c.status='ACTIVE' ORDER BY c.name").bind(auth.siteId).all(),
  env.DB.prepare("SELECT DISTINCT t.id,t.display_name FROM company_site_contracts sc JOIN company_site_contract_trades ct ON ct.site_contract_id=sc.id JOIN trade_master t ON t.id=ct.trade_id WHERE sc.site_id=?1 AND sc.status='ACTIVE' AND ct.status='ACTIVE' AND t.status='ACTIVE' ORDER BY t.display_name").bind(auth.siteId).all(),
  env.DB.prepare("SELECT sc.company_id,t.id trade_id,t.display_name FROM company_site_contracts sc JOIN company_site_contract_trades ct ON ct.site_contract_id=sc.id JOIN trade_master t ON t.id=ct.trade_id WHERE sc.site_id=?1 AND sc.status='ACTIVE' AND ct.status='ACTIVE' AND t.status='ACTIVE' ORDER BY t.display_name").bind(auth.siteId).all(),
  env.DB.prepare("SELECT id,display_name FROM site_locations WHERE site_id=?1 AND is_active=1 ORDER BY sort_order,display_name").bind(auth.siteId).all(),
  env.DB.prepare("SELECT i.id,i.work_description,r.work_date_kst,c.name company_name FROM construction_daily_report_items i JOIN construction_daily_reports r ON r.id=i.report_id JOIN companies c ON c.id=i.company_id WHERE r.site_id=?1 ORDER BY r.work_date_kst DESC LIMIT 100").bind(auth.siteId).all()
 ]);
 return {types:types.results,companies:companies.results,trades:trades.results,companyTrades:companyTrades.results,locations:locations.results,dailyReportItems:reports.results,canManage:auth.manage};
}
async function create(request,env,auth){
 const b=await parseJson(request),companyId=clean(b.companyId,80),tradeId=clean(b.tradeId,80),typeId=clean(b.inspectionTypeId,80),title=clean(b.title,200);
 if(!companyId||!tradeId||!typeId||!title)throw new ApiError(400,"CONSTRUCTION_INSPECTION_REQUIRED","회사, 공종, 검측 유형, 제목을 입력해 주세요.");
 if(!auth.manage&&companyId!==auth.companyId)throw new ApiError(403,"CONSTRUCTION_INSPECTION_COMPANY_DENIED","소속 회사의 검측만 요청할 수 있습니다.");
 const valid=await env.DB.prepare(`SELECT t.checklist_template_json,
 EXISTS(SELECT 1 FROM company_site_contracts sc WHERE sc.site_id=?1 AND sc.company_id=?2 AND sc.status='ACTIVE') company_valid,
 EXISTS(SELECT 1 FROM company_site_contracts sc JOIN company_site_contract_trades ct ON ct.site_contract_id=sc.id WHERE sc.site_id=?1 AND sc.company_id=?2 AND ct.trade_id=?3 AND ct.status='ACTIVE') trade_valid
 FROM construction_inspection_types t WHERE t.id=?4 AND t.is_active=1`).bind(auth.siteId,companyId,tradeId,typeId).first();
 if(!valid?.company_valid||!valid?.trade_valid)throw new ApiError(400,"CONSTRUCTION_INSPECTION_SCOPE_INVALID","현재 현장의 회사·계약 공종을 다시 선택해 주세요.");
 const id=crypto.randomUUID(),labels=JSON.parse(valid.checklist_template_json||"[]"),statements=[
  env.DB.prepare(`INSERT INTO construction_inspections(id,site_id,work_date_kst,company_id,trade_id,location_id,construction_daily_report_item_id,inspection_type_id,title,description,drawing_reference,specification_reference,created_by_user_id)
   VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)`).bind(id,auth.siteId,clean(b.workDate||kstDate(),10),companyId,tradeId,clean(b.locationId,80)||null,clean(b.dailyReportItemId,80)||null,typeId,title,clean(b.description),clean(b.drawingReference,500),clean(b.specificationReference,500),auth.userId),
  audit(env,auth.userId,"CONSTRUCTION_INSPECTION_CREATED",request,{inspectionId:id})
 ];
 labels.forEach((label,index)=>statements.push(env.DB.prepare("INSERT INTO construction_inspection_items(id,inspection_id,checklist_item_key,checklist_label) VALUES(?1,?2,?3,?4)").bind(crypto.randomUUID(),id,`ITEM_${index+1}`,label)));
 await env.DB.batch(statements);return json(await inspection(env,id,auth),201);
}
async function save(request,env,auth,id){
 const data=await inspection(env,id,auth),b=await parseJson(request);
 if(Number(b.revision)!==Number(data.inspection.revision))throw new ApiError(409,"CONSTRUCTION_INSPECTION_STALE","검측 정보가 변경되었습니다. 새로고침해 주세요.");
 if(!["DRAFT","REVISION_REQUESTED"].includes(data.inspection.status))throw new ApiError(409,"CONSTRUCTION_INSPECTION_EDIT_LOCKED","작성 중 또는 보완 요청 상태에서만 수정할 수 있습니다.");
 const valid=new Set(data.items.map(v=>v.id)),statements=[];
 for(const item of b.items||[]){if(!valid.has(item.id)||!["APPROPRIATE","INAPPROPRIATE","NOT_APPLICABLE","UNCONFIRMED"].includes(item.result))throw new ApiError(400,"CONSTRUCTION_INSPECTION_ITEM_INVALID","검측 항목 결과를 확인해 주세요.");statements.push(env.DB.prepare("UPDATE construction_inspection_items SET result=?2,note=?3,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?1").bind(item.id,item.result,clean(item.note,500)))}
 statements.push(env.DB.prepare("UPDATE construction_inspections SET description=?2,drawing_reference=?3,specification_reference=?4,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?1").bind(id,clean(b.description),clean(b.drawingReference,500),clean(b.specificationReference,500)),audit(env,auth.userId,"CONSTRUCTION_INSPECTION_SAVED",request,{inspectionId:id}));
 await env.DB.batch(statements);return json(await inspection(env,id,auth));
}
async function transition(request,env,auth,id,action){
 const data=await inspection(env,id,auth),b=await parseJson(request),row=data.inspection;
 if(Number(b.revision)!==Number(row.revision))throw new ApiError(409,"CONSTRUCTION_INSPECTION_STALE","검측 정보가 변경되었습니다. 새로고침해 주세요.");
 const allowed={request:["DRAFT"],resubmit:["REVISION_REQUESTED"],review:["REQUESTED","RESUBMITTED"],approve:["UNDER_REVIEW"],"request-revision":["REQUESTED","UNDER_REVIEW","RESUBMITTED"],cancel:["DRAFT","REQUESTED","REVISION_REQUESTED"]}[action]||[];
 if(!allowed.includes(row.status))throw new ApiError(409,"CONSTRUCTION_INSPECTION_STATE_INVALID","현재 검측 상태에서는 해당 작업을 할 수 없습니다.");
 if(["review","approve","request-revision","cancel"].includes(action)&&!auth.manage)throw new ApiError(403,"CONSTRUCTION_INSPECTION_REVIEW_DENIED","원도급사 현장 관리자만 검토·보완·승인할 수 있습니다.");
 if(["request","resubmit"].includes(action)&&data.items.some(v=>v.result==="UNCONFIRMED"))throw new ApiError(400,"CONSTRUCTION_INSPECTION_INCOMPLETE","모든 검측 항목을 확인해 주세요.");
 if(action==="approve"&&data.items.some(v=>v.result!=="APPROPRIATE"&&v.result!=="NOT_APPLICABLE"))throw new ApiError(409,"CONSTRUCTION_INSPECTION_APPROVAL_BLOCKED","부적합 또는 미확인 항목을 해소한 뒤 승인해 주세요.");
 const note=clean(b.reviewNote,1000);if(["approve","request-revision","cancel"].includes(action)&&!note)throw new ApiError(400,"CONSTRUCTION_INSPECTION_NOTE_REQUIRED","검토 또는 변경 사유를 입력해 주세요.");
 const next={request:"REQUESTED",resubmit:"RESUBMITTED",review:"UNDER_REVIEW",approve:"APPROVED","request-revision":"REVISION_REQUESTED",cancel:"CANCELLED"}[action],statements=[
  env.DB.prepare(`UPDATE construction_inspections SET status=?2,requested_by_user_id=CASE WHEN ?2 IN ('REQUESTED','RESUBMITTED') THEN ?3 ELSE requested_by_user_id END,requested_at=CASE WHEN ?2 IN ('REQUESTED','RESUBMITTED') THEN CURRENT_TIMESTAMP ELSE requested_at END,reviewed_by_user_id=CASE WHEN ?2 IN ('APPROVED','REVISION_REQUESTED') THEN ?3 ELSE reviewed_by_user_id END,reviewed_at=CASE WHEN ?2 IN ('APPROVED','REVISION_REQUESTED') THEN CURRENT_TIMESTAMP ELSE reviewed_at END,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?1`).bind(id,next,auth.userId),
  audit(env,auth.userId,`CONSTRUCTION_INSPECTION_${next}`,request,{inspectionId:id})
 ];
 if(["approve","request-revision"].includes(action))statements.push(env.DB.prepare("INSERT INTO construction_inspection_reviews(id,inspection_id,result,review_note,reviewed_by_user_id,revision) VALUES(?1,?2,?3,?4,?5,?6)").bind(crypto.randomUUID(),id,next,note,auth.userId,row.revision));
 await env.DB.batch(statements);return json(await inspection(env,id,auth));
}

export async function handleConstructionInspectionRequest(request,env,url=new URL(request.url)){
 const path=url.pathname,method=request.method;if(!path.startsWith("/api/v1/construction/inspections"))return null;
 if(path==="/api/v1/construction/inspections/options"&&method==="GET"){const auth=await authorize(request,env);return json(await options(env,auth))}
 if(path==="/api/v1/construction/inspections"&&method==="GET"){const auth=await authorize(request,env),scope=auth.manage?"":" AND i.company_id=?2",args=auth.manage?[auth.siteId]:[auth.siteId,auth.companyId],rows=await env.DB.prepare(`SELECT i.*,t.title inspection_type_name,c.name company_name,tr.display_name trade_name,l.display_name location_name FROM construction_inspections i JOIN construction_inspection_types t ON t.id=i.inspection_type_id JOIN companies c ON c.id=i.company_id JOIN trade_master tr ON tr.id=i.trade_id LEFT JOIN site_locations l ON l.id=i.location_id WHERE i.site_id=?1${scope} ORDER BY i.created_at DESC`).bind(...args).all();return json({items:rows.results,canManage:auth.manage})}
 if(path==="/api/v1/construction/inspections"&&method==="POST"){const auth=await authorize(request,env,{required:"EDIT",write:true});return create(request,env,auth)}
 const match=path.match(/^\/api\/v1\/construction\/inspections\/([^/]+)(?:\/(save|request|resubmit|review|approve|request-revision|cancel))?$/);if(!match)return null;
 const auth=await authorize(request,env,{required:method==="GET"?"VIEW":match[2]&&["review","approve","request-revision","cancel"].includes(match[2])?"MANAGE":"EDIT",write:method!=="GET"});
 if(method==="GET"&&!match[2])return json(await inspection(env,match[1],auth));
 if(method==="PATCH"&&match[2]==="save")return save(request,env,auth,match[1]);
 if(method==="POST"&&match[2])return transition(request,env,auth,match[1],match[2]);
 return null;
}

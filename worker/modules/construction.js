import {ApiError,json,parseJson,requestId} from "../core/response.js";
import {authenticate,context} from "../core/session.js";
import {BOARD_KEYS,requireBoardAccess} from "../core/board-access.js";
import {AwsClient} from "aws4fetch";
import {analyzeUrbanTreeWorkbook,parseUrbanTreeWorkbook,uploadResultFromAnalysis} from "./construction/xlsx-parser.js";
import {canonicalDailyContent,canonicalContentHash,comparableDailyContent,compareDailyConstructionContent,constructionTradeIdentity,isBlankDailyBlock,isExplicitRestDay,normalizeCanonicalSnapshot,normalizeStoredConstructionRevision} from "./construction/daily-content.js";
import {handleMonthlyPlanRequest} from "./construction/monthly-plan.js";
import {constructionProvider} from "./today/providers/construction-provider.js";

const SITE_ROLES=new Set(["PLATFORM_OWNER","INTEGRATED_OWNER","SITE_MANAGER"]);
const EDIT_ROLES=new Set(["PLATFORM_OWNER","INTEGRATED_OWNER","SITE_MANAGER","CONSTRUCTION_MANAGER","GENERAL_CONTRACTOR_FOREMAN"]);
const CONTRACTOR_ROLES=new Set(["CONTRACTOR_MANAGER","CONTRACTOR_SITE_MANAGER","CONTRACTOR_FOREMAN","CONTRACTOR_EMPLOYEE","CONTRACTOR_ASSIGNEE"]);
const kstDate=(date=new Date())=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
const clean=(value,max=2000)=>String(value??"").trim().slice(0,max);
const CONSTRUCTION_XLSX_MIME="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const CONSTRUCTION_XLSX_MAX_BYTES=50*1024*1024;
const CONSTRUCTION_UPLOAD_TTL_SECONDS=15*60;
const D1_MAX_STRING_BYTES=2_000_000;
const utf8Bytes=value=>new TextEncoder().encode(String(value??"")).byteLength;
export function constructionAnalysisStoragePayload(analysis,preview){
 return {analysis,preview:{templateCode:preview.templateCode,blockCount:preview.blockCount,counts:preview.counts,companyBreakdownAvailable:preview.companyBreakdownAvailable,warning:preview.warning}};
}
export function constructionD1WriteDiagnostic({statement,table,operation,sql,bindings}){
 const values=bindings.map(({name,value,json=false})=>{
  const type=value===null?"null":value instanceof ArrayBuffer||ArrayBuffer.isView(value)?"blob":typeof value;
  const bytes=type==="blob"?(value.byteLength??value.buffer?.byteLength??0):type==="string"?utf8Bytes(value):0;
  let topLevelKeys=[],arrayLength=null;
  if(json&&type==="string"){try{const parsed=JSON.parse(value);topLevelKeys=parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?Object.keys(parsed):[];arrayLength=Array.isArray(parsed)?parsed.length:null}catch{}}
  return {name,type,bytes,json,topLevelKeys,arrayLength};
 });
 return {code:"CONSTRUCTION_D1_WRITE_DIAGNOSTIC",statement,table,operation,sqlBytes:utf8Bytes(sql),bindingCount:values.length,bindings:values,totalBindingBytes:values.reduce((sum,value)=>sum+value.bytes,0)};
}
export function constructionConfirmDiagnostic({sessionAnalysisJson,stored,dates,response,auditMetadata,batchStatementCount}){
 const dateValues=dates||[],items=dateValues.flatMap(date=>date.items||[]),snapshots=dateValues.map(date=>utf8Bytes(JSON.stringify(date.contentSnapshot||{}))),tradeMatches=items.map(item=>utf8Bytes(JSON.stringify(item.tradeMatch||null))),warningJson=dateValues.map(date=>utf8Bytes(JSON.stringify(date.workforceWarnings||[]))),audits=(auditMetadata||[]).map(value=>utf8Bytes(JSON.stringify(value))),responseBytes=utf8Bytes(JSON.stringify(response||{})),refreshedStoredBytes=utf8Bytes(JSON.stringify(stored||{}));
 return {
  stage:"CONFIRM_BATCH",sessionAnalysisJsonBytes:utf8Bytes(sessionAnalysisJson),refreshedStoredJsonBytes:refreshedStoredBytes,refreshedStoredPersistence:"SKIPPED",
  dateCount:dateValues.length,itemCount:items.length,batchStatementCount:Number(batchStatementCount||0),
  maxContentSnapshotBytes:Math.max(0,...snapshots),maxTradeMatchBytes:Math.max(0,...tradeMatches),maxWorkforceWarningsBytes:Math.max(0,...warningJson),
  responseJsonBytes:responseBytes,maxAuditMetadataBytes:Math.max(0,...audits),
  maxPersistedJsonBindingBytes:Math.max(responseBytes,0,...snapshots,...tradeMatches,...warningJson,...audits)
 };
}
export function assertConstructionAnalysisPayloadSize(storedJson){
 const payloadBytes=utf8Bytes(storedJson);
 if(payloadBytes>=D1_MAX_STRING_BYTES)throw new ApiError(413,"CONSTRUCTION_ANALYSIS_PAYLOAD_TOO_LARGE","공사일보 분석 데이터의 크기가 처리 한도를 초과했습니다. 관리자에게 문의해 주세요.",{details:{stage:"UPLOAD_SESSION_SAVE",payloadBytes,limitBytes:D1_MAX_STRING_BYTES}});
 return payloadBytes;
}
export async function persistConstructionAnalysis({env,session,auth,id,buffer,digest,verifiedKey,storedJson,diagnostic,counts,requestIdValue,updateSql}){
 await env.FILES.put(verifiedKey,buffer,{httpMetadata:{contentType:CONSTRUCTION_XLSX_MIME},customMetadata:{siteId:auth.siteId,userId:auth.userId,sessionId:id,sha256:digest}});
 try{
  await env.DB.batch([
   env.DB.prepare(updateSql).bind(id,verifiedKey,storedJson),
   auditStatement(env,auth.userId,"CONSTRUCTION_UPLOAD_SESSION_ANALYZED","ALLOWED",requestIdValue,{siteId:auth.siteId,sessionId:id,dateCount:Object.values(counts).reduce((sum,value)=>sum+Number(value||0),0),statusCounts:counts,analysisPayloadBytes:utf8Bytes(storedJson)})
  ]);
 }catch(error){
  await Promise.allSettled([env.FILES.delete(verifiedKey)]);
  console.error("CONSTRUCTION_UPLOAD_COMPLETE_FAILED",JSON.stringify({stage:"UPLOAD_SESSION_SAVE",statement:"upload-session-analysis-update",table:"construction_daily_report_upload_sessions",diagnostic,errorCode:String(error?.message||"").includes("SQLITE_TOOBIG")?"SQLITE_TOOBIG":"D1_WRITE_FAILED"}));
  throw new ApiError(500,"CONSTRUCTION_ANALYSIS_SAVE_FAILED","공사일보 분석 결과를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",{details:{stage:"UPLOAD_SESSION_SAVE"}});
 }
 await Promise.allSettled([env.FILES.delete(session.r2_key)]);
}
const auditStatement=(env,actor,action,outcome,id,meta={})=>env.DB.prepare("INSERT INTO audit_logs(id,actor_user_id,action,outcome,request_id,metadata_json) VALUES(?1,?2,?3,?4,?5,?6)").bind(crypto.randomUUID(),actor||null,action,outcome,id,JSON.stringify(meta));
const audit=(env,actor,action,outcome,id,meta={})=>auditStatement(env,actor,action,outcome,id,meta).run();

async function authorize(request,env,{boardKey=BOARD_KEYS.CONSTRUCTION_DAILY_REPORT,required="VIEW",write=false,allowContractor=false}={}){
 const row=await authenticate(request,env,{csrf:write}),ctx=await context(env,row),siteId=ctx.selectedSiteId;
 if(!siteId)throw new ApiError(400,"SITE_CONTEXT_REQUIRED","현장을 선택해 주세요.");
 if(write&&Number(request.headers.get("x-context-version"))!==ctx.contextVersion)throw new ApiError(409,"CONTEXT_VERSION_STALE","현장 정보가 변경되었습니다. 새로고침 후 다시 시도해 주세요.");
 const membership=await env.DB.prepare("SELECT company_id FROM memberships WHERE user_id=?1 AND site_id=?2 AND status='ACTIVE'").bind(row.user_id,siteId).first();
 if(!membership)throw new ApiError(403,"CONSTRUCTION_SITE_SCOPE_DENIED","현재 현장의 공사일보에 접근할 수 없습니다.");
 const roleRows=await env.DB.prepare("SELECT r.code FROM user_site_roles usr JOIN roles r ON r.id=usr.role_id WHERE usr.user_id=?1 AND usr.site_id=?2 AND usr.status='ACTIVE'").bind(row.user_id,siteId).all(),roles=roleRows.results.map(v=>v.code);
 await requireBoardAccess(env,{userId:row.user_id,siteId,boardKey,required,requestId:requestId(request)});
 if(write&&!allowContractor&&roles.some(v=>CONTRACTOR_ROLES.has(v))&&!roles.some(v=>SITE_ROLES.has(v)))throw new ApiError(403,"CONSTRUCTION_CONTRACTOR_EDIT_DENIED","협력업체 사용자는 공사일보 전체를 수정할 수 없습니다.");
 if(write&&required==="EDIT"&&!roles.some(v=>EDIT_ROLES.has(v)))throw new ApiError(403,"CONSTRUCTION_ROLE_EDIT_DENIED","공사일보를 작성하거나 수정할 역할이 아닙니다.");
 return {row,ctx,siteId,userId:row.user_id,companyId:membership.company_id,roles};
}
async function reportRow(env,id,siteId){
 return env.DB.prepare(`SELECT r.*,s.name site_name,cu.display_name created_by_name,su.display_name submitted_by_name,fu.display_name finalized_by_name
 FROM construction_daily_reports r JOIN sites s ON s.id=r.site_id JOIN users cu ON cu.id=r.created_by_user_id
 LEFT JOIN users su ON su.id=r.submitted_by_user_id LEFT JOIN users fu ON fu.id=r.finalized_by_user_id
 WHERE r.id=?1 AND r.site_id=?2`).bind(id,siteId).first();
}
async function reportChildren(env,id){
 const [items,materials,equipment,media,revisions,requests]=await Promise.all([
  env.DB.prepare(`SELECT i.*,c.name company_name,tm.display_name trade_name,wt.team_name,sl.display_name location_name,
   dor.revision current_source_revision,dor.status source_status,dor.submitted_at source_submitted_at
   FROM construction_daily_report_items i JOIN companies c ON c.id=i.company_id JOIN trade_master tm ON tm.id=i.trade_id
   LEFT JOIN workforce_teams wt ON wt.id=i.team_id LEFT JOIN site_locations sl ON sl.id=i.location_id
   JOIN daily_output_reports dor ON dor.id=i.source_output_report_id
   WHERE i.report_id=?1 ORDER BY i.sort_order,c.name,tm.display_name`).bind(id).all(),
  env.DB.prepare("SELECT m.*,sl.display_name location_name,c.name supplier_company_name FROM construction_daily_report_materials m LEFT JOIN site_locations sl ON sl.id=m.location_id LEFT JOIN companies c ON c.id=m.supplier_company_id WHERE m.report_id=?1 ORDER BY m.sort_order,m.created_at").bind(id).all(),
  env.DB.prepare("SELECT e.*,sl.display_name location_name,c.name company_name FROM construction_daily_report_equipment e LEFT JOIN site_locations sl ON sl.id=e.location_id LEFT JOIN companies c ON c.id=e.company_id WHERE e.report_id=?1 ORDER BY e.sort_order,e.created_at").bind(id).all(),
  env.DB.prepare("SELECT id,location_id,description,original_name,mime_type,sort_order,created_at FROM construction_daily_report_media WHERE report_id=?1 AND status='ACTIVE' ORDER BY sort_order,created_at").bind(id).all(),
  env.DB.prepare("SELECT revision,change_type,change_reason,changed_at FROM construction_daily_report_revisions WHERE report_id=?1 ORDER BY revision DESC").bind(id).all(),
  env.DB.prepare("SELECT rr.*,u.display_name requested_by_name FROM construction_daily_report_revision_requests rr JOIN users u ON u.id=rr.requested_by_user_id WHERE rr.report_id=?1 ORDER BY rr.requested_at DESC").bind(id).all()
 ]);
 return {items:items.results.map(v=>({...v,stale:Number(v.source_output_revision)!==Number(v.current_source_revision)})),materials:materials.results,equipment:equipment.results,media:media.results.map(v=>({...v,thumbnailUrl:`/api/v1/construction/daily-reports/${id}/media/${v.id}/thumbnail`,originalUrl:`/api/v1/construction/daily-reports/${id}/media/${v.id}/original`})),revisions:revisions.results,revisionRequests:requests.results};
}
async function reportPayload(env,id,siteId){const report=await reportRow(env,id,siteId);if(!report)throw new ApiError(404,"CONSTRUCTION_REPORT_NOT_FOUND","공사일보를 찾을 수 없습니다.");return {report,...await reportChildren(env,id)}}
async function outputStatus(env,siteId,workDate){
 const rows=await env.DB.prepare(`SELECT sc.company_id,c.name company_name,c.company_type,
  COUNT(DISTINCT a.id) attendance_count,
  COUNT(DISTINCT CASE WHEN rw.included=1 THEN rw.attendance_id END) output_count,
  COUNT(DISTINCT dor.id) report_count,
  MAX(dor.submitted_at) submitted_at,
  CASE
   WHEN COUNT(DISTINCT dor.id)=0 THEN 'MISSING'
   WHEN SUM(CASE WHEN dor.status='REVISION_REQUESTED' THEN 1 ELSE 0 END)>0 THEN 'REVISION_REQUESTED'
   WHEN SUM(CASE WHEN dor.status='DRAFT' THEN 1 ELSE 0 END)>0 THEN 'DRAFT'
   ELSE 'SUBMITTED' END output_status
 FROM company_site_contracts sc JOIN companies c ON c.id=sc.company_id AND c.status='ACTIVE'
 LEFT JOIN workforce_attendance a ON a.site_id=sc.site_id AND a.company_id=sc.company_id AND a.work_date=?2 AND a.cancelled_at IS NULL
 LEFT JOIN daily_output_reports dor ON dor.site_id=sc.site_id AND dor.company_id=sc.company_id AND dor.work_date_kst=?2
 LEFT JOIN daily_output_report_workers rw ON rw.report_id=dor.id
 WHERE sc.site_id=?1 AND sc.status='ACTIVE'
 GROUP BY sc.company_id,c.name,c.company_type ORDER BY c.company_type,c.name`).bind(siteId,workDate).all();
 const items=rows.results.map(v=>({...v,attendance_count:Number(v.attendance_count||0),output_count:Number(v.output_count||0),report_count:Number(v.report_count||0),difference:Number(v.attendance_count||0)-Number(v.output_count||0)}));
 return {workDate,summary:{total:items.length,submitted:items.filter(v=>v.output_status==="SUBMITTED").length,draft:items.filter(v=>v.output_status==="DRAFT").length,missing:items.filter(v=>v.output_status==="MISSING").length,revisionRequested:items.filter(v=>v.output_status==="REVISION_REQUESTED").length,differences:items.filter(v=>v.difference!==0).length},items};
}
async function importStatements(env,reportId,siteId,workDate){
 const outputs=await env.DB.prepare(`SELECT r.id,r.company_id,r.trade_id,r.team_id,r.revision,r.work_description,r.note,
  COALESCE(r.room_location_id,r.unit_location_id,r.building_location_id) location_id,
  (SELECT COUNT(*) FROM daily_output_report_workers rw WHERE rw.report_id=r.id AND rw.included=1) workforce_count
  FROM daily_output_reports r WHERE r.site_id=?1 AND r.work_date_kst=?2
  ORDER BY r.company_id,r.trade_id,r.team_scope`).bind(siteId,workDate).all();
 return outputs.results.map((v,index)=>env.DB.prepare(`INSERT INTO construction_daily_report_items
  (id,report_id,company_id,trade_id,location_id,team_id,workforce_count,source_output_report_id,source_output_revision,work_description,manager_summary,notes,sort_order)
  VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?10,?11,?12)`).bind(crypto.randomUUID(),reportId,v.company_id,v.trade_id,v.location_id,v.team_id,Number(v.workforce_count||0),v.id,Number(v.revision),clean(v.work_description),clean(v.note),index));
}
async function createReport(request,env,auth){
 const body=await parseJson(request),workDate=clean(body.workDate||kstDate(),10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(workDate))throw new ApiError(400,"CONSTRUCTION_DATE_INVALID","공사일보 날짜를 확인해 주세요.");
 const existing=await env.DB.prepare("SELECT id FROM construction_daily_reports WHERE site_id=?1 AND work_date_kst=?2").bind(auth.siteId,workDate).first();
 if(existing)return json(await reportPayload(env,existing.id,auth.siteId),200);
 const previous=await env.DB.prepare("SELECT tomorrow_plan FROM construction_daily_reports WHERE site_id=?1 AND work_date_kst<?2 AND status<>'CANCELLED' ORDER BY work_date_kst DESC LIMIT 1").bind(auth.siteId,workDate).first();
 const id=crypto.randomUUID(),statements=[env.DB.prepare("INSERT INTO construction_daily_reports(id,site_id,work_date_kst,created_by_user_id,yesterday_summary) VALUES(?1,?2,?3,?4,?5)").bind(id,auth.siteId,workDate,auth.userId,clean(previous?.tomorrow_plan)),...(await importStatements(env,id,auth.siteId,workDate)),auditStatement(env,auth.userId,"CONSTRUCTION_DAILY_REPORT_CREATED","ALLOWED",requestId(request),{reportId:id,siteId:auth.siteId,workDate,previousPlanImported:Boolean(clean(previous?.tomorrow_plan))})];
 await env.DB.batch(statements);return json(await reportPayload(env,id,auth.siteId),201);
}
const snapshot=(report,children)=>JSON.stringify({report:{...report},items:children.items.map(v=>({companyId:v.company_id,tradeId:v.trade_id,locationId:v.location_id,teamId:v.team_id,workforceCount:v.workforce_count,sourceOutputReportId:v.source_output_report_id,sourceRevision:v.source_output_revision,workDescription:v.work_description,managerSummary:v.manager_summary,notes:v.notes})),materials:children.materials,equipment:children.equipment,media:children.media.map(v=>({id:v.id,locationId:v.location_id,description:v.description,sortOrder:v.sort_order}))});
function assertEditable(report){if(report.status==="FINALIZED")throw new ApiError(409,"CONSTRUCTION_FINALIZED_LOCKED","확정된 공사일보는 일반 수정할 수 없습니다.");if(report.status==="CANCELLED")throw new ApiError(409,"CONSTRUCTION_CANCELLED_LOCKED","취소된 공사일보는 수정할 수 없습니다.")}
async function validateScopeRefs(env,siteId,{locationId,companyId}){
 if(locationId){const row=await env.DB.prepare("SELECT 1 FROM site_locations WHERE id=?1 AND site_id=?2").bind(locationId,siteId).first();if(!row)throw new ApiError(400,"CONSTRUCTION_LOCATION_INVALID","선택한 작업 위치를 다시 확인해 주세요.")}
 if(companyId){const row=await env.DB.prepare("SELECT 1 FROM company_site_contracts WHERE company_id=?1 AND site_id=?2 AND status='ACTIVE'").bind(companyId,siteId).first();if(!row)throw new ApiError(400,"CONSTRUCTION_COMPANY_INVALID","선택한 회사는 현재 현장 참여 회사가 아닙니다.")}
}
async function saveReport(request,env,auth,id){
 const before=await reportRow(env,id,auth.siteId);if(!before)throw new ApiError(404,"CONSTRUCTION_REPORT_NOT_FOUND","공사일보를 찾을 수 없습니다.");assertEditable(before);
 const body=await parseJson(request),revision=Number(body.revision);if(revision!==Number(before.revision))throw new ApiError(409,"CONSTRUCTION_STALE_REVISION","다른 사용자가 먼저 공사일보를 변경했습니다. 최신 내용을 확인해 주세요.");
 const children=await reportChildren(env,id),currentById=new Map(children.items.map(v=>[v.id,v])),statements=[env.DB.prepare("DELETE FROM construction_daily_report_materials WHERE report_id=?1").bind(id),env.DB.prepare("DELETE FROM construction_daily_report_equipment WHERE report_id=?1").bind(id)];
 for(const item of Array.isArray(body.items)?body.items:[]){const current=currentById.get(clean(item.id,80));if(!current)throw new ApiError(400,"CONSTRUCTION_ITEM_INVALID","불러온 작업 항목을 다시 확인해 주세요.");statements.push(env.DB.prepare("UPDATE construction_daily_report_items SET manager_summary=?2,notes=?3,updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND report_id=?4").bind(current.id,clean(item.managerSummary),clean(item.notes),id))}
 for(const material of Array.isArray(body.materials)?body.materials:[]){if(!clean(material.materialName,200))throw new ApiError(400,"CONSTRUCTION_MATERIAL_NAME_REQUIRED","자재명을 입력해 주세요.");if(!(Number(material.quantity)>=0))throw new ApiError(400,"CONSTRUCTION_MATERIAL_QUANTITY_INVALID","자재 수량을 올바르게 입력해 주세요.");if(!clean(material.unit,30))throw new ApiError(400,"CONSTRUCTION_MATERIAL_UNIT_REQUIRED","자재 단위를 입력해 주세요.");await validateScopeRefs(env,auth.siteId,{locationId:clean(material.locationId,80),companyId:clean(material.supplierCompanyId,80)});statements.push(env.DB.prepare(`INSERT INTO construction_daily_report_materials(id,report_id,material_reference_id,material_name,specification,quantity,unit,received,supplier_company_id,location_id,source_type,source_id,notes,sort_order) VALUES(?1,?2,NULL,?3,?4,?5,?6,?7,?8,?9,'CONSTRUCTION_DAILY_REPORT',?2,?10,?11)`).bind(crypto.randomUUID(),id,clean(material.materialName,200),clean(material.specification,200),Number(material.quantity),clean(material.unit,30),material.received?1:0,clean(material.supplierCompanyId,80)||null,clean(material.locationId,80)||null,clean(material.notes),statements.length))}
 for(const equipment of Array.isArray(body.equipment)?body.equipment:[]){if(!clean(equipment.equipmentName,200))throw new ApiError(400,"CONSTRUCTION_EQUIPMENT_NAME_REQUIRED","장비명을 입력해 주세요.");if(!(Number(equipment.quantity)>=0))throw new ApiError(400,"CONSTRUCTION_EQUIPMENT_QUANTITY_INVALID","장비 수량을 올바르게 입력해 주세요.");await validateScopeRefs(env,auth.siteId,{locationId:clean(equipment.locationId,80),companyId:clean(equipment.companyId,80)});statements.push(env.DB.prepare("INSERT INTO construction_daily_report_equipment(id,report_id,equipment_reference_id,equipment_name,specification,quantity,operating_hours,company_id,location_id,notes,sort_order) VALUES(?1,?2,NULL,?3,?4,?5,?6,?7,?8,?9,?10)").bind(crypto.randomUUID(),id,clean(equipment.equipmentName,200),clean(equipment.specification,200),Number(equipment.quantity),equipment.operatingHours===""||equipment.operatingHours==null?null:Number(equipment.operatingHours),clean(equipment.companyId,80)||null,clean(equipment.locationId,80)||null,clean(equipment.notes),statements.length))}
 statements.unshift(env.DB.prepare(`UPDATE construction_daily_reports SET weather_summary=?2,min_temperature=?3,max_temperature=?4,precipitation_note=?5,yesterday_summary=?6,today_summary=?7,tomorrow_plan=?8,special_notes=?9,missing_output_reason=?10,difference_reason=?11,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND revision=?12`).bind(id,clean(body.weatherSummary,500),body.minTemperature===""||body.minTemperature==null?null:Number(body.minTemperature),body.maxTemperature===""||body.maxTemperature==null?null:Number(body.maxTemperature),clean(body.precipitationNote,500),clean(body.yesterdaySummary),clean(body.todaySummary),clean(body.tomorrowPlan),JSON.stringify(body.specialNotes||{}),clean(body.missingOutputReason),clean(body.differenceReason),revision));
 statements.push(env.DB.prepare("INSERT INTO construction_daily_report_revisions(id,report_id,revision,snapshot_json,changed_by_user_id,change_type,change_reason) VALUES(?1,?2,?3,?4,?5,'UPDATE',?6)").bind(crypto.randomUUID(),id,revision,snapshot(before,children),auth.userId,clean(body.changeReason,500)),auditStatement(env,auth.userId,"CONSTRUCTION_DAILY_REPORT_UPDATED","ALLOWED",requestId(request),{reportId:id,siteId:auth.siteId,revision}));
 await env.DB.batch(statements);return json(await reportPayload(env,id,auth.siteId));
}
async function refreshOutputs(request,env,auth,id){
 const report=await reportRow(env,id,auth.siteId);if(!report)throw new ApiError(404,"CONSTRUCTION_REPORT_NOT_FOUND","공사일보를 찾을 수 없습니다.");assertEditable(report);const body=await parseJson(request);if(Number(body.revision)!==Number(report.revision))throw new ApiError(409,"CONSTRUCTION_STALE_REVISION","다른 사용자가 먼저 공사일보를 변경했습니다. 최신 내용을 확인해 주세요.");
 const children=await reportChildren(env,id),stale=children.items.filter(v=>v.stale);if(!stale.length)return json(await reportPayload(env,id,auth.siteId));
 const statements=[];for(const item of stale){const source=await env.DB.prepare("SELECT revision,work_description,note,COALESCE(room_location_id,unit_location_id,building_location_id) location_id,(SELECT COUNT(*) FROM daily_output_report_workers WHERE report_id=daily_output_reports.id AND included=1) workforce_count FROM daily_output_reports WHERE id=?1 AND site_id=?2").bind(item.source_output_report_id,auth.siteId).first();statements.push(env.DB.prepare("UPDATE construction_daily_report_items SET source_output_revision=?2,work_description=?3,location_id=?4,workforce_count=?5,notes=?6,updated_at=CURRENT_TIMESTAMP WHERE id=?1").bind(item.id,source.revision,source.work_description,source.location_id,source.workforce_count,source.note))}
 statements.push(env.DB.prepare("UPDATE construction_daily_reports SET revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND revision=?2").bind(id,report.revision),auditStatement(env,auth.userId,"CONSTRUCTION_OUTPUT_REFRESHED","ALLOWED",requestId(request),{reportId:id,siteId:auth.siteId,sourceReportIds:stale.map(v=>v.source_output_report_id)}));await env.DB.batch(statements);return json(await reportPayload(env,id,auth.siteId));
}
async function transition(request,env,auth,id,type){
 const report=await reportRow(env,id,auth.siteId);if(!report)throw new ApiError(404,"CONSTRUCTION_REPORT_NOT_FOUND","공사일보를 찾을 수 없습니다.");const body=await parseJson(request),revision=Number(body.revision);
 if(revision!==Number(report.revision))throw new ApiError(409,"CONSTRUCTION_STALE_REVISION","다른 사용자가 먼저 공사일보를 변경했습니다. 최신 내용을 확인해 주세요.");
 const children=await reportChildren(env,id),status=await outputStatus(env,auth.siteId,report.work_date_kst),allowed={SUBMIT:["DRAFT"],RESUBMIT:["REVISION_REQUESTED"],FINALIZE:["SUBMITTED","RESUBMITTED"],REOPEN:["FINALIZED"],CANCEL:["DRAFT","SUBMITTED","REVISION_REQUESTED","RESUBMITTED"]}[type]||[];
 if(!allowed.includes(report.status))throw new ApiError(409,"CONSTRUCTION_STATE_INVALID","현재 공사일보 상태에서는 해당 작업을 할 수 없습니다.");
 if(["FINALIZE","REOPEN","CANCEL"].includes(type)&&!auth.roles.some(v=>SITE_ROLES.has(v)))throw new ApiError(403,"CONSTRUCTION_MANAGE_ROLE_DENIED","현장소장 또는 마스터만 해당 상태를 변경할 수 있습니다.");
 if(["SUBMIT","RESUBMIT"].includes(type)){if(!children.items.length||!children.items.some(v=>clean(v.manager_summary||v.work_description)))throw new ApiError(400,"CONSTRUCTION_TODAY_WORK_REQUIRED","금일 작업내용을 하나 이상 입력해 주세요.");if(status.summary.missing&&!clean(report.missing_output_reason))throw new ApiError(400,"CONSTRUCTION_MISSING_OUTPUT_REASON_REQUIRED","출력일보를 제출하지 않은 업체의 사유를 입력해 주세요.");if(status.summary.differences&&!clean(report.difference_reason))throw new ApiError(400,"CONSTRUCTION_DIFFERENCE_REASON_REQUIRED","출역 인원과 출력일보 인원이 다른 업체의 사유를 확인해 주세요.");if(children.items.some(v=>v.stale))throw new ApiError(409,"CONSTRUCTION_OUTPUT_STALE","참조 중인 출력일보가 변경되었습니다. 최신 내용을 확인해 주세요.")}
 const reason=clean(body.reason,1000);if(["REOPEN","CANCEL"].includes(type)&&!reason)throw new ApiError(400,"CONSTRUCTION_CHANGE_REASON_REQUIRED","변경 사유를 입력해 주세요.");
 const next={SUBMIT:"SUBMITTED",RESUBMIT:"RESUBMITTED",FINALIZE:"FINALIZED",REOPEN:"DRAFT",CANCEL:"CANCELLED"}[type],currentSnapshot=snapshot(report,children),workforceSnapshot=JSON.stringify(status.items.map(v=>({companyId:v.company_id,attendanceCount:v.attendance_count}))),outputSnapshot=JSON.stringify(children.items.map(v=>({sourceOutputReportId:v.source_output_report_id,sourceRevision:v.source_output_revision,workforceCount:v.workforce_count}))),statements=[env.DB.prepare(`UPDATE construction_daily_reports SET status=?2,workforce_snapshot_json=CASE WHEN ?2 IN ('SUBMITTED','RESUBMITTED') THEN ?3 ELSE workforce_snapshot_json END,output_snapshot_json=CASE WHEN ?2 IN ('SUBMITTED','RESUBMITTED') THEN ?4 ELSE output_snapshot_json END,submitted_by_user_id=CASE WHEN ?2 IN ('SUBMITTED','RESUBMITTED') THEN ?5 ELSE submitted_by_user_id END,submitted_at=CASE WHEN ?2 IN ('SUBMITTED','RESUBMITTED') THEN CURRENT_TIMESTAMP ELSE submitted_at END,finalized_by_user_id=CASE WHEN ?2='FINALIZED' THEN ?5 ELSE finalized_by_user_id END,finalized_at=CASE WHEN ?2='FINALIZED' THEN CURRENT_TIMESTAMP ELSE finalized_at END,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND revision=?6`).bind(id,next,workforceSnapshot,outputSnapshot,auth.userId,revision),env.DB.prepare("INSERT INTO construction_daily_report_revisions(id,report_id,revision,snapshot_json,changed_by_user_id,change_type,change_reason) VALUES(?1,?2,?3,?4,?5,?6,?7)").bind(crypto.randomUUID(),id,revision,currentSnapshot,auth.userId,type,reason||null),auditStatement(env,auth.userId,`CONSTRUCTION_DAILY_REPORT_${next}`,"ALLOWED",requestId(request),{reportId:id,siteId:auth.siteId,revision})];
 if(type==="RESUBMIT")statements.push(env.DB.prepare("UPDATE construction_daily_report_revision_requests SET status='RESOLVED',resolved_by_user_id=?2,resolved_at=CURRENT_TIMESTAMP WHERE report_id=?1 AND status='OPEN'").bind(id,auth.userId));
 await env.DB.batch(statements);return json(await reportPayload(env,id,auth.siteId));
}
async function requestRevision(request,env,auth,id){
 const report=await reportRow(env,id,auth.siteId);if(!report)throw new ApiError(404,"CONSTRUCTION_REPORT_NOT_FOUND","공사일보를 찾을 수 없습니다.");if(!["SUBMITTED","RESUBMITTED"].includes(report.status))throw new ApiError(409,"CONSTRUCTION_STATE_INVALID","제출 또는 재제출된 공사일보만 수정 요청할 수 있습니다.");
 const body=await parseJson(request),text=clean(body.requestText,1000);if(Number(body.revision)!==Number(report.revision))throw new ApiError(409,"CONSTRUCTION_STALE_REVISION","다른 사용자가 먼저 공사일보를 변경했습니다. 최신 내용을 확인해 주세요.");if(!text)throw new ApiError(400,"CONSTRUCTION_REVISION_REQUEST_REQUIRED","수정 요청 내용을 입력해 주세요.");
 const children=await reportChildren(env,id);await env.DB.batch([env.DB.prepare("UPDATE construction_daily_reports SET status='REVISION_REQUESTED',revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND revision=?2").bind(id,report.revision),env.DB.prepare("INSERT INTO construction_daily_report_revision_requests(id,report_id,requested_revision,request_text,target_section,due_date,requested_by_user_id) VALUES(?1,?2,?3,?4,?5,?6,?7)").bind(crypto.randomUUID(),id,report.revision,text,clean(body.targetSection,100)||null,clean(body.dueDate,10)||null,auth.userId),env.DB.prepare("INSERT INTO construction_daily_report_revisions(id,report_id,revision,snapshot_json,changed_by_user_id,change_type,change_reason) VALUES(?1,?2,?3,?4,?5,'REVISION_REQUEST',?6)").bind(crypto.randomUUID(),id,report.revision,snapshot(report,children),auth.userId,text),auditStatement(env,auth.userId,"CONSTRUCTION_DAILY_REPORT_REVISION_REQUESTED","ALLOWED",requestId(request),{reportId:id,siteId:auth.siteId,targetSection:clean(body.targetSection,100)})]);return json(await reportPayload(env,id,auth.siteId));
}
async function storeMedia(request,env,auth,id){
 const report=await reportRow(env,id,auth.siteId);if(!report)throw new ApiError(404,"CONSTRUCTION_REPORT_NOT_FOUND","공사일보를 찾을 수 없습니다.");assertEditable(report);const form=await request.formData(),photo=form.get("photo"),thumbnail=form.get("thumbnail");
 if(!(photo instanceof File)||!(thumbnail instanceof File)||!String(photo.type).startsWith("image/")||!String(thumbnail.type).startsWith("image/"))throw new ApiError(400,"CONSTRUCTION_PHOTO_REQUIRED","첨부할 현장 사진을 선택해 주세요.");
 const mediaId=crypto.randomUUID(),fileId=crypto.randomUUID(),safeName=String(photo.name||"photo.jpg").replace(/[^a-zA-Z0-9._-]/g,"_"),prefix=`sites/${auth.siteId}/construction/${id}/${mediaId}`,originalKey=`${prefix}/original/${safeName}`,thumbnailKey=`${prefix}/thumbnail/${safeName}`,uploaded=[];
 try{await env.FILES.put(originalKey,photo.stream(),{httpMetadata:{contentType:photo.type},customMetadata:{siteId:auth.siteId,reportId:id,mediaId,variant:"original"}});uploaded.push(originalKey);await env.FILES.put(thumbnailKey,thumbnail.stream(),{httpMetadata:{contentType:thumbnail.type},customMetadata:{siteId:auth.siteId,reportId:id,mediaId,variant:"thumbnail"}});uploaded.push(thumbnailKey);const locationId=clean(form.get("locationId"),80)||null;await validateScopeRefs(env,auth.siteId,{locationId});await env.DB.batch([env.DB.prepare("INSERT INTO files(id,owner_module,owner_record_id,r2_key,content_type,size_bytes) VALUES(?1,'construction',?2,?3,?4,?5)").bind(fileId,id,originalKey,photo.type,photo.size),env.DB.prepare("INSERT INTO construction_daily_report_media(id,report_id,site_id,media_id,source_media_id,location_id,description,original_key,thumbnail_key,original_name,mime_type,original_size,thumbnail_size,uploaded_by_user_id) VALUES(?1,?2,?3,?4,NULL,?5,?6,?7,?8,?9,?10,?11,?12,?13)").bind(mediaId,id,auth.siteId,fileId,locationId,clean(form.get("description"),500),originalKey,thumbnailKey,photo.name||safeName,photo.type,photo.size,thumbnail.size,auth.userId),auditStatement(env,auth.userId,"CONSTRUCTION_DAILY_REPORT_PHOTO_ADDED","ALLOWED",requestId(request),{reportId:id,siteId:auth.siteId,mediaId,locationId})])}catch(error){await Promise.allSettled(uploaded.map(key=>env.FILES.delete(key)));if(error instanceof ApiError)throw error;throw new ApiError(502,"CONSTRUCTION_PHOTO_UPLOAD_FAILED","현장 사진 업로드에 실패했습니다. 다시 시도해 주세요.")}
 return json(await reportPayload(env,id,auth.siteId),201);
}
async function mediaContent(request,env,auth,id,mediaId,variant){
 const row=await env.DB.prepare(`SELECT ${variant==="original"?"original_key":"thumbnail_key"} object_key,mime_type,original_name FROM construction_daily_report_media WHERE id=?1 AND report_id=?2 AND site_id=?3 AND status='ACTIVE'`).bind(mediaId,id,auth.siteId).first();if(!row)throw new ApiError(404,"CONSTRUCTION_MEDIA_NOT_FOUND","공사일보 사진을 찾을 수 없습니다.");const object=await env.FILES.get(row.object_key);if(!object)throw new ApiError(404,"CONSTRUCTION_MEDIA_OBJECT_MISSING","공사일보 사진 파일을 찾을 수 없습니다.");const headers=new Headers({"cache-control":"private, max-age=300","content-security-policy":"default-src 'none'","x-content-type-options":"nosniff"});object.writeHttpMetadata(headers);if(!headers.has("content-type"))headers.set("content-type",row.mime_type);return new Response(object.body,{headers});
}

const safeFileName=name=>String(name||"file").replace(/[^a-zA-Z0-9가-힣._-]/g,"_").slice(0,160);
const verifiedMonthlyKey=(siteId,id,fileName)=>`sites/${siteId}/construction/monthly-originals/${id}/${safeFileName(fileName)}`;
const xlsxSignature=bytes=>bytes?.length>=4&&bytes[0]===0x50&&bytes[1]===0x4b&&[0x03,0x05,0x07].includes(bytes[2])&&[0x04,0x06,0x08].includes(bytes[3]);
const hex=buffer=>[...new Uint8Array(buffer)].map(value=>value.toString(16).padStart(2,"0")).join("");
const sessionExpired=row=>Date.parse(`${row.expires_at.replace(" ","T")}Z`)<=Date.now();
const sessionUploadView=row=>({id:row.id,status:row.status,fileName:row.original_file_name,sizeBytes:Number(row.size_bytes),expiresAt:row.expires_at});
const blockingWarningCodes=new Set(["FORMULA_DATE_UNRESOLVED","REQUIRED_HEADER_MISSING","DATE_UNRESOLVED","INVALID_BLOCK"]);
const previewCounts=dates=>dates.reduce((counts,date)=>{counts[date.comparisonStatus]=(counts[date.comparisonStatus]||0)+1;return counts},{NEW:0,UNCHANGED:0,CHANGED:0,REVIEW_REQUIRED:0,WARNING:0,INVALID:0,FUTURE:0});

async function classifyDailyBlock(env,siteId,block,legacyWorkbookCache){
 const snapshot=canonicalDailyContent(siteId,block),contentHash=await canonicalContentHash(snapshot),today=kstDate();
 const invalid=!block.workDate||["INVALID_BLOCK","DATE_UNRESOLVED","REQUIRED_HEADER_MISSING"].includes(block.status);
 const blockingWarnings=(block.warnings||[]).filter(warning=>blockingWarningCodes.has(warning.code));
 const blank=isBlankDailyBlock(block)&&!isExplicitRestDay(block);
 const latest=block.workDate?await env.DB.prepare(`SELECT id,revision,content_hash,content_snapshot_json,original_file_key,today_workforce_total,employee_workforce,trade_workforce_total FROM construction_daily_report_uploads
  WHERE site_id=?1 AND work_date_kst=?2 AND parse_status='CONFIRMED' AND status='ACTIVE' ORDER BY revision DESC LIMIT 1`).bind(siteId,block.workDate).first():null;
 if(latest&&!latest.content_hash&&latest.original_file_key){
  try{
   let legacyAnalysis=legacyWorkbookCache.get(latest.original_file_key);
   if(!legacyAnalysis){const object=await env.FILES.get(latest.original_file_key);if(object)legacyAnalysis=analyzeUrbanTreeWorkbook(await object.arrayBuffer());legacyWorkbookCache.set(latest.original_file_key,legacyAnalysis)}
   const legacyBlock=legacyAnalysis?.blocks?.find(value=>value.workDate===block.workDate);
   if(legacyBlock){
    const legacySnapshot=canonicalDailyContent(siteId,legacyBlock),legacyHash=await canonicalContentHash(legacySnapshot);
    await env.DB.prepare("UPDATE construction_daily_report_uploads SET content_hash=?2,content_snapshot_json=?3 WHERE id=?1 AND content_hash IS NULL").bind(latest.id,legacyHash,JSON.stringify(legacySnapshot)).run();
    latest.content_hash=legacyHash;latest.content_snapshot_json=JSON.stringify(legacySnapshot);
   }
  }catch{}
 }
 const previousSnapshot=normalizeStoredConstructionRevision(latest);
 const comparablePreviousSnapshot=normalizeCanonicalSnapshot(previousSnapshot);
 const previousComparisonContent=comparableDailyContent(comparablePreviousSnapshot);
 const comparablePreviousHash=previousComparisonContent?await canonicalContentHash(previousComparisonContent):latest?.content_hash||null;
 const comparisonResult=latest?compareDailyConstructionContent(comparablePreviousSnapshot,snapshot):{changed:false,changes:[],unchangedMatches:[],reviewItems:[],comparisonVersion:2};
 let comparisonStatus=invalid?"INVALID":block.workDate>today?"FUTURE":(blockingWarnings.length||blank)?"WARNING":!latest?"NEW":comparisonResult.reviewItems.length?"REVIEW_REQUIRED":comparisonResult.changed?"CHANGED":"UNCHANGED";
 return {
  workDate:block.workDate,status:block.status,comparisonStatus,selectable:comparisonStatus==="NEW"||comparisonStatus==="CHANGED",
  workCount:block.plannedWorkItems.length,tradeCount:block.trades.length,
  totalWorkforce:block.todayWorkforceTotal,employeeWorkforce:block.employeeWorkforce,tradeWorkforceTotal:block.tradeWorkforceTotal,
  sourceTotalWorkforce:block.sourceTotalWorkforce,workforceTotalMatchesSource:block.workforceTotalMatchesSource,workforceWarnings:block.workforceWarnings,
   warningCount:(block.warnings||[]).length,warnings:block.warnings||[],blockingWarningCount:blockingWarnings.length+(blank?1:0),
  warningCodes:[...blockingWarnings.map(warning=>warning.code),...(blank?["EMPTY_DAILY_BLOCK"]:[])],
  existingRevision:Number(latest?.revision||0),nextRevision:Number(latest?.revision||0)+1,
  contentHash,contentSnapshot:snapshot,latestConfirmedContentHash:comparablePreviousHash,latestStoredContentHash:latest?.content_hash||null,
  changes:comparisonStatus==="CHANGED"?comparisonResult.changes:[],reviewItems:comparisonResult.reviewItems,comparisonVersion:comparisonResult.comparisonVersion,
  sourceSheetName:block.sourceSheetName,sourceCellRange:block.sourceCellRange,items:block.plannedWorkItems.map(item=>({...item,...constructionTradeIdentity(item)}))
 };
}

export async function refreshStoredComparison(env,siteId,stored){
 const dates=[],legacyWorkbookCache=new Map();
 for(const block of stored?.analysis?.blocks||[])dates.push(await classifyDailyBlock(env,siteId,block,legacyWorkbookCache));
 return {...stored,preview:{...(stored?.preview||{}),dates,counts:previewCounts(dates)}};
}

export async function constructionOptions(env,siteId,companyId=""){
 const [locations,companies,trades]=await Promise.all([
  env.DB.prepare("SELECT id,display_name,location_type,parent_id FROM site_locations WHERE site_id=?1 AND is_active=1 ORDER BY sort_order,display_name").bind(siteId).all(),
  env.DB.prepare("SELECT c.id,c.name,c.company_type FROM company_site_contracts sc JOIN companies c ON c.id=sc.company_id WHERE sc.site_id=?1 AND sc.status='ACTIVE' AND c.status='ACTIVE' ORDER BY c.company_type,c.name").bind(siteId).all(),
  env.DB.prepare(`SELECT DISTINCT tm.trade_key,tm.display_name,tm.sort_order
   FROM trade_master tm
   JOIN company_site_contract_trades ct ON ct.trade_id=tm.id AND ct.status='ACTIVE'
   JOIN company_site_contracts sc ON sc.id=ct.site_contract_id AND sc.status='ACTIVE'
   JOIN companies c ON c.id=sc.company_id AND c.status='ACTIVE'
   WHERE sc.site_id=?1 AND (?2='' OR sc.company_id=?2)
    AND tm.status='ACTIVE' AND tm.is_selectable=1
   ORDER BY tm.sort_order,tm.display_name`).bind(siteId,companyId).all()
 ]);
 return {locations:locations.results,companies:companies.results,trades:trades.results};
}

async function cleanupExpiredUploadSessions(env,siteId,userId){
 const rows=await env.DB.prepare("SELECT id,r2_key,original_file_name FROM construction_daily_report_upload_sessions WHERE site_id=?1 AND user_id=?2 AND status='CREATED' AND expires_at<=CURRENT_TIMESTAMP LIMIT 20").bind(siteId,userId).all();
 if(rows.results.length)await Promise.allSettled(rows.results.flatMap(row=>[env.FILES.delete(row.r2_key),env.FILES.delete(verifiedMonthlyKey(siteId,row.id,row.original_file_name))]));
 if(rows.results.length)await env.DB.prepare("UPDATE construction_daily_report_upload_sessions SET status='EXPIRED',updated_at=CURRENT_TIMESTAMP WHERE site_id=?1 AND user_id=?2 AND status='CREATED' AND expires_at<=CURRENT_TIMESTAMP").bind(siteId,userId).run();
}

async function createUploadSession(request,env,auth){
 const body=await parseJson(request),fileName=clean(body.fileName,160),mimeType=clean(body.mimeType,160),sizeBytes=Number(body.sizeBytes),sha256Hex=clean(body.sha256,64).toLowerCase();
 if(!/\.xlsx$/i.test(fileName)||mimeType&&mimeType!==CONSTRUCTION_XLSX_MIME)throw new ApiError(400,"CONSTRUCTION_XLSX_TYPE_INVALID","지원하지 않는 파일입니다. .xlsx 파일을 선택해 주세요.");
 if(!Number.isInteger(sizeBytes)||sizeBytes<=0)throw new ApiError(400,"CONSTRUCTION_XLSX_EMPTY","빈 파일은 업로드할 수 없습니다.");
 if(sizeBytes>CONSTRUCTION_XLSX_MAX_BYTES)throw new ApiError(413,"CONSTRUCTION_XLSX_TOO_LARGE","파일 크기가 너무 큽니다. 50MB 이하의 .xlsx 파일을 선택해 주세요.");
 if(!/^[a-f0-9]{64}$/.test(sha256Hex))throw new ApiError(400,"CONSTRUCTION_XLSX_HASH_REQUIRED","파일 확인값을 만들지 못했습니다. 파일을 다시 선택해 주세요.");
 if(!env.R2_ACCOUNT_ID||!env.R2_BUCKET_NAME||!env.R2_ACCESS_KEY_ID||!env.R2_SECRET_ACCESS_KEY)throw new ApiError(503,"CONSTRUCTION_DIRECT_UPLOAD_UNAVAILABLE","공사일보 업로드 설정을 확인하고 있습니다. 잠시 후 다시 시도해 주세요.");
 await cleanupExpiredUploadSessions(env,auth.siteId,auth.userId);
 const id=crypto.randomUUID(),key=`sites/${auth.siteId}/construction/upload-sessions/${auth.userId}/${id}/${safeFileName(fileName)}`;
 const signer=new AwsClient({accessKeyId:env.R2_ACCESS_KEY_ID,secretAccessKey:env.R2_SECRET_ACCESS_KEY,service:"s3",region:"auto"});
 const uploadUrl=new URL(`https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET_NAME}/${key.split("/").map(encodeURIComponent).join("/")}`);
 uploadUrl.searchParams.set("X-Amz-Expires",String(CONSTRUCTION_UPLOAD_TTL_SECONDS));
 const signed=await signer.sign(new Request(uploadUrl,{method:"PUT",headers:{"content-type":CONSTRUCTION_XLSX_MIME}}),{aws:{signQuery:true}});
 await env.DB.batch([
  env.DB.prepare(`INSERT INTO construction_daily_report_upload_sessions(id,site_id,user_id,original_file_name,mime_type,size_bytes,sha256_hex,r2_key,expires_at)
   VALUES(?1,?2,?3,?4,?5,?6,?7,?8,datetime('now','+15 minutes'))`).bind(id,auth.siteId,auth.userId,fileName,CONSTRUCTION_XLSX_MIME,sizeBytes,sha256Hex,key),
  auditStatement(env,auth.userId,"CONSTRUCTION_UPLOAD_SESSION_CREATED","ALLOWED",requestId(request),{siteId:auth.siteId,sessionId:id,sizeBytes})
 ]);
 const row=await env.DB.prepare("SELECT * FROM construction_daily_report_upload_sessions WHERE id=?1").bind(id).first();
 return json({session:sessionUploadView(row),upload:{method:"PUT",url:signed.url,contentType:CONSTRUCTION_XLSX_MIME,maxBytes:CONSTRUCTION_XLSX_MAX_BYTES}},201);
}

async function ownedUploadSession(env,auth,id){
 const row=await env.DB.prepare("SELECT * FROM construction_daily_report_upload_sessions WHERE id=?1 AND site_id=?2 AND user_id=?3").bind(id,auth.siteId,auth.userId).first();
 if(!row)throw new ApiError(404,"CONSTRUCTION_UPLOAD_SESSION_NOT_FOUND","업로드 정보를 찾을 수 없습니다.");
 if(sessionExpired(row)&&row.status==="CREATED"){await Promise.allSettled([env.FILES.delete(row.r2_key),env.FILES.delete(verifiedMonthlyKey(auth.siteId,row.id,row.original_file_name))]);await env.DB.prepare("UPDATE construction_daily_report_upload_sessions SET status='EXPIRED',updated_at=CURRENT_TIMESTAMP WHERE id=?1").bind(id).run();throw new ApiError(410,"CONSTRUCTION_UPLOAD_SESSION_EXPIRED","업로드 시간이 만료되었습니다. 파일을 다시 선택해 주세요.")}
 return row;
}

async function analyzeUploadSession(request,env,auth,id){
 const session=await ownedUploadSession(env,auth,id);
 if(["ANALYZED","CONFIRMED"].includes(session.status)&&session.analysis_json){const stored=await refreshStoredComparison(env,auth.siteId,JSON.parse(session.analysis_json));return json({session:sessionUploadView(session),...stored,idempotent:true})}
 if(session.status!=="CREATED")throw new ApiError(409,"CONSTRUCTION_UPLOAD_SESSION_STATE_INVALID","이 업로드는 다시 분석할 수 없습니다.");
 const head=await env.FILES.head(session.r2_key);
 if(!head)throw new ApiError(400,"CONSTRUCTION_UPLOAD_NOT_COMPLETED","공사일보 파일 업로드가 완료되지 않았습니다.");
 if(Number(head.size)!==Number(session.size_bytes)||head.size>CONSTRUCTION_XLSX_MAX_BYTES){await env.FILES.delete(session.r2_key);await env.DB.prepare("UPDATE construction_daily_report_upload_sessions SET status='FAILED',failure_code='CONSTRUCTION_XLSX_SIZE_MISMATCH',updated_at=CURRENT_TIMESTAMP WHERE id=?1").bind(id).run();throw new ApiError(400,"CONSTRUCTION_XLSX_SIZE_MISMATCH","업로드된 파일 크기가 선택한 파일과 다릅니다. 다시 선택해 주세요.")}
 const object=await env.FILES.get(session.r2_key),buffer=await object.arrayBuffer(),bytes=new Uint8Array(buffer);
 if(!xlsxSignature(bytes)){await env.FILES.delete(session.r2_key);await env.DB.prepare("UPDATE construction_daily_report_upload_sessions SET status='FAILED',failure_code='CONSTRUCTION_XLSX_SIGNATURE_INVALID',updated_at=CURRENT_TIMESTAMP WHERE id=?1").bind(id).run();throw new ApiError(400,"CONSTRUCTION_XLSX_SIGNATURE_INVALID","지원하지 않는 파일입니다. .xlsx 파일을 선택해 주세요.")}
 const digest=hex(await crypto.subtle.digest("SHA-256",buffer));
 if(digest!==session.sha256_hex){await env.FILES.delete(session.r2_key);await env.DB.prepare("UPDATE construction_daily_report_upload_sessions SET status='FAILED',failure_code='CONSTRUCTION_XLSX_HASH_MISMATCH',updated_at=CURRENT_TIMESTAMP WHERE id=?1").bind(id).run();throw new ApiError(400,"CONSTRUCTION_XLSX_HASH_MISMATCH","업로드된 파일 확인값이 일치하지 않습니다. 다시 선택해 주세요.")}
 let analysis;
 try{analysis=analyzeUrbanTreeWorkbook(buffer)}catch(error){await env.FILES.delete(session.r2_key);await env.DB.prepare("UPDATE construction_daily_report_upload_sessions SET status='FAILED',failure_code=?2,updated_at=CURRENT_TIMESTAMP WHERE id=?1").bind(id,error.code||"CONSTRUCTION_XLSX_PARSE_FAILED").run();throw new ApiError(400,error.code||"CONSTRUCTION_XLSX_PARSE_FAILED","공사일보 양식을 인식하지 못했습니다.")}
 const verifiedKey=verifiedMonthlyKey(auth.siteId,id,session.original_file_name);
 const dates=[],legacyWorkbookCache=new Map();
 for(const block of analysis.blocks){
  dates.push(await classifyDailyBlock(env,auth.siteId,block,legacyWorkbookCache));
 }
 const counts=previewCounts(dates),preview={templateCode:analysis.templateCode,blockCount:analysis.blockCount,dates,counts,companyBreakdownAvailable:false,warning:"회사별 인원 정보가 원본 공사일보에 없습니다."};
 const storedJson=JSON.stringify(constructionAnalysisStoragePayload(analysis,preview));
 const updateSql="UPDATE construction_daily_report_upload_sessions SET status='ANALYZED',r2_key=?2,analysis_json=?3,analyzed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND status='CREATED'";
 const diagnostic=constructionD1WriteDiagnostic({statement:"upload-session-analysis-update",table:"construction_daily_report_upload_sessions",operation:"UPDATE",sql:updateSql,bindings:[{name:"session_id",value:id},{name:"r2_key",value:verifiedKey},{name:"analysis_json",value:storedJson,json:true}]});
 if(env.APP_ENV==="integration")console.info("CONSTRUCTION_D1_WRITE_DIAGNOSTIC",JSON.stringify(diagnostic));
 assertConstructionAnalysisPayloadSize(storedJson);
 await persistConstructionAnalysis({env,session,auth,id,buffer,digest,verifiedKey,storedJson,diagnostic,counts,requestIdValue:requestId(request),updateSql});
 return json({session:{...sessionUploadView(session),status:"ANALYZED"},analysis,preview:{...preview,counts:previewCounts(dates),warning:"회사별 인원 정보가 원본 공사일보에 없습니다."}});
}

async function confirmUploadSession(request,env,auth,id){
 const session=await ownedUploadSession(env,auth,id),body=await parseJson(request),dates=[...new Set((Array.isArray(body.dates)?body.dates:[]).map(value=>clean(value,10)))],idempotencyKey=clean(request.headers.get("idempotency-key"),120);
 if(!idempotencyKey)throw new ApiError(400,"IDEMPOTENCY_KEY_REQUIRED","확정 요청 확인값이 필요합니다. 다시 시도해 주세요.");
 if(session.confirmation_key===idempotencyKey&&session.confirmation_result_json)return json({...JSON.parse(session.confirmation_result_json),idempotent:true});
 if(session.status!=="ANALYZED")throw new ApiError(409,"CONSTRUCTION_UPLOAD_SESSION_STATE_INVALID","분석이 완료된 파일만 확정할 수 있습니다.");
 if(!dates.length)throw new ApiError(400,"CONSTRUCTION_UPLOAD_DATES_REQUIRED","저장할 공사일보 날짜를 하나 이상 선택해 주세요.");
 const stored=JSON.parse(session.analysis_json),analysis=stored.analysis,allowed=new Set(analysis.blocks.filter(block=>block.workDate&&!["INVALID_BLOCK","DATE_UNRESOLVED","REQUIRED_HEADER_MISSING"].includes(block.status)).map(block=>block.workDate));
 if(dates.some(date=>!allowed.has(date)))throw new ApiError(400,"CONSTRUCTION_UPLOAD_DATE_INVALID","저장할 수 없는 날짜가 포함되어 있습니다.");
 const results=[],statements=[];
 for(const workDate of dates){
  const parsed=uploadResultFromAnalysis(analysis,workDate),previous=await env.DB.prepare("SELECT COALESCE(MAX(revision),0) revision FROM construction_daily_report_uploads WHERE site_id=?1 AND work_date_kst=?2").bind(auth.siteId,workDate).first(),revision=Number(previous?.revision||0)+1,uploadId=crypto.randomUUID();
  statements.push(
   env.DB.prepare("UPDATE construction_daily_report_uploads SET status='SUPERSEDED' WHERE site_id=?1 AND work_date_kst=?2 AND parse_status='CONFIRMED' AND status='ACTIVE'").bind(auth.siteId,workDate),
   env.DB.prepare(`INSERT INTO construction_daily_report_uploads(id,site_id,work_date_kst,revision,original_file_key,original_file_name,mime_type,size_bytes,workbook_template_code,source_sheet_name,document_site_name,parse_status,uploaded_by_user_id,confirmed_by_user_id,confirmed_at)
    VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,'CONFIRMED',?12,?12,CURRENT_TIMESTAMP)`).bind(uploadId,auth.siteId,workDate,revision,session.r2_key,session.original_file_name,session.mime_type,session.size_bytes,parsed.templateCode,parsed.sourceSheetName,parsed.siteName,auth.userId),
   ...parsed.items.map(item=>env.DB.prepare(`INSERT INTO construction_daily_report_imported_items(id,upload_id,work_date_kst,section_type,company_name_snapshot,company_connection_status,trade_name_snapshot,location_text,work_description,workforce_count,source_sheet_name,source_cell_range,sort_order)
    VALUES(?1,?2,?3,?4,NULL,'NOT_PROVIDED',?5,?6,?7,?8,?9,?10,?11)`).bind(crypto.randomUUID(),uploadId,workDate,item.sectionType,item.tradeNameSnapshot,item.locationText,item.workDescription,item.workforceCount,item.sourceSheetName,item.sourceCellRange,item.sortOrder)),
   auditStatement(env,auth.userId,"CONSTRUCTION_MONTHLY_DATE_CONFIRMED","ALLOWED",requestId(request),{siteId:auth.siteId,sessionId:id,uploadId,workDate,revision})
  );
  results.push({workDate,status:"CONFIRMED",uploadId,revision});
 }
 const response={ok:true,sessionId:id,results};
 statements.push(env.DB.prepare("UPDATE construction_daily_report_upload_sessions SET status='CONFIRMED',confirmation_key=?2,confirmation_result_json=?3,confirmed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND status='ANALYZED'").bind(id,idempotencyKey,JSON.stringify(response)));
 await env.DB.batch(statements);
 return json(response);
}

export async function applyComparedDates(request,env,auth,id){
 const session=await ownedUploadSession(env,auth,id),body=await parseJson(request),actionType=body.action==="CONFIRM_CHANGED"?"CONFIRM_CHANGED":"AUTO_NEW",idempotencyKey=clean(request.headers.get("idempotency-key"),120);
 if(!idempotencyKey)throw new ApiError(400,"IDEMPOTENCY_KEY_REQUIRED","요청 확인값이 필요합니다. 다시 시도해 주세요.");
 if(!["ANALYZED","CONFIRMED"].includes(session.status)||!session.analysis_json)throw new ApiError(409,"CONSTRUCTION_UPLOAD_SESSION_STATE_INVALID","분석이 완료된 파일만 반영할 수 있습니다.");
 const requestedDates=[...new Set((Array.isArray(body.dates)?body.dates:[]).map(value=>clean(value,10)))],requestHash=await canonicalContentHash({actionType,dates:requestedDates});
 const prior=await env.DB.prepare("SELECT request_hash,result_json FROM construction_daily_report_upload_actions WHERE session_id=?1 AND idempotency_key=?2").bind(id,idempotencyKey).first();
 if(prior){if(prior.request_hash!==requestHash)throw new ApiError(409,"IDEMPOTENCY_KEY_REUSED","같은 요청 확인값을 다른 작업에 사용할 수 없습니다.");return json({...JSON.parse(prior.result_json),idempotent:true})}
 const stored=await refreshStoredComparison(env,auth.siteId,JSON.parse(session.analysis_json)),preview=stored.preview,eligible=preview.dates.filter(date=>actionType==="AUTO_NEW"?date.comparisonStatus==="NEW"&&(!requestedDates.length||requestedDates.includes(date.workDate)):date.comparisonStatus==="CHANGED"&&requestedDates.includes(date.workDate));
 if(actionType==="AUTO_NEW"&&requestedDates.length&&eligible.length!==requestedDates.length)throw new ApiError(409,"CONSTRUCTION_UPLOAD_COMPARISON_STALE","비교 결과가 변경되었습니다. 파일을 다시 분석해 주세요.");
 if(actionType==="CONFIRM_CHANGED"&&!requestedDates.length)throw new ApiError(400,"CONSTRUCTION_UPLOAD_DATES_REQUIRED","변경 내용을 반영할 날짜를 선택해 주세요.");
 if(actionType==="CONFIRM_CHANGED"&&eligible.length!==requestedDates.length)throw new ApiError(409,"CONSTRUCTION_UPLOAD_COMPARISON_STALE","비교 결과가 변경되었습니다. 파일을 다시 분석해 주세요.");
 const statements=[],results=[],auditMetadata=[];
 for(const date of eligible){
  const latest=await env.DB.prepare("SELECT revision,content_hash FROM construction_daily_report_uploads WHERE site_id=?1 AND work_date_kst=?2 AND parse_status='CONFIRMED' AND status='ACTIVE' ORDER BY revision DESC LIMIT 1").bind(auth.siteId,date.workDate).first();
  if(actionType==="AUTO_NEW"&&latest)throw new ApiError(409,"CONSTRUCTION_UPLOAD_COMPARISON_STALE","신규 날짜 상태가 변경되었습니다. 파일을 다시 분석해 주세요.");
  if(actionType==="CONFIRM_CHANGED"&&latest?.content_hash!==date.latestStoredContentHash)throw new ApiError(409,"CONSTRUCTION_UPLOAD_COMPARISON_STALE","기존 저장본이 변경되었습니다. 파일을 다시 분석해 주세요.");
  const parsed=uploadResultFromAnalysis(stored.analysis,date.workDate),revision=Number(latest?.revision||0)+1,uploadId=crypto.randomUUID();
  const dateAudit={siteId:auth.siteId,sessionId:id,uploadId,workDate:date.workDate,revision,contentHash:date.contentHash};auditMetadata.push(dateAudit);
  statements.push(
   env.DB.prepare("UPDATE construction_daily_report_uploads SET status='SUPERSEDED' WHERE site_id=?1 AND work_date_kst=?2 AND parse_status='CONFIRMED' AND status='ACTIVE'").bind(auth.siteId,date.workDate),
   env.DB.prepare(`INSERT INTO construction_daily_report_uploads(id,site_id,work_date_kst,revision,original_file_key,original_file_name,mime_type,size_bytes,workbook_template_code,source_sheet_name,document_site_name,parse_status,uploaded_by_user_id,confirmed_by_user_id,confirmed_at,content_hash,content_snapshot_json,today_workforce_total,employee_workforce,trade_workforce_total,source_total_workforce,workforce_total_matches_source,workforce_warnings_json)
    VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,'CONFIRMED',?12,?12,CURRENT_TIMESTAMP,?13,?14,?15,?16,?17,?18,?19,?20)`).bind(uploadId,auth.siteId,date.workDate,revision,session.r2_key,session.original_file_name,session.mime_type,session.size_bytes,parsed.templateCode,parsed.sourceSheetName,parsed.siteName,auth.userId,date.contentHash,JSON.stringify(date.contentSnapshot),parsed.todayWorkforceTotal,parsed.employeeWorkforce,parsed.tradeWorkforceTotal,parsed.sourceTotalWorkforce,parsed.workforceTotalMatchesSource===null?null:parsed.workforceTotalMatchesSource?1:0,JSON.stringify(parsed.workforceWarnings||[])),
   ...parsed.items.map(item=>env.DB.prepare(`INSERT INTO construction_daily_report_imported_items(id,upload_id,work_date_kst,section_type,company_name_snapshot,company_connection_status,trade_name_snapshot,location_text,work_description,workforce_count,source_sheet_name,source_cell_range,sort_order,work_description_source,is_fallback_work_item,trade_match_json)
    VALUES(?1,?2,?3,?4,NULL,'NOT_PROVIDED',?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)`).bind(crypto.randomUUID(),uploadId,date.workDate,item.sectionType,item.tradeNameSnapshot,item.locationText,item.workDescription,item.workforceCount,item.sourceSheetName,item.sourceCellRange,item.sortOrder,item.workDescriptionSource||"ORIGINAL_WORK_PLAN",item.isFallbackWorkItem?1:0,JSON.stringify(item.tradeMatch||null))),
   auditStatement(env,auth.userId,actionType==="AUTO_NEW"?"CONSTRUCTION_MONTHLY_NEW_AUTO_APPLIED":"CONSTRUCTION_MONTHLY_CHANGED_CONFIRMED","ALLOWED",requestId(request),dateAudit)
  );
  results.push({workDate:date.workDate,status:"CONFIRMED",uploadId,revision});
  Object.assign(date,{comparisonStatus:"UNCHANGED",selectable:false,existingRevision:revision,nextRevision:revision+1,latestConfirmedContentHash:date.contentHash,changes:[]});
 }
 preview.counts=previewCounts(preview.dates);
 const response={ok:true,sessionId:id,action:actionType,results,counts:preview.counts};
 const actionAudit={siteId:auth.siteId,sessionId:id,actionType,idempotencyKey,appliedDates:results.map(result=>result.workDate),skippedDates:preview.dates.filter(date=>date.comparisonStatus!=="UNCHANGED").map(date=>({workDate:date.workDate,status:date.comparisonStatus})),statusCounts:preview.counts};auditMetadata.push(actionAudit);
 statements.push(
  env.DB.prepare("UPDATE construction_daily_report_upload_sessions SET status=CASE WHEN ?2>0 THEN 'CONFIRMED' ELSE status END,confirmed_at=CASE WHEN ?2>0 THEN CURRENT_TIMESTAMP ELSE confirmed_at END,updated_at=CURRENT_TIMESTAMP WHERE id=?1").bind(id,results.length),
  env.DB.prepare(`INSERT INTO construction_daily_report_upload_actions(id,session_id,site_id,action_type,idempotency_key,request_hash,result_json,created_by,created_at)
   VALUES(?1,?2,?3,?4,?5,?6,?7,?8,CURRENT_TIMESTAMP)`).bind(crypto.randomUUID(),id,auth.siteId,actionType,idempotencyKey,requestHash,JSON.stringify(response),auth.userId),
  auditStatement(env,auth.userId,"CONSTRUCTION_MONTHLY_COMPARISON_APPLIED","ALLOWED",requestId(request),actionAudit)
 );
 const diagnostic=constructionConfirmDiagnostic({sessionAnalysisJson:session.analysis_json,stored,dates:eligible,response,auditMetadata,batchStatementCount:statements.length});
 if(env.APP_ENV==="integration")console.info("CONSTRUCTION_CONFIRM_DIAGNOSTIC",JSON.stringify({...diagnostic,sessionIdPrefix:String(id).slice(0,8),actionType}));
 try{await env.DB.batch(statements)}
 catch(error){
  console.error("CONSTRUCTION_CONFIRM_FAILED",JSON.stringify({stage:"CONFIRM_BATCH",sessionIdPrefix:String(id).slice(0,8),actionType,dateCount:eligible.length,itemCount:diagnostic.itemCount,batchStatementCount:statements.length,maxPersistedJsonBindingBytes:diagnostic.maxPersistedJsonBindingBytes,errorCode:String(error?.message||"").includes("SQLITE_TOOBIG")?"SQLITE_TOOBIG":"D1_WRITE_FAILED"}));
  throw new ApiError(500,"CONSTRUCTION_CONFIRM_SAVE_FAILED","공사일보 확정 데이터를 저장하지 못했습니다. 선택한 날짜는 확정되지 않았습니다. 잠시 후 다시 시도해 주세요.");
 }
 return json(response);
}
const privateObjectResponse=async(env,key,mime,name)=>{
 const object=await env.FILES.get(key);if(!object)throw new ApiError(404,"CONSTRUCTION_FILE_MISSING","보관된 원본 파일을 찾을 수 없습니다.");
 const headers=new Headers({"cache-control":"private, no-store","content-security-policy":"default-src 'none'","x-content-type-options":"nosniff","content-type":mime,"content-disposition":`attachment; filename*=UTF-8''${encodeURIComponent(name)}`});
 return new Response(object.body,{headers});
};
async function monthlyUploadSessions(env,siteId){
 const rows=await env.DB.prepare(`SELECT s.*,u.display_name uploaded_by_name FROM construction_daily_report_upload_sessions s
  JOIN users u ON u.id=s.user_id WHERE s.site_id=?1 AND s.status IN ('ANALYZED','CONFIRMED')
  ORDER BY s.created_at DESC LIMIT 60`).bind(siteId).all(),months=new Map();
 for(const row of rows.results){
  let stored;try{stored=JSON.parse(row.analysis_json||"{}")}catch{stored={}}
  const dates=stored.preview?.dates||[],month=(dates.find(date=>date.workDate)?.workDate||row.created_at).slice(0,7);
  if(months.has(month))continue;
  months.set(month,{id:row.id,month,fileName:row.original_file_name,sizeBytes:Number(row.size_bytes),uploadedByName:row.uploaded_by_name,createdAt:row.created_at,analyzedAt:row.analyzed_at,counts:stored.preview?.counts||previewCounts(dates),dateCount:dates.length,downloadUrl:`/api/v1/construction/daily-report-upload-sessions/${row.id}/download`});
 }
 return [...months.values()];
}
async function uploadList(env,siteId,workDate=""){
 const rows=await env.DB.prepare(`SELECT u.*,up.display_name uploaded_by_name,cp.display_name confirmed_by_name,
  (SELECT COUNT(*) FROM construction_daily_report_imported_items i WHERE i.upload_id=u.id AND i.section_type='TODAY_PLAN') work_count,
  (SELECT COALESCE(SUM(i.workforce_count),0) FROM construction_daily_report_imported_items i WHERE i.upload_id=u.id AND i.section_type='TODAY_PLAN') total_workforce
  FROM construction_daily_report_uploads u JOIN users up ON up.id=u.uploaded_by_user_id LEFT JOIN users cp ON cp.id=u.confirmed_by_user_id
  WHERE u.site_id=?1 AND (?2='' OR u.work_date_kst=?2) ORDER BY u.work_date_kst DESC,u.revision DESC LIMIT 60`).bind(siteId,workDate).all();
 return rows.results.map(row=>({...row,downloadUrl:`/api/v1/construction/daily-report-uploads/${row.id}/download`}));
}
async function uploadDetail(env,siteId,id){
 const upload=await env.DB.prepare(`SELECT u.*,up.display_name uploaded_by_name,cp.display_name confirmed_by_name FROM construction_daily_report_uploads u JOIN users up ON up.id=u.uploaded_by_user_id LEFT JOIN users cp ON cp.id=u.confirmed_by_user_id WHERE u.id=?1 AND u.site_id=?2`).bind(id,siteId).first();
 if(!upload)throw new ApiError(404,"CONSTRUCTION_UPLOAD_NOT_FOUND","공사일보 업로드를 찾을 수 없습니다.");
 const items=await env.DB.prepare("SELECT * FROM construction_daily_report_imported_items WHERE upload_id=?1 ORDER BY section_type,sort_order").bind(id).all();
 return {upload:{...upload,downloadUrl:`/api/v1/construction/daily-report-uploads/${id}/download`},items:items.results.map(item=>({...item,...constructionTradeIdentity({trade:item.trade_name_snapshot})})),revisions:await uploadList(env,siteId,upload.work_date_kst)};
}
async function analyzeExcel(request,env,auth){
 const form=await request.formData(),file=form.get("file"),workDate=clean(form.get("workDate"),10);
 if(!(file instanceof File))throw new ApiError(400,"CONSTRUCTION_XLSX_REQUIRED","공사일보 엑셀 파일을 선택해 주세요.");
 if(!/\.xlsx$/i.test(file.name)||file.type&&file.type!=="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")throw new ApiError(400,"CONSTRUCTION_XLSX_TYPE_INVALID",".xlsx 형식의 공사일보만 업로드할 수 있습니다. .xls와 CSV는 지원하지 않습니다.");
 if(!file.size)throw new ApiError(400,"CONSTRUCTION_XLSX_EMPTY","빈 파일은 업로드할 수 없습니다.");
 if(file.size>15*1024*1024)throw new ApiError(413,"CONSTRUCTION_XLSX_TOO_LARGE","공사일보 파일은 15MB 이하만 업로드할 수 있습니다.");
 const previous=await env.DB.prepare("SELECT COALESCE(MAX(revision),0) revision FROM construction_daily_report_uploads WHERE site_id=?1 AND work_date_kst=?2").bind(auth.siteId,workDate).first(),revision=Number(previous?.revision||0)+1,id=crypto.randomUUID(),key=`sites/${auth.siteId}/construction/daily-reports/${workDate}/${id}/original/${safeFileName(file.name)}`,buffer=await file.arrayBuffer();
 let parsed;try{parsed=parseUrbanTreeWorkbook(buffer,workDate)}catch(error){await env.FILES.put(key,buffer,{httpMetadata:{contentType:file.type||"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}});await env.DB.batch([env.DB.prepare(`INSERT INTO construction_daily_report_uploads(id,site_id,work_date_kst,revision,original_file_key,original_file_name,mime_type,size_bytes,parse_status,parse_error_code,uploaded_by_user_id) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,'FAILED',?9,?10)`).bind(id,auth.siteId,workDate,revision,key,file.name,file.type||"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",file.size,error.code||"CONSTRUCTION_XLSX_PARSE_FAILED",auth.userId),auditStatement(env,auth.userId,"CONSTRUCTION_DAILY_REPORT_EXCEL_FAILED","DENIED",requestId(request),{siteId:auth.siteId,workDate,uploadId:id,error:error.code})]);throw new ApiError(400,error.code||"CONSTRUCTION_XLSX_PARSE_FAILED",error.message||"공사일보 양식을 인식하지 못했습니다.")}
 try{
  await env.FILES.put(key,buffer,{httpMetadata:{contentType:file.type||"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},customMetadata:{siteId:auth.siteId,workDate,uploadId:id,revision:String(revision)}});
  await env.DB.batch([
   env.DB.prepare(`INSERT INTO construction_daily_report_uploads(id,site_id,work_date_kst,revision,original_file_key,original_file_name,mime_type,size_bytes,workbook_template_code,source_sheet_name,document_site_name,parse_status,uploaded_by_user_id)
    VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,'ANALYZED',?12)`).bind(id,auth.siteId,workDate,revision,key,file.name,file.type||"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",file.size,parsed.templateCode,parsed.sheetName,parsed.siteName,auth.userId),
   ...parsed.items.map(item=>env.DB.prepare(`INSERT INTO construction_daily_report_imported_items(id,upload_id,work_date_kst,section_type,company_name_snapshot,company_connection_status,trade_name_snapshot,location_text,work_description,workforce_count,source_sheet_name,source_cell_range,sort_order)
    VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)`).bind(crypto.randomUUID(),id,workDate,item.sectionType,item.companyNameSnapshot,item.companyConnectionStatus,item.tradeNameSnapshot,item.locationText,item.workDescription,item.workforceCount,item.sourceSheetName,item.sourceCellRange,item.sortOrder)),
   auditStatement(env,auth.userId,"CONSTRUCTION_DAILY_REPORT_EXCEL_ANALYZED","ALLOWED",requestId(request),{siteId:auth.siteId,workDate,uploadId:id,revision,itemCount:parsed.items.length})
  ]);
 }catch(error){await env.FILES.delete(key);throw error}
 return json({upload:{id,workDate,revision,fileName:file.name,sizeBytes:file.size,parseStatus:"ANALYZED",templateCode:parsed.templateCode,documentSiteName:parsed.siteName},items:parsed.items,totalWorkforce:parsed.totalWorkforce,parseStatus:parsed.status,warnings:parsed.warnings,availableDates:parsed.dates,source:{sheetName:parsed.sourceSheetName,row:parsed.sourceRow,range:parsed.sourceCellRange},warning:revision>1?"기존 공사일보가 있어 새 수정본으로 저장됩니다.":null},201);
}
async function confirmExcel(request,env,auth,id){
 const upload=await env.DB.prepare("SELECT * FROM construction_daily_report_uploads WHERE id=?1 AND site_id=?2").bind(id,auth.siteId).first();
 if(!upload)throw new ApiError(404,"CONSTRUCTION_UPLOAD_NOT_FOUND","공사일보 업로드를 찾을 수 없습니다.");
 if(upload.parse_status!=="ANALYZED")throw new ApiError(409,"CONSTRUCTION_UPLOAD_STATE_INVALID","분석 완료된 공사일보만 확정할 수 있습니다.");
 await env.DB.batch([
  env.DB.prepare("UPDATE construction_daily_report_uploads SET status='SUPERSEDED' WHERE site_id=?1 AND work_date_kst=?2 AND parse_status='CONFIRMED' AND status='ACTIVE'").bind(auth.siteId,upload.work_date_kst),
  env.DB.prepare("UPDATE construction_daily_report_uploads SET parse_status='CONFIRMED',confirmed_by_user_id=?2,confirmed_at=CURRENT_TIMESTAMP,status='ACTIVE' WHERE id=?1").bind(id,auth.userId),
  auditStatement(env,auth.userId,"CONSTRUCTION_DAILY_REPORT_EXCEL_CONFIRMED","ALLOWED",requestId(request),{siteId:auth.siteId,workDate:upload.work_date_kst,uploadId:id,revision:upload.revision})
 ]);
 return json({ok:true,id,workDate:upload.work_date_kst,revision:upload.revision});
}
async function outputArchiveList(env,auth,workDate,companyId){
 if(CONTRACTOR_ROLES.size&&auth.roles.some(role=>CONTRACTOR_ROLES.has(role))&&!auth.roles.some(role=>SITE_ROLES.has(role)))companyId=auth.companyId;
 const rows=await env.DB.prepare(`SELECT d.*,c.name company_name,u.display_name uploaded_by_name,
  (SELECT COUNT(*) FROM construction_output_sheet_media m WHERE m.document_id=d.id) photo_count
  FROM construction_output_sheet_documents d JOIN companies c ON c.id=d.company_id JOIN users u ON u.id=d.uploaded_by_user_id
  WHERE d.site_id=?1 AND d.work_date_kst=?2 AND (?3='' OR d.company_id=?3) ORDER BY d.uploaded_at DESC`).bind(auth.siteId,workDate,companyId||"").all();
 const ids=rows.results.map(row=>row.id),media=ids.length?await env.DB.prepare(`SELECT * FROM construction_output_sheet_media WHERE document_id IN (${ids.map((_,index)=>`?${index+1}`).join(",")}) ORDER BY document_id,sort_order`).bind(...ids).all():{results:[]};
 return rows.results.map(row=>({...row,photos:media.results.filter(item=>item.document_id===row.id).map(item=>({...item,thumbnailUrl:`/api/v1/construction/output-sheets/${row.id}/media/${item.id}/thumbnail`,originalUrl:`/api/v1/construction/output-sheets/${row.id}/media/${item.id}/original`}))}));
}
async function storeOutputSheets(request,env,auth){
 const form=await request.formData(),workDate=clean(form.get("workDate"),10),companyId=clean(form.get("companyId"),80),note=clean(form.get("note"),500);
 const siteWide=auth.roles.some(role=>SITE_ROLES.has(role)||role==="CONSTRUCTION_MANAGER"||role==="GENERAL_CONTRACTOR_FOREMAN");
 if(!siteWide&&companyId!==auth.companyId)throw new ApiError(403,"CONSTRUCTION_COMPANY_SCOPE_DENIED","본인 회사의 출력일보 사진만 등록할 수 있습니다.");
 const company=await env.DB.prepare("SELECT 1 FROM company_site_contracts WHERE site_id=?1 AND company_id=?2 AND status='ACTIVE'").bind(auth.siteId,companyId).first();if(!company)throw new ApiError(400,"CONSTRUCTION_COMPANY_INVALID","현재 현장 참여 회사를 선택해 주세요.");
 const photos=[...form.entries()].filter(([key,value])=>key.startsWith("photo")&&value instanceof File).map(([,value])=>value),thumbs=[...form.entries()].filter(([key,value])=>key.startsWith("thumbnail")&&value instanceof File).map(([,value])=>value);
 if(!photos.length||photos.length!==thumbs.length)throw new ApiError(400,"CONSTRUCTION_OUTPUT_PHOTO_REQUIRED","출력일보 사진을 한 장 이상 선택해 주세요.");
 const id=crypto.randomUUID(),uploaded=[],media=[];
 try{for(let index=0;index<photos.length;index++){const photo=photos[index],thumbnail=thumbs[index];if(!String(photo.type).startsWith("image/")||photo.size>12*1024*1024)throw new ApiError(400,"CONSTRUCTION_OUTPUT_PHOTO_INVALID","이미지 파일은 장당 12MB 이하만 등록할 수 있습니다.");const mediaId=crypto.randomUUID(),prefix=`sites/${auth.siteId}/construction/output-sheets/${workDate}/${companyId}/${id}`,originalKey=`${prefix}/original/${mediaId}-${safeFileName(photo.name)}`,thumbnailKey=`${prefix}/thumbnail/${mediaId}.webp`;await env.FILES.put(originalKey,photo.stream(),{httpMetadata:{contentType:photo.type}});uploaded.push(originalKey);await env.FILES.put(thumbnailKey,thumbnail.stream(),{httpMetadata:{contentType:thumbnail.type}});uploaded.push(thumbnailKey);media.push({mediaId,originalKey,thumbnailKey,photo,thumbnail,index})}
  await env.DB.batch([env.DB.prepare("INSERT INTO construction_output_sheet_documents(id,site_id,work_date_kst,company_id,note,uploaded_by_user_id) VALUES(?1,?2,?3,?4,?5,?6)").bind(id,auth.siteId,workDate,companyId,note,auth.userId),...media.map(value=>env.DB.prepare("INSERT INTO construction_output_sheet_media(id,document_id,original_key,thumbnail_key,original_name,mime_type,original_size,thumbnail_size,sort_order) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9)").bind(value.mediaId,id,value.originalKey,value.thumbnailKey,value.photo.name,value.photo.type,value.photo.size,value.thumbnail.size,value.index)),auditStatement(env,auth.userId,"CONSTRUCTION_OUTPUT_SHEET_UPLOADED","ALLOWED",requestId(request),{siteId:auth.siteId,workDate,companyId,documentId:id,photoCount:photos.length})]);
 }catch(error){await Promise.allSettled(uploaded.map(key=>env.FILES.delete(key)));throw error}
 return json({id},201);
}

export async function handleConstructionRequest(request,env,url=new URL(request.url)){
 const {pathname:path}=url,method=request.method;if(!path.startsWith("/api/v1/construction"))return null;
 const monthlyPlanResponse=await handleMonthlyPlanRequest(request,env,url,{authorize});if(monthlyPlanResponse)return monthlyPlanResponse;
 if(method==="GET"&&path==="/api/v1/construction/today-schedule"){const auth=await authorize(request,env),provider=await constructionProvider({env,ctx:auth.ctx,scope:{siteId:auth.siteId}});return json({schedule:provider.schedule,reportStatus:provider.reportStatus})}
 if(method==="GET"&&path==="/api/v1/construction/daily-report-uploads"){const auth=await authorize(request,env);return json({items:await uploadList(env,auth.siteId,clean(url.searchParams.get("workDate"),10))})}
 if(method==="GET"&&path==="/api/v1/construction/daily-report-upload-sessions"){const auth=await authorize(request,env);return json({items:await monthlyUploadSessions(env,auth.siteId)})}
 if(method==="POST"&&path==="/api/v1/construction/daily-report-upload-sessions"){const auth=await authorize(request,env,{required:"EDIT",write:true});return createUploadSession(request,env,auth)}
 const uploadSessionComplete=path.match(/^\/api\/v1\/construction\/daily-report-upload-sessions\/([^/]+)\/complete$/);if(method==="POST"&&uploadSessionComplete){const auth=await authorize(request,env,{required:"EDIT",write:true});return analyzeUploadSession(request,env,auth,uploadSessionComplete[1])}
 const uploadSessionConfirm=path.match(/^\/api\/v1\/construction\/daily-report-upload-sessions\/([^/]+)\/confirm$/);if(method==="POST"&&uploadSessionConfirm){const auth=await authorize(request,env,{required:"EDIT",write:true});return applyComparedDates(request,env,auth,uploadSessionConfirm[1])}
 const uploadSessionDownload=path.match(/^\/api\/v1\/construction\/daily-report-upload-sessions\/([^/]+)\/download$/);if(method==="GET"&&uploadSessionDownload){const auth=await authorize(request,env),row=await env.DB.prepare("SELECT r2_key,original_file_name,mime_type FROM construction_daily_report_upload_sessions WHERE id=?1 AND site_id=?2 AND status IN ('ANALYZED','CONFIRMED')").bind(uploadSessionDownload[1],auth.siteId).first();if(!row)throw new ApiError(404,"CONSTRUCTION_UPLOAD_SESSION_NOT_FOUND","월간 공사일보를 찾을 수 없습니다.");return privateObjectResponse(env,row.r2_key,row.mime_type,row.original_file_name)}
 const uploadSessionDetail=path.match(/^\/api\/v1\/construction\/daily-report-upload-sessions\/([^/]+)$/);if(method==="GET"&&uploadSessionDetail){const auth=await authorize(request,env),row=await env.DB.prepare("SELECT id,status,original_file_name,analysis_json,created_at,analyzed_at FROM construction_daily_report_upload_sessions WHERE id=?1 AND site_id=?2 AND status IN ('ANALYZED','CONFIRMED')").bind(uploadSessionDetail[1],auth.siteId).first();if(!row)throw new ApiError(404,"CONSTRUCTION_UPLOAD_SESSION_NOT_FOUND","월간 공사일보를 찾을 수 없습니다.");const stored=await refreshStoredComparison(env,auth.siteId,JSON.parse(row.analysis_json||"{}"));return json({session:{id:row.id,status:row.status,fileName:row.original_file_name,createdAt:row.created_at,analyzedAt:row.analyzed_at},preview:stored.preview})}
 if(method==="POST"&&path==="/api/v1/construction/daily-report-uploads/analyze"){throw new ApiError(410,"CONSTRUCTION_LEGACY_UPLOAD_DISABLED","새 업로드 화면에서 파일을 다시 선택해 주세요.")}
 const uploadDownload=path.match(/^\/api\/v1\/construction\/daily-report-uploads\/([^/]+)\/download$/);if(method==="GET"&&uploadDownload){const auth=await authorize(request,env),row=await env.DB.prepare("SELECT original_file_key,original_file_name,mime_type FROM construction_daily_report_uploads WHERE id=?1 AND site_id=?2").bind(uploadDownload[1],auth.siteId).first();if(!row)throw new ApiError(404,"CONSTRUCTION_UPLOAD_NOT_FOUND","공사일보 업로드를 찾을 수 없습니다.");return privateObjectResponse(env,row.original_file_key,row.mime_type,row.original_file_name)}
 const uploadDetailMatch=path.match(/^\/api\/v1\/construction\/daily-report-uploads\/([^/]+)$/);if(method==="GET"&&uploadDetailMatch){const auth=await authorize(request,env);return json(await uploadDetail(env,auth.siteId,uploadDetailMatch[1]))}
 const uploadConfirm=path.match(/^\/api\/v1\/construction\/daily-report-uploads\/([^/]+)\/confirm$/);if(method==="POST"&&uploadConfirm){const auth=await authorize(request,env,{required:"EDIT",write:true});return confirmExcel(request,env,auth,uploadConfirm[1])}
 if(method==="GET"&&path==="/api/v1/construction/output-sheets"){const auth=await authorize(request,env,{boardKey:BOARD_KEYS.CONSTRUCTION_OUTPUT_STATUS});return json({items:await outputArchiveList(env,auth,clean(url.searchParams.get("workDate")||kstDate(),10),clean(url.searchParams.get("companyId"),80))})}
 if(method==="POST"&&path==="/api/v1/construction/output-sheets"){const auth=await authorize(request,env,{boardKey:BOARD_KEYS.CONSTRUCTION_OUTPUT_STATUS,required:"EDIT",write:true,allowContractor:true});return storeOutputSheets(request,env,auth)}
 const outputMedia=path.match(/^\/api\/v1\/construction\/output-sheets\/([^/]+)\/media\/([^/]+)\/(thumbnail|original)$/);if(method==="GET"&&outputMedia){const auth=await authorize(request,env,{boardKey:BOARD_KEYS.CONSTRUCTION_OUTPUT_STATUS}),row=await env.DB.prepare(`SELECT d.company_id,m.${outputMedia[3]==="original"?"original_key":"thumbnail_key"} object_key,m.mime_type,m.original_name FROM construction_output_sheet_media m JOIN construction_output_sheet_documents d ON d.id=m.document_id WHERE d.id=?1 AND m.id=?2 AND d.site_id=?3`).bind(outputMedia[1],outputMedia[2],auth.siteId).first();if(!row)throw new ApiError(404,"CONSTRUCTION_OUTPUT_PHOTO_NOT_FOUND","출력일보 사진을 찾을 수 없습니다.");if(auth.roles.some(role=>CONTRACTOR_ROLES.has(role))&&!auth.roles.some(role=>SITE_ROLES.has(role))&&row.company_id!==auth.companyId)throw new ApiError(403,"CONSTRUCTION_COMPANY_SCOPE_DENIED","다른 회사의 출력일보 사진을 볼 수 없습니다.");return privateObjectResponse(env,row.object_key,row.mime_type,row.original_name)}
 const invalidate=path.match(/^\/api\/v1\/construction\/output-sheets\/([^/]+)\/invalidate$/);if(method==="POST"&&invalidate){const auth=await authorize(request,env,{boardKey:BOARD_KEYS.CONSTRUCTION_OUTPUT_STATUS,required:"EDIT",write:true,allowContractor:true}),body=await parseJson(request),reason=clean(body.reason,500),row=await env.DB.prepare("SELECT company_id,status FROM construction_output_sheet_documents WHERE id=?1 AND site_id=?2").bind(invalidate[1],auth.siteId).first();if(!row)throw new ApiError(404,"CONSTRUCTION_OUTPUT_DOCUMENT_NOT_FOUND","출력일보 사진 자료를 찾을 수 없습니다.");if(row.company_id!==auth.companyId&&!auth.roles.some(role=>SITE_ROLES.has(role)||role==="CONSTRUCTION_MANAGER"))throw new ApiError(403,"CONSTRUCTION_COMPANY_SCOPE_DENIED","다른 회사 자료를 무효 처리할 수 없습니다.");if(!reason)throw new ApiError(400,"CONSTRUCTION_INVALIDATION_REASON_REQUIRED","무효 처리 사유를 입력해 주세요.");await env.DB.batch([env.DB.prepare("UPDATE construction_output_sheet_documents SET status='INVALIDATED',invalidated_by_user_id=?2,invalidated_at=CURRENT_TIMESTAMP,invalidation_reason=?3 WHERE id=?1 AND status='ACTIVE'").bind(invalidate[1],auth.userId,reason),auditStatement(env,auth.userId,"CONSTRUCTION_OUTPUT_SHEET_INVALIDATED","ALLOWED",requestId(request),{siteId:auth.siteId,documentId:invalidate[1],reason})]);return json({ok:true})}
 if(method==="GET"&&path==="/api/v1/construction/output-status"){const auth=await authorize(request,env,{boardKey:BOARD_KEYS.CONSTRUCTION_OUTPUT_STATUS});return json(await outputStatus(env,auth.siteId,clean(url.searchParams.get("workDate")||kstDate(),10)))}
 if(method==="GET"&&path==="/api/v1/construction/options"){const auth=await authorize(request,env);return json(await constructionOptions(env,auth.siteId,clean(url.searchParams.get("companyId"),80)))}
 if(method==="GET"&&path==="/api/v1/construction/daily-reports"){const auth=await authorize(request,env),rows=await env.DB.prepare(`SELECT r.*,u.display_name created_by_name,(SELECT COUNT(*) FROM construction_daily_report_items i WHERE i.report_id=r.id) submitted_company_count FROM construction_daily_reports r JOIN users u ON u.id=r.created_by_user_id WHERE r.site_id=?1 ORDER BY r.work_date_kst DESC LIMIT 60`).bind(auth.siteId).all();return json({items:rows.results})}
 if(method==="POST"&&path==="/api/v1/construction/daily-reports"){const auth=await authorize(request,env,{required:"EDIT",write:true});return createReport(request,env,auth)}
 const media=path.match(/^\/api\/v1\/construction\/daily-reports\/([^/]+)\/media\/([^/]+)\/(thumbnail|original)$/);if(method==="GET"&&media){const auth=await authorize(request,env);return mediaContent(request,env,auth,media[1],media[2],media[3])}
 const match=path.match(/^\/api\/v1\/construction\/daily-reports\/([^/]+)(?:\/([^/]+))?$/);if(!match)return null;const [,id,action]=match;
 if(method==="GET"&&!action){const auth=await authorize(request,env);return json(await reportPayload(env,id,auth.siteId))}
 if(method==="PATCH"&&!action){const auth=await authorize(request,env,{required:"EDIT",write:true});return saveReport(request,env,auth,id)}
 if(method==="POST"&&action==="refresh-outputs"){const auth=await authorize(request,env,{required:"EDIT",write:true});return refreshOutputs(request,env,auth,id)}
 if(method==="POST"&&action==="submit"){const auth=await authorize(request,env,{required:"EDIT",write:true});return transition(request,env,auth,id,"SUBMIT")}
 if(method==="POST"&&action==="resubmit"){const auth=await authorize(request,env,{required:"EDIT",write:true});return transition(request,env,auth,id,"RESUBMIT")}
 if(method==="POST"&&action==="revision-request"){const auth=await authorize(request,env,{required:"MANAGE",write:true});return requestRevision(request,env,auth,id)}
 if(method==="POST"&&action==="finalize"){const auth=await authorize(request,env,{required:"MANAGE",write:true});return transition(request,env,auth,id,"FINALIZE")}
 if(method==="POST"&&action==="reopen"){const auth=await authorize(request,env,{required:"MANAGE",write:true});return transition(request,env,auth,id,"REOPEN")}
 if(method==="POST"&&action==="cancel"){const auth=await authorize(request,env,{required:"MANAGE",write:true});return transition(request,env,auth,id,"CANCEL")}
 if(method==="POST"&&action==="media"){const auth=await authorize(request,env,{required:"EDIT",write:true});return storeMedia(request,env,auth,id)}
 return null;
}

import {ApiError,json,parseJson,requestId} from "../core/response.js";
import {authenticate,context} from "../core/session.js";
import {BOARD_KEYS,requireBoardAccess} from "../core/board-access.js";

const MANAGE_ROLES=new Set(["PLATFORM_OWNER","INTEGRATED_OWNER","SITE_MANAGER","QUALITY_MANAGER"]);
const BASIS_TYPES=new Set(["LEGAL_OBLIGATION","APPROVED_QUALITY_MANAGEMENT_PLAN","APPROVED_QUALITY_TEST_PLAN","APPLICABLE_STANDARD","APPLICABLE_SPECIFICATION","CSI_TARGET_TEST","CALIBRATION_DUE","MATERIAL_DOCUMENT_REQUIRED"]);
const clean=(v,max=2000)=>String(v??"").trim().slice(0,max);
const audit=(env,userId,action,request,meta)=>env.DB.prepare("INSERT INTO audit_logs(id,actor_user_id,action,outcome,request_id,metadata_json) VALUES(?1,?2,?3,'ALLOWED',?4,?5)").bind(crypto.randomUUID(),userId,action,requestId(request),JSON.stringify(meta));
const BOARD={
 csi:"QUALITY_CSI_PREPARATION",
 tests:"QUALITY_TEST_INSPECTION",
 nonconformance:"QUALITY_NONCONFORMANCE",
 calibration:"QUALITY_CALIBRATION"
};
async function authorize(request,env,{board=BOARD.csi,required="VIEW",write=false}={}){
 const row=await authenticate(request,env,{csrf:write}),ctx=await context(env,row),siteId=ctx.selectedSiteId;
 if(!siteId)throw new ApiError(400,"SITE_CONTEXT_REQUIRED","현장을 선택해 주세요.");
 if(write&&Number(request.headers.get("x-context-version"))!==ctx.contextVersion)throw new ApiError(409,"CONTEXT_VERSION_STALE","현장 정보가 변경되었습니다. 새로고침해 주세요.");
 const membership=await env.DB.prepare("SELECT company_id FROM memberships WHERE user_id=?1 AND site_id=?2 AND status='ACTIVE'").bind(row.user_id,siteId).first();
 if(!membership)throw new ApiError(403,"QUALITY_SITE_SCOPE_DENIED","현재 현장의 품질업무에 접근할 수 없습니다.");
 await requireBoardAccess(env,{userId:row.user_id,siteId,boardKey:board,required,requestId:requestId(request)});
 const roles=(await env.DB.prepare("SELECT r.code FROM user_site_roles usr JOIN roles r ON r.id=usr.role_id WHERE usr.user_id=?1 AND usr.site_id=?2 AND usr.status='ACTIVE'").bind(row.user_id,siteId).all()).results.map(v=>v.code);
 return {userId:row.user_id,siteId,companyId:membership.company_id,manage:roles.some(v=>MANAGE_ROLES.has(v))};
}
function requireManage(auth,message="현장소장 또는 품질 관리자만 처리할 수 있습니다."){if(!auth.manage)throw new ApiError(403,"QUALITY_MANAGE_DENIED",message)}
async function options(env,auth){
 const [companies,trades,locations,users,basis,equipment,dailyReports]=await Promise.all([
  env.DB.prepare("SELECT c.id,c.name FROM company_site_contracts sc JOIN companies c ON c.id=sc.company_id WHERE sc.site_id=?1 AND sc.status='ACTIVE' AND c.status='ACTIVE' ORDER BY c.name").bind(auth.siteId).all(),
  env.DB.prepare("SELECT sc.company_id,t.id trade_id,t.display_name FROM company_site_contracts sc JOIN company_site_contract_trades sct ON sct.site_contract_id=sc.id JOIN trade_master t ON t.id=sct.trade_id WHERE sc.site_id=?1 AND sc.status='ACTIVE' AND sct.status='ACTIVE' AND t.status='ACTIVE' ORDER BY t.display_name").bind(auth.siteId).all(),
  env.DB.prepare("SELECT id,display_name FROM site_locations WHERE site_id=?1 AND is_active=1 ORDER BY display_name").bind(auth.siteId).all(),
  env.DB.prepare("SELECT DISTINCT u.id,u.display_name,m.company_id FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.site_id=?1 AND m.status='ACTIVE' AND u.status='ACTIVE' ORDER BY u.display_name").bind(auth.siteId).all(),
  env.DB.prepare("SELECT id,basis_type,basis_document_reference FROM quality_work_basis_records WHERE site_id=?1 ORDER BY created_at DESC").bind(auth.siteId).all(),
  env.DB.prepare("SELECT e.id,e.equipment_name,e.management_number,(SELECT MAX(expires_date) FROM quality_calibration_records c WHERE c.equipment_id=e.id) expires_date FROM quality_test_equipment e WHERE e.site_id=?1 AND e.is_active=1 ORDER BY e.equipment_name").bind(auth.siteId).all(),
  env.DB.prepare("SELECT id,work_date_kst,status FROM construction_daily_reports WHERE site_id=?1 ORDER BY work_date_kst DESC LIMIT 100").bind(auth.siteId).all()
 ]);
 return {companies:companies.results,companyTrades:trades.results,locations:locations.results,users:users.results,basisRecords:basis.results,equipment:equipment.results,dailyReports:dailyReports.results,canManage:auth.manage};
}
async function dashboard(env,auth){
 const [tests,reports,ncr,equipment,legacy]=await Promise.all([
  env.DB.prepare("SELECT q.*,c.name company_name,t.display_name trade_name,l.display_name location_name,u.display_name manager_name,(SELECT COUNT(*) FROM quality_test_media m WHERE m.test_inspection_id=q.id AND m.media_role='RESULT_PHOTO') photo_count,(SELECT COUNT(*) FROM quality_test_report_links rl WHERE rl.test_inspection_id=q.id) report_count FROM quality_test_inspections q JOIN companies c ON c.id=q.company_id JOIN trade_master t ON t.id=q.trade_id LEFT JOIN site_locations l ON l.id=q.location_id LEFT JOIN users u ON u.id=q.test_manager_user_id WHERE q.site_id=?1 ORDER BY q.created_at DESC").bind(auth.siteId).all(),
  env.DB.prepare("SELECT r.*,(SELECT COUNT(*) FROM quality_test_report_links l WHERE l.test_report_id=r.id) linked_count FROM quality_test_reports r WHERE r.site_id=?1 ORDER BY r.issued_date DESC").bind(auth.siteId).all(),
  env.DB.prepare("SELECT n.*,q.title test_title,(SELECT status FROM quality_corrective_actions a WHERE a.nonconformance_id=n.id ORDER BY created_at DESC LIMIT 1) action_status FROM quality_nonconformances n JOIN quality_test_inspections q ON q.id=n.test_inspection_id WHERE n.site_id=?1 ORDER BY n.created_at DESC").bind(auth.siteId).all(),
  env.DB.prepare("SELECT e.*,(SELECT expires_date FROM quality_calibration_records c WHERE c.equipment_id=e.id ORDER BY expires_date DESC LIMIT 1) expires_date,(SELECT usable_status FROM quality_calibration_records c WHERE c.equipment_id=e.id ORDER BY expires_date DESC LIMIT 1) usable_status FROM quality_test_equipment e WHERE e.site_id=?1 ORDER BY e.equipment_name").bind(auth.siteId).all(),
  env.DB.prepare("SELECT (SELECT COUNT(*) FROM quality_legal_obligations) obligation_count,(SELECT COUNT(*) FROM legacy_work_classification_reports WHERE site_id=?1) classification_count").bind(auth.siteId).first()
 ]);
 const counts={scheduled:0,collecting:0,review:0,revision:0,ready:0,csiPending:0,ncrOpen:0,calibrationDue:0};
 for(const row of tests.results){if(row.status==="SCHEDULED")counts.scheduled++;if(row.status==="COLLECTING")counts.collecting++;if(["TEST_COMPLETED","REVIEW_PENDING"].includes(row.status))counts.review++;if(row.status==="REVISION_REQUIRED")counts.revision++;if(row.status==="READY_FOR_CSI"){counts.ready++;counts.csiPending++}}
 counts.ncrOpen=ncr.results.filter(v=>!["CLOSED","CANCELLED"].includes(v.status)).length;
 const soon=new Date(Date.now()+30*86400000).toISOString().slice(0,10);counts.calibrationDue=equipment.results.filter(v=>!v.expires_date||v.expires_date<=soon).length;
 return {tests:tests.results,reports:reports.results,nonconformances:ncr.results,equipment:equipment.results,counts,legacy,options:await options(env,auth),implementation:{csiIntegration:"NOT_IMPLEMENTED",automaticSubmission:false}};
}
async function validateRefs(env,auth,b){
 const companyId=clean(b.companyId,80),tradeId=clean(b.tradeId,80),managerId=clean(b.testManagerUserId,80),locationId=clean(b.locationId,80)||null,basisId=clean(b.basisRecordId,80)||null,equipmentId=clean(b.equipmentId,80)||null,dailyReportId=clean(b.constructionDailyReportId,80)||null;
 const company=await env.DB.prepare("SELECT 1 FROM company_site_contracts WHERE site_id=?1 AND company_id=?2 AND status='ACTIVE'").bind(auth.siteId,companyId).first();
 if(!company)throw new ApiError(400,"QUALITY_COMPANY_INVALID","현재 현장에 참여 중인 회사를 선택해 주세요.");
 const trade=await env.DB.prepare("SELECT 1 FROM company_site_contract_trades sct JOIN company_site_contracts sc ON sc.id=sct.site_contract_id WHERE sc.site_id=?1 AND sc.company_id=?2 AND sct.trade_id=?3 AND sc.status='ACTIVE' AND sct.status='ACTIVE'").bind(auth.siteId,companyId,tradeId).first();
 if(!trade)throw new ApiError(400,"QUALITY_TRADE_INVALID","선택한 회사의 현재 현장 계약 공종을 선택해 주세요.");
 if(managerId){const manager=await env.DB.prepare("SELECT 1 FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.site_id=?1 AND m.company_id=?2 AND m.user_id=?3 AND m.status='ACTIVE' AND u.status='ACTIVE'").bind(auth.siteId,companyId,managerId).first();if(!manager)throw new ApiError(400,"QUALITY_MANAGER_INVALID","선택한 회사의 현재 현장 활성 담당자를 선택해 주세요.")}
 if(locationId&&!await env.DB.prepare("SELECT 1 FROM site_locations WHERE id=?1 AND site_id=?2 AND is_active=1").bind(locationId,auth.siteId).first())throw new ApiError(400,"QUALITY_LOCATION_INVALID","현재 현장의 위치를 선택해 주세요.");
 if(basisId&&!await env.DB.prepare("SELECT 1 FROM quality_work_basis_records WHERE id=?1 AND site_id=?2").bind(basisId,auth.siteId).first())throw new ApiError(400,"QUALITY_BASIS_INVALID","품질시험·검사 근거를 선택해 주세요.");
 if(equipmentId){
  const equipment=await env.DB.prepare("SELECT e.id,(SELECT MAX(expires_date) FROM quality_calibration_records c WHERE c.equipment_id=e.id) expires_date FROM quality_test_equipment e WHERE e.id=?1 AND e.site_id=?2 AND e.is_active=1").bind(equipmentId,auth.siteId).first();
  if(!equipment)throw new ApiError(400,"QUALITY_EQUIPMENT_INVALID","현재 현장의 활성 시험장비를 선택해 주세요.");
  if((!equipment.expires_date||equipment.expires_date<new Date().toISOString().slice(0,10))&&!clean(b.equipmentExceptionReason,1000))throw new ApiError(409,"QUALITY_EQUIPMENT_CALIBRATION_EXPIRED","검교정 유효기간이 지난 장비입니다. 다른 장비를 선택하거나 관리자 확인 사유를 입력해 주세요.");
 }
 if(dailyReportId&&!await env.DB.prepare("SELECT 1 FROM construction_daily_reports WHERE id=?1 AND site_id=?2").bind(dailyReportId,auth.siteId).first())throw new ApiError(400,"QUALITY_DAILY_REPORT_INVALID","현재 현장의 공사일보를 선택해 주세요.");
 return {companyId,tradeId,managerId:managerId||null,locationId,basisId,equipmentId,dailyReportId};
}
async function createTest(request,env,auth){
 const b=await parseJson(request),title=clean(b.title,200),target=clean(b.testTarget,500),scheduled=clean(b.scheduledDate,10),method=clean(b.testMethod,500),criteria=clean(b.acceptanceCriteria,1000);
 if(!title)throw new ApiError(400,"QUALITY_TEST_TITLE_REQUIRED","시험·검사명을 입력해 주세요.");
 if(!target)throw new ApiError(400,"QUALITY_TEST_TARGET_REQUIRED","시험 대상을 입력해 주세요.");
 if(!scheduled)throw new ApiError(400,"QUALITY_TEST_DATE_REQUIRED","시험 예정일을 입력해 주세요.");
 if(!method||!criteria)throw new ApiError(400,"QUALITY_TEST_BASIS_REQUIRED","시험 방법과 판정 기준을 입력해 주세요.");
 const refs=await validateRefs(env,auth,b),id=crypto.randomUUID();
 await env.DB.batch([
  env.DB.prepare("INSERT INTO quality_test_inspections(id,site_id,company_id,trade_id,location_id,basis_record_id,title,test_target,scheduled_date,test_institution,test_manager_user_id,equipment_id,equipment_exception_reason,test_method,acceptance_criteria,material_reference,construction_daily_report_id,judgment,status,created_by_user_id) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,'PENDING','SCHEDULED',?18)").bind(id,auth.siteId,refs.companyId,refs.tradeId,refs.locationId,refs.basisId,title,target,scheduled,clean(b.testInstitution,200)||null,refs.managerId,refs.equipmentId,clean(b.equipmentExceptionReason,1000)||null,method,criteria,clean(b.materialReference,500)||null,refs.dailyReportId,auth.userId),
  audit(env,auth.userId,"QUALITY_TEST_SCHEDULED",request,{testInspectionId:id})
 ]);
 return json({ok:true,id},201);
}
async function testDetail(env,auth,id){
 const test=await env.DB.prepare("SELECT q.*,c.name company_name,t.display_name trade_name,l.display_name location_name,u.display_name manager_name,rv.display_name reviewer_name FROM quality_test_inspections q JOIN companies c ON c.id=q.company_id JOIN trade_master t ON t.id=q.trade_id LEFT JOIN site_locations l ON l.id=q.location_id LEFT JOIN users u ON u.id=q.test_manager_user_id LEFT JOIN users rv ON rv.id=q.reviewed_by_user_id WHERE q.id=?1 AND q.site_id=?2").bind(id,auth.siteId).first();
 if(!test)throw new ApiError(404,"QUALITY_TEST_NOT_FOUND","시험·검사 업무를 찾을 수 없습니다.");
 const [result,media,reports,ncr,csi]=await Promise.all([
  env.DB.prepare("SELECT * FROM quality_test_results WHERE test_inspection_id=?1").bind(id).first(),
  env.DB.prepare("SELECT id,media_role,original_name,mime_type,size_bytes,created_at FROM quality_test_media WHERE test_inspection_id=?1 ORDER BY created_at").bind(id).all(),
  env.DB.prepare("SELECT r.* FROM quality_test_report_links l JOIN quality_test_reports r ON r.id=l.test_report_id WHERE l.test_inspection_id=?1 ORDER BY r.issued_date DESC").bind(id).all(),
  env.DB.prepare("SELECT n.*,(SELECT id FROM quality_corrective_actions a WHERE a.nonconformance_id=n.id ORDER BY created_at DESC LIMIT 1) action_id,(SELECT status FROM quality_corrective_actions a WHERE a.nonconformance_id=n.id ORDER BY created_at DESC LIMIT 1) action_status FROM quality_nonconformances n WHERE n.test_inspection_id=?1 ORDER BY n.created_at DESC").bind(id).all(),
  env.DB.prepare("SELECT s.*,u.display_name recorded_by_name,c.display_name confirmed_by_name FROM quality_csi_submission_records s JOIN users u ON u.id=s.recorded_by_user_id JOIN users c ON c.id=s.confirmed_by_user_id WHERE s.test_inspection_id=?1").bind(id).first()
 ]);
 const completed={basic:Boolean(test.title&&test.test_target),scope:Boolean(test.company_id&&test.trade_id),schedule:Boolean(test.scheduled_date),institution:Boolean(test.test_institution),manager:Boolean(test.test_manager_user_id),method:Boolean(test.test_method&&test.acceptance_criteria),result:Boolean(result),photo:media.results.some(v=>v.media_role==="RESULT_PHOTO"),report:reports.results.length>0,review:Boolean(test.reviewed_at),csi:Boolean(csi)};
 const required=["basic","scope","schedule","institution","manager","method","result","photo","report","review"],missing=Object.entries(completed).filter(([k,v])=>k!=="csi"&&!v).map(([k])=>({institution:"시험기관",manager:"시험 담당자",result:"시험 결과",photo:"결과 사진",report:"시험성적서",review:"내부 검토",basic:"시험 기본정보",scope:"회사·공종",schedule:"시험일정",method:"시험 방법·기준"}[k]));
 return {test,result,media:media.results,reports:reports.results,nonconformances:ncr.results,csi,preparation:{completed:Object.values(completed).slice(0,10).filter(Boolean).length,required:10,missing}};
}
async function saveResult(request,env,auth,id){
 const data=await testDetail(env,auth,id),b=await parseJson(request),measured=clean(b.measuredValue,500),detail=clean(b.resultDetail,2000),judgment=clean(b.judgment,20),testDate=clean(b.testDate,10);
 if(!measured||!detail)throw new ApiError(400,"QUALITY_TEST_RESULT_REQUIRED","시험 결과와 상세 내용을 입력해 주세요.");
 if(!["PASS","FAIL"].includes(judgment))throw new ApiError(400,"QUALITY_TEST_JUDGMENT_REQUIRED","시험 결과의 적합·부적합 판정을 선택해 주세요.");
 if(!testDate)throw new ApiError(400,"QUALITY_TEST_DATE_REQUIRED","실제 시험일을 입력해 주세요.");
 if(["READY_FOR_CSI","CSI_RECORDED","CANCELLED"].includes(data.test.status))throw new ApiError(409,"QUALITY_TEST_LOCKED","CSI 준비 완료 또는 입력 완료된 시험은 결과를 변경할 수 없습니다.");
 const statements=[
  env.DB.prepare("INSERT INTO quality_test_results(id,test_inspection_id,measured_value,unit,result_detail,judgment,entered_by_user_id) VALUES(?1,?2,?3,?4,?5,?6,?7) ON CONFLICT(test_inspection_id) DO UPDATE SET measured_value=excluded.measured_value,unit=excluded.unit,result_detail=excluded.result_detail,judgment=excluded.judgment,entered_by_user_id=excluded.entered_by_user_id,revision=quality_test_results.revision+1,updated_at=CURRENT_TIMESTAMP").bind(crypto.randomUUID(),id,measured,clean(b.unit,80)||null,detail,judgment,auth.userId),
  env.DB.prepare("UPDATE quality_test_inspections SET test_date=?2,result_summary=?3,judgment=?4,status='TEST_COMPLETED',revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?1").bind(id,testDate,detail,judgment),
  audit(env,auth.userId,"QUALITY_TEST_RESULT_RECORDED",request,{testInspectionId:id,judgment})
 ];
 if(judgment==="FAIL"&&!data.nonconformances.some(v=>!["CLOSED","CANCELLED"].includes(v.status)))statements.push(env.DB.prepare("INSERT INTO quality_nonconformances(id,site_id,test_inspection_id,title,impact_scope,location_reference,material_reference,trade_id,created_by_user_id) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9)").bind(crypto.randomUUID(),auth.siteId,id,`${data.test.title} 부적합`,clean(b.impactScope,1000)||"영향 범위 확인 필요",data.test.location_name||null,clean(b.materialReference,500)||null,data.test.trade_id,auth.userId));
 await env.DB.batch(statements);return json(await testDetail(env,auth,id));
}
async function uploadTestMedia(request,env,auth,id){
 await testDetail(env,auth,id);const form=await request.formData(),photo=form.get("file");
 if(!(photo instanceof File)||!photo.size)throw new ApiError(400,"QUALITY_PHOTO_REQUIRED","시험 결과 사진을 선택해 주세요.");
 if(!String(photo.type).startsWith("image/"))throw new ApiError(400,"QUALITY_PHOTO_FORMAT_INVALID","시험 결과 사진은 이미지 파일만 등록할 수 있습니다.");
 if(photo.size>20*1024*1024)throw new ApiError(413,"QUALITY_PHOTO_TOO_LARGE","시험 결과 사진은 20MB 이하로 등록해 주세요.");
 const mediaId=crypto.randomUUID(),safe=String(photo.name||"quality-photo").replace(/[^a-zA-Z0-9._-]/g,"_"),key=`sites/${auth.siteId}/quality/tests/${id}/${mediaId}/${safe}`;
 try{await env.FILES.put(key,photo.stream(),{httpMetadata:{contentType:photo.type},customMetadata:{siteId:auth.siteId,testInspectionId:id,mediaId}});await env.DB.batch([env.DB.prepare("INSERT INTO quality_test_media(id,test_inspection_id,site_id,media_role,original_key,original_name,mime_type,size_bytes,uploaded_by_user_id) VALUES(?1,?2,?3,'RESULT_PHOTO',?4,?5,?6,?7,?8)").bind(mediaId,id,auth.siteId,key,photo.name||safe,photo.type,photo.size,auth.userId),env.DB.prepare("UPDATE quality_test_inspections SET status=CASE WHEN status='SCHEDULED' THEN 'COLLECTING' ELSE status END,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?1").bind(id),audit(env,auth.userId,"QUALITY_TEST_PHOTO_ADDED",request,{testInspectionId:id,mediaId})])}catch(error){await env.FILES.delete(key);if(error instanceof ApiError)throw error;throw new ApiError(502,"QUALITY_PHOTO_UPLOAD_FAILED","시험 결과 사진 업로드에 실패했습니다. 다시 시도해 주세요.")}
 return json(await testDetail(env,auth,id),201);
}
async function uploadReport(request,env,auth,id){
 await testDetail(env,auth,id);const form=await request.formData(),file=form.get("file"),number=clean(form.get("reportNumber"),120),name=clean(form.get("testName"),200),institution=clean(form.get("testInstitution"),200),issued=clean(form.get("issuedDate"),10),target=clean(form.get("testTarget"),500);
 if(!number)throw new ApiError(400,"QUALITY_REPORT_NUMBER_REQUIRED","시험성적서 번호를 입력해 주세요.");
 if(!name||!institution||!issued||!target)throw new ApiError(400,"QUALITY_REPORT_FIELDS_REQUIRED","시험명, 시험기관, 발급일, 시험 대상을 입력해 주세요.");
 const existing=await env.DB.prepare("SELECT id FROM quality_test_reports WHERE site_id=?1 AND report_number=?2").bind(auth.siteId,number).first();
 if(existing){await env.DB.batch([env.DB.prepare("INSERT OR IGNORE INTO quality_test_report_links(id,test_inspection_id,test_report_id,created_by_user_id) VALUES(?1,?2,?3,?4)").bind(crypto.randomUUID(),id,existing.id,auth.userId),audit(env,auth.userId,"QUALITY_REPORT_REUSED",request,{testInspectionId:id,reportId:existing.id})]);return json(await testDetail(env,auth,id),200)}
 if(!(file instanceof File)||!file.size)throw new ApiError(400,"QUALITY_REPORT_FILE_REQUIRED","시험성적서 파일을 선택해 주세요.");
 if(file.size>30*1024*1024)throw new ApiError(413,"QUALITY_REPORT_TOO_LARGE","시험성적서는 30MB 이하로 등록해 주세요.");
 const reportId=crypto.randomUUID(),safe=String(file.name||"quality-report").replace(/[^a-zA-Z0-9._-]/g,"_"),key=`sites/${auth.siteId}/quality/reports/${reportId}/${safe}`;
 try{await env.FILES.put(key,file.stream(),{httpMetadata:{contentType:file.type||"application/octet-stream"},customMetadata:{siteId:auth.siteId,reportId}});await env.DB.batch([env.DB.prepare("INSERT INTO quality_test_reports(id,site_id,report_number,test_name,test_institution,issued_date,test_target,material_reference,original_key,original_name,mime_type,size_bytes,note,uploaded_by_user_id) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)").bind(reportId,auth.siteId,number,name,institution,issued,target,clean(form.get("materialReference"),500)||null,key,file.name||safe,file.type||"application/octet-stream",file.size,clean(form.get("note"),1000)||null,auth.userId),env.DB.prepare("INSERT INTO quality_test_report_links(id,test_inspection_id,test_report_id,created_by_user_id) VALUES(?1,?2,?3,?4)").bind(crypto.randomUUID(),id,reportId,auth.userId),audit(env,auth.userId,"QUALITY_TEST_REPORT_ADDED",request,{testInspectionId:id,reportId})])}catch(error){await env.FILES.delete(key);if(error instanceof ApiError)throw error;throw new ApiError(502,"QUALITY_REPORT_UPLOAD_FAILED","시험성적서 업로드에 실패했습니다. 다시 시도해 주세요.")}
 return json(await testDetail(env,auth,id),201);
}
async function linkReport(request,env,auth,id){
 await testDetail(env,auth,id);const b=await parseJson(request),reportId=clean(b.reportId,80);
 const report=await env.DB.prepare("SELECT id FROM quality_test_reports WHERE id=?1 AND site_id=?2 AND is_valid=1").bind(reportId,auth.siteId).first();
 if(!report)throw new ApiError(400,"QUALITY_REPORT_INVALID","현재 현장의 유효한 시험성적서를 선택해 주세요.");
 await env.DB.batch([env.DB.prepare("INSERT OR IGNORE INTO quality_test_report_links(id,test_inspection_id,test_report_id,created_by_user_id) VALUES(?1,?2,?3,?4)").bind(crypto.randomUUID(),id,reportId,auth.userId),audit(env,auth.userId,"QUALITY_TEST_REPORT_LINKED",request,{testInspectionId:id,reportId})]);
 return json(await testDetail(env,auth,id));
}
async function transition(request,env,auth,id,action){
 const data=await testDetail(env,auth,id),b=await parseJson(request),note=clean(b.note,1000),status=data.test.status;
 if(action==="submit-review"){
  if(!["TEST_COMPLETED","REVISION_REQUIRED"].includes(status))throw new ApiError(409,"QUALITY_REVIEW_TRANSITION_INVALID","시험 결과 입력 또는 보완 후 내부 검토를 요청할 수 있습니다.");
  if(!data.result)throw new ApiError(400,"QUALITY_TEST_RESULT_REQUIRED","시험 결과를 입력해 주세요.");
  if(!data.media.some(v=>v.media_role==="RESULT_PHOTO")&&!data.reports.length)throw new ApiError(400,"QUALITY_EVIDENCE_REQUIRED","시험 결과 사진이나 성적서를 등록해 주세요.");
  await env.DB.batch([env.DB.prepare("UPDATE quality_test_inspections SET status='REVIEW_PENDING',review_note=NULL,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?1").bind(id),audit(env,auth.userId,"QUALITY_TEST_REVIEW_REQUESTED",request,{testInspectionId:id})]);
 }else if(action==="revision"){
  requireManage(auth);if(status!=="REVIEW_PENDING")throw new ApiError(409,"QUALITY_REVIEW_TRANSITION_INVALID","내부 검토 대기 중인 시험만 보완 요청할 수 있습니다.");if(!note)throw new ApiError(400,"QUALITY_REVIEW_NOTE_REQUIRED","보완할 내용을 구체적으로 입력해 주세요.");
  await env.DB.batch([env.DB.prepare("UPDATE quality_test_inspections SET status='REVISION_REQUIRED',review_note=?2,reviewed_by_user_id=?3,reviewed_at=CURRENT_TIMESTAMP,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?1").bind(id,note,auth.userId),audit(env,auth.userId,"QUALITY_TEST_REVISION_REQUIRED",request,{testInspectionId:id})]);
 }else if(action==="ready"){
  requireManage(auth);if(status!=="REVIEW_PENDING")throw new ApiError(409,"QUALITY_REVIEW_TRANSITION_INVALID","내부 검토 대기 중인 시험만 CSI 입력 준비 완료로 승인할 수 있습니다.");
  const missing=data.preparation.missing.filter(v=>v!=="내부 검토");if(missing.length)throw new ApiError(409,"QUALITY_CSI_PACKAGE_INCOMPLETE",`CSI 입력 준비에 필요한 자료가 ${missing.length}건 부족합니다: ${missing.join(", ")}`);
  if(data.result.judgment==="FAIL"&&data.nonconformances.some(v=>v.status!=="CLOSED"))throw new ApiError(409,"QUALITY_NONCONFORMANCE_OPEN","미종결 부적합·시정조치를 완료한 뒤 CSI 입력 준비를 승인해 주세요.");
  await env.DB.batch([env.DB.prepare("UPDATE quality_test_inspections SET status='READY_FOR_CSI',review_note=?2,reviewed_by_user_id=?3,reviewed_at=CURRENT_TIMESTAMP,ready_by_user_id=?3,ready_at=CURRENT_TIMESTAMP,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?1").bind(id,note||"내부 검토 완료",auth.userId),audit(env,auth.userId,"QUALITY_READY_FOR_CSI",request,{testInspectionId:id})]);
 }else if(action==="csi-record"){
  if(status!=="READY_FOR_CSI")throw new ApiError(409,"QUALITY_CSI_STATUS_INVALID","CSI 입력 준비 완료된 시험만 실제 입력 완료 사실을 기록할 수 있습니다.");
  const date=clean(b.recordedDate,10),reference=clean(b.csiReferenceNumber,300);
  if(!date)throw new ApiError(400,"QUALITY_CSI_DATE_REQUIRED","CSI 입력 완료일을 입력해 주세요.");
  if(!reference)throw new ApiError(400,"QUALITY_CSI_REFERENCE_REQUIRED","CSI 관리번호 또는 확인 근거를 입력해 주세요.");
  const recordId=crypto.randomUUID();await env.DB.batch([env.DB.prepare("INSERT INTO quality_csi_submission_records(id,test_inspection_id,recorded_date,recorded_by_user_id,csi_reference_number,note,confirmed_by_user_id) VALUES(?1,?2,?3,?4,?5,?6,?7)").bind(recordId,id,date,auth.userId,reference,clean(b.note,1000)||null,auth.userId),env.DB.prepare("UPDATE quality_test_inspections SET status='CSI_RECORDED',revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?1").bind(id),audit(env,auth.userId,"QUALITY_CSI_INPUT_RECORDED",request,{testInspectionId:id,submissionRecordId:recordId})]);
 }else throw new ApiError(404,"QUALITY_ACTION_NOT_FOUND","지원하지 않는 품질업무 처리입니다.");
 return json(await testDetail(env,auth,id));
}
async function createAction(request,env,auth,ncrId){
 const ncr=await env.DB.prepare("SELECT n.* FROM quality_nonconformances n WHERE n.id=?1 AND n.site_id=?2").bind(ncrId,auth.siteId).first();if(!ncr)throw new ApiError(404,"QUALITY_NCR_NOT_FOUND","부적합 기록을 찾을 수 없습니다.");
 const b=await parseJson(request),detail=clean(b.actionDetail,2000);if(!detail)throw new ApiError(400,"QUALITY_ACTION_DETAIL_REQUIRED","시정조치 내용을 입력해 주세요.");
 const id=crypto.randomUUID();await env.DB.batch([env.DB.prepare("INSERT INTO quality_corrective_actions(id,nonconformance_id,action_detail,assigned_user_id,created_by_user_id) VALUES(?1,?2,?3,?4,?5)").bind(id,ncrId,detail,clean(b.assignedUserId,80)||auth.userId,auth.userId),env.DB.prepare("UPDATE quality_nonconformances SET status='ACTION_IN_PROGRESS',revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?1").bind(ncrId),audit(env,auth.userId,"QUALITY_CORRECTIVE_ACTION_STARTED",request,{nonconformanceId:ncrId,actionId:id})]);return json(await dashboard(env,auth),201);
}
async function verifyAction(request,env,auth,ncrId){
 requireManage(auth);const ncr=await env.DB.prepare("SELECT n.*,a.id action_id FROM quality_nonconformances n JOIN quality_corrective_actions a ON a.nonconformance_id=n.id WHERE n.id=?1 AND n.site_id=?2 ORDER BY a.created_at DESC LIMIT 1").bind(ncrId,auth.siteId).first();if(!ncr)throw new ApiError(404,"QUALITY_NCR_NOT_FOUND","시정조치가 있는 부적합 기록을 찾을 수 없습니다.");
 const b=await parseJson(request),result=clean(b.resultDetail,2000),retest=clean(b.retestResult,20);if(!result)throw new ApiError(400,"QUALITY_ACTION_RESULT_REQUIRED","시정조치 결과를 입력해 주세요.");if(!["PASS","FAIL"].includes(retest))throw new ApiError(400,"QUALITY_RETEST_RESULT_REQUIRED","재시험 또는 확인 결과를 선택해 주세요.");
 const closed=retest==="PASS";await env.DB.batch([env.DB.prepare("UPDATE quality_corrective_actions SET result_detail=?2,retest_result=?3,status=?4,verified_by_user_id=?5,verified_at=CURRENT_TIMESTAMP,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?1").bind(ncr.action_id,result,retest,closed?"COMPLETED":"ACTION_IN_PROGRESS",auth.userId),env.DB.prepare("UPDATE quality_nonconformances SET status=?2,closed_by_user_id=CASE WHEN ?2='CLOSED' THEN ?3 ELSE NULL END,closed_at=CASE WHEN ?2='CLOSED' THEN CURRENT_TIMESTAMP ELSE NULL END,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?1").bind(ncrId,closed?"CLOSED":"RETEST_REQUIRED",auth.userId),audit(env,auth.userId,"QUALITY_CORRECTIVE_ACTION_VERIFIED",request,{nonconformanceId:ncrId,retestResult:retest})]);return json(await dashboard(env,auth));
}
async function createEquipment(request,env,auth){
 const b=await parseJson(request),name=clean(b.equipmentName,200),number=clean(b.managementNumber,120);if(!name||!number)throw new ApiError(400,"QUALITY_EQUIPMENT_REQUIRED","장비명과 관리번호를 입력해 주세요.");
 const id=crypto.randomUUID();try{await env.DB.batch([env.DB.prepare("INSERT INTO quality_test_equipment(id,site_id,equipment_name,management_number,manufacturer,model,note,created_by_user_id) VALUES(?1,?2,?3,?4,?5,?6,?7,?8)").bind(id,auth.siteId,name,number,clean(b.manufacturer,200)||null,clean(b.model,200)||null,clean(b.note,1000)||null,auth.userId),audit(env,auth.userId,"QUALITY_TEST_EQUIPMENT_CREATED",request,{equipmentId:id})])}catch{throw new ApiError(409,"QUALITY_EQUIPMENT_DUPLICATE","이미 등록된 시험장비 관리번호입니다.")}return json(await dashboard(env,auth),201);
}
async function createCalibration(request,env,auth,id){
 const equipment=await env.DB.prepare("SELECT 1 FROM quality_test_equipment WHERE id=?1 AND site_id=?2 AND is_active=1").bind(id,auth.siteId).first();if(!equipment)throw new ApiError(404,"QUALITY_EQUIPMENT_NOT_FOUND","시험장비를 찾을 수 없습니다.");
 const b=await parseJson(request),institution=clean(b.calibrationInstitution,200),date=clean(b.calibratedDate,10),expires=clean(b.expiresDate,10);if(!institution||!date||!expires)throw new ApiError(400,"QUALITY_CALIBRATION_REQUIRED","검교정 기관, 검교정일, 만료일을 입력해 주세요.");if(expires<date)throw new ApiError(400,"QUALITY_CALIBRATION_DATE_INVALID","검교정 만료일은 검교정일 이후로 입력해 주세요.");
 const status=expires<new Date().toISOString().slice(0,10)?"EXPIRED":"USABLE";await env.DB.batch([env.DB.prepare("INSERT INTO quality_calibration_records(id,equipment_id,calibration_institution,calibrated_date,expires_date,usable_status,exception_reason,created_by_user_id) VALUES(?1,?2,?3,?4,?5,?6,?7,?8)").bind(crypto.randomUUID(),id,institution,date,expires,status,clean(b.exceptionReason,1000)||null,auth.userId),audit(env,auth.userId,"QUALITY_CALIBRATION_RECORDED",request,{equipmentId:id,status})]);return json(await dashboard(env,auth),201);
}
async function content(request,env,auth,type,id){
 const row=type==="media"?await env.DB.prepare("SELECT original_key object_key,mime_type,original_name FROM quality_test_media WHERE id=?1 AND site_id=?2").bind(id,auth.siteId).first():await env.DB.prepare("SELECT original_key object_key,mime_type,original_name FROM quality_test_reports WHERE id=?1 AND site_id=?2").bind(id,auth.siteId).first();
 if(!row)throw new ApiError(404,"QUALITY_FILE_NOT_FOUND","품질 자료 파일을 찾을 수 없습니다.");const object=await env.FILES.get(row.object_key);if(!object)throw new ApiError(404,"QUALITY_FILE_OBJECT_MISSING","품질 자료 원본 파일을 찾을 수 없습니다.");const headers=new Headers({"cache-control":"private, max-age=300","content-security-policy":"default-src 'none'","x-content-type-options":"nosniff"});object.writeHttpMetadata(headers);if(!headers.has("content-type"))headers.set("content-type",row.mime_type);return new Response(object.body,{headers});
}
export async function handleQualityRequest(request,env,url=new URL(request.url)){
 const path=url.pathname,method=request.method;if(!path.startsWith("/api/v1/quality"))return null;
 if(["/api/v1/quality","/api/v1/quality/dashboard","/api/v1/quality/legal-obligations"].includes(path)&&method==="GET"){const auth=await authorize(request,env);return json(await dashboard(env,auth))}
 if(path==="/api/v1/quality/tests"&&method==="POST"){const auth=await authorize(request,env,{board:BOARD.tests,required:"EDIT",write:true});return createTest(request,env,auth)}
 const file=path.match(/^\/api\/v1\/quality\/(media|reports)\/([^/]+)\/content$/);if(file&&method==="GET"){const auth=await authorize(request,env);return content(request,env,auth,file[1],file[2])}
 const test=path.match(/^\/api\/v1\/quality\/tests\/([^/]+)(?:\/(result|photo|report|link-report|submit-review|revision|ready|csi-record))?$/);
 if(test){
  const auth=await authorize(request,env,{board:test[2]==="csi-record"?BOARD.csi:BOARD.tests,required:method==="GET"?"VIEW":["revision","ready"].includes(test[2])?"MANAGE":"EDIT",write:method!=="GET"});
  if(method==="GET"&&!test[2])return json(await testDetail(env,auth,test[1]));
  if(method==="PATCH"&&test[2]==="result")return saveResult(request,env,auth,test[1]);
  if(method==="POST"&&test[2]==="photo")return uploadTestMedia(request,env,auth,test[1]);
  if(method==="POST"&&test[2]==="report")return uploadReport(request,env,auth,test[1]);
  if(method==="POST"&&test[2]==="link-report")return linkReport(request,env,auth,test[1]);
  if(method==="POST"&&["submit-review","revision","ready","csi-record"].includes(test[2]))return transition(request,env,auth,test[1],test[2]);
 }
 const ncr=path.match(/^\/api\/v1\/quality\/nonconformances\/([^/]+)\/(action|verify)$/);if(ncr&&method==="POST"){const auth=await authorize(request,env,{board:BOARD.nonconformance,required:ncr[2]==="verify"?"MANAGE":"EDIT",write:true});return ncr[2]==="action"?createAction(request,env,auth,ncr[1]):verifyAction(request,env,auth,ncr[1])}
 if(path==="/api/v1/quality/equipment"&&method==="POST"){const auth=await authorize(request,env,{board:BOARD.calibration,required:"EDIT",write:true});return createEquipment(request,env,auth)}
 const calibration=path.match(/^\/api\/v1\/quality\/equipment\/([^/]+)\/calibrations$/);if(calibration&&method==="POST"){const auth=await authorize(request,env,{board:BOARD.calibration,required:"EDIT",write:true});return createCalibration(request,env,auth,calibration[1])}
 return null;
}

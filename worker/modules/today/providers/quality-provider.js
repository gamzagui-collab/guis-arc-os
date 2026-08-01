import {kstWorkDate} from "../today-policy.js";

export async function qualityProvider({env,ctx,scope}){
 const access=ctx.boardAccess?.QUALITY_CSI_PREPARATION?.accessLevel||ctx.boardAccess?.QUALITY_LEGAL_OBLIGATION?.accessLevel;
 if(!ctx.modules.includes("quality")||!access)return {code:"quality",label:"품질 업무",implementationStatus:"IMPLEMENTED",state:"NO_PERMISSION",message:"품질 업무를 볼 권한이 없습니다.",cards:[]};
 const today=kstWorkDate(),soon=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
 const [tests,ncr,calibration]=await env.DB.batch([
  env.DB.prepare("SELECT SUM(scheduled_date=?2 AND status='SCHEDULED') scheduled,SUM(status='COLLECTING') collecting,SUM(status IN ('TEST_COMPLETED','REVIEW_PENDING')) review,SUM(status='REVISION_REQUIRED') revision,SUM(status='READY_FOR_CSI') ready,SUM(status='READY_FOR_CSI') csi_pending FROM quality_test_inspections WHERE site_id=?1").bind(scope.siteId,today),
  env.DB.prepare("SELECT COUNT(*) open FROM quality_nonconformances WHERE site_id=?1 AND status NOT IN ('CLOSED','CANCELLED')").bind(scope.siteId),
  env.DB.prepare("SELECT COUNT(*) due FROM quality_test_equipment e WHERE e.site_id=?1 AND e.is_active=1 AND COALESCE((SELECT MAX(expires_date) FROM quality_calibration_records c WHERE c.equipment_id=e.id),'0000-00-00')<=?2").bind(scope.siteId,soon)
 ]);
 const t=tests.results[0]||{},n=ncr.results[0]||{},c=calibration.results[0]||{};
 return {code:"quality",label:"품질 업무",implementationStatus:"IMPLEMENTED",state:"LOADED",message:`오늘 예정 ${Number(t.scheduled||0)}건 · 검토 ${Number(t.review||0)}건 · CSI 입력 미완료 ${Number(t.csi_pending||0)}건`,href:"/quality",cards:[
  {code:"QUALITY_TODAY_TEST",label:"오늘 시험 예정",count:Number(t.scheduled||0),href:"/quality/tests",priority:"B"},
  {code:"QUALITY_REVIEW",label:"시험 완료·검토 대기",count:Number(t.review||0),href:"/quality/tests",priority:"A"},
  {code:"QUALITY_REVISION",label:"보완 필요",count:Number(t.revision||0),href:"/quality/csi-preparation",priority:"A"},
  {code:"QUALITY_CSI_READY",label:"CSI 입력 준비 완료",count:Number(t.ready||0),href:"/quality/csi-preparation",priority:"B"},
  {code:"QUALITY_CSI_PENDING",label:"CSI 입력 미완료",count:Number(t.csi_pending||0),href:"/quality/csi-preparation",priority:"A"},
  {code:"QUALITY_NCR_OPEN",label:"부적합 미종결",count:Number(n.open||0),href:"/quality/nonconformance",priority:"A"},
  {code:"QUALITY_CALIBRATION_DUE",label:"검교정 만료 임박",count:Number(c.due||0),href:"/quality/calibration",priority:"A"}
 ]};
}

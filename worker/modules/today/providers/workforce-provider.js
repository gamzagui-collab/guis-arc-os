import {kstDate} from "../../workforce.js";
export async function workforceProvider({env,ctx}){
 if(!ctx.selectedSiteId)return {code:"workforce",label:"현재 출역",implementationStatus:"IMPLEMENTED",state:"NO_PERMISSION",message:"선택된 현장이 없습니다.",summary:null};
 const access=ctx.boardAccess?.WORKFORCE_ATTENDANCE?.accessLevel||ctx.boardAccess?.WORKFORCE_DAILY_OUTPUT?.accessLevel;
 if(!ctx.modules.includes("workforce")||!access)return {code:"workforce",label:"현재 출역",implementationStatus:"IMPLEMENTED",state:"NO_PERMISSION",message:"출역 현황을 볼 권한이 없습니다.",summary:null};
 const date=kstDate(),[attendance,pending,companies,reports]=await env.DB.batch([
  env.DB.prepare("SELECT COUNT(*) total,MAX(check_in_at) latest FROM workforce_attendance WHERE site_id=?1 AND work_date=?2 AND cancelled_at IS NULL").bind(ctx.selectedSiteId,date),
  env.DB.prepare("SELECT COUNT(*) total FROM workforce_site_enrollments WHERE site_id=?1 AND approval_status='PENDING'").bind(ctx.selectedSiteId),
  env.DB.prepare("SELECT c.name,COUNT(*) total FROM workforce_attendance a JOIN companies c ON c.id=a.company_id WHERE a.site_id=?1 AND a.work_date=?2 AND a.cancelled_at IS NULL GROUP BY c.id,c.name ORDER BY total DESC").bind(ctx.selectedSiteId,date),
  env.DB.prepare("SELECT COUNT(*) reports,SUM(CASE WHEN attendance_count<>included_count THEN 1 ELSE 0 END) differences FROM (SELECT r.id,(SELECT COUNT(*) FROM workforce_attendance a WHERE a.site_id=r.site_id AND a.work_date=r.work_date_kst AND a.company_id=r.company_id AND a.trade_id=r.trade_id AND a.cancelled_at IS NULL AND (r.team_scope='' OR a.team_id=r.team_id)) attendance_count,(SELECT COUNT(*) FROM daily_output_report_workers rw WHERE rw.report_id=r.id AND rw.included=1) included_count FROM daily_output_reports r WHERE r.site_id=?1 AND r.work_date_kst=?2)").bind(ctx.selectedSiteId,date)
 ]),present=Number(attendance.results[0]?.total||0);
 return {code:"workforce",label:"현재 출역",implementationStatus:"IMPLEMENTED",state:"READY",message:`현재 출역 ${present}명 · 승인 대기 ${Number(pending.results[0]?.total||0)}명 · 출력일보 차이 ${Number(reports.results[0]?.differences||0)}건`,summary:{workDate:date,present,pending:Number(pending.results[0]?.total||0),latestCheckIn:attendance.results[0]?.latest||null,byCompany:companies.results,reports:Number(reports.results[0]?.reports||0),differences:Number(reports.results[0]?.differences||0)}};
}

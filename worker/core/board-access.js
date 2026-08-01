import {ApiError} from "./response.js";

export const BOARD_KEYS=Object.freeze({
 ISSUE:"ISSUE",
 WORKFORCE_PROFILE:"WORKFORCE_PROFILE",
 WORKFORCE_APPROVAL:"WORKFORCE_APPROVAL",
 WORKFORCE_ATTENDANCE:"WORKFORCE_ATTENDANCE",
 WORKFORCE_DAILY_OUTPUT:"WORKFORCE_DAILY_OUTPUT",
 CONSTRUCTION_DAILY_REPORT:"CONSTRUCTION_DAILY_REPORT",
 CONSTRUCTION_OUTPUT_STATUS:"CONSTRUCTION_OUTPUT_STATUS",
 CONSTRUCTION_INSPECTION:"CONSTRUCTION_INSPECTION",
 SAFETY_CASE:"SAFETY_CASE",
 SAFETY_RISK_ASSESSMENT:"SAFETY_RISK_ASSESSMENT",
 SAFETY_CORRECTIVE_ACTION:"SAFETY_CORRECTIVE_ACTION",
 SAFETY_ROOT_CAUSE:"SAFETY_ROOT_CAUSE",
 SAFETY_DASHBOARD:"SAFETY_DASHBOARD",
 SAFETY_PERIODIC_TASK:"SAFETY_PERIODIC_TASK",
 QUALITY_LEGAL_OBLIGATION:"QUALITY_LEGAL_OBLIGATION",
 QUALITY_CSI_PREPARATION:"QUALITY_CSI_PREPARATION",
 QUALITY_TEST_INSPECTION:"QUALITY_TEST_INSPECTION",
 QUALITY_NONCONFORMANCE:"QUALITY_NONCONFORMANCE",
 QUALITY_CALIBRATION:"QUALITY_CALIBRATION"
});
export const ACCESS_LEVELS=Object.freeze(["VIEW","EDIT","MANAGE"]);
const RANK=Object.freeze({VIEW:1,EDIT:2,MANAGE:3});

export const includesBoardAccess=(actual,required="VIEW")=>(RANK[actual]||0)>=(RANK[required]||0);

export async function boardAccessForUser(env,userId,siteId){
 const result=await env.DB.prepare(`SELECT b.board_key,g.access_level,b.contains_sensitive_data
 FROM board_access_grants g JOIN board_definitions b ON b.id=g.board_id
 WHERE g.user_id=?1 AND g.site_id=?2 AND g.is_active=1 AND b.is_active=1`).bind(userId,siteId).all();
 return Object.fromEntries(result.results.map(row=>[row.board_key,{accessLevel:row.access_level,containsSensitiveData:Boolean(row.contains_sensitive_data)}]));
}

export async function requireBoardAccess(env,{userId,siteId,boardKey,required="VIEW",requestId="board-access"}){
 const row=await env.DB.prepare(`SELECT g.access_level FROM board_access_grants g
 JOIN board_definitions b ON b.id=g.board_id
 WHERE g.user_id=?1 AND g.site_id=?2 AND b.board_key=?3 AND b.is_active=1 AND g.is_active=1`).bind(userId,siteId,boardKey).first();
 if(!row||!includesBoardAccess(row.access_level,required)){
  await env.DB.prepare("INSERT INTO audit_logs(id,actor_user_id,action,outcome,request_id,metadata_json) VALUES(?1,?2,'BOARD_ACCESS_DENIED','DENIED',?3,?4)")
   .bind(crypto.randomUUID(),userId,requestId,JSON.stringify({siteId,boardKey,required,actual:row?.access_level||"NONE"})).run();
  throw new ApiError(403,"BOARD_ACCESS_DENIED",`${boardKey} ${required} access is required.`);
 }
 return row.access_level;
}

export function workforceBoardKey(pathname){
 if(pathname.includes("/daily-output"))return BOARD_KEYS.WORKFORCE_DAILY_OUTPUT;
 if(pathname.includes("/enrollments"))return BOARD_KEYS.WORKFORCE_APPROVAL;
 if(pathname.includes("/profiles")||pathname.includes("/teams")||pathname.endsWith("/options"))return BOARD_KEYS.WORKFORCE_PROFILE;
 return BOARD_KEYS.WORKFORCE_ATTENDANCE;
}

import {ApiError,json,parseJson,requestId} from "../core/response.js";
import {authenticate,context} from "../core/session.js";
import {ACCESS_LEVELS,includesBoardAccess,requireBoardAccess} from "../core/board-access.js";
import {ROLE_DEFAULTS} from "../core/board-access-defaults.js";

const MASTER_ROLES=new Set(["PLATFORM_OWNER","INTEGRATED_OWNER"]);
const MANAGER_ROLES=new Set([...MASTER_ROLES,"SITE_MANAGER"]);
const LEVEL_RANK={NONE:0,VIEW:1,EDIT:2,MANAGE:3};
const PLANNED_MODULES=Object.freeze([
 {moduleKey:"safety",displayName:"안전 관리",state:"PLANNED"},
 {moduleKey:"quality",displayName:"품질 관리",state:"PLANNED"},
 {moduleKey:"materials",displayName:"자재 관리",state:"PLANNED"},
 {moduleKey:"equipment",displayName:"장비 관리",state:"PLANNED"},
 {moduleKey:"documents",displayName:"문서 관리",state:"PLANNED"}
]);
const audit=(env,actor,action,id,meta,outcome="ALLOWED")=>env.DB.prepare("INSERT INTO audit_logs(id,actor_user_id,action,outcome,request_id,metadata_json) VALUES(?1,?2,?3,?4,?5,?6)").bind(crypto.randomUUID(),actor,action,outcome,id,JSON.stringify(meta));
const rolesAt=async(env,userId,siteId)=>(await env.DB.prepare("SELECT DISTINCT r.code FROM user_site_roles usr JOIN roles r ON r.id=usr.role_id WHERE usr.user_id=?1 AND usr.site_id=?2 AND usr.status='ACTIVE'").bind(userId,siteId).all()).results.map(row=>row.code);

async function authorizeAdmin(request,env,{write=false,siteId=null}={}){
 const row=await authenticate(request,env,{csrf:write}),ctx=await context(env,row),activeSite=siteId||ctx.selectedSiteId;
 if(!activeSite)throw new ApiError(400,"SITE_CONTEXT_REQUIRED","현장을 선택해 주세요.");
 if(activeSite!==ctx.selectedSiteId)throw new ApiError(403,"BOARD_ACCESS_SITE_DENIED","현재 선택한 현장에서만 권한을 관리할 수 있습니다.");
 const actorRoles=await rolesAt(env,row.user_id,activeSite);
 if(!actorRoles.some(role=>MANAGER_ROLES.has(role)))throw new ApiError(403,"BOARD_ACCESS_ADMIN_DENIED","게시판 권한 관리 권한이 없습니다.");
 const membership=await env.DB.prepare("SELECT 1 allowed FROM memberships WHERE user_id=?1 AND site_id=?2 AND status='ACTIVE' AND approval_status='APPROVED'").bind(row.user_id,activeSite).first();
 if(!membership)throw new ApiError(403,"BOARD_ACCESS_SITE_DENIED","승인된 현장 가입이 필요합니다.");
 await requireBoardAccess(env,{userId:row.user_id,siteId:activeSite,boardKey:"ADMINISTRATION",required:"MANAGE",requestId:requestId(request)});
 if(write&&Number(request.headers.get("x-context-version"))!==ctx.contextVersion)throw new ApiError(409,"CONTEXT_VERSION_STALE","화면을 새로고침해 주세요.");
 return {row,ctx,siteId:activeSite,roles:actorRoles,master:actorRoles.some(role=>MASTER_ROLES.has(role))};
}

async function manageableBoards(env,auth){
 const result=await env.DB.prepare(`SELECT b.id,b.board_key,b.module_key,b.display_name,b.contains_sensitive_data,g.access_level actor_access_level
 FROM board_definitions b JOIN board_access_grants g ON g.board_id=b.id AND g.site_id=?1 AND g.user_id=?2 AND g.is_active=1
 WHERE b.is_active=1 AND g.access_level='MANAGE' ORDER BY CASE b.module_key WHEN 'issue' THEN 0 WHEN 'workforce' THEN 1 WHEN 'admin' THEN 2 ELSE 9 END,b.display_name`).bind(auth.siteId,auth.row.user_id).all();
 return result.results;
}

async function definitions(request,env,url){
 const auth=await authorizeAdmin(request,env,{siteId:url.searchParams.get("siteId")});
 return json({siteId:auth.siteId,boards:await manageableBoards(env,auth),plannedModules:PLANNED_MODULES,roleDefaults:ROLE_DEFAULTS});
}

const filterParams=url=>({
 companyType:url.searchParams.get("companyType")||null,
 companyId:url.searchParams.get("companyId")||null,
 roleCode:url.searchParams.get("roleCode")||null,
 accountStatus:url.searchParams.get("accountStatus")||null,
 approvalStatus:url.searchParams.get("approvalStatus")||null,
 q:String(url.searchParams.get("q")||"").trim().toLowerCase()
});

async function userRows(env,siteId,filters){
 const result=await env.DB.prepare(`SELECT u.id,u.display_name,u.status account_status,substr(replace(u.login_identifier,'-',''),-4) phone_last4,
 c.id company_id,c.name company_name,c.company_type,m.approval_status,m.status membership_status,
 GROUP_CONCAT(DISTINCT r.code) role_codes
 FROM memberships m JOIN users u ON u.id=m.user_id
 JOIN companies c ON c.id=m.company_id
 LEFT JOIN user_site_roles usr ON usr.user_id=u.id AND usr.site_id=m.site_id AND usr.status='ACTIVE'
 LEFT JOIN roles r ON r.id=usr.role_id
 WHERE m.site_id=?1 AND m.status='ACTIVE'
 AND (?2 IS NULL OR c.company_type=?2) AND (?3 IS NULL OR c.id=?3)
 AND (?4 IS NULL OR u.status=?4) AND (?5 IS NULL OR m.approval_status=?5)
 GROUP BY u.id,u.display_name,u.status,u.login_identifier,c.id,c.name,c.company_type,m.approval_status,m.status
 HAVING (?6 IS NULL OR instr(','||role_codes||',',','||?6||',')>0)
 AND (?7='' OR lower(u.display_name) LIKE '%'||?7||'%')
 ORDER BY CASE c.company_type WHEN 'GENERAL_CONTRACTOR' THEN 0 ELSE 1 END,c.name,
 CASE WHEN instr(role_codes,'SITE_MANAGER')>0 THEN 0 WHEN instr(role_codes,'MANAGER')>0 THEN 1 WHEN instr(role_codes,'FOREMAN')>0 THEN 2 ELSE 3 END,u.display_name`)
 .bind(siteId,filters.companyType,filters.companyId,filters.accountStatus,filters.approvalStatus,filters.roleCode,filters.q).all();
 return result.results;
}

async function grantMap(env,siteId,userIds,boardIds){
 if(!userIds.length||!boardIds.length)return {};
 const userMarks=userIds.map((_,i)=>`?${i+2}`).join(","),boardOffset=userIds.length+2,boardMarks=boardIds.map((_,i)=>`?${boardOffset+i}`).join(",");
 const query=env.DB.prepare(`SELECT g.user_id,b.board_key,g.access_level,g.revision FROM board_access_grants g JOIN board_definitions b ON b.id=g.board_id WHERE g.site_id=?1 AND g.user_id IN (${userMarks}) AND g.board_id IN (${boardMarks}) AND g.is_active=1`);
 const result=await query.bind(siteId,...userIds,...boardIds).all(),map={};
 for(const row of result.results)(map[row.user_id]??={})[row.board_key]={accessLevel:row.access_level,revision:Number(row.revision)};
 return map;
}

const permissionSummary=(boards,grants)=>boards.filter(board=>grants?.[board.board_key]?.accessLevel).map(board=>`${board.display_name} ${grants[board.board_key].accessLevel}`);

async function users(request,env,url,userId=null){
 const auth=await authorizeAdmin(request,env,{siteId:url.searchParams.get("siteId")}),boards=await manageableBoards(env,auth),filters=filterParams(url);
 const rows=await userRows(env,auth.siteId,filters),selected=userId?rows.filter(user=>user.id===userId):rows;
 if(userId&&!selected.length)throw new ApiError(404,"BOARD_ACCESS_USER_NOT_FOUND","현재 현장의 활성 사용자를 찾을 수 없습니다.");
 const grants=await grantMap(env,auth.siteId,selected.map(user=>user.id),boards.map(board=>board.id));
 const items=selected.map(user=>({...user,roleCodes:String(user.role_codes||"").split(",").filter(Boolean),permissions:grants[user.id]||{},permissionSummary:permissionSummary(boards,grants[user.id])}));
 const companyResult=await env.DB.prepare(`SELECT c.id,c.name,c.company_type companyType,COUNT(DISTINCT m.user_id) userCount
 FROM memberships m JOIN users u ON u.id=m.user_id AND u.status='ACTIVE' JOIN companies c ON c.id=m.company_id
 WHERE m.site_id=?1 AND m.status='ACTIVE' GROUP BY c.id,c.name,c.company_type
 ORDER BY CASE c.company_type WHEN 'GENERAL_CONTRACTOR' THEN 0 ELSE 1 END,c.name`).bind(auth.siteId).all();
 const roleResult=await env.DB.prepare(`SELECT DISTINCT r.code FROM user_site_roles usr JOIN roles r ON r.id=usr.role_id
 WHERE usr.site_id=?1 AND usr.status='ACTIVE' ORDER BY r.rank DESC,r.name`).bind(auth.siteId).all();
 return json({siteId:auth.siteId,boards,plannedModules:PLANNED_MODULES,companies:companyResult.results,roles:roleResult.results.map(row=>row.code),items});
}

async function assertTargets(env,auth,userIds){
 if(!userIds.length||userIds.length>200)throw new ApiError(400,"BOARD_ACCESS_TARGETS_INVALID","1명 이상 200명 이하의 사용자를 선택해 주세요.");
 const marks=userIds.map((_,i)=>`?${i+2}`).join(","),result=await env.DB.prepare(`SELECT m.user_id,u.status,m.approval_status FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.site_id=?1 AND m.user_id IN (${marks}) AND m.status='ACTIVE'`).bind(auth.siteId,...userIds).all();
 if(result.results.length!==new Set(userIds).size||result.results.some(row=>row.status!=="ACTIVE"||row.approval_status!=="APPROVED"))throw new ApiError(403,"BOARD_ACCESS_TARGET_DENIED","대상은 현재 현장의 승인된 활성 사용자여야 합니다.");
}

async function planChanges(env,auth,userIds,permissions,revisions,method){
 const boards=await manageableBoards(env,auth),boardByKey=new Map(boards.map(board=>[board.board_key,board])),keys=Object.keys(permissions);
 if(!keys.length)throw new ApiError(400,"BOARD_ACCESS_CHANGES_REQUIRED","변경할 게시판 권한을 선택해 주세요.");
 if(keys.some(key=>!boardByKey.has(key)))throw new ApiError(403,"BOARD_ACCESS_BOARD_DENIED","관리할 수 없는 게시판이 포함되어 있습니다.");
 await assertTargets(env,auth,userIds);
 const roleMap={};for(const userId of userIds)roleMap[userId]=await rolesAt(env,userId,auth.siteId);
 const current=await grantMap(env,auth.siteId,userIds,keys.map(key=>boardByKey.get(key).id)),changes=[];
 for(const userId of userIds)for(const boardKey of keys){
  const next=String(permissions[boardKey]||"NONE"),before=current[userId]?.[boardKey]||{accessLevel:"NONE",revision:0};
  if(next!=="NONE"&&!ACCESS_LEVELS.includes(next))throw new ApiError(400,"BOARD_ACCESS_LEVEL_INVALID","유효하지 않은 권한입니다.");
  if(next==="MANAGE"&&!roleMap[userId].some(role=>MANAGER_ROLES.has(role)))throw new ApiError(403,"BOARD_ACCESS_MANAGER_TARGET_DENIED","관리 권한은 마스터와 현장소장에게만 부여할 수 있습니다.");
  const expected=Number(revisions?.[userId]?.[boardKey]??before.revision);
  if(expected!==before.revision)throw new ApiError(409,"BOARD_ACCESS_REVISION_STALE","다른 관리자가 권한을 변경했습니다. 새로고침해 주세요.");
  if(next!==before.accessLevel)changes.push({userId,boardKey,boardId:boardByKey.get(boardKey).id,previousAccess:before.accessLevel,newAccess:next,revision:before.revision,method});
 }
 return {boards,changes};
}

async function commitChanges(env,auth,changes,id,summary=null){
 const statements=[];
 for(const change of changes){
  if(change.revision)statements.push(env.DB.prepare("UPDATE board_access_grants SET is_active=0,revoked_by_user_id=?2,revoked_at=CURRENT_TIMESTAMP,revision=revision+1 WHERE site_id=?1 AND board_id=?3 AND user_id=?4 AND is_active=1 AND revision=?5").bind(auth.siteId,auth.row.user_id,change.boardId,change.userId,change.revision));
  if(change.newAccess!=="NONE")statements.push(env.DB.prepare("INSERT INTO board_access_grants(id,site_id,board_id,user_id,access_level,granted_by_user_id,revision) VALUES(?1,?2,?3,?4,?5,?6,1)").bind(crypto.randomUUID(),auth.siteId,change.boardId,change.userId,change.newAccess,auth.row.user_id));
  statements.push(audit(env,auth.row.user_id,"BOARD_ACCESS_CHANGED",id,{siteId:auth.siteId,targetUserId:change.userId,boardKey:change.boardKey,previousAccess:change.previousAccess,newAccess:change.newAccess,method:change.method}));
 }
 const affected=[...new Set(changes.map(change=>change.userId))];
 for(const userId of affected){
  statements.push(env.DB.prepare("UPDATE users SET context_version=context_version+1 WHERE id=?1").bind(userId));
  statements.push(env.DB.prepare("UPDATE sessions SET context_version=context_version+1 WHERE user_id=?1 AND revoked_at IS NULL").bind(userId));
 }
 if(summary)statements.push(audit(env,auth.row.user_id,summary.action,id,{siteId:auth.siteId,targetUserIds:affected,...summary.metadata}));
 if(statements.length)await env.DB.batch(statements);
 return {changed:changes.length,affectedUsers:affected.length};
}

async function batch(request,env){
 const body=await parseJson(request),auth=await authorizeAdmin(request,env,{write:true,siteId:String(body.siteId||"")}),userIds=[...new Set((body.userIds||[]).map(String))];
 try{
  const plan=await planChanges(env,auth,userIds,body.permissions||{},body.revisions||{},"BATCH");
  return json({ok:true,...await commitChanges(env,auth,plan.changes,requestId(request))});
 }catch(error){
  await audit(env,auth.row.user_id,"BOARD_ACCESS_BATCH_FAILED",requestId(request),{siteId:auth.siteId,targetCount:userIds.length,error:error.code||"INVALID"},"DENIED").run();
  throw error;
 }
}

async function copy(request,env){
 const body=await parseJson(request),auth=await authorizeAdmin(request,env,{write:!body.dryRun,siteId:String(body.siteId||"")}),sourceUserId=String(body.sourceUserId||""),targetUserIds=[...new Set((body.targetUserIds||[]).map(String))],mode=String(body.mode||"REPLACE_ALL");
 if(!["REPLACE_ALL","REPLACE_SELECTED","ADD_ONLY"].includes(mode)||targetUserIds.includes(sourceUserId))throw new ApiError(400,"BOARD_ACCESS_COPY_INVALID","권한 복사 요청이 올바르지 않습니다.");
 await assertTargets(env,auth,[sourceUserId,...targetUserIds]);
 const boards=await manageableBoards(env,auth),selectedKeys=mode==="REPLACE_SELECTED"?(body.boardKeys||[]).map(String):boards.map(board=>board.board_key),source=await grantMap(env,auth.siteId,[sourceUserId],boards.map(board=>board.id)),target=await grantMap(env,auth.siteId,targetUserIds,boards.map(board=>board.id)),permissionsByTarget={},comparisons=[];
 for(const targetUserId of targetUserIds){
  const permissions={};
  for(const boardKey of selectedKeys){
   const sourceLevel=source[sourceUserId]?.[boardKey]?.accessLevel||"NONE",targetLevel=target[targetUserId]?.[boardKey]?.accessLevel||"NONE";
   const next=mode==="ADD_ONLY"?(LEVEL_RANK[sourceLevel]>LEVEL_RANK[targetLevel]?sourceLevel:targetLevel):sourceLevel;
   permissions[boardKey]=next;if(next!==targetLevel)comparisons.push({targetUserId,boardKey,previousAccess:targetLevel,newAccess:next});
  }
  permissionsByTarget[targetUserId]=permissions;
 }
 if(body.dryRun)return json({ok:true,dryRun:true,comparisons,changed:comparisons.length});
 const allChanges=[];
 for(const targetUserId of targetUserIds){const plan=await planChanges(env,auth,[targetUserId],permissionsByTarget[targetUserId],body.revisions||{},"COPY");allChanges.push(...plan.changes)}
 return json({ok:true,...await commitChanges(env,auth,allChanges,requestId(request),{action:"BOARD_ACCESS_COPIED",metadata:{sourceUserId,mode,boardKeys:selectedKeys}})});
}

async function applyDefault(request,env){
 const body=await parseJson(request),auth=await authorizeAdmin(request,env,{write:true,siteId:String(body.siteId||"")}),roleCode=String(body.roleCode||""),userIds=[...new Set((body.userIds||[]).map(String))],defaults=ROLE_DEFAULTS[roleCode];
 if(defaults===undefined)throw new ApiError(400,"BOARD_ACCESS_DEFAULT_ROLE_INVALID","지원하지 않는 역할입니다.");
 for(const userId of userIds)if(!(await rolesAt(env,userId,auth.siteId)).includes(roleCode))throw new ApiError(403,"BOARD_ACCESS_DEFAULT_TARGET_DENIED","선택한 역할의 사용자에게만 기본 권한을 적용할 수 있습니다.");
 const boards=await manageableBoards(env,auth),permissions=Object.fromEntries(boards.map(board=>[board.board_key,defaults[board.board_key]||"NONE"])),plan=await planChanges(env,auth,userIds,permissions,body.revisions||{},"ROLE_DEFAULT");
 return json({ok:true,...await commitChanges(env,auth,plan.changes,requestId(request),{action:"BOARD_ROLE_DEFAULT_APPLIED",metadata:{roleCode}})});
}

async function legacyDetail(request,env,url,boardKey){
 const auth=await authorizeAdmin(request,env,{siteId:url.searchParams.get("siteId")}),boards=await manageableBoards(env,auth),board=boards.find(item=>item.board_key===boardKey);
 if(!board)throw new ApiError(404,"BOARD_NOT_FOUND","관리할 수 있는 게시판을 찾을 수 없습니다.");
 const rows=await userRows(env,auth.siteId,filterParams(url)),grants=await grantMap(env,auth.siteId,rows.map(user=>user.id),[board.id]);
 return json({siteId:auth.siteId,board:{...board,contains_sensitive_data:Boolean(board.contains_sensitive_data)},users:rows.map(user=>({...user,access_level:grants[user.id]?.[boardKey]?.accessLevel||"NONE",revision:grants[user.id]?.[boardKey]?.revision||0,canManage:String(user.role_codes||"").split(",").some(role=>MANAGER_ROLES.has(role))}))});
}

async function legacyBatch(request,env,boardKey,bodyOverride=null){
 const body=bodyOverride||await parseJson(request),auth=await authorizeAdmin(request,env,{write:true,siteId:String(body.siteId||"")}),changes=Array.isArray(body.changes)?body.changes:[];
 if(!changes.length)throw new ApiError(400,"BOARD_ACCESS_CHANGES_REQUIRED","변경할 사용자를 선택해 주세요.");
 const planned=[];
 for(const change of changes){
  const userId=String(change.userId||""),plan=await planChanges(env,auth,[userId],{[boardKey]:String(change.accessLevel||"NONE")},{[userId]:{[boardKey]:Number(change.revision||0)}},"LEGACY_BATCH");
  planned.push(...plan.changes);
 }
 return json({ok:true,...await commitChanges(env,auth,planned,requestId(request))});
}

export async function handleBoardAccessAdminRequest(request,env,url){
 if(!url.pathname.startsWith("/api/v1/admin/board-access"))return null;
 const method=request.method,path=url.pathname;
 if(method==="GET"&&path==="/api/v1/admin/board-access")return definitions(request,env,url);
 if(method==="GET"&&path==="/api/v1/admin/board-access/users")return users(request,env,url);
 const userMatch=path.match(/^\/api\/v1\/admin\/board-access\/users\/([^/]+)$/);
 if(method==="GET"&&userMatch)return users(request,env,url,userMatch[1]);
 if(method==="POST"&&path==="/api/v1/admin/board-access/batch")return batch(request,env);
 if(method==="POST"&&path==="/api/v1/admin/board-access/copy")return copy(request,env);
 if(method==="POST"&&path==="/api/v1/admin/board-access/apply-default")return applyDefault(request,env);
 const legacyBatchMatch=path.match(/^\/api\/v1\/admin\/board-access\/([A-Z_]+)\/batch$/);
 if(method==="POST"&&legacyBatchMatch)return legacyBatch(request,env,legacyBatchMatch[1]);
 const legacyUserMatch=path.match(/^\/api\/v1\/admin\/board-access\/([A-Z_]+)\/users\/([^/]+)$/);
 if(legacyUserMatch&&["PUT","DELETE"].includes(method)){const body=await parseJson(request);return legacyBatch(request,env,legacyUserMatch[1],{siteId:body.siteId,changes:[{userId:legacyUserMatch[2],accessLevel:method==="DELETE"?"NONE":body.accessLevel,revision:body.revision}]})}
 const legacyDetailMatch=path.match(/^\/api\/v1\/admin\/board-access\/([A-Z_]+)$/);
 if(method==="GET"&&legacyDetailMatch)return legacyDetail(request,env,url,legacyDetailMatch[1]);
 return null;
}

import {ApiError,json,parseJson,requestId} from "../core/response.js";
import {authenticate,context} from "../core/session.js";
import {deriveCredential,randomToken,sha256} from "../core/security.js";
import {requireBoardAccess} from "../core/board-access.js";
import {pinValidationError} from "../core/pin-policy.js";

const MASTER=new Set(["PLATFORM_OWNER","INTEGRATED_OWNER"]),MANAGERS=new Set([...MASTER,"SITE_MANAGER"]);
const COMPANY_TYPES=new Set(["GENERAL_CONTRACTOR","SUBCONTRACTOR"]);
const ROLE_COMPATIBILITY={
 GENERAL_CONTRACTOR:new Set(["GENERAL_CONTRACTOR_STAFF","GENERAL_CONTRACTOR_FOREMAN","CONSTRUCTION_MANAGER","SAFETY_MANAGER","QUALITY_MANAGER","MATERIALS_MANAGER","EQUIPMENT_MANAGER","FIELD_WORKER","SITE_MANAGER"]),
 SUBCONTRACTOR:new Set(["CONTRACTOR_MANAGER","CONTRACTOR_SITE_MANAGER","CONTRACTOR_FOREMAN","CONTRACTOR_EMPLOYEE","CONTRACTOR_ASSIGNEE","FIELD_WORKER"])
};
const DEFAULT_BOARD_ACCESS={INTEGRATED_OWNER:{ISSUE:"MANAGE",WORKFORCE_PROFILE:"MANAGE",WORKFORCE_ATTENDANCE:"MANAGE",WORKFORCE_DAILY_OUTPUT:"MANAGE",ADMINISTRATION:"MANAGE"},PLATFORM_OWNER:{ISSUE:"MANAGE",WORKFORCE_PROFILE:"MANAGE",WORKFORCE_ATTENDANCE:"MANAGE",WORKFORCE_DAILY_OUTPUT:"MANAGE",ADMINISTRATION:"MANAGE"},SITE_MANAGER:{ISSUE:"MANAGE",WORKFORCE_PROFILE:"MANAGE",WORKFORCE_ATTENDANCE:"MANAGE",WORKFORCE_DAILY_OUTPUT:"MANAGE",ADMINISTRATION:"MANAGE"},GENERAL_CONTRACTOR_FOREMAN:{ISSUE:"EDIT",WORKFORCE_ATTENDANCE:"VIEW"},CONTRACTOR_MANAGER:{ISSUE:"EDIT",WORKFORCE_ATTENDANCE:"VIEW",WORKFORCE_DAILY_OUTPUT:"EDIT"}};
const audit=(env,actor,action,id,meta)=>env.DB.prepare("INSERT INTO audit_logs(id,actor_user_id,action,outcome,request_id,metadata_json) VALUES(?1,?2,?3,'ALLOWED',?4,?5)").bind(crypto.randomUUID(),actor,action,id,JSON.stringify(meta));
const defaultBoardGrantStatements=(env,userId,siteId,roleCode="SITE_MANAGER")=>Object.entries(DEFAULT_BOARD_ACCESS[roleCode]||{}).map(([boardKey,accessLevel])=>env.DB.prepare("INSERT OR IGNORE INTO board_access_grants(id,site_id,board_id,user_id,access_level,granted_by_user_id) SELECT ?1,?2,id,?3,?4,?3 FROM board_definitions WHERE board_key=?5 AND is_active=1").bind(crypto.randomUUID(),siteId,userId,accessLevel,boardKey));
const safetyGrantStatements=(env,userId,siteId)=>[
 env.DB.prepare(`INSERT OR IGNORE INTO board_access_grants(id,site_id,board_id,user_id,access_level,granted_by_user_id)
 SELECT lower(hex(randomblob(16))),?2,b.id,?1,
 CASE WHEN r.code IN ('PLATFORM_OWNER','INTEGRATED_OWNER','SITE_MANAGER','SAFETY_MANAGER') THEN 'MANAGE'
 WHEN r.code IN ('CONSTRUCTION_MANAGER','GENERAL_CONTRACTOR_FOREMAN') THEN CASE WHEN b.board_key IN ('SAFETY_CASE','SAFETY_CORRECTIVE_ACTION') THEN 'EDIT' ELSE 'VIEW' END
 WHEN r.code IN ('CONTRACTOR_MANAGER','CONTRACTOR_SITE_MANAGER','CONTRACTOR_FOREMAN') THEN CASE WHEN b.board_key IN ('SAFETY_CASE','SAFETY_CORRECTIVE_ACTION','SAFETY_PERIODIC_TASK') THEN 'EDIT' ELSE 'VIEW' END ELSE 'VIEW' END,?1
 FROM user_site_roles usr JOIN roles r ON r.id=usr.role_id JOIN board_definitions b ON b.board_key IN ('SAFETY_CASE','SAFETY_RISK_ASSESSMENT','SAFETY_CORRECTIVE_ACTION','SAFETY_ROOT_CAUSE','SAFETY_DASHBOARD','SAFETY_PERIODIC_TASK')
 WHERE usr.user_id=?1 AND usr.site_id=?2 AND usr.status='ACTIVE' AND r.code IN ('PLATFORM_OWNER','INTEGRATED_OWNER','SITE_MANAGER','SAFETY_MANAGER','CONSTRUCTION_MANAGER','GENERAL_CONTRACTOR_FOREMAN','CONTRACTOR_MANAGER','CONTRACTOR_SITE_MANAGER','CONTRACTOR_FOREMAN')`).bind(userId,siteId),
 env.DB.prepare("INSERT OR IGNORE INTO module_entitlements(id,user_id,module_code,status) SELECT lower(hex(randomblob(16))),?1,'safety','ACTIVE' WHERE EXISTS(SELECT 1 FROM board_access_grants g JOIN board_definitions b ON b.id=g.board_id WHERE g.user_id=?1 AND g.site_id=?2 AND g.is_active=1 AND b.module_key='safety')").bind(userId,siteId)
];
const rolesAt=async(env,userId,siteId)=>(await env.DB.prepare("SELECT DISTINCT r.code FROM user_site_roles usr JOIN roles r ON r.id=usr.role_id WHERE usr.user_id=?1 AND usr.status='ACTIVE' AND (usr.site_id=?2 OR usr.site_id IS NULL)").bind(userId,siteId).all()).results.map(row=>row.code);
const clean=(value,max=120)=>{const text=String(value||"").trim();if(!text||text.length>max)throw new ApiError(400,"ADMIN_INPUT_INVALID","필수 입력값을 확인해 주세요.");return text};
const phone=value=>String(value||"").replace(/\D/g,"").slice(0,11);
const mask=value=>{const text=phone(value);return text.length===11?`${text.slice(0,3)}-****-${text.slice(-4)}`:text};
const business=value=>String(value||"").replace(/\D/g,"").slice(0,10);
const companyError=(code,message,field,details)=>new ApiError(400,code,message,{field,details});
export function validateCompanyCreateInput(body={}){
 const name=String(body.name??"").trim();
 if(!name)throw companyError("COMPANY_NAME_REQUIRED","회사명을 입력해 주세요.","name");
 if(name.length>120)throw companyError("COMPANY_NAME_TOO_LONG","회사명은 120자 이하로 입력해 주세요.","name",{maxLength:120,actualLength:name.length});
 const companyType=String(body.companyType??"").trim();
 if(!companyType)throw companyError("COMPANY_TYPE_REQUIRED","회사 유형을 선택해 주세요.","companyType");
 if(!COMPANY_TYPES.has(companyType))throw companyError("COMPANY_TYPE_INVALID","선택한 회사 유형이 올바르지 않습니다.","companyType");
 const registration=String(body.businessRegistrationNumber??"").trim();
 if(!registration)throw companyError("BUSINESS_NUMBER_REQUIRED","사업자등록번호를 입력해 주세요.","businessRegistrationNumber");
 if(!/^\d+$/.test(registration))throw companyError("BUSINESS_NUMBER_INVALID_FORMAT","사업자등록번호에는 숫자만 입력할 수 있습니다.","businessRegistrationNumber");
 if(registration.length!==10)throw companyError("BUSINESS_NUMBER_INVALID_LENGTH","사업자등록번호는 숫자 10자리로 입력해 주세요.","businessRegistrationNumber",{requiredLength:10,actualLength:registration.length});
 const tradeIds=[...new Set((Array.isArray(body.tradeIds)?body.tradeIds:[]).map(String).filter(Boolean))];
 if(!tradeIds.length)throw companyError("COMPANY_TRADES_REQUIRED","표준 공종을 하나 이상 선택해 주세요.","tradeIds");
 return {name,companyType,registration,tradeIds};
}

async function authorize(request,env,{write=false,siteId=null,masterOnly=false}={}){
 const row=await authenticate(request,env,{csrf:write}),ctx=await context(env,row),activeSite=siteId||ctx.selectedSiteId;
 if(!activeSite)throw new ApiError(400,"SITE_CONTEXT_REQUIRED","현장을 선택해 주세요.");
 if(write&&Number(request.headers.get("x-context-version"))!==ctx.contextVersion)throw new ApiError(409,"CONTEXT_VERSION_STALE","화면을 새로고침해 주세요.");
 const membership=await env.DB.prepare("SELECT 1 allowed FROM memberships WHERE user_id=?1 AND site_id=?2 AND status='ACTIVE'").bind(row.user_id,activeSite).first();
 if(!membership)throw new ApiError(403,"ADMIN_SITE_SCOPE_DENIED","활성 현장 가입이 필요합니다.");
 const roles=await rolesAt(env,row.user_id,activeSite),master=roles.some(role=>MASTER.has(role));
 if(!roles.some(role=>MANAGERS.has(role))||masterOnly&&!master)throw new ApiError(403,"ADMIN_PERMISSION_DENIED","관리 권한이 필요합니다.");
 if(!master&&activeSite!==ctx.selectedSiteId)throw new ApiError(403,"ADMIN_SITE_SCOPE_DENIED","현재 현장만 관리할 수 있습니다.");
 await requireBoardAccess(env,{userId:row.user_id,siteId:activeSite,boardKey:"ADMINISTRATION",required:"MANAGE",requestId:requestId(request)});
 return {row,ctx,siteId:activeSite,roles,master};
}
async function createSite(request,env){
 const body=await parseJson(request),auth=await authorize(request,env,{write:true,masterOnly:true}),companyId=String(body.companyId||"").trim(),siteName=String(body.siteName||"").trim().replace(/\s+/g," ");
 if(!companyId)throw new ApiError(400,"SITE_COMPANY_REQUIRED","회사를 선택해 주세요.");
 if(!siteName)throw new ApiError(400,"SITE_NAME_REQUIRED","현장명을 입력해 주세요.");
 if(siteName.length>120)throw new ApiError(400,"SITE_NAME_TOO_LONG","현장명은 120자 이하로 입력해 주세요.");
 const company=await env.DB.prepare("SELECT c.id FROM companies c JOIN memberships m ON m.company_id=c.id WHERE c.id=?1 AND c.status='ACTIVE' AND m.user_id=?2 AND m.site_id=?3 AND m.status='ACTIVE' AND m.approval_status='APPROVED'").bind(companyId,auth.row.user_id,auth.siteId).first();
 if(!company)throw new ApiError(404,"SITE_COMPANY_NOT_FOUND","연결 가능한 회사를 찾을 수 없습니다.");
 const duplicate=await env.DB.prepare("SELECT 1 found FROM sites WHERE company_id=?1 AND lower(trim(name))=lower(?2) AND status='ACTIVE' LIMIT 1").bind(companyId,siteName).first();
 if(duplicate)throw new ApiError(409,"SITE_NAME_DUPLICATE","같은 회사에 동일한 현장명이 있습니다.");
 const role=await env.DB.prepare("SELECT id FROM roles WHERE code='SITE_MANAGER'").first();
 if(!role)throw new ApiError(500,"SITE_ROLE_UNAVAILABLE","현장 관리자 역할을 찾을 수 없습니다.");
 const siteId=crypto.randomUUID(),statements=[env.DB.prepare("INSERT INTO sites(id,company_id,name,status) VALUES(?1,?2,?3,'ACTIVE')").bind(siteId,companyId,siteName),env.DB.prepare("INSERT INTO memberships(id,user_id,company_id,site_id,status,approval_status) VALUES(?1,?2,?3,?4,'ACTIVE','APPROVED') ON CONFLICT(user_id,company_id,site_id) DO UPDATE SET status='ACTIVE',approval_status='APPROVED'").bind(crypto.randomUUID(),auth.row.user_id,companyId,siteId),env.DB.prepare("INSERT INTO user_site_roles(id,user_id,role_id,company_id,site_id,status) VALUES(?1,?2,?3,?4,?5,'ACTIVE')").bind(crypto.randomUUID(),auth.row.user_id,role.id,companyId,siteId),...defaultBoardGrantStatements(env,auth.row.user_id,siteId),env.DB.prepare("UPDATE users SET context_version=context_version+1 WHERE id=?1").bind(auth.row.user_id),env.DB.prepare("UPDATE sessions SET context_version=context_version+1 WHERE user_id=?1 AND revoked_at IS NULL").bind(auth.row.user_id),audit(env,auth.row.user_id,"SITE_CREATED",requestId(request),{siteId,companyId,siteName,roleCode:"SITE_MANAGER"})];
 await env.DB.batch(statements);return json({site:{id:siteId,companyId,name:siteName},contextVersion:auth.ctx.contextVersion+1},201);
}
async function tradeOptions(request,env,url){
 const includeInactive=url.searchParams.get("all")==="1";await authorize(request,env,{masterOnly:includeInactive});
 const rows=await env.DB.prepare(`SELECT tm.id trade_id,tm.trade_key,tm.display_name,tm.short_name,tm.description,tm.status,tm.sort_order,tm.is_selectable,
 tg.id group_id,tg.group_key,tg.display_name group_name,tc.id category_id,tc.category_key,tc.display_name category_name
 FROM trade_master tm JOIN trade_groups tg ON tg.id=tm.group_id JOIN trade_categories tc ON tc.id=tg.category_id
 WHERE (?1=1 OR (tm.status='ACTIVE' AND tm.is_selectable=1 AND tg.is_active=1 AND tc.is_active=1))
 ORDER BY tc.sort_order,tg.sort_order,tm.sort_order,tm.display_name`).bind(includeInactive?1:0).all();
 const categories=[];for(const row of rows.results){let category=categories.find(value=>value.id===row.category_id);if(!category){category={id:row.category_id,key:row.category_key,name:row.category_name,groups:[]};categories.push(category)}let group=category.groups.find(value=>value.id===row.group_id);if(!group){group={id:row.group_id,key:row.group_key,name:row.group_name,trades:[]};category.groups.push(group)}group.trades.push({id:row.trade_id,tradeId:row.trade_id,tradeKey:row.trade_key,displayName:row.display_name,path:`${row.category_name} · ${row.group_name}`,status:row.status,description:row.description||"",sortOrder:Number(row.sort_order)})}
 return json({items:rows.results,categories,count:rows.results.length});
}
async function manageTrade(request,env,id){
 const body=await parseJson(request),auth=await authorize(request,env,{write:true,masterOnly:true}),before=id?await env.DB.prepare("SELECT tm.*,tg.display_name group_name,tc.display_name category_name FROM trade_master tm JOIN trade_groups tg ON tg.id=tm.group_id JOIN trade_categories tc ON tc.id=tg.category_id WHERE tm.id=?1").bind(id).first():null;
 if(id&&!before)throw new ApiError(404,"TRADE_NOT_FOUND","공종을 찾을 수 없습니다.");
 const displayName=clean(body.displayName,id?120:120),description=String(body.description||"").trim().slice(0,500),status=body.status==null?(before?.status||"ACTIVE"):String(body.status),sortOrder=Number(body.sortOrder??before?.sort_order??1000);
 if(!["ACTIVE","INACTIVE"].includes(status)||!Number.isInteger(sortOrder))throw new ApiError(400,"TRADE_INPUT_INVALID","공종 입력값을 확인해 주세요.");
 if(id){await env.DB.batch([env.DB.prepare("UPDATE trade_master SET display_name=?2,short_name=?2,description=?3,status=?4,sort_order=?5,updated_at=CURRENT_TIMESTAMP WHERE id=?1").bind(id,displayName,description,status,sortOrder),audit(env,auth.row.user_id,status!==before.status?(status==="ACTIVE"?"TRADE_ACTIVATED":"TRADE_DEACTIVATED"):"TRADE_UPDATED",requestId(request),{tradeId:id,path:`${before.category_name} · ${before.group_name} · ${before.display_name}`,before:{displayName:before.display_name,description:before.description,status:before.status,sortOrder:before.sort_order},after:{displayName,description,status,sortOrder}})]);return json({ok:true})}
 const groupId=clean(body.groupId),group=await env.DB.prepare("SELECT tg.group_key,tg.display_name group_name,tc.display_name category_name FROM trade_groups tg JOIN trade_categories tc ON tc.id=tg.category_id WHERE tg.id=?1 AND tg.is_active=1 AND tc.is_active=1").bind(groupId).first();if(!group)throw new ApiError(400,"TRADE_GROUP_INVALID","중분류를 다시 선택해 주세요.");
 const tradeKey=clean(body.tradeKey,100).toUpperCase();if(!/^[A-Z][A-Z0-9_]+$/.test(tradeKey))throw new ApiError(400,"TRADE_KEY_INVALID","공종 키는 영문 대문자와 숫자, 밑줄만 사용할 수 있습니다.");
 const tradeId=crypto.randomUUID();try{await env.DB.batch([env.DB.prepare("INSERT INTO trade_master(id,trade_key,display_name,parent_category,status,sort_order,group_id,short_name,description,is_selectable) VALUES(?1,?2,?3,?4,'ACTIVE',?5,?6,?3,?7,1)").bind(tradeId,tradeKey,displayName,group.category_name,sortOrder,groupId,description),audit(env,auth.row.user_id,"TRADE_CREATED",requestId(request),{tradeId,path:`${group.category_name} · ${group.group_name} · ${displayName}`,tradeKey})])}catch(error){if(String(error).includes("UNIQUE"))throw new ApiError(409,"TRADE_KEY_DUPLICATE","이미 사용 중인 공종 키입니다.");throw error}return json({ok:true,tradeId},201);
}
async function updateCompanyTrades(request,env,companyId){
 const body=await parseJson(request),auth=await authorize(request,env,{write:true}),tradeIds=[...new Set((body.tradeIds||[]).map(String))],company=await env.DB.prepare("SELECT id FROM companies WHERE id=?1").bind(companyId).first();if(!company)throw new ApiError(404,"COMPANY_NOT_FOUND","회사를 찾을 수 없습니다.");if(!tradeIds.length)throw companyError("COMPANY_TRADES_REQUIRED","표준 공종을 하나 이상 선택해 주세요.","tradeIds");
 const valid=await env.DB.prepare(`SELECT COUNT(*) count FROM trade_master tm JOIN trade_groups tg ON tg.id=tm.group_id JOIN trade_categories tc ON tc.id=tg.category_id WHERE tm.id IN (${tradeIds.map((_,i)=>`?${i+1}`).join(",")}) AND tm.status='ACTIVE' AND tm.is_selectable=1 AND tg.is_active=1 AND tc.is_active=1`).bind(...tradeIds).first();if(Number(valid.count)!==tradeIds.length)throw companyError("COMPANY_TRADE_INVALID","선택한 공종 정보를 다시 확인해 주세요.","tradeIds");
 const before=(await env.DB.prepare("SELECT trade_id FROM company_trades WHERE company_id=?1 AND status='ACTIVE' ORDER BY trade_id").bind(companyId).all()).results.map(v=>v.trade_id),statements=[env.DB.prepare("UPDATE company_trades SET status='INACTIVE',updated_at=CURRENT_TIMESTAMP WHERE company_id=?1").bind(companyId)];for(const tradeId of tradeIds)statements.push(env.DB.prepare("INSERT INTO company_trades(company_id,trade_id,status) VALUES(?1,?2,'ACTIVE') ON CONFLICT(company_id,trade_id) DO UPDATE SET status='ACTIVE',updated_at=CURRENT_TIMESTAMP").bind(companyId,tradeId));statements.push(audit(env,auth.row.user_id,"COMPANY_TRADES_UPDATED",requestId(request),{companyId,before,after:tradeIds}));await env.DB.batch(statements);return json({ok:true});
}
async function companies(request,env,url){
 if(request.method==="GET"){await authorize(request,env);const query=String(url.searchParams.get("q")||"").trim(),digits=business(query),like=`%${query.replaceAll("%","\\%")}%`,rows=await env.DB.prepare(`SELECT c.id,c.name,c.company_type,c.business_registration_number,c.status,c.created_at,c.updated_at,
 GROUP_CONCAT(CASE WHEN ct.status='ACTIVE' THEN tm.id||':'||tm.trade_key||':'||tm.display_name END) trades
 FROM companies c LEFT JOIN company_trades ct ON ct.company_id=c.id LEFT JOIN trade_master tm ON tm.id=ct.trade_id
 WHERE c.name LIKE ?1 ESCAPE '\\' OR (?2<>'' AND c.business_registration_number LIKE '%'||?2||'%')
 GROUP BY c.id ORDER BY c.name`).bind(like,digits).all();return json({items:rows.results.map(row=>({...row,trades:row.trades?row.trades.split(",").map(item=>{const [tradeId,tradeKey,displayName]=item.split(":");return {tradeId,tradeKey,displayName}}):[]}))})}
 const auth=await authorize(request,env,{write:true}),body=await parseJson(request),{name,companyType,registration,tradeIds}=validateCompanyCreateInput(body);
 const duplicate=await env.DB.prepare("SELECT 1 found FROM companies WHERE business_registration_number=?1 LIMIT 1").bind(registration).first();
 if(duplicate)throw new ApiError(409,"BUSINESS_NUMBER_DUPLICATE","이미 등록된 사업자등록번호입니다.",{field:"businessRegistrationNumber"});
 const valid=await env.DB.prepare(`SELECT COUNT(*) count FROM trade_master tm JOIN trade_groups tg ON tg.id=tm.group_id JOIN trade_categories tc ON tc.id=tg.category_id WHERE tm.id IN (${tradeIds.map((_,i)=>`?${i+1}`).join(",")}) AND tm.status='ACTIVE' AND tm.is_selectable=1 AND tg.is_active=1 AND tc.is_active=1`).bind(...tradeIds).first();
 if(Number(valid?.count)!==tradeIds.length)throw companyError("COMPANY_TRADE_INVALID","선택한 공종 정보를 다시 확인해 주세요.","tradeIds");
 const id=crypto.randomUUID(),statements=[env.DB.prepare("INSERT INTO companies(id,name,company_type,business_registration_number,status,updated_at) VALUES(?1,?2,?3,?4,'ACTIVE',CURRENT_TIMESTAMP)").bind(id,name,companyType,registration)];
 for(const tradeId of tradeIds)statements.push(env.DB.prepare("INSERT INTO company_trades(company_id,trade_id,status) VALUES(?1,?2,'ACTIVE')").bind(id,tradeId));
 statements.push(audit(env,auth.row.user_id,"COMPANY_CREATED",requestId(request),{companyId:id,companyType,tradeIds}));
 try{await env.DB.batch(statements)}catch(error){if(String(error).includes("UNIQUE"))throw new ApiError(409,"BUSINESS_NUMBER_DUPLICATE","이미 등록된 사업자등록번호입니다.",{field:"businessRegistrationNumber"});throw error}
 return json({company:{id,name,companyType,businessRegistrationNumber:registration,status:"ACTIVE"}},201);
}
async function updateCompany(request,env,id){
 const auth=await authorize(request,env,{write:true}),body=await parseJson(request),name=clean(body.name,120),companyType=String(body.companyType||""),status=String(body.status||"ACTIVE"),registration=body.businessRegistrationNumber==null?null:business(body.businessRegistrationNumber);
 if(!COMPANY_TYPES.has(companyType)||!["ACTIVE","INACTIVE"].includes(status)||registration!==null&&registration.length!==10)throw new ApiError(400,"COMPANY_UPDATE_INVALID","회사 수정 정보를 확인해 주세요.");
 try{const result=await env.DB.prepare("UPDATE companies SET name=?2,company_type=?3,status=?4,business_registration_number=?5,updated_at=CURRENT_TIMESTAMP WHERE id=?1").bind(id,name,companyType,status,registration).run();if(!result.meta.changes)throw new ApiError(404,"COMPANY_NOT_FOUND","회사를 찾을 수 없습니다.")}catch(error){if(String(error).includes("UNIQUE"))throw new ApiError(409,"BUSINESS_NUMBER_DUPLICATE","이미 등록된 사업자등록번호입니다.");throw error}
 await audit(env,auth.row.user_id,"COMPANY_UPDATED",requestId(request),{companyId:id,companyType,status}).run();return json({ok:true});
}
async function contracts(request,env,url){
 const siteId=url.searchParams.get("siteId")||undefined;
 if(request.method==="GET"){const auth=await authorize(request,env,{siteId}),rows=await env.DB.prepare(`SELECT sc.id,sc.company_id,c.name company_name,c.company_type,sc.status,sc.participation_start_date,sc.participation_end_date,sc.site_manager_user_id,u.display_name site_manager_name,
 GROUP_CONCAT(CASE WHEN cst.status='ACTIVE' THEN tm.id||':'||tm.trade_key||':'||tm.display_name END) trades
 FROM company_site_contracts sc JOIN companies c ON c.id=sc.company_id LEFT JOIN company_site_contract_trades cst ON cst.site_contract_id=sc.id LEFT JOIN trade_master tm ON tm.id=cst.trade_id LEFT JOIN users u ON u.id=sc.site_manager_user_id
 WHERE sc.site_id=?1 GROUP BY sc.id ORDER BY c.company_type,c.name`).bind(auth.siteId).all();return json({siteId:auth.siteId,items:rows.results.map(row=>({...row,trades:row.trades?row.trades.split(",").map(item=>{const [tradeId,tradeKey,displayName]=item.split(":");return {tradeId,tradeKey,displayName}}):[]}))})}
 const auth=await authorize(request,env,{write:true,siteId}),body=await parseJson(request),companyId=clean(body.companyId),tradeIds=[...new Set((Array.isArray(body.tradeIds)?body.tradeIds:[]).map(String))],company=await env.DB.prepare("SELECT company_type FROM companies WHERE id=?1 AND status='ACTIVE'").bind(companyId).first();
 if(!company)throw new ApiError(404,"COMPANY_NOT_FOUND","활성 회사를 찾을 수 없습니다.");
 if(!tradeIds.length)throw new ApiError(400,"CONTRACT_TRADES_REQUIRED","계약 공종을 하나 이상 선택해 주세요.");
 const allowed=await env.DB.prepare(`SELECT tm.id,tm.trade_key FROM company_trades ct JOIN trade_master tm ON tm.id=ct.trade_id WHERE ct.company_id=?1 AND ct.status='ACTIVE' AND tm.status='ACTIVE' AND tm.id IN (${tradeIds.map((_,i)=>`?${i+2}`).join(",")})`).bind(companyId,...tradeIds).all();
 if(allowed.results.length!==tradeIds.length)throw new ApiError(400,"CONTRACT_TRADE_SCOPE_INVALID","회사에 등록된 활성 공종만 계약할 수 있습니다.");
 const id=crypto.randomUUID(),existing=await env.DB.prepare("SELECT id FROM company_site_contracts WHERE company_id=?1 AND site_id=?2").bind(companyId,auth.siteId).first(),contractId=existing?.id||id,first=allowed.results[0],statements=[env.DB.prepare("INSERT INTO company_site_contracts(id,company_id,site_id,contractor_type,trade_code,status,participation_start_date,participation_end_date,site_manager_user_id,updated_at) VALUES(?1,?2,?3,?4,?5,'ACTIVE',?6,?7,?8,CURRENT_TIMESTAMP) ON CONFLICT(company_id,site_id) DO UPDATE SET contractor_type=excluded.contractor_type,trade_code=excluded.trade_code,status='ACTIVE',participation_start_date=excluded.participation_start_date,participation_end_date=excluded.participation_end_date,site_manager_user_id=excluded.site_manager_user_id,updated_at=CURRENT_TIMESTAMP").bind(id,companyId,auth.siteId,company.company_type,first.trade_key,body.startDate||null,body.endDate||null,body.managerUserId||null),env.DB.prepare("UPDATE company_site_contract_trades SET status='INACTIVE',updated_at=CURRENT_TIMESTAMP WHERE site_contract_id=?1").bind(contractId)];
 for(const trade of allowed.results)statements.push(env.DB.prepare("INSERT INTO company_site_contract_trades(id,site_contract_id,trade_code,trade_id,status) VALUES(?1,?2,?3,?4,'ACTIVE') ON CONFLICT(site_contract_id,trade_code) DO UPDATE SET trade_id=excluded.trade_id,status='ACTIVE',updated_at=CURRENT_TIMESTAMP").bind(crypto.randomUUID(),contractId,trade.trade_key,trade.id));
 statements.push(audit(env,auth.row.user_id,"SITE_COMPANY_CONNECTED",requestId(request),{siteId:auth.siteId,companyId,tradeIds}));await env.DB.batch(statements);return json({ok:true,contractId},201);
}
async function users(request,env,url){
 const auth=await authorize(request,env,{siteId:url.searchParams.get("siteId")||undefined}),companyType=url.searchParams.get("companyType"),companyId=url.searchParams.get("companyId"),roleCode=url.searchParams.get("roleCode"),q=phone(url.searchParams.get("q")||"")||String(url.searchParams.get("q")||"").trim().toLowerCase(),rows=await env.DB.prepare(`SELECT u.id,u.display_name,u.login_identifier,u.status,c.id company_id,c.name company_name,c.company_type,m.site_id,m.approval_status,GROUP_CONCAT(DISTINCT r.code) role_codes
 FROM memberships m JOIN users u ON u.id=m.user_id JOIN companies c ON c.id=m.company_id LEFT JOIN user_site_roles usr ON usr.user_id=u.id AND usr.site_id=m.site_id AND usr.status='ACTIVE' LEFT JOIN roles r ON r.id=usr.role_id
 WHERE m.site_id=?1 AND m.status='ACTIVE' AND (?2 IS NULL OR c.company_type=?2) AND (?3 IS NULL OR c.id=?3)
 GROUP BY u.id,c.id,m.site_id HAVING (?4 IS NULL OR instr(','||role_codes||',',','||?4||',')>0) AND (?5='' OR lower(u.display_name) LIKE '%'||?5||'%' OR u.login_identifier LIKE '%'||?5||'%')
 ORDER BY CASE c.company_type WHEN 'GENERAL_CONTRACTOR' THEN 0 ELSE 1 END,c.name,u.display_name`).bind(auth.siteId,companyType||null,companyId||null,roleCode||null,q).all();
 return json({siteId:auth.siteId,items:rows.results.map(row=>({...row,login_identifier:mask(row.login_identifier),roleCodes:row.role_codes?row.role_codes.split(","):[]}))});
}
async function updateUserAccess(request,env,userId){
 const body=await parseJson(request),auth=await authorize(request,env,{write:true,siteId:String(body.siteId||"")}),roleCode=clean(body.roleCode,80),target=await env.DB.prepare("SELECT c.company_type,m.company_id FROM memberships m JOIN users u ON u.id=m.user_id AND u.status='ACTIVE' JOIN companies c ON c.id=m.company_id WHERE m.user_id=?1 AND m.site_id=?2 AND m.status='ACTIVE'").bind(userId,auth.siteId).first(),assigningMaster=MASTER.has(roleCode);
 if(!target||!ROLE_COMPATIBILITY[target.company_type]?.has(roleCode)&&roleCode!=="SITE_MANAGER"&&!assigningMaster)throw new ApiError(403,"USER_ROLE_SCOPE_DENIED","회사 유형에 맞지 않는 역할입니다.");
 if((assigningMaster||roleCode==="SITE_MANAGER")&&!auth.master)throw new ApiError(403,"USER_ADMIN_SCOPE_DENIED","마스터만 해당 역할을 부여할 수 있습니다.");
 const role=await env.DB.prepare("SELECT id FROM roles WHERE code=?1").bind(roleCode).first();if(!role)throw new ApiError(400,"USER_ROLE_INVALID","사용할 수 없는 역할입니다.");
 await env.DB.batch([env.DB.prepare("UPDATE user_site_roles SET status='INACTIVE' WHERE user_id=?1 AND site_id=?2 AND status='ACTIVE'").bind(userId,auth.siteId),env.DB.prepare("INSERT INTO user_site_roles(id,user_id,role_id,company_id,site_id,status) VALUES(?1,?2,?3,?4,?5,'ACTIVE')").bind(crypto.randomUUID(),userId,role.id,target.company_id,auth.siteId),...safetyGrantStatements(env,userId,auth.siteId),env.DB.prepare("UPDATE users SET context_version=context_version+1 WHERE id=?1").bind(userId),audit(env,auth.row.user_id,"USER_ROLE_UPDATED",requestId(request),{targetUserId:userId,siteId:auth.siteId,roleCode})]);return json({ok:true});
}
async function updateUserMembership(request,env,userId){
 const body=await parseJson(request),auth=await authorize(request,env,{write:true,masterOnly:true,siteId:String(body.siteId||"")}),companyId=clean(body.companyId,80),roleCode=clean(body.roleCode,80),assigningMaster=MASTER.has(roleCode);
 const [target,company,role,enrollment]=await Promise.all([
  env.DB.prepare("SELECT GROUP_CONCAT(DISTINCT m.company_id) company_ids,MAX(m.approval_status) approval_status,GROUP_CONCAT(DISTINCT r.code) role_codes FROM memberships m JOIN users u ON u.id=m.user_id AND u.status='ACTIVE' LEFT JOIN user_site_roles usr ON usr.user_id=m.user_id AND usr.site_id=m.site_id AND usr.status='ACTIVE' LEFT JOIN roles r ON r.id=usr.role_id WHERE m.user_id=?1 AND m.site_id=?2 AND m.status='ACTIVE' GROUP BY m.user_id,m.site_id").bind(userId,auth.siteId).first(),
  env.DB.prepare("SELECT c.company_type,sc.id site_contract_id FROM companies c JOIN company_site_contracts sc ON sc.company_id=c.id WHERE c.id=?1 AND sc.site_id=?2 AND c.status='ACTIVE' AND sc.status='ACTIVE'").bind(companyId,auth.siteId).first(),
  env.DB.prepare("SELECT id FROM roles WHERE code=?1").bind(roleCode).first(),
  env.DB.prepare("SELECT trade_id FROM workforce_site_enrollments WHERE user_id=?1 AND site_id=?2").bind(userId,auth.siteId).first()
 ]);
 if(!target)throw new ApiError(404,"MEMBERSHIP_NOT_FOUND","현장 가입 정보를 찾을 수 없습니다.");
 if(!company)throw new ApiError(400,"USER_COMPANY_SCOPE_INVALID","현재 현장에 참여 중인 활성 회사를 선택해 주세요.");
 if(!role)throw new ApiError(400,"USER_ROLE_INVALID","사용할 수 없는 역할입니다.");
 if(!assigningMaster&&roleCode!=="SITE_MANAGER"&&!ROLE_COMPATIBILITY[company.company_type]?.has(roleCode))throw new ApiError(400,"USER_ROLE_SCOPE_DENIED","선택한 회사 유형에 맞는 역할을 선택해 주세요.");
 const retainedTrade=enrollment?.trade_id?await env.DB.prepare("SELECT 1 FROM company_site_contracts sc JOIN company_site_contract_trades ct ON ct.site_contract_id=sc.id AND ct.status='ACTIVE' WHERE sc.id=?1 AND ct.trade_id=?2 AND sc.status='ACTIVE'").bind(company.site_contract_id,enrollment.trade_id).first():null;
 const beforeRoles=target.role_codes?target.role_codes.split(","):[];
 await env.DB.batch([
  env.DB.prepare("UPDATE memberships SET status='INACTIVE' WHERE user_id=?1 AND site_id=?2 AND status='ACTIVE'").bind(userId,auth.siteId),
  env.DB.prepare("INSERT INTO memberships(id,user_id,company_id,site_id,status,approval_status) VALUES(?1,?2,?3,?4,'ACTIVE',?5) ON CONFLICT(user_id,company_id,site_id) DO UPDATE SET status='ACTIVE',approval_status=excluded.approval_status").bind(crypto.randomUUID(),userId,companyId,auth.siteId,target.approval_status||"PENDING"),
  env.DB.prepare("UPDATE user_site_roles SET status='INACTIVE' WHERE user_id=?1 AND site_id=?2 AND status='ACTIVE'").bind(userId,auth.siteId),
  env.DB.prepare("INSERT INTO user_site_roles(id,user_id,role_id,company_id,site_id,status) VALUES(?1,?2,?3,?4,?5,'ACTIVE')").bind(crypto.randomUUID(),userId,role.id,companyId,auth.siteId),
  ...safetyGrantStatements(env,userId,auth.siteId),
  env.DB.prepare("UPDATE workforce_site_enrollments SET company_id=?3,site_contractor_id=?4,trade_id=?5,team_id=NULL,role_code=?6,updated_at=CURRENT_TIMESTAMP,revision=revision+1 WHERE user_id=?1 AND site_id=?2").bind(userId,auth.siteId,companyId,company.site_contract_id,retainedTrade?enrollment.trade_id:null,roleCode),
  env.DB.prepare("UPDATE users SET context_version=context_version+1 WHERE id=?1").bind(userId),
  audit(env,auth.row.user_id,"USER_MEMBERSHIP_UPDATED",requestId(request),{targetUserId:userId,siteId:auth.siteId,beforeCompanyIds:target.company_ids?target.company_ids.split(","):[],afterCompanyId:companyId,beforeRoles,afterRole:roleCode,workforceTradeRetained:Boolean(retainedTrade)})
 ]);
 return json({ok:true,companyId,roleCode});
}
async function updateMembershipApproval(request,env,userId){
 const body=await parseJson(request),auth=await authorize(request,env,{write:true,siteId:String(body.siteId||"")}),approvalStatus=String(body.approvalStatus||"");
 if(!["APPROVED","REJECTED"].includes(approvalStatus))throw new ApiError(400,"MEMBERSHIP_APPROVAL_INVALID","승인 상태를 확인해 주세요.");
 const result=await env.DB.prepare("UPDATE memberships SET approval_status=?3 WHERE user_id=?1 AND site_id=?2 AND status='ACTIVE'").bind(userId,auth.siteId,approvalStatus).run();
 if(!result.meta.changes)throw new ApiError(404,"MEMBERSHIP_NOT_FOUND","현장 가입 정보를 찾을 수 없습니다.");
 await env.DB.batch([...safetyGrantStatements(env,userId,auth.siteId),env.DB.prepare("UPDATE users SET context_version=context_version+1 WHERE id=?1").bind(userId),audit(env,auth.row.user_id,`MEMBERSHIP_${approvalStatus}`,requestId(request),{targetUserId:userId,siteId:auth.siteId})]);
 return json({ok:true,approvalStatus});
}
async function invitationList(request,env,url){
 const auth=await authorize(request,env,{siteId:url.searchParams.get("siteId")||undefined}),rows=await env.DB.prepare(`SELECT i.id,i.display_name,i.identifier,i.company_id,c.name company_name,i.site_id,i.site_role_code,i.display_code,i.status,i.expires_at,i.created_at,i.accepted_at,i.cancelled_at,u.display_name created_by_name
 FROM invitations i JOIN companies c ON c.id=i.company_id LEFT JOIN users u ON u.id=i.created_by_user_id WHERE i.site_id=?1 ORDER BY i.created_at DESC LIMIT 200`).bind(auth.siteId).all();
 return json({siteId:auth.siteId,items:rows.results.map(row=>({...row,identifier:mask(row.identifier),inviteUrl:row.status==="PENDING"&&Date.parse(row.expires_at)>Date.now()?`${env.PUBLIC_ORIGIN||new URL(request.url).origin}/join?code=${row.display_code}`:null,effectiveStatus:row.status==="PENDING"&&Date.parse(row.expires_at)<=Date.now()?"EXPIRED":row.status}))});
}
async function createInvitation(request,env){
 const body=await parseJson(request),auth=await authorize(request,env,{write:true,siteId:String(body.siteId||"")}),companyId=clean(body.companyId),displayName=clean(body.displayName,80),identifier=phone(body.identifier),siteRole=clean(body.siteRole,80),tradeId=clean(body.tradeId,80),teamId=body.teamId?clean(body.teamId,80):null,expiresAt=new Date(body.expiresAt);
 if(identifier.length!==11)throw new ApiError(400,"PHONE_INVALID","휴대전화 번호 11자리를 입력해 주세요.");
 if(Number.isNaN(expiresAt.valueOf())||expiresAt<=new Date())throw new ApiError(400,"INVITATION_EXPIRY_INVALID","미래 만료일을 선택해 주세요.");
 const company=await env.DB.prepare("SELECT c.company_type FROM companies c JOIN company_site_contracts sc ON sc.company_id=c.id WHERE c.id=?1 AND sc.site_id=?2 AND c.status='ACTIVE' AND sc.status='ACTIVE'").bind(companyId,auth.siteId).first();
 if(!company||!ROLE_COMPATIBILITY[company.company_type]?.has(siteRole))throw new ApiError(403,"INVITATION_ROLE_SCOPE_DENIED","회사·현장·역할 조합을 확인해 주세요.");
 const trade=await env.DB.prepare(`SELECT tm.id FROM company_site_contracts sc JOIN company_site_contract_trades ct ON ct.site_contract_id=sc.id AND ct.status='ACTIVE' JOIN company_trades cot ON cot.company_id=sc.company_id AND cot.trade_id=ct.trade_id AND cot.status='ACTIVE' JOIN trade_master tm ON tm.id=ct.trade_id AND tm.status='ACTIVE' AND tm.is_selectable=1 WHERE sc.site_id=?1 AND sc.company_id=?2 AND sc.status='ACTIVE' AND tm.id=?3`).bind(auth.siteId,companyId,tradeId).first();
 if(!trade)throw new ApiError(400,"WORKFORCE_TRADE_SCOPE_INVALID","공종을 선택해 주세요. 회사의 현재 현장 계약 공종만 선택할 수 있습니다.");
 if(teamId){const team=await env.DB.prepare("SELECT 1 FROM workforce_teams WHERE id=?1 AND site_id=?2 AND company_id=?3 AND trade_id=?4 AND is_active=1").bind(teamId,auth.siteId,companyId,tradeId).first();if(!team)throw new ApiError(400,"WORKFORCE_TEAM_INVALID","선택한 팀 또는 반을 다시 확인해 주세요.")}
 const token=randomToken(32),code=crypto.randomUUID().replaceAll("-","").slice(0,8).toUpperCase(),id=crypto.randomUUID();
 await env.DB.batch([env.DB.prepare("INSERT INTO invitations(id,identifier,company_id,site_id,role_code,module_codes_json,token_hash,status,expires_at,display_name,company_role_code,site_role_code,display_code,display_code_hash,created_by_user_id,workforce_trade_id,workforce_team_id) VALUES(?1,?2,?3,?4,?5,'[]',?6,'PENDING',?7,?8,?5,?5,?9,?10,?11,?12,?13)").bind(id,identifier,companyId,auth.siteId,siteRole,await sha256(token),expiresAt.toISOString(),displayName,code,await sha256(code),auth.row.user_id,tradeId,teamId),audit(env,auth.row.user_id,"INVITATION_CREATED",requestId(request),{invitationId:id,siteId:auth.siteId,companyId,siteRole,tradeId,teamId})]);
 return json({invitation:{id,displayCode:code,inviteUrl:`${env.PUBLIC_ORIGIN||new URL(request.url).origin}/join?token=${encodeURIComponent(token)}`,expiresAt:expiresAt.toISOString()}},201);
}
async function cancelInvitation(request,env,id){const body=await parseJson(request),auth=await authorize(request,env,{write:true,siteId:String(body.siteId||"")}),result=await env.DB.prepare("UPDATE invitations SET status='CANCELLED',cancelled_by_user_id=?2,cancelled_at=CURRENT_TIMESTAMP,revision=revision+1 WHERE id=?1 AND site_id=?3 AND status='PENDING'").bind(id,auth.row.user_id,auth.siteId).run();if(!result.meta.changes)throw new ApiError(409,"INVITATION_NOT_CANCELLABLE","취소할 수 없는 초대입니다.");await audit(env,auth.row.user_id,"INVITATION_CANCELLED",requestId(request),{invitationId:id,siteId:auth.siteId}).run();return json({ok:true})}
async function findInvitation(env,credential){const hash=await sha256(String(credential||"").trim()),row=await env.DB.prepare("SELECT i.*,c.name company_name,c.company_type,s.name site_name,tm.display_name trade_name,wt.team_name FROM invitations i JOIN companies c ON c.id=i.company_id JOIN sites s ON s.id=i.site_id LEFT JOIN trade_master tm ON tm.id=i.workforce_trade_id LEFT JOIN workforce_teams wt ON wt.id=i.workforce_team_id WHERE i.token_hash=?1 OR i.display_code_hash=?1").bind(hash).first();if(!row||row.status!=="PENDING"||Date.parse(row.expires_at)<=Date.now())throw new ApiError(410,"INVITATION_UNAVAILABLE","사용할 수 없는 초대입니다.");return row}
async function verifyInvitation(request,env,url){const row=await findInvitation(env,url.searchParams.get("token")||url.searchParams.get("code"));return json({invitation:{displayName:row.display_name,identifier:row.identifier,companyName:row.company_name,companyType:row.company_type,siteName:row.site_name,siteRole:row.site_role_code,tradeName:row.trade_name,teamName:row.team_name,expiresAt:row.expires_at}})}
async function acceptInvitation(request,env){
 const body=await parseJson(request),invite=await findInvitation(env,body.token||body.code),pin=String(body.pin||""),birthDate=String(body.birthDate||""),pinError=pinValidationError(pin);if(pinError)throw new ApiError(400,"PIN_INVALID",pinError);if(!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)||Number.isNaN(Date.parse(`${birthDate}T00:00:00Z`)))throw new ApiError(400,"WORKFORCE_BIRTH_DATE_REQUIRED","생년월일을 입력해 주세요.");
 let user=await env.DB.prepare("SELECT id FROM users WHERE login_identifier=?1").bind(invite.identifier).first(),newUser=false,salt,credentialHash;if(!user){newUser=true;salt=randomToken(16);credentialHash=await deriveCredential(pin,salt,100000);user={id:crypto.randomUUID()}}
 const role=await env.DB.prepare("SELECT id FROM roles WHERE code=?1").bind(invite.site_role_code).first();if(!role)throw new ApiError(400,"INVITATION_ROLE_INVALID","초대 역할을 사용할 수 없습니다.");
 const statements=[],phoneDigest=`sha256:${await sha256(invite.identifier)}`,birthDigest=`sha256:${await sha256(birthDate)}`;if(newUser)statements.push(env.DB.prepare("INSERT INTO users(id,login_identifier,display_name,credential_hash,credential_salt,credential_iterations,status) VALUES(?1,?2,?3,?4,?5,100000,'ACTIVE')").bind(user.id,invite.identifier,invite.display_name,credentialHash,salt));
 statements.push(env.DB.prepare("INSERT INTO invitation_acceptances(invitation_id,user_id) VALUES(?1,?2)").bind(invite.id,user.id),env.DB.prepare("INSERT OR IGNORE INTO memberships(id,user_id,company_id,site_id,status,approval_status) VALUES(?1,?2,?3,?4,'ACTIVE','PENDING')").bind(crypto.randomUUID(),user.id,invite.company_id,invite.site_id),env.DB.prepare("INSERT OR IGNORE INTO user_site_roles(id,user_id,role_id,company_id,site_id,status) VALUES(?1,?2,?3,?4,?5,'ACTIVE')").bind(crypto.randomUUID(),user.id,role.id,invite.company_id,invite.site_id),env.DB.prepare("INSERT INTO workforce_profiles(id,user_id,status,phone_encrypted,birth_date_encrypted) VALUES(?1,?2,'PENDING',?3,?4) ON CONFLICT(user_id) DO UPDATE SET status='PENDING',phone_encrypted=excluded.phone_encrypted,birth_date_encrypted=excluded.birth_date_encrypted,updated_at=CURRENT_TIMESTAMP,revision=revision+1").bind(crypto.randomUUID(),user.id,phoneDigest,birthDigest),env.DB.prepare("INSERT INTO workforce_site_enrollments(id,user_id,site_id,company_id,trade_id,team_id,role_code,join_method) VALUES(?1,?2,?3,?4,?5,?6,?7,'INVITATION') ON CONFLICT(user_id,site_id) DO UPDATE SET company_id=excluded.company_id,trade_id=excluded.trade_id,team_id=excluded.team_id,role_code=excluded.role_code,approval_status='PENDING',updated_at=CURRENT_TIMESTAMP,revision=workforce_site_enrollments.revision+1").bind(crypto.randomUUID(),user.id,invite.site_id,invite.company_id,invite.workforce_trade_id,invite.workforce_team_id,invite.site_role_code));
 statements.push(...safetyGrantStatements(env,user.id,invite.site_id));
 statements.push(env.DB.prepare("UPDATE invitations SET status='ACCEPTED',accepted_at=CURRENT_TIMESTAMP,revision=revision+1 WHERE id=?1 AND status='PENDING'").bind(invite.id),audit(env,user.id,"INVITATION_ACCEPTED",requestId(request),{invitationId:invite.id,siteId:invite.site_id,companyId:invite.company_id,newUser}));
 try{await env.DB.batch(statements)}catch(error){if(String(error).includes("UNIQUE"))throw new ApiError(409,"INVITATION_ALREADY_USED","이미 사용된 초대입니다.");throw error}return json({ok:true,userId:user.id,newUser,loginIdentifier:invite.identifier,approvalStatus:"PENDING"},201);
}
export async function handleIntegratedAdminRequest(request,env,url){
 const path=url.pathname,method=request.method;if(method==="GET"&&path==="/api/v1/public/invitations/verify")return verifyInvitation(request,env,url);if(method==="POST"&&path==="/api/v1/public/invitations/accept")return acceptInvitation(request,env);if(!path.startsWith("/api/v1/admin/"))return null;
 if(path==="/api/v1/admin/trades"&&method==="GET")return tradeOptions(request,env,url);
 if(path==="/api/v1/admin/trades"&&method==="POST")return manageTrade(request,env);
 const trade=path.match(/^\/api\/v1\/admin\/trades\/([^/]+)$/);if(trade&&method==="PUT")return manageTrade(request,env,trade[1]);
 if(path==="/api/v1/admin/companies"&&["GET","POST"].includes(method))return companies(request,env,url);
 if(path==="/api/v1/admin/sites"&&method==="POST")return createSite(request,env);
 const company=path.match(/^\/api\/v1\/admin\/companies\/([^/]+)$/);if(company&&method==="PATCH")return updateCompany(request,env,company[1]);
 const companyTrades=path.match(/^\/api\/v1\/admin\/companies\/([^/]+)\/trades$/);if(companyTrades&&method==="PUT")return updateCompanyTrades(request,env,companyTrades[1]);
 if(path==="/api/v1/admin/site-contracts"&&["GET","POST"].includes(method))return contracts(request,env,url);
 if(path==="/api/v1/admin/users"&&method==="GET")return users(request,env,url);
 const userMembership=path.match(/^\/api\/v1\/admin\/users\/([^/]+)\/membership$/);if(userMembership&&method==="PUT")return updateUserMembership(request,env,userMembership[1]);
 const userAccess=path.match(/^\/api\/v1\/admin\/users\/([^/]+)\/access$/);if(userAccess&&method==="PUT")return updateUserAccess(request,env,userAccess[1]);
 const membershipApproval=path.match(/^\/api\/v1\/admin\/users\/([^/]+)\/approval$/);if(membershipApproval&&method==="PUT")return updateMembershipApproval(request,env,membershipApproval[1]);
 if(path==="/api/v1/admin/invitations"&&method==="GET")return invitationList(request,env,url);if(path==="/api/v1/admin/invitations"&&method==="POST")return createInvitation(request,env);
 const cancel=path.match(/^\/api\/v1\/admin\/invitations\/([^/]+)$/);if(cancel&&method==="DELETE")return cancelInvitation(request,env,cancel[1]);return null;
}

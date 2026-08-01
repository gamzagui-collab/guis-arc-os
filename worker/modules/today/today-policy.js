import {ApiError} from "../../core/response.js";
import {ISSUE_SCOPE,resolveIssueScope} from "../issue-policy.js";

export const kstWorkDate=(instant=new Date())=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(instant);

export async function todayScope(env,row,ctx){
 const siteId=ctx.selectedSiteId;
 if(!siteId)throw new ApiError(400,"SITE_CONTEXT_REQUIRED","Select a site before opening Today.");
 const membership=await env.DB.prepare("SELECT company_id FROM memberships WHERE user_id=?1 AND site_id=?2 AND status='ACTIVE'").bind(row.user_id,siteId).first();
 if(!membership)throw new ApiError(403,"TODAY_SITE_SCOPE_DENIED","Today requires an active site membership.");
 const roleResult=await env.DB.prepare("SELECT DISTINCT r.code FROM user_site_roles usr JOIN roles r ON r.id=usr.role_id WHERE usr.user_id=?1 AND usr.site_id=?2 AND usr.status='ACTIVE'").bind(row.user_id,siteId).all(),roles=roleResult.results.map(value=>value.code);
 return {userId:row.user_id,siteId,companyId:membership.company_id,roles,issueScope:resolveIssueScope(roles)};
}

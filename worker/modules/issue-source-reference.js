import {ApiError} from "../core/response.js";

export const ISSUE_SOURCE_ITEM_MAX_COUNT=100;
export const ISSUE_SOURCE_ITEM_MAX_BYTES=16*1024;
export const ISSUE_SOURCE_DETACHED_WARNING="원본 작업 연결을 확인하지 못해 일반 이슈로 등록했습니다.";

const normalized=value=>String(value||"").trim().replace(/\s+/g," ");

export function buildSourceMatchKey(item={}){
 return [normalized(item.section_type).toUpperCase(),normalized(item.source_sheet_name),normalized(item.source_cell_range).replace(/\s+/g,"").toUpperCase()].join("|");
}

export function normalizeSourceItemRefs(items=[]){
 const refs=[];
 for(const item of items){
  const itemId=normalized(item.id||item.itemId),matchKey=item.matchKey||buildSourceMatchKey(item);
  if(!itemId||matchKey.split("|").some(part=>!part))return {ok:false,refs:[]};
  refs.push({itemId,matchKey});
 }
 const size=new TextEncoder().encode(JSON.stringify(refs)).byteLength;
 return refs.length<=ISSUE_SOURCE_ITEM_MAX_COUNT&&size<=ISSUE_SOURCE_ITEM_MAX_BYTES?{ok:true,refs}:{ok:false,refs:[]};
}

export async function sourceItemRefsForIds(env,{siteId,sourceId,itemIds=[]}={}){
 const ids=[...new Set(itemIds.map(normalized).filter(Boolean))];
 if(!ids.length||ids.length>ISSUE_SOURCE_ITEM_MAX_COUNT)return [];
 const upload=await env.DB.prepare("SELECT id FROM construction_daily_report_uploads WHERE id=?1 AND site_id=?2").bind(normalized(sourceId),normalized(siteId)).first();
 if(!upload)return [];
 const placeholders=ids.map((_,index)=>`?${index+2}`).join(","),rows=(await env.DB.prepare(`SELECT id,section_type,source_sheet_name,source_cell_range FROM construction_daily_report_imported_items WHERE upload_id=?1 AND id IN (${placeholders})`).bind(upload.id,...ids).all()).results||[];
 if(rows.length!==ids.length)return [];
 const byId=new Map(rows.map(row=>[row.id,row]));
 return ids.map(id=>byId.get(id)).filter(Boolean).map(item=>({itemId:item.id,matchKey:buildSourceMatchKey(item)}));
}

export async function resolveIssueSource(_env,input={}){
 if(!input.sourceType&&!input.sourceId)return {status:"NONE",reference:null,warning:null};
 const detached=()=>({status:"DETACHED",reference:null,warning:ISSUE_SOURCE_DETACHED_WARNING});
 const env=_env;
 try{
  const siteId=normalized(input.siteId),sourceId=normalized(input.sourceId),sourceType=normalized(input.sourceType).toUpperCase(),sourceRevision=Number(input.sourceRevision);
  if(!siteId||!sourceId||!Number.isInteger(sourceRevision)||sourceRevision<1)return detached();
  if(sourceType==="CONSTRUCTION_DAILY_REPORT"){
   const sourceScope=await env.DB.prepare("SELECT site_id FROM construction_daily_report_uploads WHERE id=?1").bind(sourceId).first();
   if(sourceScope&&sourceScope.site_id!==siteId)throw new ApiError(403,"ISSUE_SOURCE_SCOPE_DENIED","다른 현장의 원본 작업은 연결할 수 없습니다.");
   const submitted=normalizeSourceItemRefs(Array.isArray(input.sourceItemRefs)?input.sourceItemRefs:[]);
   if(!submitted.ok||!submitted.refs.length)return detached();
   const original=await env.DB.prepare("SELECT id,work_date_kst,revision,status FROM construction_daily_report_uploads WHERE id=?1 AND site_id=?2 AND parse_status='CONFIRMED'").bind(sourceId,siteId).first();
   if(!original||Number(original.revision)!==sourceRevision)return detached();
   const originalItems=(await env.DB.prepare("SELECT id,section_type,source_sheet_name,source_cell_range FROM construction_daily_report_imported_items WHERE upload_id=?1").bind(original.id).all()).results||[];
   const originalById=new Map(originalItems.map(item=>[item.id,buildSourceMatchKey(item)]));
   if(submitted.refs.some(ref=>originalById.get(ref.itemId)!==ref.matchKey))return detached();
   const latest=await env.DB.prepare("SELECT id,work_date_kst,revision FROM construction_daily_report_uploads WHERE site_id=?1 AND work_date_kst=?2 AND parse_status='CONFIRMED' AND status='ACTIVE' ORDER BY revision DESC LIMIT 1").bind(siteId,original.work_date_kst).first();
   if(!latest)return detached();
   const latestItems=(await env.DB.prepare("SELECT id,section_type,source_sheet_name,source_cell_range,company_name_snapshot,trade_name_snapshot,location_text,work_description FROM construction_daily_report_imported_items WHERE upload_id=?1").bind(latest.id).all()).results||[];
   const byKey=new Map();for(const item of latestItems){const key=buildSourceMatchKey(item);if(!byKey.has(key))byKey.set(key,[]);byKey.get(key).push(item)}
   const matches=[];for(const ref of submitted.refs){const candidates=byKey.get(ref.matchKey)||[];if(candidates.length!==1)return detached();matches.push(candidates[0])}
   const unique=value=>[...new Set(matches.map(item=>normalized(item[value])).filter(Boolean))],joined=value=>unique(value).join(", ")||null;
   const reference={sourceType,sourceId:latest.id,sourceRevision:Number(latest.revision),workDate:latest.work_date_kst,sourceItemRefs:matches.map(item=>({itemId:item.id,matchKey:buildSourceMatchKey(item)})),snapshot:{workDate:latest.work_date_kst,company:joined("company_name_snapshot"),trade:joined("trade_name_snapshot"),workDescription:joined("work_description"),location:joined("location_text")}};
   return {status:latest.id===original.id?"LINKED":"RELINKED",reference,warning:null};
  }
  if(sourceType==="CONSTRUCTION_MONTHLY_PLAN"){
   const sourceScope=await env.DB.prepare("SELECT site_id FROM construction_monthly_plans WHERE id=?1").bind(sourceId).first();
   if(sourceScope&&sourceScope.site_id!==siteId)throw new ApiError(403,"ISSUE_SOURCE_SCOPE_DENIED","다른 현장의 원본 작업은 연결할 수 없습니다.");
   const plan=await env.DB.prepare("SELECT id,site_id,start_date,revision,contractor_company_name_snapshot,trade_label,location_text,work_description FROM construction_monthly_plans WHERE id=?1 AND site_id=?2 AND status<>'CANCELLED'").bind(sourceId,siteId).first();
   if(!plan||Number(plan.revision)<sourceRevision)return detached();
   return {status:Number(plan.revision)===sourceRevision?"LINKED":"RELINKED",reference:{sourceType,sourceId:plan.id,sourceRevision:Number(plan.revision),workDate:plan.start_date,sourceItemRefs:[],snapshot:{workDate:plan.start_date,company:plan.contractor_company_name_snapshot||null,trade:plan.trade_label||null,workDescription:plan.work_description,location:plan.location_text||null}},warning:null};
  }
  return detached();
 }catch(error){if(error instanceof ApiError)throw error;return detached()}
}

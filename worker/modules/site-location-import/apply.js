import {ApiError} from "../../core/response.js";

const CHUNK=10;
const chunks=items=>Array.from({length:Math.ceil(items.length/CHUNK)},(_,index)=>items.slice(index*CHUNK,(index+1)*CHUNK));
const values=(count,width)=>Array.from({length:count},(_,row)=>`(${Array.from({length:width},(_,column)=>`?${row*width+column+1}`).join(",")})`).join(",");
const bindRows=(statement,rows,fields)=>statement.bind(...rows.flatMap(row=>fields.map(field=>row[field]??null)));

export function buildLocationImportApplyStatements(env,{importRow,siteId,userId,idempotencyKey,payloadHash,diff,requestId,response}){
  const statements=[],by=type=>diff.operations.filter(item=>item.type===type);
  for(const group of chunks(by("ADD").map(item=>item.after)))statements.push(bindRows(env.DB.prepare(`INSERT INTO site_locations(id,site_id,parent_id,location_type,canonical_key,display_name,sort_order,source,is_active) VALUES ${values(group.length,9)}`),group,["id","siteId","parentId","locationType","canonicalKey","displayName","sortOrder","source","isActive"]));
  for(const item of [...by("UPDATE"),...by("INACTIVE")])statements.push(env.DB.prepare("UPDATE site_locations SET parent_id=?3,location_type=?4,canonical_key=?5,display_name=?6,sort_order=?7,is_active=?8,updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND site_id=?2 AND source='IMPORT'").bind(item.id,siteId,item.after.parentId,item.after.locationType,item.after.canonicalKey,item.after.displayName,item.after.sortOrder,item.after.isActive));
  for(const group of chunks(by("ALIAS_ADD").map(item=>item.after)))statements.push(bindRows(env.DB.prepare(`INSERT INTO site_location_aliases(id,site_id,location_id,alias_text,normalized_alias,alias_type,source,is_active) VALUES ${values(group.length,8)}`),group,["id","siteId","locationId","aliasText","normalizedAlias","aliasType","source","isActive"]));
  for(const item of [...by("ALIAS_UPDATE"),...by("ALIAS_INACTIVE")])statements.push(env.DB.prepare("UPDATE site_location_aliases SET alias_text=?3,alias_type=?4,is_active=?5,updated_at=CURRENT_TIMESTAMP WHERE id=?1 AND site_id=?2 AND source='IMPORT'").bind(item.id,siteId,item.after.aliasText,item.after.aliasType,item.after.isActive));
  statements.push(env.DB.prepare(`UPDATE site_location_imports SET status='APPLIED',applied_at=CURRENT_TIMESTAMP,added_count=?3,updated_count=?4,unchanged_count=?5,inactivated_count=?6,alias_added_count=?7,alias_updated_count=?8,alias_inactivated_count=?9,error_count=0 WHERE id=?1 AND site_id=?2 AND status='APPLYING'`).bind(importRow.id,siteId,diff.counts.added,diff.counts.updated,diff.counts.unchanged,diff.counts.inactivated,diff.counts.aliasAdded,diff.counts.aliasUpdated,diff.counts.aliasInactivated));
  statements.push(env.DB.prepare("INSERT INTO audit_logs(id,actor_user_id,action,outcome,request_id,metadata_json) VALUES(?1,?2,'SITE_LOCATION_IMPORT_APPLIED','ALLOWED',?3,?4)").bind(crypto.randomUUID(),userId,requestId,JSON.stringify({siteId,importId:importRow.id,counts:diff.counts,newMasterFingerprint:response.newMasterFingerprint})));
  statements.push(env.DB.prepare("INSERT INTO issue_idempotency(user_id,idempotency_key,operation,resource_id,payload_hash,expires_at) VALUES(?1,?2,?3,?4,?5,datetime('now','+7 days'))").bind(userId,idempotencyKey,`SITE_LOCATION_IMPORT_APPLY:${importRow.id}`,importRow.id,payloadHash));
  return statements;
}

export async function applyLocationImport({env,repository,importRow,siteId,userId,idempotencyKey,payloadHash,diff,fileHash="file-a",requestId}){
  const replay=await repository.getApplyReplay(env,{siteId,userId,importId:importRow.id,idempotencyKey});
  if(replay){if(replay.payload_hash!==payloadHash)throw new ApiError(409,"IDEMPOTENCY_PAYLOAD_MISMATCH","The Idempotency-Key was already used with a different payload.");return replay.response_json?JSON.parse(replay.response_json):replay.response}
  if(fileHash!==importRow.file_hash||diff.baseMasterFingerprint!==importRow.base_master_fingerprint||diff.previewHash!==importRow.preview_hash)throw new ApiError(409,"LOCATION_IMPORT_PREVIEW_STALE","The file or Location Master changed after preview.");
  if(diff.counts.error||diff.operations.some(item=>item.type==="ERROR"))throw new ApiError(409,"LOCATION_IMPORT_PREVIEW_STALE","The import is no longer valid.");
  if(!await repository.beginLocationImportApply(env,siteId,importRow.id))throw new ApiError(409,"LOCATION_IMPORT_STATE_INVALID","The import state changed. Refresh and try again.");
  const newMasterFingerprint=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(`${diff.baseMasterFingerprint}:${diff.previewHash}`)).then(value=>[...new Uint8Array(value)].map(byte=>byte.toString(16).padStart(2,"0")).join(""));
  const response={importId:importRow.id,status:"APPLIED",counts:diff.counts,newMasterFingerprint};
  try{
    const args={importRow,siteId,userId,idempotencyKey,payloadHash,diff,requestId,response,buildStatements:buildLocationImportApplyStatements};
    const statements=repository.buildLocationImportApplyStatements?await repository.buildLocationImportApplyStatements(args):buildLocationImportApplyStatements(env,args);
    await env.DB.batch(statements);
    return response;
  }catch(error){try{await repository.markLocationImportApplyFailed(env,siteId,importRow.id)}catch{}throw error}
}

const results=value=>value?.results??[];
const unique=values=>[...new Set(values.map(value=>String(value??"").trim()).filter(Boolean))];
const encoder=new TextEncoder(),IDENTITY_JSON_BYTES=1536*1024;
const jsonChunks=values=>{const out=[];let rows=[],size=2;const flush=()=>{if(rows.length){out.push(JSON.stringify(rows));rows=[];size=2}};for(const value of values){const encoded=JSON.stringify(value),bytes=encoder.encode(encoded).byteLength;if(rows.length&&size+bytes+1>IDENTITY_JSON_BYTES)flush();rows.push(value);size+=bytes+(rows.length>1?1:0)}flush();return out};

export async function loadLocationImportIdentityGuards(env,siteId,workbook={}){
  const locationIds=unique((workbook.locations??[]).map(row=>row.locationId??row.id));
  const locationReferences=unique([...locationIds,...(workbook.locations??[]).map(row=>row.parentLocationId??row.parentId)]);
  const locationChunks=jsonChunks(locationReferences),statements=locationChunks.map(values=>env.DB.prepare("SELECT id FROM site_locations WHERE site_id<>?1 AND id IN (SELECT value FROM json_each(?2))").bind(siteId,values));
  const rows=statements.length?await env.DB.batch(statements):[];
  return {
    foreignLocationIds:new Set(rows.flatMap(results).map(row=>row.id))
  };
}

export async function loadLocationMasterSnapshot(env,siteId){
  const [locations,aliases,revision]=await env.DB.batch([
    env.DB.prepare("SELECT id,site_id,parent_id,location_type,canonical_key,display_name,sort_order,source,is_active FROM site_locations WHERE site_id=?1 ORDER BY id").bind(siteId),
    env.DB.prepare("SELECT id,site_id,location_id,alias_text,normalized_alias,alias_type,source,is_active FROM site_location_aliases WHERE site_id=?1 ORDER BY id").bind(siteId),
    env.DB.prepare("SELECT revision FROM site_location_master_revisions WHERE site_id=?1").bind(siteId)
  ]);
  return {locations:results(locations),aliases:results(aliases),revision:Number(results(revision)[0]?.revision||0)};
}

export async function loadRecentLocationImports(env,siteId,limit=20){
  const bounded=Math.max(1,Math.min(50,Number(limit)||20));
  return results(await env.DB.prepare(`SELECT i.id,i.file_name,i.file_hash,i.template_version,i.status,i.created_at,i.validated_at,i.applied_at,
    i.added_count,i.updated_count,i.unchanged_count,i.inactivated_count,i.alias_added_count,i.alias_updated_count,i.alias_inactivated_count,i.error_count,
    u.display_name created_by_name FROM site_location_imports i LEFT JOIN users u ON u.id=i.created_by WHERE i.site_id=?1 ORDER BY i.created_at DESC LIMIT ?2`).bind(siteId,bounded).all());
}

export async function loadLocationImportCleanupCandidates(env,siteId,limit=20){
  const bounded=Math.max(1,Math.min(20,Number(limit)||20));
  return results(await env.DB.prepare(`SELECT id,site_id,file_name,file_hash,r2_object_key,artifact_object_key,status,
    CASE WHEN status IN ('READY','FAILED','INVALID') THEN validated_at WHEN status='APPLIED' THEN applied_at ELSE created_at END cleanup_activity_at FROM site_location_imports
    WHERE site_id=?1 AND r2_object_key IS NOT NULL AND (cleanup_claim_token IS NULL OR datetime(cleanup_claimed_at)<=datetime('now','-1 day')) AND (
      (status='UPLOADED' AND datetime(created_at)<=datetime('now','-1 day')) OR
      (status IN ('READY','FAILED') AND datetime(validated_at)<=datetime('now','-1 day')) OR
      (status='INVALID' AND datetime(validated_at)<=datetime('now','-16 minutes')) OR
      (status='APPLIED' AND datetime(applied_at)<=datetime('now','-16 minutes')) OR
      (status='CANCELLED' AND datetime(created_at)<=datetime('now','-16 minutes'))
    )
    ORDER BY created_at LIMIT ?2`).bind(siteId,bounded).all());
}

export async function claimLocationImportUploadCleanup(env,{siteId,importId,objectKey,status,activityAt,claimToken}){
  const result=await env.DB.prepare(`UPDATE site_location_imports SET cleanup_claim_token=?5,cleanup_claimed_at=CURRENT_TIMESTAMP
    WHERE id=?1 AND site_id=?2 AND r2_object_key=?3 AND status=?4 AND (cleanup_claim_token IS NULL OR datetime(cleanup_claimed_at)<=datetime('now','-1 day'))
      AND (CASE WHEN status IN ('READY','FAILED','INVALID') THEN validated_at WHEN status='APPLIED' THEN applied_at ELSE created_at END)=?6`).bind(importId,siteId,objectKey,status,claimToken,activityAt).run();
  return Number(result?.meta?.changes||0)===1;
}

export async function completeLocationImportUploadCleanup(env,{siteId,importId,objectKey,status,claimToken}){
  const terminal=status==="APPLIED"?"APPLIED":status==="INVALID"?"INVALID":"CANCELLED";
  const result=await env.DB.prepare("UPDATE site_location_imports SET r2_object_key=NULL,status=?4,cleanup_claim_token=NULL,cleanup_claimed_at=NULL WHERE id=?1 AND site_id=?2 AND r2_object_key=?3 AND status=?5 AND cleanup_claim_token=?6").bind(importId,siteId,objectKey,terminal,status,claimToken).run();
  return Number(result?.meta?.changes||0)===1;
}

export async function releaseLocationImportUploadCleanup(env,{siteId,importId,objectKey,status,claimToken}){
  const result=await env.DB.prepare("UPDATE site_location_imports SET cleanup_claim_token=NULL,cleanup_claimed_at=NULL WHERE id=?1 AND site_id=?2 AND r2_object_key=?3 AND status=?4 AND cleanup_claim_token=?5").bind(importId,siteId,objectKey,status,claimToken).run();
  return Number(result?.meta?.changes||0)===1;
}

export async function clearLocationImportUploadObject(env,{siteId,importId,objectKey}){
  return env.DB.prepare("UPDATE site_location_imports SET r2_object_key=NULL WHERE id=?1 AND site_id=?2 AND r2_object_key=?3").bind(importId,siteId,objectKey).run();
}

export async function countActiveFixedLocations(env,siteId){
  const row=await env.DB.prepare("SELECT COUNT(*) count FROM site_locations WHERE site_id=?1 AND is_active=1").bind(siteId).first();
  return Number(row?.count||0);
}

export function getLocationImport(env,siteId,importId){
  return env.DB.prepare("SELECT * FROM site_location_imports WHERE id=?1 AND site_id=?2").bind(importId,siteId).first();
}

export async function createLocationImport(env,row){
  await env.DB.prepare(`INSERT INTO site_location_imports(id,site_id,file_name,file_hash,r2_object_key,template_version,status,created_by)
    VALUES(?1,?2,?3,?4,?5,'SIMPLE_LOCATION_LIST_V2','UPLOADED',?6)`).bind(row.id,row.siteId,row.fileName,row.fileHash,row.r2ObjectKey,row.createdBy).run();
  return row;
}

export async function beginLocationImportValidation(env,siteId,importId,claimToken){
  if(!claimToken)return false;
  const result=await env.DB.prepare(`UPDATE site_location_imports SET status='VALIDATING',validation_claim_token=?3,validation_claimed_at=CURRENT_TIMESTAMP
    WHERE id=?1 AND site_id=?2 AND cleanup_claim_token IS NULL AND ((status IN ('UPLOADED','INVALID','READY') AND validation_claim_token IS NULL) OR (status='VALIDATING' AND validation_claim_token IS NOT NULL AND datetime(validation_claimed_at)<=datetime('now','-15 minutes')))` ).bind(importId,siteId,claimToken).run();
  return Number(result?.meta?.changes||0)===1;
}

export async function updateLocationImportValidation(env,row){
  const result=await env.DB.prepare(`UPDATE site_location_imports SET status=?3,base_master_fingerprint=?4,preview_hash=?5,validated_at=CURRENT_TIMESTAMP,
    added_count=?6,updated_count=?7,unchanged_count=?8,inactivated_count=?9,alias_added_count=?10,alias_updated_count=?11,alias_inactivated_count=?12,error_count=?13
    ,base_master_revision=?14,validation_claim_token=NULL,validation_claimed_at=NULL WHERE id=?1 AND site_id=?2 AND status='VALIDATING' AND validation_claim_token=?15`).bind(row.id,row.siteId,row.status,row.baseMasterFingerprint??null,row.previewHash??null,row.counts.added??0,row.counts.updated??0,row.counts.unchanged??0,row.counts.inactivated??0,row.counts.aliasAdded??0,row.counts.aliasUpdated??0,row.counts.aliasInactivated??0,row.counts.error??0,row.baseMasterRevision??null,row.validationClaimToken).run();
  return Number(result?.meta?.changes||0)===1;
}

export async function getApplyReplay(env,{siteId,userId,importId,idempotencyKey}){
  const row=await env.DB.prepare("SELECT payload_hash,response_json FROM site_location_import_idempotency WHERE site_id=?1 AND import_id=?2 AND user_id=?3 AND idempotency_key=?4 AND datetime(expires_at)>datetime('now')").bind(siteId,importId,userId,idempotencyKey).first();
  if(!row)return null;
  return {...row,response:JSON.parse(row.response_json)};
}

export async function beginLocationImportApply(env,siteId,importId,claimToken){
  if(!claimToken)return false;
  const result=await env.DB.prepare(`UPDATE site_location_imports SET status='APPLYING',apply_claim_token=?3,apply_claimed_at=CURRENT_TIMESTAMP
    WHERE id=?1 AND site_id=?2 AND cleanup_claim_token IS NULL AND ((status='READY' AND apply_claim_token IS NULL) OR (status='APPLYING' AND apply_claim_token IS NOT NULL AND datetime(apply_claimed_at)<=datetime('now','-15 minutes')))` ).bind(importId,siteId,claimToken).run();
  return Number(result?.meta?.changes||0)===1;
}

export async function restoreLocationImportApplyReady(env,siteId,importId,claimToken){
  const result=await env.DB.prepare("UPDATE site_location_imports SET status='READY',apply_claim_token=NULL,apply_claimed_at=NULL WHERE id=?1 AND site_id=?2 AND status='APPLYING' AND apply_claim_token=?3").bind(importId,siteId,claimToken).run();
  return Number(result?.meta?.changes||0)===1;
}

const results=value=>value?.results??[];

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

export async function countActiveFixedLocations(env,siteId){
  const row=await env.DB.prepare("SELECT COUNT(*) count FROM site_locations WHERE site_id=?1 AND is_active=1").bind(siteId).first();
  return Number(row?.count||0);
}

export function getLocationImport(env,siteId,importId){
  return env.DB.prepare("SELECT * FROM site_location_imports WHERE id=?1 AND site_id=?2").bind(importId,siteId).first();
}

export async function createLocationImport(env,row){
  await env.DB.prepare(`INSERT INTO site_location_imports(id,site_id,file_name,file_hash,r2_object_key,template_version,status,created_by)
    VALUES(?1,?2,?3,?4,?5,'v1','UPLOADED',?6)`).bind(row.id,row.siteId,row.fileName,row.fileHash,row.r2ObjectKey,row.createdBy).run();
  return row;
}

export async function beginLocationImportValidation(env,siteId,importId){
  const result=await env.DB.prepare("UPDATE site_location_imports SET status='VALIDATING' WHERE id=?1 AND site_id=?2 AND status IN ('UPLOADED','INVALID','READY')").bind(importId,siteId).run();
  return Number(result?.meta?.changes||0)===1;
}

export async function updateLocationImportValidation(env,row){
  const result=await env.DB.prepare(`UPDATE site_location_imports SET status=?3,base_master_fingerprint=?4,preview_hash=?5,validated_at=CURRENT_TIMESTAMP,
    added_count=?6,updated_count=?7,unchanged_count=?8,inactivated_count=?9,alias_added_count=?10,alias_updated_count=?11,alias_inactivated_count=?12,error_count=?13
    ,base_master_revision=?14 WHERE id=?1 AND site_id=?2 AND status='VALIDATING'`).bind(row.id,row.siteId,row.status,row.baseMasterFingerprint??null,row.previewHash??null,row.counts.added??0,row.counts.updated??0,row.counts.unchanged??0,row.counts.inactivated??0,row.counts.aliasAdded??0,row.counts.aliasUpdated??0,row.counts.aliasInactivated??0,row.counts.error??0,row.baseMasterRevision??null).run();
  return Number(result?.meta?.changes||0)===1;
}

export async function getApplyReplay(env,{siteId,userId,importId,idempotencyKey}){
  const row=await env.DB.prepare("SELECT payload_hash,response_json FROM site_location_import_idempotency WHERE site_id=?1 AND import_id=?2 AND user_id=?3 AND idempotency_key=?4 AND datetime(expires_at)>datetime('now')").bind(siteId,importId,userId,idempotencyKey).first();
  if(!row)return null;
  return {...row,response:JSON.parse(row.response_json)};
}

export async function beginLocationImportApply(env,siteId,importId){
  const result=await env.DB.prepare("UPDATE site_location_imports SET status='APPLYING' WHERE id=?1 AND site_id=?2 AND status='READY'").bind(importId,siteId).run();
  return Number(result?.meta?.changes||0)===1;
}

export async function markLocationImportApplyFailed(env,siteId,importId){
  return env.DB.prepare("UPDATE site_location_imports SET status='FAILED' WHERE id=?1 AND site_id=?2 AND status='READY'").bind(importId,siteId).run();
}

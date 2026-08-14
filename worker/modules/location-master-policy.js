const rows=result=>result?.results??[];

export async function hasAppliedLocationImport(env,siteId){
  const row=await env.DB.prepare("SELECT 1 applied FROM site_location_imports WHERE site_id=?1 AND status='APPLIED' LIMIT 1").bind(siteId).first();
  return Boolean(row?.applied);
}

export async function loadEffectiveIssueLocations(env,siteId){
  const importMode=await hasAppliedLocationImport(env,siteId);
  const query=`SELECT id,location_type,code,display_name,parent_id FROM site_locations WHERE site_id=?1 AND is_active=1${importMode?" AND source='IMPORT'":""} ORDER BY sort_order,display_name`;
  return rows(await env.DB.prepare(query).bind(siteId).all());
}

export async function countEffectiveActiveLocations(env,siteId){
  const importMode=await hasAppliedLocationImport(env,siteId);
  const query=`SELECT COUNT(*) count FROM site_locations WHERE site_id=?1 AND is_active=1${importMode?" AND source='IMPORT'":""}`;
  const row=await env.DB.prepare(query).bind(siteId).first();
  return Number(row?.count||0);
}

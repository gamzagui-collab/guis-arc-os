import { json } from "../utils/response.js";

export async function createDemoSite(request, env){
  const siteCode = "DEMO-001", pin = "1234";
  await env.DB.prepare(`INSERT OR REPLACE INTO sites(site_code, pin, site_name, site_type, created_at) VALUES(?, ?, ?, ?, datetime('now'))`)
    .bind(siteCode, pin, "김제 샘플현장", "학교").run();
  return json({ok:true, site:{siteCode, pin, siteName:"김제 샘플현장", siteType:"학교"}});
}

export async function loginSite(request, env){
  const {siteCode, pin} = await request.json();
  const row = await env.DB.prepare(`SELECT site_code as siteCode, site_name as siteName, site_type as siteType FROM sites WHERE site_code=? AND pin=?`)
    .bind(siteCode, pin).first();
  if(!row) return json({ok:false, message:"현장코드 또는 PIN이 맞지 않습니다."},401);
  return json({ok:true, site:row});
}

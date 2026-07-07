import { json } from "../utils/response.js";

function normalizeCode(code){
  return String(code || "").trim().toUpperCase();
}

export async function createDemoSite(request, env){
  const siteCode = "DEMO-001", pin = "1234";
  await env.DB.prepare(`INSERT OR REPLACE INTO sites(site_code, pin, site_name, site_type, created_at) VALUES(?, ?, ?, ?, datetime('now'))`)
    .bind(siteCode, pin, "김제 샘플현장", "학교").run();

  const site = await env.DB.prepare("SELECT id FROM sites WHERE site_code=?").bind(siteCode).first();
  await env.DB.prepare(`INSERT OR REPLACE INTO site_profiles(site_id, client_name, contractor_name, supervisor_name, start_date, end_date, project_amount, scale_text, payload, updated_at)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`)
    .bind(site.id, "샘플 발주처", "샘플 시공사", "샘플 감리단", "", "", "", "지상 4층", JSON.stringify({siteType:"school"})).run();

  return json({ok:true, site:{siteCode, pin, siteName:"김제 샘플현장", siteType:"학교"}});
}

export async function createSite(request, env){
  const body = await request.json();
  const siteCode = normalizeCode(body.siteCode);
  const pin = String(body.pin || "").trim();
  const siteName = String(body.siteName || "").trim();
  const siteType = String(body.siteType || "school").trim();

  if(!siteCode || !pin || !siteName){
    return json({ok:false, message:"현장명, 현장코드, PIN은 필수입니다."},400);
  }

  await env.DB.prepare(`INSERT INTO sites(site_code, pin, site_name, site_type, created_at) VALUES(?, ?, ?, ?, datetime('now'))`)
    .bind(siteCode, pin, siteName, siteType).run();

  const site = await env.DB.prepare("SELECT id FROM sites WHERE site_code=?").bind(siteCode).first();
  await env.DB.prepare(`INSERT INTO site_profiles(site_id, client_name, contractor_name, supervisor_name, start_date, end_date, project_amount, scale_text, payload, updated_at)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`)
    .bind(site.id, body.clientName || "", body.contractorName || "", body.supervisorName || "", body.startDate || "", body.endDate || "", body.projectAmount || "", body.scaleText || "", JSON.stringify(body)).run();

  return json({ok:true, site:{siteCode, siteName, siteType}});
}

export async function loginSite(request, env){
  const {siteCode, pin} = await request.json();
  const row = await env.DB.prepare(`SELECT id, site_code as siteCode, site_name as siteName, site_type as siteType FROM sites WHERE site_code=? AND pin=?`)
    .bind(normalizeCode(siteCode), String(pin || "").trim()).first();

  if(!row) return json({ok:false, message:"현장코드 또는 PIN이 맞지 않습니다."},401);
  return json({ok:true, site:row});
}

export async function saveSiteProfile(request, env){
  const {siteCode, pin, profile} = await request.json();
  const site = await env.DB.prepare("SELECT id FROM sites WHERE site_code=? AND pin=?").bind(normalizeCode(siteCode), String(pin || "").trim()).first();
  if(!site) return json({ok:false, message:"현장 인증 실패"},401);

  await env.DB.prepare(`INSERT OR REPLACE INTO site_profiles(id, site_id, client_name, contractor_name, supervisor_name, start_date, end_date, project_amount, scale_text, payload, updated_at)
    VALUES((SELECT id FROM site_profiles WHERE site_id=?), ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`)
    .bind(site.id, site.id, profile.clientName || "", profile.contractorName || "", profile.supervisorName || "", profile.startDate || "", profile.endDate || "", profile.projectAmount || "", profile.scaleText || "", JSON.stringify(profile)).run();

  return json({ok:true});
}

export async function getSiteBundle(request, env){
  const url = new URL(request.url);
  const siteCode = normalizeCode(url.searchParams.get("siteCode"));
  const pin = String(url.searchParams.get("pin") || "").trim();

  const site = await env.DB.prepare(`SELECT id, site_code as siteCode, site_name as siteName, site_type as siteType FROM sites WHERE site_code=? AND pin=?`)
    .bind(siteCode, pin).first();
  if(!site) return json({ok:false, message:"현장 인증 실패"},401);

  const profile = await env.DB.prepare("SELECT * FROM site_profiles WHERE site_id=?").bind(site.id).first();
  const schedules = await env.DB.prepare(`SELECT id, schedule_type as type, title, schedule_date as date, payload FROM schedules WHERE site_id=? ORDER BY schedule_date ASC`)
    .bind(site.id).all();
  const daily = await env.DB.prepare(`SELECT id, work_date as date, role, category, title, detail, is_done as isDone FROM daily_work_items WHERE site_id=? ORDER BY id DESC LIMIT 200`)
    .bind(site.id).all();

  return json({
    ok:true,
    site,
    profile: profile ? {...profile, payload: safeJson(profile.payload)} : null,
    schedules: (schedules.results || []).map(x => ({...x, payload: safeJson(x.payload)})),
    dailyWork: daily.results || []
  });
}

function safeJson(text){
  try{return JSON.parse(text || "{}");}catch{return {};}
}

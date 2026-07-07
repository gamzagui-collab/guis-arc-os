import { json } from "../utils/response.js";

function normalizeCode(code){ return String(code || "").trim().toUpperCase(); }

export async function saveSchedule(request, env){
  const {siteCode, pin, item} = await request.json();
  const site = await env.DB.prepare("SELECT id FROM sites WHERE site_code=? AND pin=?").bind(normalizeCode(siteCode), String(pin || "").trim()).first();
  if(!site) return json({ok:false, message:"현장 인증 실패"},401);

  await env.DB.prepare(`INSERT INTO schedules(site_id, schedule_type, title, schedule_date, payload, created_at) VALUES(?, ?, ?, ?, ?, datetime('now'))`)
    .bind(site.id, item.type, item.title, item.date, JSON.stringify(item)).run();

  return json({ok:true});
}

export async function listSchedule(request, env){
  const url = new URL(request.url);
  const siteCode = normalizeCode(url.searchParams.get("siteCode"));
  const pin = String(url.searchParams.get("pin") || "").trim();
  const site = await env.DB.prepare("SELECT id FROM sites WHERE site_code=? AND pin=?").bind(siteCode, pin).first();
  if(!site) return json({ok:false, message:"현장 인증 실패"},401);

  const rows = await env.DB.prepare(`SELECT id, schedule_type as type, title, schedule_date as date, payload FROM schedules WHERE site_id=? ORDER BY schedule_date ASC`)
    .bind(site.id).all();

  return json({ok:true, rows:(rows.results || []).map(x => ({...x, payload: safeJson(x.payload)}))});
}

export async function saveDailyWork(request, env){
  const {siteCode, pin, items} = await request.json();
  const site = await env.DB.prepare("SELECT id FROM sites WHERE site_code=? AND pin=?").bind(normalizeCode(siteCode), String(pin || "").trim()).first();
  if(!site) return json({ok:false, message:"현장 인증 실패"},401);

  for(const item of (items || [])){
    await env.DB.prepare(`INSERT INTO daily_work_items(site_id, work_date, role, category, title, detail, is_done, created_at)
      VALUES(?, ?, ?, ?, ?, ?, ?, datetime('now'))`)
      .bind(site.id, item.date || new Date().toISOString().slice(0,10), item.role || "", item.category || "", item.title || "", item.detail || "", item.isDone ? 1 : 0).run();
  }

  return json({ok:true, count:(items || []).length});
}

function safeJson(text){ try{return JSON.parse(text || "{}");}catch{return {};} }

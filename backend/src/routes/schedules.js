import { json } from "../utils/response.js";

export async function saveSchedule(request, env){
  const {siteCode, pin, item} = await request.json();
  const site = await env.DB.prepare("SELECT id FROM sites WHERE site_code=? AND pin=?").bind(siteCode, pin).first();
  if(!site) return json({ok:false, message:"현장 인증 실패"},401);
  await env.DB.prepare(`INSERT INTO schedules(site_id, schedule_type, title, schedule_date, payload, created_at) VALUES(?, ?, ?, ?, ?, datetime('now'))`)
    .bind(site.id, item.type, item.title, item.date, JSON.stringify(item)).run();
  return json({ok:true});
}

export async function listSchedule(request, env){
  const url = new URL(request.url);
  const siteCode = url.searchParams.get("siteCode"), pin = url.searchParams.get("pin");
  const site = await env.DB.prepare("SELECT id FROM sites WHERE site_code=? AND pin=?").bind(siteCode, pin).first();
  if(!site) return json({ok:false, message:"현장 인증 실패"},401);
  const rows = await env.DB.prepare(`SELECT id, schedule_type as type, title, schedule_date as date, payload FROM schedules WHERE site_id=? ORDER BY schedule_date ASC`)
    .bind(site.id).all();
  return json({ok:true, rows:rows.results || []});
}

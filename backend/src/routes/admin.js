import { json } from "../utils/response.js";

export async function systemStatus(request, env){
  let d1 = false;
  try{
    await env.DB.prepare("SELECT 1").first();
    d1 = true;
  }catch{}
  return json({
    ok: true,
    version: env.APP_VERSION || "7.7.0",
    name: env.APP_NAME || "GUI's Arc OS",
    checks: {
      worker: true,
      d1,
      time: new Date().toISOString()
    }
  });
}

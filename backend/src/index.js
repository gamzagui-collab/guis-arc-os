import { json, corsHeaders } from "./utils/response.js";
import { createDemoSite, loginSite, createSite, saveSiteProfile, getSiteBundle } from "./routes/sites.js";
import { saveSchedule, listSchedule, saveDailyWork } from "./routes/schedules.js";
import { aiBriefing } from "./routes/assistant.js";

export default {
  async fetch(request, env) {
    if(request.method === "OPTIONS") return new Response(null,{headers:corsHeaders()});
    const url = new URL(request.url);
    try{
      if(url.pathname === "/health") return json({ok:true, name:"GUI's Arc OS API", version:"7.0.0"});
      if(url.pathname === "/site/demo" && request.method === "POST") return createDemoSite(request, env);
      if(url.pathname === "/site/create" && request.method === "POST") return createSite(request, env);
      if(url.pathname === "/site/profile" && request.method === "POST") return saveSiteProfile(request, env);
      if(url.pathname === "/site/bundle" && request.method === "GET") return getSiteBundle(request, env);
      if(url.pathname === "/site/login" && request.method === "POST") return loginSite(request, env);
      if(url.pathname === "/schedule" && request.method === "POST") return saveSchedule(request, env);
      if(url.pathname === "/schedule" && request.method === "GET") return listSchedule(request, env);
      if(url.pathname === "/daily-work" && request.method === "POST") return saveDailyWork(request, env);
      if(url.pathname === "/ai/briefing" && request.method === "POST") return aiBriefing(request, env);
      return json({ok:false, message:"not found"},404);
    }catch(error){return json({ok:false, message:error.message},500);}
  }
}

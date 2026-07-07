import { json, corsHeaders } from "./utils/response.js";
import { createDemoSite, loginSite } from "./routes/sites.js";
import { saveSchedule, listSchedule } from "./routes/schedules.js";

export default {
  async fetch(request, env) {
    if(request.method === "OPTIONS") return new Response(null,{headers:corsHeaders()});
    const url = new URL(request.url);
    try{
      if(url.pathname === "/health") return json({ok:true, name:"GUI's Arc Enterprise API", version:"7.0.0"});
      if(url.pathname === "/site/demo" && request.method === "POST") return createDemoSite(request, env);
      if(url.pathname === "/site/login" && request.method === "POST") return loginSite(request, env);
      if(url.pathname === "/schedule" && request.method === "POST") return saveSchedule(request, env);
      if(url.pathname === "/schedule" && request.method === "GET") return listSchedule(request, env);
      return json({ok:false, message:"not found"},404);
    }catch(error){return json({ok:false, message:error.message},500);}
  }
}

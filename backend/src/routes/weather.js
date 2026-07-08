import { json } from "../utils/response.js";

export async function weatherDemo(request, env){
  return json({
    ok: true,
    version: env.APP_VERSION || "8.2.0",
    message: "Weather API route foundation ready",
    models: ["KMA", "ECMWF", "GFS", "JMA"],
    next: "Connect existing v6.4 weather proxy and real forecast APIs"
  });
}

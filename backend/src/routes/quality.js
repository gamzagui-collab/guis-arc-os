import { json } from "../utils/response.js";

export async function qualityInfo(request, env){
  return json({
    ok: true,
    version: env.APP_VERSION || "8.5.0",
    name: "Quality Knowledge Engine",
    modules: ["concrete_specimen_calculator", "fresh_concrete_tests", "photo_points", "quality_checklist"]
  });
}

import { json } from "../utils/response.js";

export async function csiInfo(request, env){
  return json({
    ok: true,
    version: env.APP_VERSION || "8.4.0",
    name: "Construction Stress Index",
    message: "기온·습도·풍속·작업종류·작업위치를 반영하는 현장 체감위험도 산출 구조입니다."
  });
}

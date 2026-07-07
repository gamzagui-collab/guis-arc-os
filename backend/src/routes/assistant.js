import { json } from "../utils/response.js";

export async function aiBriefing(request, env){
  const payload = await request.json().catch(() => ({}));
  return json({
    ok: true,
    mode: "rule-based-foundation",
    message: "AI 현장비서 서버 연동 준비 완료",
    input: payload,
    outputs: ["사고위험 TOP5", "품질문제 TOP3", "감리지적 TOP3", "역할별 할 일", "TBM"]
  });
}

import { buildTodayBriefing } from "./todayWorkEngine.js";

export const ROLE_DEFINITIONS = {
  director: {
    title: "현장소장",
    subtitle: "오늘 현장 판단과 지시사항",
    focus: ["작업 진행 여부", "위험공정 통제", "날씨에 따른 작업순서", "품질·안전 누락 확인"],
    color: "role-director"
  },
  safety: {
    title: "안전관리",
    subtitle: "오늘 위험작업과 TBM 중심",
    focus: ["추락·낙하·끼임", "장비 작업반경", "온열·강우·풍속", "TBM 전달사항"],
    color: "role-safety"
  },
  quality: {
    title: "품질관리",
    subtitle: "시험·검측·사진·감리지적 예방",
    focus: ["공시체·시험", "검측 사진", "자재 품질서류", "양생·균열·재료분리"],
    color: "role-quality"
  },
  construction: {
    title: "공사관리",
    subtitle: "공정·작업순서·협력업체 조율",
    focus: ["오늘 작업순서", "후속공정", "레미콘·장비 동선", "작업구역 간섭"],
    color: "role-construction"
  },
  resource: {
    title: "자재·장비관리",
    subtitle: "반입·하역·장비점검·동선 관리",
    focus: ["자재 검수", "하역구역 통제", "장비점검표", "작업반경·신호수"],
    color: "role-resource"
  }
};

export function buildRoleBriefing(roleKey){
  const b = buildTodayBriefing();
  const def = ROLE_DEFINITIONS[roleKey];
  const roleMap = {
    director: "현장소장",
    safety: "안전관리자",
    quality: "품질관리자",
    construction: "공사관리자",
    resource: "자재관리자"
  };
  const roleName = roleMap[roleKey];
  let actions = b.roleActions[roleName] || [];

  if(roleKey === "resource"){
    actions = [...(b.roleActions["자재관리자"] || []), ...(b.roleActions["장비관리자"] || [])];
  }

  return {
    def,
    today: b.today,
    weather: b.weather,
    specimen: b.specimen,
    actions,
    commonActions: b.actions,
    photos: b.photoPoints,
    tbm: b.tbm
  };
}

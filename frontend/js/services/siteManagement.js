export const SITE_TYPE_PRESETS = {
  apartment: {
    name: "아파트",
    methods: ["갱폼", "알루미늄폼", "타워크레인", "펌프카"],
    trades: ["갱폼작업", "AL폼작업", "철근공사", "콘크리트 타설", "타워크레인 양중"],
    risks: ["고층 추락", "갱폼 인양", "타워크레인 양중", "레미콘 차량 동선"]
  },
  school: {
    name: "학교",
    methods: ["재래식 거푸집", "시스템동바리", "소형 펌프카", "외부비계"],
    trades: ["철근공사", "거푸집공사", "콘크리트 타설", "조적공사", "방수공사"],
    risks: ["협소부지 동선혼재", "자재하역", "외부비계 추락", "타설 품질"]
  },
  public: {
    name: "공공청사",
    methods: ["철근콘크리트", "커튼월", "석공사"],
    trades: ["철근공사", "콘크리트 타설", "커튼월", "석공사", "기계설비"],
    risks: ["외부마감 추락", "크레인 양중", "감리검측", "마감 품질"]
  },
  commercial: {
    name: "상가",
    methods: ["철근콘크리트", "철골", "외장공사"],
    trades: ["철골공사", "크레인작업", "콘크리트 타설", "외장공사"],
    risks: ["협소부지 장비동선", "도로점용", "외부비계", "민원"]
  }
};

export function getSitePreset(siteType){
  return SITE_TYPE_PRESETS[siteType] || SITE_TYPE_PRESETS.school;
}

export function buildActionsFromSchedule(schedules = [], weatherRisk = "주의"){
  const actions = [];
  for(const item of schedules){
    if(item.type === "타설"){
      actions.push({role:"안전", category:"장비", title:"펌프카 아웃트리거·받침판 확인", detail:`${item.title} 타설 전 펌프카 전도 위험 확인`});
      actions.push({role:"공사", category:"타설", title:"레미콘 대기공간·진입로 확보", detail:`${item.title} 타설순서와 차량 동선 확인`});
      actions.push({role:"품질", category:"품질", title:"슬럼프·공기량·공시체 확인", detail:"강수 예보 시 보양재와 추가 공시체 검토"});
    }
    if(item.type === "자재"){
      actions.push({role:"안전", category:"하역", title:"하역구역 출입통제 및 신호수 배치", detail:"지게차 후진동선과 보행자 동선 분리"});
      actions.push({role:"자재", category:"검수", title:"규격·수량·보관위치 확인", detail:"자재승인서와 납품서 확인"});
    }
    if(item.type === "장비"){
      actions.push({role:"장비", category:"장비", title:"장비점검표와 작업반경 확인", detail:"강풍 시 작업중지 기준 확인"});
      actions.push({role:"안전", category:"통제", title:"작업반경 출입통제", detail:"신호수 배치와 유도 동선 확인"});
    }
  }
  if(weatherRisk !== "정상"){
    actions.push({role:"안전", category:"기상", title:"기상위험 시간대 집중순회", detail:"07~17시 강수·풍속·체감온도 위험 시간 확인"});
  }
  return actions;
}

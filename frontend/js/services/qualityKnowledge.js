export const QUALITY_KNOWLEDGE = {
  "version": "8.5",
  "notice": "초기 업무 보조 DB입니다. 현장 시방서, 감리 지시, 최신 KCS/KS/법령을 우선 확인해야 합니다.",
  "concrete": {
    "standards": [
      "KCS 14 20 10 일반콘크리트",
      "KS F 2403 콘크리트의 강도 시험용 공시체 제작 방법",
      "KS F 2405 콘크리트의 압축강도 시험방법",
      "현장 품질관리계획서 및 특기시방서"
    ],
    "specimenGroups": [
      {
        "id": "vertical_strip",
        "name": "수직부재 탈형강도",
        "defaultRequired": true,
        "groupCount": 1,
        "piecesPerGroup": 3,
        "description": "벽·기둥 등 수직부재 거푸집 해체 판단용"
      },
      {
        "id": "horizontal_strip",
        "name": "수평부재 탈형강도",
        "defaultRequired": true,
        "groupCount": 1,
        "piecesPerGroup": 3,
        "description": "보·슬래브 등 수평부재 거푸집/동바리 해체 판단용"
      },
      {
        "id": "standard_28d",
        "name": "28일 표준양생 압축강도",
        "defaultRequired": true,
        "groupCount": 1,
        "piecesPerGroup": 3,
        "description": "설계기준강도 확인용 기본 압축강도 공시체"
      },
      {
        "id": "reserve",
        "name": "예비 공시체",
        "defaultRequired": false,
        "groupCount": 1,
        "piecesPerGroup": 3,
        "description": "강도 미달, 재시험, 현장 협의 대비용"
      },
      {
        "id": "early_strength",
        "name": "조기강도 확인",
        "defaultRequired": false,
        "groupCount": 1,
        "piecesPerGroup": 3,
        "description": "조기 탈형·후속공정 판단이 필요한 경우"
      }
    ],
    "freshConcreteTests": [
      "슬럼프",
      "공기량",
      "염화물량",
      "콘크리트 온도",
      "단위수량 또는 단위용적질량(현장 기준에 따름)",
      "납품서·배합표 확인"
    ],
    "qualityChecklist": [
      "타설 전 배근·거푸집·매립물 검측 완료",
      "레미콘 납품서와 배합 확인",
      "슬럼프·공기량·염화물·온도 시험",
      "공시체 채취 위치와 시간 기록",
      "공시체 표기: 현장명/부위/날짜/배합/시험목적",
      "현장양생 공시체는 구조물과 유사한 조건으로 보관",
      "강우 시 보양재·배수로·표면 빗물 유입 여부 확인",
      "양생계획과 초기 균열 관리 확인"
    ],
    "photoPoints": [
      "타설 전 검측 완료 사진",
      "레미콘 송장/납품서",
      "슬럼프 시험",
      "공기량 시험",
      "공시체 제작 및 라벨",
      "타설 중 다짐",
      "타설 후 보양"
    ]
  }
};

export function calculateConcreteSpecimens(options = {}){
  const selected = {
    vertical_strip: options.verticalStrip ?? true,
    horizontal_strip: options.horizontalStrip ?? true,
    standard_28d: options.standard28d ?? true,
    reserve: options.reserve ?? false,
    early_strength: options.earlyStrength ?? false
  };

  const rows = QUALITY_KNOWLEDGE.concrete.specimenGroups
    .filter(g => selected[g.id])
    .map(g => ({
      id: g.id,
      name: g.name,
      groupCount: Number(options[`${g.id}GroupCount`] || g.groupCount || 1),
      piecesPerGroup: g.piecesPerGroup,
      description: g.description,
      pieces: Number(options[`${g.id}GroupCount`] || g.groupCount || 1) * g.piecesPerGroup
    }));

  const totalGroups = rows.reduce((sum, r) => sum + r.groupCount, 0);
  const totalPieces = rows.reduce((sum, r) => sum + r.pieces, 0);

  return {rows, totalGroups, totalPieces};
}

export function buildConcreteQualityBrief(options = {}){
  const specimen = calculateConcreteSpecimens(options);
  return [
    "■ 콘크리트 타설 품질관리 요약",
    "",
    `공시체 합계: ${specimen.totalGroups}조 / ${specimen.totalPieces}개`,
    ...specimen.rows.map(r => `- ${r.name}: ${r.groupCount}조 × ${r.piecesPerGroup}개 = ${r.pieces}개`),
    "",
    "현장 시험:",
    ...QUALITY_KNOWLEDGE.concrete.freshConcreteTests.map(x => `- ${x}`),
    "",
    "주의: 현장 특기시방서, 감리 지시, 최신 KCS/KS 기준을 우선 확인하세요."
  ].join("\n");
}

export function getConcreteQualityChecklist(){
  return QUALITY_KNOWLEDGE.concrete.qualityChecklist;
}

export function getConcretePhotoPoints(){
  return QUALITY_KNOWLEDGE.concrete.photoPoints;
}

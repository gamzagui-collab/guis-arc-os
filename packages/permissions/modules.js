export const MODULES=[
 {code:"today",label:"오늘",path:"/today",children:[["현장 요약","/today"],["주요 일정","/today/schedule"],["실시간 현황","/today/live"],["주의사항","/today/notices"]]},
 {code:"workforce",label:"인력 관리",path:"/workforce",children:[["근로자 관리","/workforce/workers"],["가입 승인","/workforce/approvals"],["출역 현황","/workforce/live"]]},
 {code:"construction",label:"공사 관리",path:"/construction",children:[["공사 Today","/construction"],["공사일보","/construction/daily"],["월간계획","/construction/monthly-plan"],["출력일보 보관함","/construction/output-status"],["공정별 시공 검측","/construction/inspections"],["작업 계획","/construction/plans"],["공사 기록","/construction/records"]]},
 {code:"issue",label:"현장 이슈",path:"/issues",children:[["전체 이슈","/issues"],["이슈 등록","/issues/new"],["미조치","/issues/open"],["완료 확인","/issues/review"],["완료","/issues/completed"],["통계","/issues/statistics"]]},
 {code:"safety",label:"안전 관리",path:"/safety",children:[["안전 Today","/safety"],["안전 정기업무","/safety/periodic"],["위험·개선조치","/safety/cases"],["위험성평가","/safety/assessments"],["반복 원인","/safety/recurrence"],["안전 문서보관","/safety/documents"]]},
 {code:"quality",label:"품질 관리",path:"/quality",children:[["품질 Today","/quality"],["CSI 입력 준비","/quality/csi-preparation"],["시험·검사 관리","/quality/tests"],["시험성적서","/quality/certificates"],["부적합·시정조치","/quality/nonconformance"],["시험장비·검교정","/quality/calibration"],["품질 자료보관","/quality/documents"]]},
 {code:"materials",label:"자재 관리",path:"/materials",children:[["반입 예정","/materials"],["반입 실적","/materials/received"],["주요 자재","/materials/critical"],["승인 현황","/materials/approvals"]]},
 {code:"equipment",label:"장비 관리",path:"/equipment",children:[["투입 현황","/equipment"],["점검","/equipment/inspection"],["작업 일정","/equipment/schedule"],["장비 이력","/equipment/history"]]},
 {code:"documents",label:"문서 관리",path:"/documents",children:[["문서 작성","/documents"],["문서 양식","/documents/templates"],["결재 대기","/documents/approvals"],["보관함","/documents/archive"]]},
 {code:"admin",label:"통합 관리",path:"/admin",children:[["회사 관리","/admin/companies"],["공종 관리","/admin/trades"],["현장 참여 회사","/admin/site-companies"],["사용자 관리","/admin/users"],["사용자 초대","/admin/invitations"],["역할·권한","/admin/permissions"],["게시판 권한","/admin/board-access"]]}
];
export const byPath=path=>path.startsWith("/pwa/issues/")?MODULES.find(v=>v.code==="issue"):path.startsWith("/pwa/workforce")?MODULES.find(v=>v.code==="workforce"):MODULES.find(v=>path===v.path||v.children.some(([,child])=>path===child)||path.startsWith(v.path+"/"));
export const childByPath=path=>byPath(path)?.children.find(([,child])=>child===path);

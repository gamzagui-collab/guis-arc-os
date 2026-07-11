// GUI's Arc OS v9.5.1 Safety Duty Database
// 안전관리자 정기업무/발생업무 기준 DB. 화면과 오늘업무 스케줄러는 이 파일을 기준으로 동작한다.
export const SAFETY_DUTY_DB = [
  {
    "id": "daily-tbm",
    "group": "매일",
    "cycle": "daily",
    "type": "정기",
    "title": "작업 전 TBM 실시 및 전달사항 기록",
    "trigger": "매일 작업 전",
    "owner": "안전관리자/관리감독자",
    "documents": [
      "TBM 일지",
      "참석자 서명",
      "위험요인 전달사항",
      "사진"
    ],
    "evidence": [
      "서명",
      "사진"
    ],
    "legal": "위험성평가·TBM 실무관리",
    "source": "MOEL/KOSHA 위험성평가·TBM 안내",
    "sourceUrl": "https://www.moel.go.kr/",
    "priority": "high",
    "actions": [
      "금일 일정·날씨·고위험작업 공유",
      "작업반별 위험요인과 대책 확인",
      "신규근로자·협력업체 전달 여부 확인"
    ]
  },
  {
    "id": "daily-patrol",
    "group": "매일",
    "cycle": "daily",
    "type": "정기",
    "title": "현장 순회점검 및 즉시 시정조치",
    "trigger": "오전/오후 1회 이상",
    "owner": "안전관리자",
    "documents": [
      "순회점검일지",
      "지적사항 관리대장",
      "전·후 사진"
    ],
    "evidence": [
      "사진",
      "조치확인"
    ],
    "legal": "산업안전보건법 안전관리자 업무/사업주 조치",
    "source": "산업안전보건법",
    "sourceUrl": "https://www.law.go.kr/",
    "priority": "high",
    "actions": [
      "추락·낙하·협착·전도 위험 확인",
      "개구부·단부·통로·가설전기 확인",
      "시정조치 담당자와 완료시간 지정"
    ]
  },
  {
    "id": "daily-ppe",
    "group": "매일",
    "cycle": "daily",
    "type": "정기",
    "title": "보호구 착용 및 출입통제 확인",
    "trigger": "작업 시작 전/수시",
    "owner": "안전관리자/관리감독자",
    "documents": [
      "보호구 점검사진",
      "출입통제 사진",
      "방문자 교육대장"
    ],
    "evidence": [
      "사진"
    ],
    "legal": "산업안전보건기준에 관한 규칙",
    "source": "법제처 국가법령정보센터",
    "sourceUrl": "https://www.law.go.kr/",
    "priority": "normal",
    "actions": [
      "안전모·안전화·안전대 착용 확인",
      "타설·양중·하역 반경 출입통제",
      "외부 방문자 안전교육 확인"
    ]
  },
  {
    "id": "daily-weather",
    "group": "매일",
    "cycle": "daily",
    "type": "정기",
    "title": "강우·풍속·폭염/한랭 작업중지 기준 확인",
    "trigger": "작업 전 및 기상 변화 시",
    "owner": "안전관리자/공사관리자",
    "documents": [
      "기상확인 캡처",
      "작업조정 기록",
      "휴식·음수 관리사진"
    ],
    "evidence": [
      "캡처",
      "사진"
    ],
    "legal": "산업안전보건기준에 관한 규칙/온열질환 예방 가이드",
    "source": "MOEL/KOSHA",
    "sourceUrl": "https://www.kosha.or.kr/",
    "priority": "high",
    "actions": [
      "강수 피크 시간 확인",
      "풍속 상승 시 양중·고소작업 재검토",
      "폭염 시 물·그늘·휴식·체온관리 확인"
    ]
  },
  {
    "id": "daily-access",
    "group": "매일",
    "cycle": "daily",
    "type": "정기",
    "title": "출입자·신규투입자 확인",
    "trigger": "매일 출근/신규 투입 시",
    "owner": "안전관리자",
    "documents": [
      "출입자 명부",
      "신규자 확인표",
      "기초안전보건교육 이수증"
    ],
    "evidence": [
      "명부",
      "이수증"
    ],
    "legal": "산업안전보건법 안전보건교육",
    "source": "KOSHA 안전보건교육",
    "sourceUrl": "https://portal.kosha.or.kr/archive/laws/key-content/occupational-safety-health/education-safety-health",
    "priority": "high",
    "actions": [
      "신규자 여부 확인",
      "기초안전보건교육 이수증 확인",
      "현장 출입 전 기본수칙 전달"
    ]
  },
  {
    "id": "weekly-risk",
    "group": "주 1회",
    "cycle": "weekly",
    "type": "정기",
    "title": "위험성평가 이행상태 및 개선조치 점검",
    "trigger": "매주 월요일 권장",
    "owner": "안전관리자/원·하청",
    "documents": [
      "주간 위험성평가 이행점검표",
      "개선조치 대장",
      "회의록"
    ],
    "evidence": [
      "조치사진"
    ],
    "legal": "사업장 위험성평가에 관한 지침/상시평가",
    "source": "MOEL 위험성평가 안내",
    "sourceUrl": "https://www.moel.go.kr/",
    "priority": "high",
    "actions": [
      "금주 주요 공종 위험성평가 확인",
      "근로자 참여·공유 여부 확인",
      "미조치 위험요인 개선기한 재설정"
    ]
  },
  {
    "id": "weekly-equipment",
    "group": "주 1회",
    "cycle": "weekly",
    "type": "정기",
    "title": "장비·가설재·안전시설 주간 점검",
    "trigger": "매주 1회",
    "owner": "안전관리자/장비관리자",
    "documents": [
      "장비 점검표",
      "가설시설 점검표",
      "안전시설 점검사진"
    ],
    "evidence": [
      "점검표",
      "사진"
    ],
    "legal": "산업안전보건기준에 관한 규칙",
    "source": "법제처 국가법령정보센터",
    "sourceUrl": "https://www.law.go.kr/",
    "priority": "normal",
    "actions": [
      "크레인·펌프카·고소작업대 점검표 확인",
      "비계·동바리·작업발판 상태 확인",
      "소화기·분전반·임시전기 상태 확인"
    ]
  },
  {
    "id": "weekly-contractor",
    "group": "주 1회",
    "cycle": "weekly",
    "type": "실무",
    "title": "협력업체 안전회의 및 지적사항 공유",
    "trigger": "주 1회 권장",
    "owner": "안전관리자/공사관리자",
    "documents": [
      "협력업체 안전회의록",
      "지시사항 이행대장"
    ],
    "evidence": [
      "회의록",
      "사진"
    ],
    "legal": "도급사업 안전보건관리 실무",
    "source": "MOEL/KOSHA 건설업 안전보건 자료",
    "sourceUrl": "https://www.moel.go.kr/",
    "priority": "normal",
    "actions": [
      "협력업체별 위험공종 확인",
      "반복 지적사항 공유",
      "다음 회의 전 조치기한 지정"
    ]
  },
  {
    "id": "biweekly-inspection",
    "group": "2주 1회",
    "cycle": "biweekly",
    "type": "실무",
    "title": "협력업체 합동 안전점검 및 지적사항 회의",
    "trigger": "격주 1회",
    "owner": "안전관리자/공사관리자",
    "documents": [
      "합동점검표",
      "참석자 명부",
      "조치결과 사진"
    ],
    "evidence": [
      "서명",
      "사진"
    ],
    "legal": "도급인 합동점검 실무",
    "source": "MOEL/KOSHA",
    "sourceUrl": "https://www.kosha.or.kr/",
    "priority": "normal",
    "actions": [
      "협력업체별 지적사항 확인",
      "반복 지적 항목 원인 분석",
      "다음 점검 전 완료목표 등록"
    ]
  },
  {
    "id": "biweekly-highrisk",
    "group": "2주 1회",
    "cycle": "biweekly",
    "type": "실무",
    "title": "고위험작업 특별교육·작업계획서 재확인",
    "trigger": "격주 또는 고위험작업 전",
    "owner": "안전관리자",
    "documents": [
      "특별교육 일지",
      "작업계획서",
      "작업허가서"
    ],
    "evidence": [
      "서명",
      "교육사진"
    ],
    "legal": "산업안전보건법 안전보건교육/특별교육",
    "source": "KOSHA 안전보건교육",
    "sourceUrl": "https://portal.kosha.or.kr/archive/laws/key-content/occupational-safety-health/education-safety-health",
    "priority": "high",
    "actions": [
      "타설·양중·비계·굴착 등 작업계획서 확인",
      "신호수·유도자·작업반장 역할 재확인",
      "교육 참석자 기록 정리"
    ]
  },
  {
    "id": "twice-monthly-doc",
    "group": "월 2회",
    "cycle": "twiceMonthly",
    "type": "실무",
    "title": "안전보건 서류·교육·점검 기록 정리",
    "trigger": "매월 1일/15일 권장",
    "owner": "안전관리자",
    "documents": [
      "서류 누락 점검표",
      "교육대장",
      "점검대장",
      "사진철"
    ],
    "evidence": [
      "서류철",
      "사진"
    ],
    "legal": "점검기관 실무 대응",
    "source": "MOEL/KOSHA 점검 실무",
    "sourceUrl": "https://www.moel.go.kr/",
    "priority": "normal",
    "actions": [
      "TBM·교육·순회점검 기록 누락 확인",
      "위험성평가 개선조치 증빙 첨부",
      "외부점검 대비 필수서류 폴더 정리"
    ]
  },
  {
    "id": "twice-monthly-emergency",
    "group": "월 2회",
    "cycle": "twiceMonthly",
    "type": "실무",
    "title": "비상대응·응급·화재 예방 상태 점검",
    "trigger": "매월 1일/15일 권장",
    "owner": "안전관리자",
    "documents": [
      "비상연락망",
      "응급함 점검표",
      "소화기 점검사진"
    ],
    "evidence": [
      "사진"
    ],
    "legal": "산업안전보건기준/소방 실무",
    "source": "법제처/MOEL/KOSHA",
    "sourceUrl": "https://www.law.go.kr/",
    "priority": "normal",
    "actions": [
      "비상연락망·응급함·AED 위치 확인",
      "용접·절단 화기작업 관리상태 확인",
      "소화기·피난통로·집결지 안내 확인"
    ]
  },
  {
    "id": "monthly-education",
    "group": "월 1회",
    "cycle": "monthly",
    "type": "정기",
    "title": "근로자 정기안전보건교육 운영/기록",
    "trigger": "월 1회 운영 권장",
    "owner": "안전관리자/관리감독자",
    "documents": [
      "정기교육일지",
      "교육자료",
      "참석자 서명부",
      "사진"
    ],
    "evidence": [
      "서명",
      "사진"
    ],
    "legal": "산업안전보건법 제29조/시행규칙 별표4·5",
    "source": "KOSHA 안전보건교육",
    "sourceUrl": "https://portal.kosha.or.kr/archive/laws/key-content/occupational-safety-health/education-safety-health",
    "priority": "high",
    "actions": [
      "교육대상자 명단 확인",
      "교육자료 준비",
      "불참자 보충교육 계획 수립"
    ]
  },
  {
    "id": "monthly-risk",
    "group": "월 1회",
    "cycle": "monthly",
    "type": "정기",
    "title": "월간 위험성평가 및 개선대책 정리",
    "trigger": "월 1회 이상 권장",
    "owner": "안전관리자/관리감독자",
    "documents": [
      "월간 위험성평가표",
      "개선대책 대장",
      "근로자 의견수렴 자료"
    ],
    "evidence": [
      "회의록",
      "사진"
    ],
    "legal": "사업장 위험성평가에 관한 지침",
    "source": "MOEL 위험성평가 안내",
    "sourceUrl": "https://www.moel.go.kr/",
    "priority": "high",
    "actions": [
      "월간 주요 공정 위험요인 재파악",
      "개선대책 수립 및 담당자 지정",
      "TBM 공유 자료로 전환"
    ]
  },
  {
    "id": "monthly-safety-cost",
    "group": "월 1회",
    "cycle": "monthly",
    "type": "정기",
    "title": "산업안전보건관리비 사용내역 정리",
    "trigger": "월 1회",
    "owner": "안전관리자/관리팀",
    "documents": [
      "산업안전보건관리비 사용내역서",
      "세금계산서",
      "구매품 사진"
    ],
    "evidence": [
      "영수증",
      "사진"
    ],
    "legal": "건설업 산업안전보건관리비 계상 및 사용기준",
    "source": "MOEL",
    "sourceUrl": "https://www.moel.go.kr/",
    "priority": "normal",
    "actions": [
      "항목별 사용 가능 여부 확인",
      "증빙 누락 여부 확인",
      "월말 보고자료 정리"
    ]
  },
  {
    "id": "monthly-msds",
    "group": "월 1회",
    "cycle": "monthly",
    "type": "정기",
    "title": "MSDS 목록·비치·교육상태 확인",
    "trigger": "월 1회 및 신규 물질 반입 시",
    "owner": "안전관리자/자재관리자",
    "documents": [
      "MSDS 목록",
      "비치사진",
      "교육일지"
    ],
    "evidence": [
      "사진",
      "서명"
    ],
    "legal": "산업안전보건법 물질안전보건자료",
    "source": "MOEL/KOSHA MSDS",
    "sourceUrl": "https://msds.kosha.or.kr/",
    "priority": "normal",
    "actions": [
      "신규 화학물질 반입 여부 확인",
      "MSDS 비치 위치 사진 정리",
      "취급자 교육 여부 확인"
    ]
  },
  {
    "id": "monthly-equipment-cert",
    "group": "월 1회",
    "cycle": "monthly",
    "type": "실무",
    "title": "장비 검사증·보험·자격증 유효기간 확인",
    "trigger": "월 1회",
    "owner": "안전관리자/장비관리자",
    "documents": [
      "장비대장",
      "검사증",
      "보험증권",
      "운전원 자격증"
    ],
    "evidence": [
      "사본"
    ],
    "legal": "건설기계/산업안전보건 실무",
    "source": "점검기관 실무 체크",
    "sourceUrl": "https://www.kosha.or.kr/",
    "priority": "normal",
    "actions": [
      "만료 예정 장비 확인",
      "운전원 자격 확인",
      "장비별 일상점검표 누락 확인"
    ]
  },
  {
    "id": "bimonthly-labor-management",
    "group": "2개월 1회",
    "cycle": "bimonthly",
    "type": "법정대상",
    "title": "노사협의체 회의록 작성·보존",
    "trigger": "대상 건설공사 2개월마다",
    "owner": "안전관리자/현장대리인",
    "documents": [
      "노사협의체 회의록",
      "참석자 명부",
      "심의·의결사항 이행대장"
    ],
    "evidence": [
      "서명",
      "회의록"
    ],
    "legal": "산업안전보건법 노사협의체",
    "source": "산업안전보건법/시행령",
    "sourceUrl": "https://www.law.go.kr/",
    "priority": "high",
    "actions": [
      "회의 안건 준비",
      "근로자·사용자위원 참석 확인",
      "의결사항 이행 여부 기록"
    ]
  },
  {
    "id": "quarter-osh-committee",
    "group": "분기 1회",
    "cycle": "quarterly",
    "type": "법정대상",
    "title": "산업안전보건위원회 회의 운영",
    "trigger": "대상 사업장 분기 1회",
    "owner": "안전관리자/안전보건관리책임자",
    "documents": [
      "산업안전보건위원회 회의록",
      "안건자료",
      "조치결과"
    ],
    "evidence": [
      "회의록",
      "서명"
    ],
    "legal": "산업안전보건법 산업안전보건위원회",
    "source": "산업안전보건법",
    "sourceUrl": "https://www.law.go.kr/",
    "priority": "normal",
    "actions": [
      "분기 안건 취합",
      "회의록 작성·보존",
      "의결사항 조치결과 추적"
    ]
  },
  {
    "id": "half-major-law",
    "group": "반기 1회",
    "cycle": "halfYear",
    "type": "법정대상",
    "title": "안전·보건 관계 법령 의무이행 점검",
    "trigger": "반기 1회 이상",
    "owner": "경영책임자/안전보건관리책임자/안전관리자",
    "documents": [
      "반기 의무이행 점검표",
      "미이행 조치계획",
      "보고서"
    ],
    "evidence": [
      "보고서",
      "조치사진"
    ],
    "legal": "중대재해처벌법 시행령 제4조",
    "source": "법제처 중대재해처벌법 시행령",
    "sourceUrl": "https://www.law.go.kr/LSW/lsInfoP.do?lsId=014159",
    "priority": "high",
    "actions": [
      "안전보건 관계 법령 이행 여부 점검",
      "미이행 항목 조치계획 수립",
      "경영책임자 보고자료 정리"
    ]
  },
  {
    "id": "annual-plan",
    "group": "연 1회",
    "cycle": "yearly",
    "type": "정기",
    "title": "연간 안전보건계획 및 교육계획 수립",
    "trigger": "연초/착공 초기",
    "owner": "안전보건관리책임자/안전관리자",
    "documents": [
      "연간 안전보건계획서",
      "연간 교육계획표",
      "월별 중점관리계획"
    ],
    "evidence": [
      "계획서"
    ],
    "legal": "안전보건관리체계 구축 실무",
    "source": "MOEL/KOSHA 안전보건관리체계 자료",
    "sourceUrl": "https://www.moel.go.kr/",
    "priority": "high",
    "actions": [
      "연간 주요 공정과 위험작업 배치",
      "교육·점검·훈련 주기표 확정",
      "관리자별 담당업무 배분"
    ]
  },
  {
    "id": "annual-manager-training",
    "group": "연 1회",
    "cycle": "yearly",
    "type": "정기",
    "title": "관리감독자 정기교육 이수 확인",
    "trigger": "연 1회",
    "owner": "안전관리자/관리감독자",
    "documents": [
      "관리감독자 교육 이수증",
      "교육대장"
    ],
    "evidence": [
      "이수증"
    ],
    "legal": "산업안전보건법 안전보건교육",
    "source": "KOSHA 안전보건교육",
    "sourceUrl": "https://portal.kosha.or.kr/archive/laws/key-content/occupational-safety-health/education-safety-health",
    "priority": "normal",
    "actions": [
      "관리감독자 명단 확인",
      "이수증 누락자 확인",
      "보수교육 일정 등록"
    ]
  },
  {
    "id": "annual-emergency-drill",
    "group": "연 1회",
    "cycle": "yearly",
    "type": "실무",
    "title": "비상대응·대피훈련 실시/결과보고",
    "trigger": "연 1회 이상 권장 또는 현장계획 기준",
    "owner": "안전관리자",
    "documents": [
      "훈련계획서",
      "훈련사진",
      "결과보고서",
      "개선사항"
    ],
    "evidence": [
      "사진",
      "보고서"
    ],
    "legal": "비상대응체계 구축 실무",
    "source": "MOEL/KOSHA 안전보건관리체계",
    "sourceUrl": "https://www.kosha.or.kr/",
    "priority": "normal",
    "actions": [
      "훈련 시나리오 작성",
      "대피동선·집결지 확인",
      "훈련 후 개선사항 등록"
    ]
  },
  {
    "id": "event-new-worker",
    "group": "발생 시",
    "cycle": "event",
    "type": "법정",
    "title": "신규채용자 안전보건교육",
    "trigger": "신규자 투입 전/채용 시",
    "owner": "안전관리자/관리감독자",
    "documents": [
      "신규채용자 교육일지",
      "서명부",
      "교육자료",
      "사진"
    ],
    "evidence": [
      "서명",
      "사진"
    ],
    "legal": "산업안전보건법 제29조/시행규칙 별표4·5",
    "source": "KOSHA 안전보건교육",
    "sourceUrl": "https://portal.kosha.or.kr/archive/laws/key-content/occupational-safety-health/education-safety-health",
    "priority": "high",
    "actions": [
      "신규자 명단 확인",
      "현장 기본수칙 교육",
      "출입 전 이수증·교육일지 저장"
    ]
  },
  {
    "id": "event-job-change",
    "group": "발생 시",
    "cycle": "event",
    "type": "법정",
    "title": "작업내용 변경 시 안전보건교육",
    "trigger": "작업내용 변경 전",
    "owner": "안전관리자/관리감독자",
    "documents": [
      "변경교육 일지",
      "대상자 서명부",
      "변경작업 위험요인"
    ],
    "evidence": [
      "서명"
    ],
    "legal": "산업안전보건법 안전보건교육",
    "source": "KOSHA 안전보건교육",
    "sourceUrl": "https://portal.kosha.or.kr/archive/laws/key-content/occupational-safety-health/education-safety-health",
    "priority": "high",
    "actions": [
      "변경 작업내용 설명",
      "변경된 위험요인과 대책 전달",
      "교육기록 보관"
    ]
  },
  {
    "id": "event-special-education",
    "group": "발생 시",
    "cycle": "event",
    "type": "법정",
    "title": "특별안전보건교육 대상 작업 교육",
    "trigger": "특정 유해·위험작업 시작 전",
    "owner": "안전관리자/관리감독자",
    "documents": [
      "특별교육 일지",
      "교육자료",
      "참석자 서명부"
    ],
    "evidence": [
      "서명",
      "교육사진"
    ],
    "legal": "산업안전보건법 시행규칙 별표4·5",
    "source": "KOSHA 안전보건교육",
    "sourceUrl": "https://portal.kosha.or.kr/archive/laws/key-content/occupational-safety-health/education-safety-health",
    "priority": "high",
    "actions": [
      "대상작업 여부 확인",
      "교육자료 준비",
      "교육 후 작업투입 승인"
    ]
  },
  {
    "id": "event-work-permit",
    "group": "작업 전",
    "cycle": "beforeWork",
    "type": "실무",
    "title": "고위험작업 작업허가서 확인",
    "trigger": "화기·고소·굴착·밀폐·양중 등 작업 전",
    "owner": "안전관리자/작업반장",
    "documents": [
      "작업허가서",
      "작업계획서",
      "위험성평가"
    ],
    "evidence": [
      "서명",
      "사진"
    ],
    "legal": "고위험작업 안전관리 실무",
    "source": "MOEL/KOSHA 건설업 자료",
    "sourceUrl": "https://www.kosha.or.kr/",
    "priority": "high",
    "actions": [
      "작업구역 통제 확인",
      "작업계획서와 현장조건 일치 확인",
      "필요 교육·자격·신호수 확인"
    ]
  },
  {
    "id": "event-equipment-use",
    "group": "작업 전",
    "cycle": "beforeWork",
    "type": "실무",
    "title": "장비 사용 전 일상점검",
    "trigger": "굴착기·크레인·펌프카·지게차·고소작업대 사용 전",
    "owner": "장비관리자/안전관리자",
    "documents": [
      "장비 일상점검표",
      "운전원 자격증",
      "작업계획서"
    ],
    "evidence": [
      "점검표",
      "사진"
    ],
    "legal": "산업안전보건기준/건설기계 실무",
    "source": "KOSHA",
    "sourceUrl": "https://www.kosha.or.kr/",
    "priority": "high",
    "actions": [
      "작동상태·안전장치 확인",
      "후진·회전반경 통제",
      "신호수 배치 확인"
    ]
  },
  {
    "id": "event-nearmiss",
    "group": "발생 즉시",
    "cycle": "incident",
    "type": "실무",
    "title": "아차사고/위험요인 보고 및 개선조치",
    "trigger": "아차사고 또는 위험요인 발견 즉시",
    "owner": "안전관리자/관리감독자",
    "documents": [
      "아차사고 보고서",
      "개선조치 대장",
      "전·후 사진"
    ],
    "evidence": [
      "사진",
      "보고서"
    ],
    "legal": "위험요인 개선조치 실무",
    "source": "MOEL/KOSHA",
    "sourceUrl": "https://www.kosha.or.kr/",
    "priority": "high",
    "actions": [
      "위험요인 즉시 통제",
      "원인과 재발방지대책 기록",
      "완료 전후 사진 저장"
    ]
  },
  {
    "id": "event-accident",
    "group": "발생 즉시",
    "cycle": "incident",
    "type": "법정/실무",
    "title": "사고 발생 보고·현장보존·재발방지대책",
    "trigger": "사고 발생 즉시",
    "owner": "안전관리자/현장대리인",
    "documents": [
      "사고보고서",
      "현장사진",
      "목격자 진술",
      "재발방지대책"
    ],
    "evidence": [
      "사진",
      "보고서"
    ],
    "legal": "산업안전보건법/중대재해 대응",
    "source": "MOEL/법제처",
    "sourceUrl": "https://www.law.go.kr/",
    "priority": "high",
    "actions": [
      "인명구조 및 2차사고 방지",
      "현장보존·보고체계 가동",
      "재발방지대책 등록"
    ]
  },
  {
    "id": "event-pre-placement-health",
    "group": "발생 시",
    "cycle": "event",
    "type": "법정대상",
    "title": "특수건강진단 대상자 배치전 건강진단 확인",
    "trigger": "대상 업무 배치 전",
    "owner": "안전관리자/보건관리자",
    "documents": [
      "배치전 건강진단 결과",
      "대상자 명단"
    ],
    "evidence": [
      "결과확인"
    ],
    "legal": "산업안전보건법 건강진단",
    "source": "MOEL/KOSHA",
    "sourceUrl": "https://www.kosha.or.kr/",
    "priority": "normal",
    "actions": [
      "대상 유해인자 확인",
      "배치전 건강진단 여부 확인",
      "미실시자 투입 보류"
    ]
  },
  {
    "id": "event-msds-new",
    "group": "발생 시",
    "cycle": "event",
    "type": "법정",
    "title": "신규 화학물질 반입 시 MSDS 확인/교육",
    "trigger": "신규 화학물질 반입 시",
    "owner": "안전관리자/자재관리자",
    "documents": [
      "MSDS",
      "경고표지 사진",
      "취급자 교육일지"
    ],
    "evidence": [
      "사진",
      "서명"
    ],
    "legal": "산업안전보건법 MSDS",
    "source": "KOSHA MSDS",
    "sourceUrl": "https://msds.kosha.or.kr/",
    "priority": "high",
    "actions": [
      "MSDS 확보와 비치",
      "경고표지 부착 확인",
      "취급근로자 교육 실시"
    ]
  }
];

export const SAFETY_DUTY_GROUP_ORDER = ["매일","작업 전","발생 시","발생 즉시","주 1회","2주 1회","월 2회","월 1회","2개월 1회","분기 1회","반기 1회","연 1회"];

export const SAFETY_DUTY_RECURRING_CYCLES = new Set(["daily","weekly","biweekly","twiceMonthly","monthly","bimonthly","quarterly","halfYear","yearly"]);

export function getRecurringSafetyDuties(){
  return SAFETY_DUTY_DB.filter(x => SAFETY_DUTY_RECURRING_CYCLES.has(x.cycle));
}
export function getEventSafetyDuties(){
  return SAFETY_DUTY_DB.filter(x => !SAFETY_DUTY_RECURRING_CYCLES.has(x.cycle));
}

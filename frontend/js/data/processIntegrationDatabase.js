export const PROCESS_INTEGRATION_DB = [
  {
    id:"rc-slab-concrete", category:"철근콘크리트공사", trade:"콘크리트공사", subProcess:"슬래브 콘크리트 타설", riskLevel:"high", highRisk:true,
    aliases:["슬래브 타설","콘크리트 타설","타설"],
    safetyRisks:["펌프카 아웃트리거 침하·전도","압송호스 이탈·파열","레미콘 후진 및 작업자 협착","단부·개구부 추락","젖은 작업면 미끄럼","폭염·한랭에 따른 건강장해"],
    preventiveActions:["펌프카 설치지반과 받침판 확인","붐 작업반경 및 레미콘 동선 통제","압송호스 연결부·고정상태 확인","단부·개구부 난간과 작업발판 확인","강우 대비 보양재·배수로 확보","신호수 배치와 TBM 실시"],
    documents:["작업계획서","위험성평가서","TBM 일지","펌프카 장비점검표","타설 전 검측기록","콘크리트 시험·공시체 기록"],
    tbmPoints:["펌프카 전도와 붐 작업반경 출입통제","압송호스 이탈방지 및 작업자 위치","레미콘 차량 후진 시 신호수 유도","단부·개구부 추락방지","강우·고온 시 작업순서와 휴식관리"],
    safetyJournalSummary:"슬래브 타설 구간의 펌프카·차량동선·추락·미끄럼 위험을 중점 관리함.",
    qualityActions:["슬럼프·공기량 시험","공시체 수량·라벨 확인","타설순서·이어치기 확인","양생계획 확인"],
    constructionActions:["레미콘 배차와 타설순서 확인","펌프카 위치·동선 확보","인원·장비 배치 확인","타설 후 보양 준비"],
    materialsEquipment:["펌프카","레미콘","진동기","보양포·비닐","공시체 몰드"],
    weatherRules:{rain:"강우 시 표면수 유입·미끄럼·품질저하 대비", wind:"강풍 시 붐대 흔들림과 장비 안정성 재검토", heat:"고온 시 휴식·음수·콘크리트 급속건조 관리", cold:"한랭 시 결빙·보온양생 확인"}
  },
  {
    id:"rc-wall-rebar", category:"철근콘크리트공사", trade:"철근공사", subProcess:"벽체·기둥 철근 배근", riskLevel:"high", highRisk:true,
    aliases:["철근 배근","벽체 철근","기둥 철근"],
    safetyRisks:["단부·개구부 추락","철근 돌출부 찔림","철근 인양 중 낙하","결속 작업 중 손 끼임","중량물 인력운반"],
    preventiveActions:["안전난간·작업발판 확인","철근캡 설치","인양구역 출입통제","절단·가공기 방호장치 확인","운반 인원과 동선 확보"],
    documents:["위험성평가서","TBM 일지","양중 작업계획서","배근 검측기록"],
    tbmPoints:["단부·개구부 안전대 체결","철근 돌출부 캡 설치","인양물 하부 출입금지","결속선·공구 정리","무리한 인력운반 금지"],
    safetyJournalSummary:"철근 배근구간 추락·찔림·낙하물 위험을 중점 점검함.",
    qualityActions:["피복두께 확인","정착·이음길이 확인","간격·수량 확인","개구부 보강 확인"],
    constructionActions:["배근순서와 검측시점 확인","설비 매립과 간섭 확인","후속 거푸집 일정 확인"],
    materialsEquipment:["철근","결속선","철근캡","절단기·절곡기"],
    weatherRules:{rain:"우천 시 미끄럼과 감전 위험 확인", wind:"강풍 시 장척철근 인양 재검토", heat:"고온 시 금속 표면 화상·온열질환 관리", cold:"결빙 작업발판 미끄럼 방지"}
  },
  {
    id:"rc-formwork", category:"철근콘크리트공사", trade:"거푸집공사", subProcess:"거푸집·동바리 설치", riskLevel:"high", highRisk:true,
    aliases:["거푸집","동바리","알폼"],
    safetyRisks:["동바리 붕괴","작업발판 추락","자재 낙하","상하 동시작업","해체 중 비래"],
    preventiveActions:["구조검토·조립도 확인","동바리 간격·수직·체결 확인","작업발판·안전난간 설치","상하 동시작업 통제","해체순서 사전교육"],
    documents:["거푸집동바리 조립도","작업계획서","위험성평가서","TBM 일지","타설 전 점검표"],
    tbmPoints:["동바리 임의해체 금지","발판·난간 상태 확인","상하 동시작업 금지","자재 낙하방지","해체순서 준수"],
    safetyJournalSummary:"거푸집·동바리의 붕괴·추락·낙하 위험을 중점 관리함.",
    qualityActions:["수직도·수평도 확인","치수·개구부 위치 확인","이음부 누수방지 확인"],
    constructionActions:["조립순서와 인원배치 확인","타설하중 전달경로 확인","해체시기 확인"],
    materialsEquipment:["거푸집 패널","동바리","멍에·장선","체결재"],
    weatherRules:{rain:"젖은 발판 미끄럼과 목재 변형 확인", wind:"패널 전도·비산 방지", heat:"밀폐구간 환기와 휴식", cold:"결빙 발판과 동바리 침하 확인"}
  },
  {
    id:"lifting-crane", category:"장비·양중공사", trade:"양중작업", subProcess:"이동식크레인 양중", riskLevel:"critical", highRisk:true,
    aliases:["크레인","양중","인양"],
    safetyRisks:["크레인 전도","인양물 낙하","줄걸이 파단","작업반경 협착","강풍 흔들림","전선 접촉"],
    preventiveActions:["작업계획서와 정격하중 확인","아웃트리거 받침판 설치","줄걸이·샤클 점검","신호수 지정","하부 출입통제","풍속·가공전선 확인"],
    documents:["차량계 건설기계 작업계획서","중량물 취급 작업계획서","장비점검표","운전원 자격증","TBM 일지"],
    tbmPoints:["정격하중과 작업반경 확인","아웃트리거 완전 전개","신호수 단일화","인양물 하부 출입금지","풍속 상승 시 중지"],
    safetyJournalSummary:"크레인 전도·인양물 낙하·작업반경 협착 위험을 통제함.",
    qualityActions:["부재 손상방지","설치 위치·방향 확인"],
    constructionActions:["양중순서·반입순서 확인","작업반경과 장비위치 확보"],
    materialsEquipment:["이동식크레인","와이어로프","샤클","유도줄","받침판"],
    weatherRules:{rain:"지반 연약화와 시야저하 확인", wind:"풍속 기준에 따라 양중 중지 검토", heat:"운전원·신호수 휴식", cold:"아웃트리거 지반 결빙·미끄럼 확인"}
  },
  {
    id:"scaffold-install", category:"가설공사", trade:"비계공사", subProcess:"비계 설치·해체", riskLevel:"critical", highRisk:true,
    aliases:["비계","시스템비계","강관비계"],
    safetyRisks:["고소 추락","비계 붕괴","자재 낙하","벽이음 누락","해체구간 출입"],
    preventiveActions:["작업발판·난간 선행설치","벽이음·가새 확인","안전대 부착설비 확보","하부 출입통제","해체순서 준수"],
    documents:["비계 조립도","작업계획서","위험성평가서","TBM 일지","정기점검표"],
    tbmPoints:["난간 선행설치","벽이음 임의해체 금지","안전대 체결","하부 출입통제","강풍 시 작업중지"],
    safetyJournalSummary:"비계 설치·해체 시 추락·붕괴·낙하물 위험을 중점 관리함.",
    qualityActions:["수직·수평·간격 확인","벽이음 위치 확인"],
    constructionActions:["설치·해체 순서 확인","사용구간 인계 확인"],
    materialsEquipment:["비계재","작업발판","안전난간","승강설비"],
    weatherRules:{rain:"젖은 발판 작업중지 검토", wind:"강풍 시 설치·해체 중지", heat:"고소작업 휴식 강화", cold:"결빙 발판 사용 금지"}
  },
  {
    id:"excavation", category:"토공사", trade:"굴착공사", subProcess:"굴착 및 흙막이 작업", riskLevel:"critical", highRisk:true,
    aliases:["굴착","터파기","흙막이"],
    safetyRisks:["토사 붕괴","굴착기 충돌","지하매설물 파손","단부 추락","우수 유입"],
    preventiveActions:["굴착면 기울기·흙막이 확인","장비 작업반경 통제","매설물 사전조사","단부 난간 설치","배수·양수계획 확보"],
    documents:["굴착 작업계획서","위험성평가서","매설물 조사기록","흙막이 점검표","TBM 일지"],
    tbmPoints:["굴착면 접근금지","장비 후방 신호수 배치","매설물 위치 공유","단부 추락방지","강우 후 붕괴징후 확인"],
    safetyJournalSummary:"굴착구간 붕괴·장비충돌·단부추락·우수유입 위험을 관리함.",
    qualityActions:["굴착깊이·레벨 확인","지지층 확인"],
    constructionActions:["토사반출 동선 확인","흙막이 설치순서 확인"],
    materialsEquipment:["굴착기","덤프트럭","흙막이재","양수기"],
    weatherRules:{rain:"강우 전후 굴착면 붕괴·배수 집중점검", wind:"비산먼지 관리", heat:"장비운전원 휴식", cold:"동결토·결빙 통로 확인"}
  },
  {
    id:"waterproofing", category:"마감공사", trade:"방수공사", subProcess:"도막·시트 방수", riskLevel:"medium", highRisk:false,
    aliases:["방수","도막방수","시트방수"],
    safetyRisks:["유기용제 흡입","화재·폭발","미끄럼","밀폐공간 산소결핍","피부접촉"],
    preventiveActions:["MSDS·환기 확인","화기엄금과 소화기 배치","보호장갑·방독마스크 착용","출입통제","밀폐구간 가스측정"],
    documents:["MSDS","위험성평가서","TBM 일지","화기작업허가서(해당 시)"],
    tbmPoints:["환기상태 확인","화기엄금","보호구 착용","도료 누출 즉시 제거","밀폐구간 가스측정"],
    safetyJournalSummary:"방수작업의 유기용제·화재·미끄럼 위험을 관리함.",
    qualityActions:["바탕면 함수율·청소 확인","도막두께·겹침 확인","담수시험 확인"],
    constructionActions:["선행공정 완료 확인","양생·보호층 일정 확인"],
    materialsEquipment:["방수재","프라이머","롤러","환기팬","소화기"],
    weatherRules:{rain:"외부 방수작업 연기 및 바탕면 건조 확인", wind:"용제 증기·비산 관리", heat:"재료 가사시간과 환기 관리", cold:"저온 시 경화조건 확인"}
  },
  {
    id:"electrical-temp", category:"전기공사", trade:"가설전기", subProcess:"가설전기 설치·사용", riskLevel:"high", highRisk:true,
    aliases:["가설전기","분전반","전기"],
    safetyRisks:["감전","누전·화재","케이블 손상","젖은 장소 사용","무자격 작업"],
    preventiveActions:["누전차단기 시험","접지·분전반 잠금 확인","케이블 가공·보호","습윤장소 방수조치","정격용량 확인"],
    documents:["가설전기 점검표","위험성평가서","TBM 일지","전기설비 검사기록"],
    tbmPoints:["누전차단기 시험","분전반 잠금·접지 확인","손상 케이블 사용금지","습윤장소 방수","임의 결선 금지"],
    safetyJournalSummary:"가설전기의 감전·누전·화재 위험을 중점 점검함.",
    qualityActions:["회로·용량 확인","접지저항 확인"],
    constructionActions:["전원공급 계획 확인","케이블 동선 확보"],
    materialsEquipment:["분전반","누전차단기","접지선","케이블보호대"],
    weatherRules:{rain:"우천 시 분전반·케이블 방수 집중점검", wind:"가공선 고정 확인", heat:"과부하·발열 확인", cold:"케이블 피복 경화·파손 확인"}
  }
  ,{
    id:"rc-column-concrete", category:"철근콘크리트공사", trade:"콘크리트공사", subProcess:"벽체·기둥 콘크리트 타설", riskLevel:"high", highRisk:true,
    aliases:["벽체 타설","기둥 타설","수직부재 타설"],
    safetyRisks:["거푸집 측압에 따른 변형·붕괴","호스 반동·이탈","작업발판 추락","레미콘·펌프카 협착","콘크리트 비산"],
    preventiveActions:["거푸집 체결·버팀 상태 확인","타설속도와 높이 준수","압송호스 고정 및 작업자 위치 통제","작업발판·난간 확인","펌프카·레미콘 동선 분리"],
    documents:["타설계획서","위험성평가서","TBM 일지","거푸집 점검표","펌프카 점검표","콘크리트 시험기록"],
    tbmPoints:["거푸집 변형 징후 즉시 보고","타설속도·순서 준수","호스 선단부 공동 제어","작업발판 이탈 금지","차량 후진 신호수 유도"],
    safetyJournalSummary:"수직부재 타설 시 거푸집 측압·호스 반동·추락·차량협착 위험을 중점 관리함.",
    qualityActions:["슬럼프·공기량 시험","다짐상태 확인","콜드조인트 방지","수직부재 탈형 공시체 확인"],
    constructionActions:["타설순서와 속도 확인","거푸집 변형 감시자 배치","양생·탈형계획 확인"],
    materialsEquipment:["펌프카","레미콘","진동기","거푸집 버팀재","공시체 몰드"],
    weatherRules:{rain:"강우 유입과 작업발판 미끄럼 관리",wind:"붐대 안정성과 거푸집 패널 비산 확인",heat:"급속건조·온열질환 관리",cold:"보온양생과 결빙 발판 확인"}
  },
  {
    id:"rc-slab-rebar", category:"철근콘크리트공사", trade:"철근공사", subProcess:"슬래브·보 철근 배근", riskLevel:"high", highRisk:true,
    aliases:["슬래브 철근","보 철근","상부근 배근"],
    safetyRisks:["개구부·단부 추락","철근 위 걸림·전도","철근 인양 중 낙하","돌출철근 찔림","절단기 끼임·비산"],
    preventiveActions:["개구부 덮개·난간 확인","안전통로 확보","인양구역 하부 통제","철근캡 설치","절단·절곡기 방호장치 확인"],
    documents:["위험성평가서","TBM 일지","양중 작업계획서","철근 검측기록"],
    tbmPoints:["개구부 덮개 임의해체 금지","철근 위 이동 시 지정통로 사용","인양물 하부 접근금지","돌출철근 캡 유지","가공기계 장갑 말림 주의"],
    safetyJournalSummary:"슬래브·보 철근 작업의 추락·전도·낙하·찔림 위험을 관리함.",
    qualityActions:["피복두께·간격 확인","이음·정착길이 확인","보강근·개구부 보강 확인","스페이서 설치 확인"],
    constructionActions:["배근순서·검측시점 확인","설비배관 간섭 확인","후속 타설 일정 확인"],
    materialsEquipment:["철근","결속선","스페이서","철근캡","절단·절곡기"],
    weatherRules:{rain:"미끄럼·감전과 철근 표면 오염 확인",wind:"장척철근 인양 중지 검토",heat:"철근 표면 화상·온열질환 관리",cold:"결빙 구간 미끄럼 방지"}
  },
  {
    id:"masonry-block", category:"조적공사", trade:"조적공사", subProcess:"벽돌·블록 조적", riskLevel:"medium", highRisk:false,
    aliases:["조적","벽돌","블록"],
    safetyRisks:["작업발판 추락","벽체 전도","자재 낙하","절단 분진","중량물 반복운반"],
    preventiveActions:["작업발판·난간 설치","일일 조적높이와 벽체 지지 확인","하부 출입통제","집진·방진마스크 사용","운반카트와 적정 인원 사용"],
    documents:["위험성평가서","TBM 일지","작업발판 점검표"],
    tbmPoints:["불안전 발판 사용금지","미경화 벽체 기대지 않기","자재 과다 적재 금지","절단 시 보안경·방진마스크 착용"],
    safetyJournalSummary:"조적작업의 발판추락·벽체전도·분진·중량물 위험을 관리함.",
    qualityActions:["수직·수평·줄눈 확인","보강철물·인방 확인","벽체 긴결 확인"],
    constructionActions:["자재양중·층별 적치계획 확인","설비 매립과 개구부 위치 확인"],
    materialsEquipment:["벽돌·블록","몰탈","비계·발판","절단기"],
    weatherRules:{rain:"외부 조적 보호와 미끄럼 관리",wind:"미경화 벽체 전도 방지",heat:"몰탈 건조·휴식 관리",cold:"동절기 시공·보온 확인"}
  },
  {
    id:"plastering", category:"미장공사", trade:"미장공사", subProcess:"내·외부 미장", riskLevel:"medium", highRisk:false,
    aliases:["미장","몰탈 미장","견출"],
    safetyRisks:["작업발판 추락","습윤 바닥 미끄럼","몰탈 비산·피부접촉","전동공구 감전","반복작업 근골격계 부담"],
    preventiveActions:["발판·난간 확인","통로와 바닥 정리","보안경·방수장갑 착용","누전차단기 확인","작업자 교대·휴식"],
    documents:["위험성평가서","TBM 일지","작업발판 점검표","MSDS"],
    tbmPoints:["젖은 바닥 미끄럼 주의","발판 위 자재 과적 금지","몰탈 피부접촉 즉시 세척","전동공구 케이블 손상 확인"],
    safetyJournalSummary:"미장작업의 발판·미끄럼·비산·감전 위험을 관리함.",
    qualityActions:["바탕면 청소·습윤 확인","두께·평활도 확인","균열·들뜸 방지"],
    constructionActions:["바탕 공정 완료 확인","양생·후속 마감 일정 확인"],
    materialsEquipment:["몰탈","믹서기","흙손","작업발판"],
    weatherRules:{rain:"외부 미장 작업중지·보양",wind:"재료 비산·급건조 관리",heat:"급건조 균열과 온열질환 관리",cold:"동해 방지와 보온"}
  },
  {
    id:"tile-install", category:"타일공사", trade:"타일공사", subProcess:"벽·바닥 타일 시공", riskLevel:"medium", highRisk:false,
    aliases:["타일","타일붙임","타일 시공"],
    safetyRisks:["절단 분진·비산","습윤 바닥 미끄럼","접착제 피부접촉","쪼그림 작업 근골격계 부담","자재 운반 협착"],
    preventiveActions:["습식절단·집진과 보안경 사용","작업구역 미끄럼 통제","장갑·마스크 착용","작업자 교대와 스트레칭","운반카트 사용"],
    documents:["위험성평가서","TBM 일지","MSDS"],
    tbmPoints:["절단기 방호커버 확인","보안경·방진마스크 착용","젖은 바닥 통제","접착제 피부접촉 주의"],
    safetyJournalSummary:"타일 작업의 절단 비산·분진·미끄럼·근골격계 위험을 관리함.",
    qualityActions:["바탕면 평활·함수 확인","줄눈·단차 확인","들뜸 방지와 양생 확인"],
    constructionActions:["자재 반입·층별 배치 확인","선행 방수·미장 상태 확인"],
    materialsEquipment:["타일","접착제","절단기","레벨기"],
    weatherRules:{rain:"외부 작업·자재보관 관리",wind:"분진 비산 관리",heat:"접착제 가사시간 확인",cold:"접착·양생 온도 확인"}
  },
  {
    id:"painting", category:"도장공사", trade:"도장공사", subProcess:"내·외부 도장", riskLevel:"high", highRisk:true,
    aliases:["도장","페인트","도색"],
    safetyRisks:["유기용제 흡입","화재·폭발","고소작업 추락","피부·안구 노출","환기불량"],
    preventiveActions:["MSDS 확인과 충분한 환기","화기엄금·소화기 배치","고소작업대·발판 점검","방독마스크·보안경·장갑 착용","용기 밀폐와 폐기물 분리"],
    documents:["위험성평가서","TBM 일지","MSDS","화기작업허가서(해당 시)","밀폐공간 작업허가서(해당 시)"],
    tbmPoints:["환기 가동 확인","화기·흡연 금지","방독마스크 필터 확인","고소작업 안전대 체결","도료 누출 즉시 제거"],
    safetyJournalSummary:"도장작업의 유기용제·화재·환기·고소 추락 위험을 관리함.",
    qualityActions:["바탕면 상태·함수율 확인","도막두께·색상 확인","재도장 간격 준수"],
    constructionActions:["환기·출입통제 계획 확인","양생 중 후속공정 통제"],
    materialsEquipment:["도료","희석제","환기팬","방독마스크","소화기"],
    weatherRules:{rain:"외부 도장 금지·바탕면 건조 확인",wind:"도료 비산과 주변 오염 통제",heat:"용제 증기·가사시간 관리",cold:"경화온도와 결로 확인"}
  },
  {
    id:"hot-work", category:"철골·금속공사", trade:"화기작업", subProcess:"용접·용단 작업", riskLevel:"critical", highRisk:true,
    aliases:["용접","용단","화기작업"],
    safetyRisks:["불티 화재","가스통 전도·폭발","용접흄 흡입","감전","하부 낙하불티"],
    preventiveActions:["화기작업허가서 발행","불티비산방지포·소화기 배치","가스통 직립 고정과 역화방지기 확인","국소배기·보호구 착용","하부 감시자·잔불 확인"],
    documents:["화기작업허가서","위험성평가서","TBM 일지","가스용기 점검표","화재감시 기록"],
    tbmPoints:["가연물 제거","소화기와 감시자 배치","가스호스·역화방지기 확인","용접면·방진마스크 착용","작업 종료 후 잔불 확인"],
    safetyJournalSummary:"용접·용단 작업의 화재·폭발·흄·감전 위험을 중점 통제함.",
    qualityActions:["용접부 외관·치수 확인","용접재료 보관 확인"],
    constructionActions:["작업구역·후속 도장공정 간섭 확인","화재감시 시간 확보"],
    materialsEquipment:["용접기","가스용기","불티방지포","소화기","환기팬"],
    weatherRules:{rain:"옥외 전기용접 중지·감전 방지",wind:"불티 비산 범위 확대 통제",heat:"가스용기 직사광선 차단",cold:"케이블·호스 경화 손상 확인"}
  },
  {
    id:"aerial-lift", category:"장비·양중공사", trade:"고소작업", subProcess:"고소작업대 사용", riskLevel:"critical", highRisk:true,
    aliases:["고소작업대","렌탈","시저리프트","붐리프트"],
    safetyRisks:["작업대 전도","상부 구조물 협착","작업대 밖 추락","주행 중 충돌","과상승"],
    preventiveActions:["작업계획·장비점검표 확인","지반 수평·아웃트리거 확인","안전대 체결","상부 장애물·과상승방지장치 확인","작업반경 출입통제"],
    documents:["차량계 하역운반기계 작업계획서","장비점검표","위험성평가서","TBM 일지","운전자 자격 확인"],
    tbmPoints:["안전대 체결","상부 장애물 확인","작업대 난간 위 올라서기 금지","주행 시 작업대 하강","지반·경사 확인"],
    safetyJournalSummary:"고소작업대의 전도·협착·추락 위험을 중점 관리함.",
    qualityActions:["작업 대상 위치·마감 손상 방지"],
    constructionActions:["장비 진입동선·작업반경 확보","상부 간섭 확인"],
    materialsEquipment:["고소작업대","안전대","라바콘","받침판"],
    weatherRules:{rain:"젖은 작업대 미끄럼과 옥외 사용 재검토",wind:"제조사 풍속기준에 따라 작업중지",heat:"작업대 체류시간·휴식 관리",cold:"결빙 지반과 유압장치 점검"}
  },
  {
    id:"confined-space", category:"설비공사", trade:"밀폐공간", subProcess:"밀폐공간 출입·작업", riskLevel:"critical", highRisk:true,
    aliases:["밀폐공간","맨홀","탱크 내부","집수정"],
    safetyRisks:["산소결핍","유해가스 중독","화재·폭발","구조 지연","연락두절"],
    preventiveActions:["작업허가서와 출입자 명부 작성","작업 전·중 가스측정","강제환기","감시인 배치와 연락체계 확보","구조장비·송기마스크 준비"],
    documents:["밀폐공간 작업허가서","가스측정 기록","출입자 명부","구조계획서","위험성평가서","TBM 일지"],
    tbmPoints:["무측정 출입 금지","환기 중단 시 즉시 퇴출","감시인 자리이탈 금지","비상구조 임의진입 금지","연락방법 확인"],
    safetyJournalSummary:"밀폐공간 작업의 산소결핍·중독·구조지연 위험을 최고위험으로 관리함.",
    qualityActions:["설비 내부 청소·검사 기준 확인"],
    constructionActions:["작업시간·환기·구조 인력 확보","동시작업 통제"],
    materialsEquipment:["가스측정기","환기팬","구조삼각대","안전대","송기마스크"],
    weatherRules:{rain:"우수 유입 가능 공간 출입금지 검토",wind:"환기 배출구 위치 확인",heat:"내부 열스트레스 집중관리",cold:"내부 결빙·저체온 관리"}
  },
  {
    id:"demolition", category:"해체공사", trade:"해체공사", subProcess:"구조물·마감재 해체", riskLevel:"critical", highRisk:true,
    aliases:["해체","철거","브레이커"],
    safetyRisks:["예상치 못한 붕괴","낙하물","분진·석면","장비 충돌","잔존 전기·가스"],
    preventiveActions:["해체계획서·순서 확인","위험구역 출입통제","잔존 설비 차단","살수·집진과 보호구 착용","하부·인접구간 동시작업 금지"],
    documents:["해체계획서","위험성평가서","TBM 일지","설비 차단 확인서","폐기물·석면 조사자료"],
    tbmPoints:["계획 외 임의해체 금지","위험구역 접근금지","잔존 전기·가스 확인","낙하물 하부 통제","분진 보호구 착용"],
    safetyJournalSummary:"해체작업의 붕괴·낙하·분진·잔존에너지 위험을 최고위험으로 관리함.",
    qualityActions:["존치부 손상·균열 확인"],
    constructionActions:["해체순서·반출동선·폐기물 구분 확인"],
    materialsEquipment:["굴착기·브레이커","살수장비","방진막","폐기물 용기"],
    weatherRules:{rain:"구조 취약·미끄럼·폐기물 유출 관리",wind:"분진·비산물 작업중지 검토",heat:"방진보호구 착용자 휴식 강화",cold:"결빙·취약부 파괴거동 확인"}
  }

];

export const PROCESS_CATEGORIES = [...new Set(PROCESS_INTEGRATION_DB.map(x=>x.category))];
export function getProcessesByCategory(category){ return PROCESS_INTEGRATION_DB.filter(x=>x.category===category); }
export function getProcessById(id){ return PROCESS_INTEGRATION_DB.find(x=>x.id===id) || null; }
export function findProcessByText(text=""){
  const q=String(text).toLowerCase();
  return PROCESS_INTEGRATION_DB.find(x=>[x.trade,x.subProcess,...(x.aliases||[])].some(v=>q.includes(String(v).toLowerCase()))) || null;
}

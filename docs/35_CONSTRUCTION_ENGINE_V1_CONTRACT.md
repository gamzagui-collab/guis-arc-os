# Construction Engine v1.0 계약

## 목적과 경계

Construction Engine v1.0은 Issue의 제목, 내용, 현재 `trade_id`를 입력으로 공사·안전·품질·관리·미분류 부서를 추천하는 저장소 내부 Rule Engine이다. 외부 AI, LLM, 임베딩, 벡터 DB, 사진 분석 및 외부 네트워크를 사용하지 않는다. 추천은 담당자 배정이나 상태 변경이 아니며 관리자가 확인하기 전에는 확정 부서가 아니다.

## 입력과 출력

- 입력: 정규화된 제목·내용, canonical `trade_id`, 현장 ID
- 출력: 추천 부서, 0~100 Rule 일치 강도, 표시 등급, 근거, 일치 Rule ID, 후보 부서, 충돌 여부, 입력 해시
- 점수는 AI 확률이 아니다. 85 이상은 `높은 신뢰도`, 그 미만의 일치는 `검토 필요`, 무일치는 `부서 미분류`다.

## Rule Master와 평가

`construction_department_rules`는 SYSTEM·SITE·MANUAL 출처, 포함·제외 키워드, 선택적 공종, 우선순위, 기본 신뢰도, 활성 상태를 저장한다. 평가 순서는 현장 Rule, 높은 priority, 높은 신뢰도, 안정적인 Rule ID 순이다. 포함 키워드는 모두 일치해야 하며 제외 키워드가 하나라도 일치하면 해당 Rule은 제외된다.

동일 scope·priority·confidence의 최상위 Rule이 서로 다른 부서를 가리키면 `conflict=true`, 추천 부서는 `UNCLASSIFIED`, 신뢰도는 최대 50으로 제한한다. 일치 Rule이 없을 때 미분류는 정상 결과다.

## 추천 Snapshot과 확정

신규 Issue 생성, 제목·내용 변경, 공종 변경, 관리자의 명시적 재추천에서만 Snapshot을 갱신한다. 사진·담당자·상태·조치·완료 변경과 조회에서는 재추천하지 않는다. Rule 변경은 기존 Issue를 자동 재분류하지 않는다.

`issue_department_recommendations`는 추천과 확정을 분리한다. 재추천은 추천 필드만 갱신하며 `confirmed_department_code`, 확정자·확정시각과 수동 변경 여부를 덮어쓰지 않는다. 기존 Issue는 추천 행이 없어도 정상 조회된다.

## 권한과 Audit

Issue 조회 범위 안의 사용자는 추천 결과를 볼 수 있다. 기존 `issue.assign` 또는 `issue.manage_all` 권한과 SITE scope를 함께 만족하는 원도급 현장 관리자만 재추천·확정할 수 있다. 협력업체·다른 현장 접근은 기존 Issue scope에서 차단한다.

추천, 엔진 실패, 관리자 동일값 확정, 관리자 수동 변경은 `audit_logs`에 구분해 기록한다. Audit에는 Issue·현장 ID, 입력 해시, 추천·확정 부서, 점수, Rule ID만 저장하고 전체 본문은 복제하지 않는다.

## 실패·성능·캐시

평가 또는 Snapshot 저장 실패는 Issue 등록을 롤백하지 않는다. 가능한 경우 미분류 결과와 실패 Audit을 남긴다. Rule은 한 평가당 현장+SYSTEM 범위를 한 번 조회하고 메모리에서 결정적으로 평가한다. 목록 조회에서는 Rule을 조회하거나 행별 평가하지 않는다. v1.0은 장기 캐시를 두지 않아 Rule 변경 무효화 문제가 없다.

## 초기 Rule의 한계

초기 SYSTEM Rule은 안전난간·추락방지·형틀 추락, 콘크리트 압축강도·시험성적서, 벽면 할석·형틀 시공 불량·일반 균열·난간 도장 불량, 계약서류·문서 제출의 안전한 최소 초안이다. 완전한 건설 표준이 아니며 운영 Issue를 자동 확정하거나 기존 데이터를 재분류하지 않는다.

## v1.0 비범위와 향후 확장

공종·담당자·우선순위 자동 확정, Rule 편집 UI, 자동 학습, 일괄 추천·확정, PC 다중 선택·탭·필터, Today·Safety·Quality 연결은 비범위다. 서비스 경계는 향후 단건·다건 소비자가 재사용할 수 있으나 이번 버전의 공개 API는 단건 재추천과 부서 확정만 제공한다.

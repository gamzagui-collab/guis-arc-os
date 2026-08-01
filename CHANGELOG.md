# v0.24.8 — 내부 테스트 접근 없음 권한 정리 Hotfix

- v0.24.7 Integration apply가 12계정·13 Membership을 생성한 뒤 `no_access`의 과거 활성 Issue entitlement 때문에 readback 12/11 불일치로 실패한 문제를 수정했습니다.
- `NO_ISSUE_ACCESS` fixture의 활성 Issue entitlement와 Issue Board grant를 같은 batch에서 비활성화합니다.
- 다른 역할의 권한과 비활성 권한 이력은 보존합니다.
- 과거 권한이 남은 DB의 2회 apply 회귀 테스트를 추가했습니다.
- Migration과 Production은 변경하지 않습니다.

# v0.24.7 — 내부 테스트 Board grant 이력 Hotfix

- v0.24.6 확정 후 Integration apply에서 발견된 `board_access_grants` 활성·비활성 이력 충돌을 수정했습니다.
- fixture 권한 갱신은 활성 grant만 변경하며 비활성 이력을 재활성화하지 않습니다.
- 활성 grant가 없을 때는 기존 idempotent INSERT가 새 활성 행을 생성합니다.
- 활성 행과 비활성 역사 행이 공존하는 상태의 2회 apply 회귀 테스트를 추가했습니다.
- Migration과 Production은 변경하지 않습니다.

# v0.24.6 — 내부 테스트 계약 ID 재사용 Hotfix

- 기존 Integration fixture DB에서 `(company_id, site_id)` 자연키로 저장된 실제 회사-현장 계약 ID를 재사용합니다.
- 신규 DB에서는 기존 fixture 계약 ID를 생성하고, 기존 v0.21 DB에서는 `gc-contract-e2e-v021-site-a`처럼 이미 저장된 ID를 유지합니다.
- 계약 공종과 일반 근로자 현장 등록이 실제 계약 ID를 참조하도록 수정해 FK 실패를 제거했습니다.
- 동일 자연키의 복수 계약과 `OPERATIONAL` 현장 연결은 batch 실행 전에 한국어 오류로 차단합니다.
- 내부 테스트 공통 PIN을 운영 계정과 동일한 숫자 4자리·PBKDF2-SHA256 100,000회 정책으로 맞추고 반복·연속된 단순 PIN을 거부합니다.
- 신규 Migration은 없으며 Production은 변경하지 않습니다.

# v0.24.5 — 내부 테스트 현장 격리

- Integration D1에 Migration 0028을 적용하고 Worker·canonical Pages를 v0.24.5로 배포했습니다. E2E provisioning Secret과 공통 PIN이 없어 12계정 생성과 인증 Browser E2E는 실행하지 않았습니다.
- 테스트 계정 준비 입력을 역할별 JSON에서 공통 8자리 시험 PIN 하나로 단순화하고, 계정별 salt·PBKDF2 hash 분리를 유지했습니다.
- ChatGPT의 설계·검토 역할과 Codex의 공식 구현·배포·Git·패키징 역할을 개발 규칙에 명시했습니다.
- 동일 Integration 서버와 DB에서 운영 현장과 내부 테스트 현장을 `sites.purpose`로 구분합니다.
- 일반 계정의 운영·테스트 현장 교차 Membership을 DB와 서버에서 차단하고 Master 계정만 양쪽 진입을 허용합니다.
- 현장 선택 UI를 운영 현장과 개발 도구로 분리하고 내부 테스트 현장에 영구 문구 배너를 표시합니다.
- 기존 `e2e-v021` fixture를 확장한 명시적 Integration 전용 관리 명령을 추가했으며 자동 생성·물리 삭제·Production 실행은 금지합니다.
- Migration 0028과 Integration 배포 및 실제 테스트 계정 생성은 이번 로컬 패키지 작업에서 실행하지 않았습니다. Production은 변경하지 않았습니다.

# v0.24.4 — Codex Skill 체계와 Integration 배포

- 기존 상위 실행 Skill 5개를 유지하고 역할이 분리된 전문 Skill 10개를 추가했습니다.
- Skill 선택 흐름, 중복 방지, 실제로 읽은 Skill만 보고하는 원칙을 AGENTS와 개발규칙에 연결했습니다.
- 읽기 전용 `validate-skills.mjs`, `skills:validate` 명령과 신규 Skill별 Trigger 평가 자료를 추가했습니다.
- 프로젝트 릴리스·Skill·웹 캐시 버전의 장기 분리 필요성을 기술부채로 기록하고 이번 버전에서는 v0.24.4로 동기화했습니다.
- 직영 배정 기능 코드와 `0027_issue_assignment_type.sql` 내용은 변경하지 않았습니다.

# v0.24.3 — 직영 Issue 공종·담당자 배정

- Issue 배정을 협력업체·직영·미배정으로 명시적으로 구분하는 `assignment_type`을 추가했습니다.
- 기존 업체 배정은 협력업체로, 업체가 없는 기존 이슈는 미배정으로 안전하게 이관합니다.
- 직영 배정은 가짜 업체 없이 원도급사 활성 현장 사용자와 현재 현장 활성 canonical 공종만 사용합니다.
- 단건·일괄 배정, 목록 필터, Audit에 배정 유형을 반영하고 협력업체 사용자의 직영 변경을 차단했습니다.
- 모바일 간편등록은 기존 사진·위치·내용 흐름을 유지하며 신규 이슈를 미배정으로 저장합니다.
- Integration과 Production은 배포하지 않았습니다.

# v0.24.2 — PC Issue Dashboard 일괄 변경 Hotfix

- 선택한 이슈가 같은 업체면 해당 업체의 활성 현장 계약 공종을, 서로 다른 업체면 공통 canonical 공종만 표시합니다.
- 업체 미배정 포함·공통 공종 없음·계약 공종 없음·로딩·실패 상태를 공종 Select 아래 한국어로 안내합니다.
- Dialog에서 업체를 변경하면 공종과 담당자 후보를 즉시 다시 계산하고 이전 갱신 응답이 최신 선택을 덮지 않도록 요청 토큰을 적용했습니다.
- 공종 해제를 후보 Select와 분리하고, 종속 값 정리 체크박스의 전체 문장 클릭·키보드·두 줄 정렬을 보완했습니다.
- Dialog의 업체·공종·담당자·부서 Select 폭을 통일했습니다.
- 기존 Issue options API와 Bulk API를 재사용하며 DB, Migration, R2, Today, Construction Rule은 변경하지 않았습니다.

# v0.24.1 — 전역 사용자 액션 피드백 규칙과 PC Issue Dashboard 안정화

- 처리 중·성공·실패·재시도·중복 실행 방지·접근성 원칙을 공식 개발규칙과 프로젝트 Skill에 추가했습니다.
- 공통 Spinner, Inline 상태, 성공·실패 Toast, 재시도 버튼 유틸리티를 추가했습니다.
- PC Issue 목록 조회와 필터 갱신에 처리 중 문구, 중복 조회 차단, 성공·실패 안내를 적용했습니다.
- 일괄 변경에 대상 건수, `aria-busy`, Dialog 닫기 차단, 성공 후 목록 갱신·행 강조·선택 해제를 적용했습니다.
- 실패 시 선택과 Dialog 입력을 보존하고 Revision 충돌에는 목록 새로고침 동선을 제공합니다.
- API, DB, Migration, R2, Today, 모바일 Photo Viewer는 변경하지 않았습니다.
- Integration과 Production에는 배포하지 않았습니다.

# v0.24.0 — PC Issue Management Dashboard

- PC 이슈 화면을 사진 카드 중심 목록에서 고밀도 관리 행으로 변경했습니다.
- 상태·부서·공종·미배정 필터와 현재 페이지 전체 선택, 선택 해제, Shift 범위 선택을 추가했습니다.
- 최대 50건의 업체·계약 공종·담당자·확정 부서를 Revision 검증 후 원자적으로 일괄 변경합니다.
- 일괄 변경은 현장 관리자 범위, Idempotency, 이슈별 Audit와 배치 Audit를 적용합니다.
- 모바일 Issue Photo Viewer, Today, R2, Issue 상태 머신은 변경하지 않았습니다.
- Integration과 Production에는 배포하지 않았습니다.

# v0.23.0 — Construction Engine v1.0

- 공사·안전·품질·관리·미분류 부서 Master와 SYSTEM·SITE·MANUAL Rule Master를 추가했습니다.
- Issue 제목·내용·canonical 공종을 결정적으로 평가하고 추천 부서·근거·Rule 일치 강도·충돌 Snapshot을 저장합니다.
- 신규 등록, 제목·내용 변경, 공종 변경과 명시적 재추천에만 엔진을 연결하며 관리자 확정값은 재추천으로 덮어쓰지 않습니다.
- Issue 상세에 한국어 추천·확정 영역을 추가하고 기존 SITE scope와 배정 권한을 재사용해 협력업체 변경을 차단합니다.
- 추천·실패·확정·수동 변경을 기존 Audit에 기록하고 전체 본문은 Audit에 저장하지 않습니다.
- 외부 AI·사진 분석·Today·Safety·Quality·상태 머신·R2·Integration·Production은 변경하지 않았습니다.

# v0.22.0 — Issue Photo Viewer 사진 중심 작업 화면

- PC는 기존 목록, 모바일은 사진 슬라이드를 기본으로 사용하며 사진보기·목록보기 전환을 유지했습니다.
- 상단에 뒤로가기, 현재 순번, 상태, 목록보기를 고정하고 한 슬라이드를 이슈 1건 단위로 구성했습니다.
- 사진 위 하단 Overlay를 기본 25%, 최대 35%로 제한하고 접으면 약 56px만 남도록 했습니다. 접힘 상태는 같은 세션의 다음 이슈에서도 유지됩니다.
- 사진 영역 Swipe와 Overlay 조작 영역을 분리하고 키보드 이전·다음, Double Tap 확대, Pinch Zoom을 지원합니다.
- 목록 API 응답을 한 번만 사용하고 현재·이전·다음 썸네일만 준비합니다. 기본 Viewer는 썸네일을 사용하고 사용자가 원본 보기를 선택할 때만 원본을 요청합니다.
- 상태에 따라 조치하기·조치사진 등록·상세보기 중 하나만 주요 버튼으로 표시합니다.
- API·DB·Migration·권한·Today·R2·상태 머신·App Shell은 변경하지 않았고 Integration과 Production에는 배포하지 않았습니다.

# v0.21.1 — 사진 중심 이슈 슬라이드 검토

- 모바일 이슈 목록의 기본 보기를 사진 중심 슬라이드로 변경했습니다.
- 상단 메뉴 아래 남은 화면을 사진이 사용하고 위치·내용·조치 버튼은 하단 오버레이로 표시합니다.
- 오버레이는 기본 펼침이며 접기·펼치기 상태를 현재 세션 동안 유지합니다.
- 좌우 스와이프·키보드·PC 이전/다음 버튼을 지원하며 현재 번호와 상태를 고정 표시합니다.
- 목록 응답의 썸네일과 메타데이터를 재사용하고 앞·뒤 사진만 미리 불러와 슬라이드 이동 시 추가 API 조회를 하지 않습니다.
- PC 목록 보기와 기존 상세·조치·완료 흐름은 유지했습니다.
- Integration 및 Production은 변경하지 않았습니다.

# CHANGELOG

## v0.21.0 — 현장 이슈 초간편 등록 및 등록 후 관리자 배정

- 최초 이슈 등록 화면을 사진 → 위치 → 내용 → 등록 순서로 축소하고 업체·공종·담당자·내부 분류·위치 관리 기능을 제거했다.
- 사진·위치·내용만으로 `OPEN` 미배정 이슈를 정상 저장하며 업체·공종·담당자를 추론하거나 등록자 소속 회사로 자동 입력하지 않는다.
- 기존 전체 필드 생성 요청의 호환성을 유지하고, 상세 화면에서 권한 있는 관리자가 현장 계약 업체·계약 공종·업체 소속 담당자를 함께 배정하거나 재배정하도록 확장했다.
- 목록과 상세에서 업체·공종·담당자 미배정을 한국어로 표시하고, 작성자가 자신의 미배정 이슈를 계속 조회할 수 있도록 범위를 보완했다.
- 배정 전후 값을 기존 Audit에 기록하고 상태 머신, 사진 편집, R2 비공개 저장·정리, 조치·완료 계약은 유지했다.
- DB 컬럼이 이미 nullable이므로 Migration은 추가하지 않았으며 Integration과 Production에는 배포하지 않았다.

## v0.20.1 — Codex 프로젝트 지식·Skill 체계 구축

- `AGENTS.md`를 현재 사용자 요청, VERSION·코드, `AIOS/PROJECT_STATE.md`, 개발규칙, 최신 계약, 과거 기록 순으로 판단하는 짧은 진입점으로 개편했다.
- 현재 기준본·모듈 상태·확정 사실·검증 공백·문서 충돌을 한 파일에서 확인하도록 `AIOS/PROJECT_STATE.md`를 추가하고, 누적하지 않는 단일 전달 파일 `AIOS/NEXT_TASK.md`를 추가했다.
- v0.2.2~v0.8.0 기준의 기존 AIOS와 Handoff 문서는 삭제하지 않고 상단에 `HISTORICAL — 현재 기준 아님`을 표시했다.
- 검토·구현·검증·Integration 배포·패키징을 위한 프로젝트 전용 절차형 Skill 5개를 `.agents/skills`에 추가했다.
- 외부 Skill의 Secret·환경변수·Git·배포·삭제·네트워크 동작을 먼저 검토하고 프로젝트 규칙과 충돌하면 사용하지 않는 안전정책을 추가했다.
- 사용자 화면·Worker·API·DB·Migration·R2·Provider는 변경하지 않았고 Integration과 Production에는 배포하지 않았다.

## v0.20.0 — 공사 Today 현장 가독성 개선

- 회사 정보가 있는 일정은 회사 → 공종·인원 → 위치 → 작업내용 → 시간·주의사항 순으로 배치해 현장 핵심 정보를 먼저 확인할 수 있도록 했다.
- 회사 정보가 없는 확정 공사일보는 공종·인원을 제목으로 유지하고 `회사 미지정`을 작은 보조 정보로 표시한다. 회사·위치·작업내용을 추론하거나 자동 결합하지 않는다.
- 위치 미등록과 시간 미정을 낮은 강조의 보조 문구로 표시하고, 주의사항은 실제 값이 있을 때만 제목과 내용으로 구분해 표시한다.
- 날짜 구역의 단일 출처 안내를 유지하고 카드별 중복 출처 표시는 제거했다. Provider의 오늘 확정 공사일보 우선순위와 내일·모레 월간계획 계약은 변경하지 않았다.
- PC는 충분한 폭에서 2열, 좁은 화면과 모바일은 1열로 표시하며 원본 반환 순서와 60초 자동 갱신 시 스크롤 복원을 유지한다.
- API·DB·Migration·R2·Revision·Parser·Trade Engine·Comparison은 변경하지 않았고 Integration과 Production에는 배포하지 않았다.

## v0.19.7 — 공사일보 날짜 확정 UX 안정화

- 월간 공사일보 상세의 일괄 확정 도구를 App Shell 고정 헤더 아래 sticky 영역으로 제공하고, 선택된 확정 가능 날짜 수를 즉시 표시한다.
- NEW·CHANGED 날짜 카드에 `이 날짜 확정` 버튼을 추가해 기존 `submitConfirmationGroups`, `AUTO_NEW`, `CONFIRM_CHANGED`, idempotency 계약으로 한 날짜만 확정한다.
- 개별·일괄 확정은 하나의 실행 잠금을 공유한다. 실행 중 모든 확정 제어를 비활성화하고 실패 후 다시 사용할 수 있도록 복원한다.
- 확정 후 세션 상세 API를 다시 조회하며 성공한 날짜만 선택에서 제거하고 나머지 선택, 펼친 상세 영역, 스크롤 위치를 보존한다.
- 조회 전용 사용자는 날짜 상세·Revision·경고·작업 원문만 볼 수 있으며 확정 도구와 날짜별 버튼은 표시하지 않는다.
- API·DB·Migration·Parser·Trade Engine·Comparison·Today Provider·월간계획은 변경하지 않았고 Integration과 Production에는 배포하지 않았다.

## v0.19.6 — 공사일보 확정 SQLITE_TOOBIG 긴급 안정화

- 실제 Integration confirm 500의 Root Cause를 `construction_daily_report_upload_sessions.analysis_json` 재저장 binding으로 특정했다. 31일 대형 fixture에서 최초 저장값은 1,571,000바이트였지만 비교 갱신 객체는 3,061,583바이트였다.
- confirm은 월간 분석 원본을 다시 저장하지 않고 세션 상태·확정 시각만 갱신한다. 날짜별 최신 상태는 기존 `refreshStoredComparison()`이 확정 Revision을 기준으로 재계산한다.
- 31일·372개 작업·24개 공종·다수 경고·긴 원문·tradeMatch를 포함한 실제 SQLite 및 2MB D1 binding 한도 모사 테스트에서 단일 날짜와 전체 날짜 확정을 검증했다.
- 날짜 snapshot 최대 19,369바이트, tradeMatch 최대 125바이트, 전체 batch 468 statement로 측정해 batch 개수가 아닌 단일 대형 binding 문제임을 구분했다.
- confirm batch 실패 시 Revision·imported items·Audit·action·세션 상태가 함께 롤백되고 한국어 오류만 표시되도록 보완했다.
- 기존 analysis_json과 R2 원본은 보존하며 Parser·Trade Engine·Comparison 의미·Today 우선순위·월간계획·DB Schema·Migration은 변경하지 않았다.
- Integration과 Production에는 배포하지 않았다.

## v0.19.5 — 기존 분석 세션 확정 흐름 안정화

- 신규 분석 직후와 `최근 월간 업로드 → 날짜별 내용 보기`가 동일한 공통 선택 확정 UI와 이벤트 처리 함수를 사용하도록 통합했다.
- 파일을 다시 업로드하지 않고 기존 `ANALYZED` 세션과 일부 날짜를 확정한 `CONFIRMED` 세션의 남은 `NEW`·`CHANGED` 날짜를 계속 확정할 수 있다.
- 조회 전용 사용자는 날짜·경고·작업 원문만 보고 체크박스와 확정 버튼은 사용할 수 없으며, 서버의 기존 EDIT 권한 검증을 유지한다.
- NEW·CHANGED 동시 선택의 요청과 결과를 분리하고 부분 실패를 숨기지 않으며, 확정 후 세션을 다시 조회해 Revision과 비교 상태를 표시한다.
- 변경 Revision의 동시성 검사를 정규화 비교 해시가 아닌 동일한 DB 저장 해시끼리 수행해 정상 `CONFIRM_CHANGED`가 409로 차단될 수 있던 문제를 수정했다.
- DB·Migration·R2·Parser·Trade Engine·Comparison 의미·월간계획·Today Provider는 변경하지 않았고 Integration과 Production에는 배포하지 않았다.

## v0.19.4 — 공사일보 선택 확정 계약 복구

- 월간 공사일보 분석 결과의 날짜 카드에 확정 선택 체크박스와 `전체 선택`, `전체 해제`, `선택 날짜 확정` 동작을 복구했다.
- 날짜별 상태를 `확정 가능`, `확인 후 확정 권장`, `확정 불가`로 구분하고, 확정 완료 후 Revision과 공식 출처를 표시한다.
- 선택한 신규 날짜와 변경 날짜를 기존 `AUTO_NEW`, `CONFIRM_CHANGED` Revision 생성 계약으로 각각 처리한다.
- 신규 날짜 자동 반영 API는 날짜 목록이 전달되면 선택한 신규 날짜만 확정하도록 보완했다.
- Parser, 공종 매칭 엔진, 비교 엔진, Today Provider, 월간계획, DB 및 Migration은 변경하지 않았다.

## v0.19.3 — 월간계획 PATCH 공종·회사별 선택 UX 안정화
- PATCH에서 `tradeKey`를 보내고 `tradeLabel`을 생략하면 이전 label을 재사용하지 않고 서버가 새 key의 공식 공종명을 다시 결정한다.
- 잘못된 label, 비활성·미계약·다른 현장 공종 차단과 Revision·Audit 원자성은 그대로 유지한다.
- Construction 옵션 API에 선택적 `companyId` 필터를 추가해 기존 무필터 응답과 다른 화면의 하위 호환성을 유지한다.
- 월간계획 폼은 회사 변경 시 해당 회사의 활성 현장 계약 공종만 다시 불러오며, 사용할 수 없는 기존 선택만 해제하고 나머지 입력값은 보존한다.
- DB·Migration·R2를 변경하지 않았고 Integration과 Production에는 배포하지 않았다.

## v0.19.2 — 월간계획 취소 사유·공종 무결성 안정화
- 신규 Migration 0025로 월간계획의 구조화된 `cancellation_reason`을 추가하고 일반 메모와 분리했다. 기존 메모·취소 일정은 변환하지 않는다.
- 신규 취소는 메모를 변경하지 않고 취소 사유, 처리 사용자·시각, 상태와 Revision을 조건부 UPDATE 및 Audit 배치로 저장한다.
- 월간계획 생성·수정 시 현재 현장의 활성 공종 계약과 활성·선택 가능 공종 master를 검증하고 서버 공식 공종명을 snapshot으로 저장한다.
- 클라이언트 공종명이 공식명과 다르거나 공종이 없거나 비활성·다른 현장 전용이면 저장과 성공 Audit 없이 400으로 차단한다.
- Remote Migration과 Integration 배포를 적용하지 않았고 R2와 Production은 변경하지 않았다.

## v0.19.1 — 월간계획 날짜·Revision·Audit 원자성 안정화
- 월간계획 날짜는 형식뿐 아니라 실제 달력에 존재하는 `YYYY-MM-DD`만 허용하며 윤년을 정확히 처리한다.
- 수정·취소는 Revision 기반 낙관적 잠금으로 정확히 1행이 변경된 경우에만 성공하고, 오래된 Revision은 409로 안내한다.
- 조건부 UPDATE와 실제 저장 행 기반 Audit을 하나의 D1 배치 트랜잭션으로 처리해 UPDATE 0행이면 성공 Audit을 생성하지 않는다.
- 수정·취소 성공 시에만 Revision을 1 증가시키며, 중복 취소는 기존 멱등 응답을 유지한다.
- DB Schema와 Migration은 변경하지 않았고 Integration Migration·Integration 배포를 적용하지 않았으며 Production은 변경하지 않았다.

## v0.19.0 — 월간계획·공사 Today·공사일보 경고 상세
- D1 기반 월간 공사계획 기간 일정과 현장 격리·기존 Construction 편집 권한·감사·중복 제출 방지·Revision 검증을 적용한 조회·등록·수정·취소 API를 추가했다.
- 공사 관리 메뉴에 `월간계획`을 추가하고 PC 월간 달력과 모바일 선택 날짜 목록, 기간 일정, 공종·회사·위치·작업내용·예정 인원·시간·주의사항 입력을 구현했다.
- Construction 공사 Today를 공사일보 관리 화면과 분리해 오늘·내일·모레 일정과 출처를 표시한다. 오늘은 확정 공사일보를 우선하고 미확정이면 월간계획, 내일·모레는 월간계획을 사용한다.
- 공사일보 날짜별 경고를 확인 필요·참고로 분류해 사용자용 제목, 설명, 관련 공종·작업, 원본 위치, 자동 반영 여부와 확정 가능 상태를 같은 화면에서 펼쳐 확인할 수 있게 했다.
- 기존 Parser·공종 사전·매칭 점수·Comparison·Revision·R2 구조는 변경하지 않았으며 Integration과 Production에는 배포하지 않았다.

## v0.18.4 — 공사일보 분석 D1 payload Hotfix
- 실제 37,705,458바이트 월간 파일의 32개 날짜 분석에서 `analysis_json`이 2,750,450바이트가 되어 Remote D1의 2,000,000바이트 문자열·행 한도를 넘은 Root Cause를 확인했다.
- 전체 Parser 분석 1,724,878바이트는 보존하고, 동일 날짜·작업을 다시 담던 Preview 1,025,548바이트는 요약만 저장한 뒤 기존 비교 함수로 조회 시 재계산하도록 했다. 실제 저장 payload는 1,725,128바이트다.
- D1 쓰기 직전 SQL·binding별 자료형과 바이트 크기만 기록하고, 한도 초과 시 한국어 오류로 D1 호출 전에 중단한다.
- D1 저장 실패 시 새 검증 R2 객체를 정리하고 임시 원본은 유지하며, 성공 후에만 임시 원본을 삭제한다. 만료된 실패 세션은 양쪽 경로를 정리한다.
- Parser 의미, 공종·비교·Revision 정책, Today, DB Schema·Migration, Reset 범위는 변경하지 않았고 Integration·Production 배포와 실제 업로드·확정은 수행하지 않았다.

## v0.18.3 — Remote D1 Reset SQL Hotfix
- v0.18.2의 실제 `deletionSql()`이 `BEGIN IMMEDIATE`와 `COMMIT`을 `delete.sql`에 기록해 Wrangler Remote D1에서 거부된 Root Cause를 수정했다.
- Remote 삭제·복구 SQL에서 명시적 transaction wrapper를 제거하고, 실제 생성 파일을 실행 직전에 다시 읽어 BEGIN·COMMIT·ROLLBACK·SAVEPOINT·RELEASE 금지 토큰과 SHA-256 동일성을 검사한다.
- Dry Run에 SQL 파일 경로, SHA-256, 문장·DELETE·UPDATE 수, 금지 토큰 0건과 대상 테이블을 표시한다.
- Remote D1 실행 실패 시 대상 수를 다시 조회해 변경 0건이면 복구 불필요로 보고하고, 일부 변경이면 기존 백업으로 복구를 시도한다.
- Reset 범위, R2 범위·백업, Parser·공종·비교 엔진, Today, DB·Migration은 변경하지 않았으며 실제 Integration Reset과 배포 및 Production 변경은 수행하지 않았다.

## v0.18.2 — 초기화 가시성·최종 확인 안전성 보완
- Dry Run을 실행 대상, 삭제 대상 현황, 삭제 후 예상 0건, 유지 대상, R2 전체 키, 백업 계획 구역으로 나눠 실제 조회값을 표시한다.
- 빈 키, 다른 현장·모듈 Prefix, 비정상 경로와 백업 Prefix를 강제 거부하고 중복 제거 후 R2 키 전체를 사람이 확인할 수 있게 했다.
- 실제 실행은 명시된 Integration 현장과 1차 확인 인수에 더해 TTY에서 `DELETE-CONSTRUCTION-TEST-DATA`를 정확히 입력해야 시작한다. CI·배포 파이프라인·비대화형 실행은 차단한다.
- 성공 시 삭제 전·삭제·삭제 후 상태와 최초 업로드 절차를 출력하고, 실패 시 실패 단계와 D1·R2 복구 결과를 구분한다. 양쪽 모두 기계 판독 가능한 `reset-result.json`을 남긴다.
- 삭제 범위, D1 트랜잭션, R2 백업, 복구 SQL, Parser·공종·비교 엔진, Today, DB·Migration은 변경하지 않았으며 실제 Integration 초기화와 배포 및 Production 변경은 수행하지 않았다.

## v0.18.1 — Integration 공사일보 테스트 데이터 완전 초기화
- v0.18.0의 “기존 원본 보존 후 Revision 재생성” 해석을 폐기하고, 공사일보 업로드 이력을 한 번도 없는 상태로 되돌리는 관리자 도구로 교체했다.
- 기본 Dry Run, Integration 대상 고정, 실행 확인 문자열, Production 코드 차단을 적용했다.
- 공사일보 업로드·세션·Revision·항목·비교 동작·분석 Preview만 삭제하며 출력일보 사진과 사용자·회사·현장·권한·다른 모듈 데이터는 보존한다.
- D1 전체 대상 행과 R2 키 목록을 백업하고, R2 원본은 전용 백업 Prefix로 복사한 뒤 메타데이터에 연결된 정확한 키만 삭제한다. 부분 실패 시 자동 복구를 시도한다.
- DB 구조와 Migration, Parser, 공종 매칭 엔진, Today의 다른 공급자는 변경하지 않았다. Integration 및 Production에는 배포하거나 실제 초기화를 실행하지 않았다.

## v0.18.0 — Construction Revision 기준 정리 도구
- Integration 읽기 전용 조사에서 업로드 메타데이터 19건, 공식 Revision 18건, 파생 작업 항목 199건, 월간 preview 10건, 비교 실행 기록 2건을 확인했다.
- 기본 Dry Run과 이중 실행 확인을 적용한 관리자 전용 `reset-construction-revisions` 도구를 추가했다.
- 업로드 메타데이터·월간 세션·R2 원본은 유지하고 파생 작업 항목, 비교 snapshot·hash, 월간 preview와 비교 실행 기록만 현재 엔진으로 재생성한다.
- 기존 R2 원본을 현재 Parser, 공종 엔진, `compareDailyConstructionContent()`로 다시 분석하며 기존 preview를 재사용하지 않는다.
- 실행 전 원본 목록을 로컬 검증 기록으로 남기고 실행 후 업로드·세션 보존 수와 재생성 항목 수를 확인한다.
- DB 구조와 Migration, Production은 변경하지 않았으며 Integration에서는 Dry Run만 수행했다.

## v0.17.7 — 저장된 월간 비교 결과 호환 안정화
- 실제 Integration D1의 2026-07-17 Revision 1에서 총 8명, 직원 7명, T/C 조종사 1명과 빈 `plannedWorkItems` 구조를 확인했다.
- v0.17.6 배포 후에도 기존 월간 업로드 세션의 `analysis_json.preview`가 최초 분석 당시의 두 건 `공종 추가`를 그대로 반환하던 원인을 수정했다.
- 기존 분석 세션 상세 조회와 변경 확정 직전에 현재 활성 Revision을 기준으로 날짜 비교 결과를 다시 계산한다.
- D1 snake_case 행을 camelCase 비교 객체로 변환하는 저장 Revision 경계와, 공식 근거 기반 fallback 복원 함수를 명시적으로 분리했다.
- 공종별 근거가 없는 기타 인원은 추가로 확정하지 않고 `확인 필요` 상태와 한국어 설명으로 표시한다.
- Parser, 공종 사전·별칭·충돌·점수, DB 구조, Migration, 인증·권한, Today UX는 변경하지 않았으며 Integration과 Production은 배포하지 않았다.

## v0.17.6 — 구형 Revision fallback 비교 호환 안정화
- 빈 `plannedWorkItems`가 `Array.every()` 때문에 현재 구조로 오인되어 구형 fallback 복원이 생략되던 원인을 수정했다.
- 구형 Revision의 공종별 출력행과 `employeeWorkforce`에 공식 근거가 있을 때만 직원·T/C 조종사 `노코멘트` fallback을 비교 메모리에서 복원한다.
- 저장된 월간 업로드의 workforce 요약 필드를 기존 snapshot과 함께 비교 정규화에 전달하며 DB 원본과 기존 Revision은 수정하지 않는다.
- 총 출력인원만 있고 공종별 근거가 없으면 인원을 역산하거나 업로드 값을 복사하지 않고 `확인 필요`로 유지한다.
- 실제 직원 인원 변경과 T/C 조종사 추가·삭제는 계속 변경으로 표시하며, 공종·인원 강조와 JSON 미노출 UI는 유지한다.
- Parser, 공종 사전·별칭·충돌·점수, DB, Migration, 인증·권한, Today UX는 변경하지 않았으며 Integration과 Production은 배포하지 않았다.

## v0.17.5 — 공사일보 의미 기반 변경 비교 안정화
- 날짜 변경 상태와 화면의 변경 목록이 Worker의 단일 비교 결과를 사용하도록 통합했다.
- 이전·현재 Revision의 공종을 동일한 안전 기준 공종 키로 정규화하고, 충돌 공종은 서로 매칭하지 않는다.
- 작업내용 비교 시 Unicode 호환 정규화, 목록 기호, 공백과 줄바꿈 차이는 무시하되 의미 있는 글자와 숫자는 보존한다.
- 같은 공종의 복수 행은 완전 일치, 작업내용, 공식 인원, 단일 잔여 후보 순으로 결정적으로 연결하며 모호한 후보는 `확인 필요`로 남긴다.
- 기계설비공·소방설비공·형틀공·견출공의 괄호 세부표기 차이가 동일 업무의 삭제·추가로 오분류되지 않도록 회귀 테스트를 추가했다.
- DB, Migration, Parser, 공종 사전·별칭·충돌 규칙·점수, 인증·권한, Today UX는 변경하지 않았으며 Integration과 Production은 배포하지 않았다.

## v0.17.4 — 복합 공종 비교·표시 안정화

- 기존 공종 엔진의 표준 공종 ID와 복합 공종 기본명을 재사용해 표시 공종명과 비교 키를 분리했다.
- 기계설비공·소방설비공·형틀공·견출공의 괄호 세부 구성 차이를 공종 삭제·추가로 오판하지 않게 했다.
- 같은 기본 공종의 여러 작업은 작업내용 완전 일치, 공식 인원 일치, 단일 후보 순으로 대응하며 복수 후보는 임의 연결하지 않고 확인 필요로 표시한다.
- 기본 작업 행은 괄호 세부 구성을 제외한 `공종명(공식 인원)`으로 표시해 연속 괄호를 제거하고 공종·인원 강조와 일반 굵기 작업내용을 유지했다.
- 세부 구성 숫자는 비교용 공식 인원으로 사용하지 않고 기존 출력현황 금일 인원을 유지했다.
- 공종 사전, 별칭, 충돌 규칙, 점수, Parser, DB, Migration과 승인 흐름은 변경하지 않았으며 Integration과 Production은 배포하지 않았다.

## v0.17.3 — 공사일보 작업 표시·변경 비교 UI 안정화

- 월간 분석, 확정 상세, 날짜 상세, 변경 비교와 Today 작업 행에서 공종명·인원만 `strong`으로 강조하고 작업내용과 노코멘트는 일반 굵기로 분리했다.
- 사용자 파일의 공종, 인원, 작업내용을 각각 escape하는 공통 작업 행 렌더링을 추가했다.
- 변경 비교 화면의 `JSON.stringify` 및 `<pre>` 출력을 제거하고 기존·업로드 값을 한국어 공종별 문장으로 표시한다.
- 공종 추가·삭제, 인원 변경, 작업내용 변경, 인원 및 작업내용 변경을 구분하고 순서·원문·내부 메타데이터만 다른 항목은 사용자 변경 목록에서 제외한다.
- 저장 스냅샷은 변경하지 않고 날짜 비교 시에만 공종·인원·작업내용을 의미 정규화하여 순서·원문·메타데이터 차이만으로 `변경` 분류되지 않게 했다.
- 모바일 긴 문장 줄바꿈과 가로 넘침 방지 스타일을 관련 Construction·Today 범위에만 적용했다.
- 공종 엔진, Parser, DB, Migration, 인증·권한과 변경 승인 흐름은 변경하지 않았으며 Integration과 Production은 배포하지 않았다.

## v0.17.2 — 월간 공사일보 비교 공종·인원 표시 안정화

- 월간 분석과 비교 화면의 작업 행을 `공종명(인원) - 작업내용` 형식으로 통일했다.
- 미등록 인원과 실제 0명을 각각 `인원 확인 필요`, `0명`으로 구분하고 출력현황 기반 fallback 작업도 누락하지 않는다.
- 비교 스냅샷을 조정된 Parser 결과로 생성하며 공종, 작업내용, 원문, 예정 인원, fallback 여부와 출처를 보존한다.
- 이전 버전 스냅샷은 조회 시 메모리에서 호환 형식으로 정규화하여 의미가 같은 날짜가 모두 변경으로 표시되지 않게 했다.
- DB와 Migration, 공종 사전·별칭·점수·매칭 알고리즘, Today UX는 변경하지 않았다.
- Integration과 Production은 배포하지 않았다.

## v0.17.1 — 현재 현장 공종 규칙 공식 데이터 분리

- 현재 현장 공종 사전과 별칭을 `trade-data/site-trade-dictionary.js`, 충돌 관계를 `trade-data/site-trade-conflicts.js`로 매칭 알고리즘에서 분리했다.
- 별칭의 `CONFIRMED`, `REGISTERED`, `REVIEW_REQUIRED` 상태를 공식 데이터로 관리하고 미확정 별칭은 자동 매칭에서 제외한다.
- 표준 공종 ID, 정규화 별칭, 필수 한글 필드, 별칭 상태, 충돌 참조·자기 충돌·중복 관계를 모듈 초기화 시 검증한다.
- 공개 매칭 함수 계약과 v0.17.0의 공종·별칭·충돌·복합 공종·인원 집계·Today 표시 결과를 유지했다.
- 현장 공종 사전 변경 절차 문서를 추가했으며 UI, DB, 기존 Migration은 변경하지 않았다.
- Integration과 Production은 배포하지 않았다.

## v0.17.0 — 현재 현장 공사일보 공종 매칭 엔진

- 제공된 현재 현장 코퍼스와 실제 7월 공사일보를 기준으로 `SITE` 범위 표준 공종, 확인된 별칭, 충돌 관계, 복합 공종 처리를 구현했다.
- 출력현황과 금일 작업예정사항의 원문·정규화 표기·표준 공종 ID·판단 근거·셀 위치를 보존하고, 한 출력 행이 한 공종 그룹에만 배정되도록 했다.
- 괄호 안 세부 인원은 검증 근거로만 사용하고 왼쪽 출력현황의 금일 인원을 공식 예정 인원으로 유지한다.
- 공종 검토 경고와 총계 차이는 날짜 전체 반영을 막지 않으며, 날짜·필수 머리글·행 구조 오류만 날짜 단위 차단 사유로 유지했다.
- Today 작업명을 `공종명(인원) - 작업내용`으로 표시하고, 미등록 인원은 0 대신 `인원 확인 필요`, 출력현황만 있는 공종은 `노코멘트`로 표시한다.
- 새 DB Migration은 필요하지 않으며 기존 `0021_construction_workforce_matching.sql` 구조를 그대로 사용한다.
- Integration과 Production은 배포하지 않았다.

## v0.16.1 — 공종 안전 매칭·금일 총 출력인원

- 출력현황과 금일 작업예정사항의 공종을 원문, 정규화명, 등록 별칭, 복수 핵심 단어 순으로 안전하게 연결한다.
- `전기통신설비공`과 `전기통신공`을 명시적 별칭으로 연결해 인원을 누락하거나 중복 집계하지 않는다.
- 출력인원만 있는 공종과 직원 행은 원본 공종명·“노코멘트”·보완 출처 메타데이터를 가진 항목으로 보존한다.
- 직원과 개별 공종의 금일 인원을 합산한 금일 총 출력인원을 계산하며 원본 합계는 검증값으로만 사용한다.
- 공종 후보가 불확실하거나 계산 총계가 원본 총계와 다르면 자동 연결·자동 확정하지 않고 확인 경고를 표시한다.
- Today 펼침 상세에 공종, 작업내용, 예정 인원과 “공사일보 기준” 금일 총 출력인원을 표시한다.
- 신규 Migration `0021_construction_workforce_matching.sql`과 관련 Parser·Today 회귀 테스트를 추가했다.
- Production은 변경하지 않았다.

## v0.16.0 — 월간 공사일보 날짜별 비교·안전 자동 반영

- 월간 엑셀의 유효 날짜를 최신 확정본과 정규화된 `content_hash`로 비교해 신규, 동일, 변경, 확인 필요, 분석 불가, 미래 날짜로 구분한다.
- 신규 날짜만 한 번에 자동 반영하고, 동일 날짜에는 Revision을 만들지 않는다.
- 변경 날짜는 달라진 업무 항목만 기존/업로드 값으로 비교한 뒤 사용자 승인 시에만 새 Revision으로 반영한다.
- 날짜별 정규화 원본과 SHA-256 해시를 저장하고, 자동 반영 및 변경 승인 요청을 별도 멱등 작업 기록으로 보관한다.
- 명시적인 휴무·작업 없음은 유효한 일보로 인정하고, 실제 빈 날짜 블록은 자동 반영하지 않는다.
- 최근 업로드 목록을 같은 월의 최신 월간 파일 한 건으로 묶어 상태별 건수와 원본 다운로드를 제공한다.
- 사용자 화면 문구와 버전 표면을 v0.16.0으로 동기화했으며 Production은 변경하지 않았다.

## v0.15.0 — 월간 공사일보 직접 업로드·복수 날짜 확정

- 15MB multipart 업로드를 제거하고 최대 50MB `.xlsx`를 15분짜리 presigned PUT URL로 비공개 R2에 직접 업로드한다.
- 업로드 세션을 현장·사용자·파일 크기·SHA-256·R2 경로에 바인딩하고 확장자·MIME·ZIP 시그니처를 검증한다.
- 월간 파일 분석 후 날짜별 작업·공종·예정 인원·경고·Revision을 표시하고 유효한 날짜 전체 또는 일부를 선택해 확정한다.
- 복수 날짜 확정을 원자적 D1 Batch와 멱등성 키로 보호해 부분 저장과 중복 Revision을 막는다.
- 비동기 업로드 후 `event.currentTarget`이 null이 되어 발생하던 버튼 복구 오류를 안정적인 버튼 참조로 수정했다.
- 기존 공사일보 Revision, 원본 다운로드, Today, 출력일보 사진 보관과 Production은 변경하지 않았다.

## v0.14.2 — 공사일보 API 배포·오류 표시 안정화

- Integration D1에 기존 `0018_construction_excel_and_output_archive.sql`이 적용되지 않아 공사일보 조회가 `no such table`로 실패한 Root Cause를 확인했다.
- 새 Migration을 만들거나 기존 Migration을 수정하지 않고, Integration 적용 순서를 Migration → Worker → Pages로 명확히 했다.
- 공사일보 화면이 403 권한 거부와 500 서버 오류를 구분해 하나의 올바른 안내만 표시하도록 수정했다.
- 실제 월간 공사일보 18개 날짜의 공종·예정 인원·작업 원문·셀 위치·경고를 재검증했다.
- Today, 출력일보 사진 보관, Revision, Parser 구조와 Production은 변경하지 않았다.

## v0.14.1 — 공사일보 파서 정확성·추적성 보강

- 월간 공사일보 전체를 제목과 필수 헤더 조합으로 찾아 18개 날짜 블록을 분석하며, 67행 고정 간격은 더 이상 유일한 식별 조건으로 사용하지 않는다.
- 날짜 수식은 저장된 계산값을 우선 사용하고, 계산값이 없는 경우 안전한 `이전 셀 + 1`만 해석한다.
- 원문·정규화값·원본 셀 위치·경고 코드를 보존하고 빈 인원, 실제 0, 잘못된 숫자, 합계 행을 구분한다.
- 자유서술 작업 위치를 추측하지 않으며 회사 정보가 없는 원본에서 임의 회사 목록을 만들지 않는다.
- 현재 업로드 화면은 월간 파일 전체 날짜를 분석하되 사용자가 선택한 날짜 한 건을 Revision으로 저장하는 기존 UX를 유지한다.
- 기존 DB Migration은 변경하지 않았고 Production도 변경하지 않았다.

## v0.14.0 — 공사일보 엑셀 원본·출력일보 사진 보관 전환

- 회사 보고용 `.xlsx` 공사일보를 분석·미리보기·확정하고 같은 날짜의 재업로드를 Revision으로 보존한다.
- 제공된 실제 월별 공사일보 양식의 67행 반복 블록, 병합 셀, 수식 저장값, 금일 작업예정사항과 공종별 예정 인원을 기준으로 파싱한다.
- 원본 엑셀과 출력일보 원본·썸네일 사진을 R2에 비공개 보관하고 메타데이터·파싱 결과·이력은 D1에 저장한다.
- 기존 전자식 출력일보 UI를 메뉴에서 제거하고 기존 DB·API는 호환 이력으로 보존했다.
- Today는 최신 확정 엑셀 Revision의 주요 작업과 예정 인원만 사용하며 실제 출역 인원과 혼합하지 않는다.
- 제공 양식에 회사명 열이 없으므로 회사명을 추측하지 않고 “회사 연결 필요” 상태로 보존한다.
- OCR과 AI 자동 판독은 구현하지 않았다.
- Production은 변경하지 않았다.

## v0.13.3 — Today 오늘 주요 작업 연동

- “오늘 해야 할 일”을 오늘 확정 공사일보의 금일 주요 작업으로 교체했다.
- 동일 작업명의 회사별 출력 인원을 하나로 묶고 총 투입 인원이 회사별 합계와 일치하도록 집계했다.
- 작업 행 전체를 눌러 같은 화면에서 여러 항목을 독립적으로 펼치고 접을 수 있으며, 키보드 조작과 자동 갱신 시 펼침·스크롤 상태 보존을 지원한다.
- 공사일보 미작성·미확정, 조회 실패, 투입인원 미등록 상태를 각각 지정된 한국어 문구로 구분했다.
- Production은 변경하지 않았다.

## v0.13.2 — 최소 범위 개발규칙 고정

- Codex가 작업을 시작할 때 확인할 루트 `AGENTS.md`, `DEVELOPMENT_RULES.md`, `VERSION.md`를 추가했다.
- 작은 수정은 관련 파일만 읽고 처리하며 전체 저장소 분석·불필요한 리팩터링·병렬 작업을 기본 금지했다.
- 비전공 사용자가 수동 병합·Git 판단·코드 수정을 하지 않도록 역할 경계를 명시했다.
- 작업 요청을 짧게 정리하는 `npm run task:scope -- "요청"` 명령과 최소 변경 절차 문서를 추가했다.
- 새 규칙 파일이 공식 Integrated ZIP과 검증 대상에서 빠지지 않도록 패키징·검증 계약을 갱신했다.
- Production은 변경하지 않았다.

## v0.13.1 — Today 인라인 상세 및 배포 캐시 정상화

- 현장요약과 오늘 주의·알림의 개별 항목을 `/today` 안에서 독립적으로 펼치고 접도록 수정했다.
- 마우스, Enter, Space 입력과 복수 펼침 및 60초 갱신 상태·스크롤 보존을 적용했다.
- v0.13.1 전용 정적 자산 URL과 Service Worker 캐시를 사용하고 이전 GUI’s Arc 캐시를 activate 단계에서 삭제한다.
- 공식 v0.13.0 기준본과 새 패키지를 구분해 동일 버전 파일명에 서로 다른 해시가 생기지 않도록 했다.

## v0.13.0 — 직원용 PC Today 개편 및 정적 모듈 라우팅 안정화

- 직원용 PC Today를 오늘 할 일, 긴급·미조치 이슈, 주의·알림, 현장 요약, 업무 바로가기, 보조 분석 순서로 재구성했다.
- 기존 Issue·Workforce·Construction·Safety·Quality Provider의 실제 데이터와 권한 범위를 재사용했다.
- 긴급 이슈에 제목·위치·담당자·상태·상세 링크를 제공하고 데이터가 없을 때 명확한 빈 상태를 표시한다.
- 최신 CSRF 쿠키를 우선 사용하도록 수정해 오래 열린 탭에서도 로그아웃이 정상 처리되도록 했다.
- 브라우저 공용 모듈 import를 `/packages/...` 절대 경로로 정규화했다.
- `_redirects`의 전역 HTML 폴백을 제거하고 `_worker.js`에서 화면 탐색 요청에만 SPA 폴백을 적용했다.
- `.js`, `.css`, `.svg`, `.json`, `.webmanifest` 및 정적 디렉터리 요청이 누락되면 HTML 대신 명시적 404를 반환한다.
- `/packages/permissions/modules.js`가 `text/html`로 응답해 흰 화면이 발생하는 회귀를 막는 테스트를 추가했다.
- 현장 요약 카드를 독립적으로 펼칠 수 있는 접근성 인라인 패널로 바꾸고 모두 접기와 모듈별 상세 이동을 제공한다.
- 60초 데이터 갱신 후에도 펼침 상태와 스크롤 위치를 유지하며 권한 없음·빈 데이터·오류 상태를 카드 안에서 구분한다.
- Workforce 현장 요약 데이터도 서버에서 모듈 및 게시판 열람 권한을 재검증한다.

## v0.9.0 - 2026-07-27

- Added the real Construction daily-report flow backed by approved attendance and company daily-output reports.
- Added output submission status, revision-aware imports, materials, equipment, special notes, R2 site photos, revision requests, resubmission and finalization.
- Added Construction Today status and the `CONSTRUCTION_DAILY_REPORT` and `CONSTRUCTION_OUTPUT_STATUS` board contracts.

## v0.8.0 - 2026-07-27

- Added approval-gated Workforce enrollment with canonical company, trade and team assignments.
- Added site-bound rotating QR attendance with duplicate prevention and audited correction/cancellation.
- Added real-time company, trade and team attendance totals.
- Added attendance-based daily output reports, revision requests, resubmission and worker Today reflection.
- Added four independent Workforce board permissions and server-side scope enforcement.
- Production was not changed.

## v0.7.0 - 2026-07-26

- Expanded the flat trade master into 14 categories, hierarchical groups, and canonical selectable leaf trades.
- Preserved all v0.6 trade IDs as general leaves and linked Issue creation to contract-scoped trade IDs.
- Added hierarchical company trade selection and master-only trade create/update/activation APIs.
- Separated management work functions from construction trades and prohibited free-text trade persistence.
- Production was not changed.

## v0.6.3 - 2026-07-26

- Added company registration field-level Korean validation in the browser and API.
- Added automatic business-number formatting, digit progress guidance, multi-error summaries, and first-error focus while preserving input.
- Added canonical company validation error codes and safe field/detail response metadata.
- Strengthened the Constitution rule for actionable user-input errors.
- Production was not changed.

## v0.6.0 - 2026-07-26

- Added canonical business registration numbers, standard trades, company trade registration, and site contract trade selection.
- Added formatted phone onboarding, four-digit PIN creation, invitation membership approval state, and copy-safe invitation links and codes.
- Made Today available to every active site membership with approval status, own attendance, and company aggregate information.
- Replaced application-scope navigation decisions with canonical board access for implemented Issue, Workforce, and Administration boards.
- Added server-side company type, company, role, and name filters plus grouped batch board access administration.
- Production was not changed.

## v0.5.1 - 2026-07-26

- Added a shared Korean display dictionary for roles, modules, statuses, access levels, company types, and API error codes.
- Localized the shared shell, Today, Workforce, Issue errors, invitations, administration, and board-access screens without changing canonical values.
- Added the Korean-first user-interface rule and an automated English-remnant validation command.
- Production was not changed.

## v0.5.0 - 2026-07-26

- Added site-scoped canonical board definitions and historical VIEW, EDIT, and MANAGE grants.
- Added audited, revision-checked batch board access administration for implemented Issue and Workforce boards.
- Enforced board access on Issue and Workforce APIs without bypassing existing role, site, company, trade, or assignee scope.
- Added the board access management screen, sensitive-board marking, menu filtering, and regression coverage.
- Added connected company, site participation, user, invitation, role, and application-access administration.
- Added single-use public invitation verification and acceptance for new and existing canonical users.
- Added active site-role uniqueness and masked user identifiers in administration responses.

## v0.4.4 - 2026-07-26

- Fixed Issue registration payloads so temporary building, unit, and room options are sent as labels without invalid location IDs.
- Added regression coverage for canonical UNIT IDs, dynamic and direct unit labels, invalid/cross-site/inactive IDs, and duplicate prevention.

## v0.4.3 - 2026-07-23

- Reworked the mobile header into brand/user/logout and full-width site rows.
- Constrained Issue photos and editor canvases to the viewport and added a full-screen image viewer.
- Added audited site location creation plus delete-or-deactivate behavior for used locations.
- Removed floor from new Issue entry and added direct unit input.
- Added company-specific multi-trade selection and all-active-site-member assignee options.
- Production was not changed.

## v0.4.2 - 2026-07-23

- Localized all Issue UI labels and canonical status display text to Korean.
- Added camera-first and file-select image inputs with one preview, resize, and upload flow.
- Added speech-to-text location assistance, configurable fallback location options, and canonical category codes.
- Added server-scoped company and assignable-user form options plus create-time company-assignee validation.
- Added canonical site location entities, photo annotations with undo/clear, and a photo-free two-line collapsed Issue list.
- Separated the mobile shell header into brand/menu and site/user rows without changing the desktop header.
- Verified the deployed Integration list structure and Issue registration flow; final-build 360px, 390px, 412px viewport reruns, live speech, and Samsung Internet device checks were not executed.
- Production was not changed.

## v0.4.1 - 2026-07-22

- Completed the Integration Issue create, assign, action-photo, completion, rework, and final-completion workflow.
- Enforced assignee, creator, company, trade, site, and FIELD_WORKER scope in the Issue API.
- Added photo-first responsive cards, standard mobile image inputs, upload progress, and duplicate-submit guards.
- Added protected per-media delivery and the Integration Issue operational migration.
- Production was not changed; Samsung Internet and 360/390/412 in-app viewport verification remain unverified.

## v0.1.0 — Modular Monolith Foundation

- 신규 Integrated 프로젝트와 독립 Integration resource 계약
- Platform 기반 Core identity schema, 단일 login/session/logout
- 권한 기반 통합 App Shell, 고정 navigation, responsive layout
- 공통 UI component와 design token
- 모듈 경계, 성능 budget, migration/identity/data ownership 분석
- Production 변경 없음
# v0.1.1 — Foundation Alignment

- Stabilized Desktop Sidebar and Mobile More with URL-derived accessible accordion behavior.
- Replaced `/documents/reports` with canonical `보관함 /documents/archive`.
- Replaced multi-statement CLI provisioning with disabled-by-default Integration Worker D1 batch provisioning and read-back verification.
- Constitution v1.0.0 and GDR-001 through GDR-005 fixed as permanent governance contracts.
- Fixed shared navigation, monochrome design tokens, responsive shell, and truthful placeholders.
- Added Integration-only administrator provisioning safety flow.
- Added version, handoff, UI, navigation, production-protection, and implementation-truth regression contracts.
- No Production change and no database migration.
# v0.1.2 — Provisioning TTY Hotfix

- Fixed interactive provisioning so approved general fields can be supplied through process environment while PIN remains TTY-only and hidden.
- Non-interactive stdin is now rejected instead of risking secret echo or an incomplete top-level await.
- Added canonical redirect, 44px sub-navigation targets, mobile More logout, and cache-busted hotfix assets after authenticated E2E findings.
- Provisioned and verified the approved Integration administrator; provisioning endpoint was disabled after use.
- No schema migration and no Production change.
# v0.2.0 — Integrated Issue Module Foundation

- Added the first real Integrated business module without a separate login or session.
- Added canonical Issue schema, permissions, site-scoped APIs, state machine, audit, optimistic revision and idempotency contracts.
- Added shared-shell Issue list, detail, photo registration, assignment, action, completion, rework and statistics UI.
- Added mobile Issue PWA entry, shell-only cache, local draft and fail-closed offline final submission.
- Added private R2 media namespace and metadata-only D1 storage.
- Other business modules remain truthful placeholders. Production remains unchanged.
- Fixed mobile logout and restored-session CSRF synchronization without weakening write protection.
- Remotely verified the authenticated create, assign, action-photo, completion-request, rework, second action, final completion, list, statistics, media and audit workflow.
# v0.2.1 — Issue Operational Stabilization

- Synchronized Issue implementation truth across Data Ownership, Version Matrix, runtime and handoff documents.
- Added site-manager, general-contractor, contractor-manager, contractor-assignee, no-access and field-worker role contracts.
- Added contractor and assignee record isolation, active-site permission evaluation and media authorization hardening.
- Added payload-aware idempotency for Issue creation, actions and transitions, plus stale-revision denied audit.
- Added sequential R2 upload cleanup for partial failures and explicit private media response headers.
- Preserved Production and every legacy resource unchanged.
# v0.2.2 — Issue Operational Completion · Authentication Performance

- Login returns canonical Context and avoids the duplicate first-load session call.
- Added safe Server-Timing decomposition without changing PBKDF2 100,000 or synchronous audit.
- Remotely verified bilateral contractor isolation, entitlement restore, session expiry and R2 failure rejection.
- Login performance remains FAIL because one sample exceeded two seconds; offline and screenshot evidence remain incomplete.
- Production and legacy resources unchanged.
# v0.3.0 — Git Official Baseline · Today Module Foundation

- Established the verified v0.2.2 Integrated ZIP as the official Git baseline with release and branch governance.
- Added the authenticated, selected-site-scoped Today aggregation API with Core and canonical Issue providers.
- Added explicit PLACEHOLDER and NOT_CONNECTED provider states without fabricated operational values.
- Added lazy-loaded responsive Today UI, canonical Issue links, KST work date, provider timing and browser performance marks.
- Added Today authorization, scope, aggregation, implementation-truth, responsive and performance regression contracts.
- No database migration. Production and legacy Platform, OS and Issue resources remain unchanged.
# v0.4.0 — Workforce Attendance Foundation

- Added Core-linked Workforce profiles and site enrollments with approval states.
- Added fail-closed, site-bound HMAC dynamic QR issuance and KST attendance check-in.
- Added database uniqueness, idempotency and audit coverage for duplicate/concurrent requests.
- Added live summary, attendance UI, worker PWA and a real Today Workforce provider.
- Upgraded the shared Service Worker cache and navigation strategy without unconditional `skipWaiting`.
- Kept Production and all legacy OS/Platform/Issue sources unchanged.
# v0.24.0 — PC Issue Management Dashboard

- PC 이슈 화면을 사진 카드 중심 목록에서 고밀도 관리 행으로 변경했습니다.
- 상태·부서·공종·미배정 필터와 현재 페이지 전체 선택, 선택 해제, Shift 범위 선택을 추가했습니다.
- 최대 50건의 업체·계약 공종·담당자·확정 부서를 Revision 검증 후 원자적으로 일괄 변경합니다.
- 일괄 변경은 현장 관리자 범위, Idempotency, 이슈별 Audit와 배치 Audit를 적용합니다.
- 모바일 Issue Photo Viewer, Today, R2, Issue 상태 머신은 변경하지 않았습니다.
- Integration과 Production에는 배포하지 않았습니다.

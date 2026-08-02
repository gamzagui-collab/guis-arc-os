# GUI's Arc 다음 단일 작업

## v0.24.14 Engine Core v1 Stabilization 현재 작업

- 남은 검증: 새 브라우저 세션에서 역할별 Browser E2E와 ISSUE_CREATED, TITLE_CHANGED, DESCRIPTION_CHANGED, TRADE_CHANGED, MANUAL_REQUEST의 Integration History·Metrics 증분을 실제 확인한다.

- Engine Constitution과 Construction adapter 연결을 검증한다.
- Migration 0029, registry/history/metrics, event idempotency, 특정 execution 결정 연결을 Integration에서 확인한다.
- 기존 Construction 공개 계약과 결과 parity를 유지한다.
- Production은 변경하지 않는다.
- Engine Core v1 MVP Integration 배포와 실제 수동 추천 E2E는 완료됐다. 후속 엔진 추가는 별도 승인 작업이다.

## v0.24.12 안정화 Hotfix 인계 기준

- `ISSUE-ASSIGN-001`만 수정한다.
- `ISSUE-AUTH-UI-002` 범위로 완료 요청·완료 확인·재조치 권한을 UI와 Worker의 공통 정책 함수로 정렬한다.
- 단건·일괄 배정의 UI payload, Worker 검증, DB 저장 유형과 상태 전이를 동일 계약으로 유지한다.
- 현재 소스 버전: v0.24.12
- Migration·Production 변경 없음. Integration 관리자 완료 Browser E2E 완료; 작성자·일반 사용자의 실제 계정 Browser E2E는 별도 진행 시 명시한다.

## 과거 v0.24.11 인계 기록

- TEST-FIXTURE-001과 ISSUE-AUTH-UI-001만 수정한다.
- 협력업체 담당자 fixture는 공식 ROLE_DEFAULTS의 ISSUE EDIT를 공유하고, 조치 UI는 Board access·capability·개인 담당자·상태 계약으로 렌더한다.
- `ISSUE-ASSIGN-001`은 `NEXT_HOTFIX_CANDIDATE`로만 기록하며 별도 계약 확정 전 구현하지 않는다.
- 현재 소스 버전: v0.24.11
- Migration·Production 변경 없음. Integration Worker·Pages v0.24.11 배포와 VIEW-only·접근 없음 Browser E2E를 완료했다.
- 다음 권장 작업은 `ISSUE-ASSIGN-001` 계약 확정과 별도 Hotfix다. 신규 조치 저장·완료 재실행은 조치 가능한 담당자 fixture 준비가 차단되어 `NOT_EXECUTED`다.

## v0.24.10 Hotfix 인계 기준

- v0.24.9 실제 사용자 검증에서 재현된 공사담당자 PC 이슈 일괄 변경 이벤트 바인딩 중단을 v0.24.10에서 최소 수정한다.
- 일괄 변경 capability는 서버와 동일한 SITE scope + ISSUE EDIT/MANAGE grant를 사용하며, 선택 없음·처리 중·성공·실패 피드백 계약을 유지한다.
- Integration에서 단일·다중·전체 선택 저장, 새로고침 유지, 권한 경계와 Console·Network를 확인한 뒤 Worker·Pages·패키지를 확정한다.
- 현재 소스 버전: v0.24.10
- 직접 기준 ZIP: `GUI_Arc_Integrated_v0.24.4_Integrated.zip`
- 직접 기준 SHA-256: `455A993C035AD55722DEC5D71324158894159E11BEB3860BD3F98BDBD5560BA8`
- 로컬 구현: 내부 테스트 현장 격리, Migration 0028, 12개 역할별 fixture, Integration 전용 관리 CLI.
- 다음 운영 작업 후보: 협력업체 별도 인증 세션의 실제 Browser 권한 차단을 필요 시 추가 확인한다.
- 현재 원격 상태: v0.24.10 Worker·Pages 배포와 공사담당자 단일·다중 저장·새로고침·전체 선택 Browser E2E 완료; Production `NOT_CHANGED`.
- 아래 v0.24.4 항목은 과거 직접 기준 기록이며 현재 원격 배포 완료를 의미하지 않는다.

- 공식 기준 버전: v0.24.4
- 직접 기준 ZIP: `GUI_Arc_Integrated_v0.24.4_Integrated.zip`
- 공식 SHA-256: `455A993C035AD55722DEC5D71324158894159E11BEB3860BD3F98BDBD5560BA8`
- 현재 구현 상태: 상위 Skill 5개와 전문 Skill 10개, 정적 검증과 Trigger 평가 자료를 갖추고 v0.24.3 직영 배정 기능을 유지한다.
- 배포 상태: v0.24.4 Integration Worker·Pages 배포 및 D1 Migration 0027 적용 완료, Production `NOT_CHANGED`.
- 운영 검증 상태: `OPERATIONAL_VERIFICATION_PENDING`.
- 변경 금지 범위: 요청과 무관한 기능 코드, R2, 인증 구조, Today Provider, Construction Rule, Production.

## 남은 검증과 다음 작업 후보

1. 인증된 원도급 관리자 세션에서 직영 단건 배정 검증
2. 직영 일괄 배정 검증
3. 협력업체·직영·미배정 전환 검증
4. 권한별 접근 격리 검증
5. Revision·Idempotency·Audit 실제 원격 검증
6. 신규 Codex 세션에서 Skill Trigger 자동 선택 검증
7. 사용자의 다음 명시적 기능 요청
8. npm 취약점 3건 별도 보안 검토

실행하지 않은 검증은 `NOT_EXECUTED`로 보고하고 Production은 명시적 승인 없이 변경하지 않는다.

이 문서는 누적 이력이 아니며 위 후보가 자동으로 개발 범위를 결정하지 않는다. 다음 작업은 현재 사용자의 명시적 요청으로만 확정하고, 새 릴리스나 다음 작업이 확정되면 전체 내용을 현재 사실로 교체한다.

## v0.24.14 이후 확인 필요 항목

현재 Engine Core v1 Stabilization의 기본 Integration 업무 흐름은 완료됐다. 다음 항목은 이번 릴리스의 코드 범위에 섞지 않고 별도 승인 후 처리한다.

1. Issue 제목·설명 편집의 공식 UI 계약을 확정한 뒤 `TITLE_CHANGED`, `DESCRIPTION_CHANGED`, 복합 변경 실제 Browser E2E를 수행한다.
2. Integration `CONSTRUCTION_MANAGER` 역할의 `issue.assign` 권한 누락이 fixture 의도인지 확인하고 Configuration을 정상화한다.
3. 사용자 화면의 `UNCLASSIFIED` 내부 enum과 상태 이력 사유 `Issue created without assignment`를 한국어 표시값으로 변환하는 최소 UI Hotfix를 검토한다.
4. 브라우저 제어 세션 연결을 복구한 뒤 Console·Network 자동 증거 수집을 재실행한다.
5. npm 의존성 취약점 3건은 기능 변경과 분리해 보안 검토한다. 자동 `npm audit fix`는 실행하지 않는다.

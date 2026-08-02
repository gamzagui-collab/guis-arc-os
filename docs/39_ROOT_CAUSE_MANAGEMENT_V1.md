# Root Cause Management v1 계약

## WHY

반복되는 Issue의 원인을 사람이 구조적으로 기록하고, 확정된 사실을 재발 방지 업무에 활용한다.

## GOAL

- 하나의 Issue에 여러 원인을 기록한다.
- 원인 수준은 `DIRECT`, `CONTRIBUTING`, `ROOT`를 사용한다.
- 분석 상태는 `NOT_STARTED`, `DRAFT`, `CONFIRMED`를 사용한다.
- 기존 Issue 상태와 조치 흐름을 변경하지 않는다.
- 확정된 분석만 현장·기간·수준별 집계에 포함한다.

## RISK

- 사람이나 회사에 대한 책임 추정
- Issue 또는 현장 범위를 넘는 데이터 노출
- 중복 원인과 중복 확정
- 비활성 분류로 인한 과거 기록 손실
- Root Cause 기능과 Engine Core의 잘못된 결합

## SOLUTION

- 시스템 원인 분류 Master와 Issue별 분석·원인 연결을 분리한다.
- 동일 분석에서 같은 분류와 같은 수준의 중복을 DB에서 차단한다.
- 비활성 분류는 과거 기록에서 계속 표시하고 신규 선택만 차단한다.
- 기존 Issue Board Access, 역할 범위, 선택 현장 Context, CSRF, revision, idempotency, Audit를 재사용한다.
- 원인 분석은 Issue 상세 내부에 표시한다.

## TASK

- `0032_root_cause_management_v1.sql`
- 분류 목록, 분석 조회, 초안 저장, 확정, 확정 분석 집계 API
- Issue 상세의 원인 분석 UI
- Migration·권한·중복·한국어 UI 회귀 테스트

## 권한 계약

- Issue 조회 범위를 통과한 사용자는 확정 분석을 조회할 수 있다.
- 초안은 편집 권한 사용자에게만 노출한다.
- 초안 편집은 Issue `EDIT` 또는 `MANAGE` Board Access와 기존 관리 역할을 함께 요구한다.
- 협력업체 관리자는 자신의 기존 Issue 범위에서 초안을 작성할 수 있다.
- 최종 확정은 `issue.manage_all`, `issue.confirm_completion`, Issue 편집 Board Access 및 현장소장급 역할을 함께 요구한다.
- 집계는 현장 전체 Issue 범위와 기존 통계 권한을 함께 요구한다.

## 명시적 제외

- 자동 추천, AI/LLM, 키워드 분류, 사진·음성 분석
- 후보, 추천, 신뢰도, 점수, 책임자·회사 순위
- Engine Registry, Engine History, Engine Metrics 연결
- Issue 제목을 원인으로 자동 복사
- 별도 최상위 메뉴 또는 독립 대시보드
- Issue 상태 자동 변경

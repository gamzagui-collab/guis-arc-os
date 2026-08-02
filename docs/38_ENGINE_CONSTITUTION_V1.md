# GUI's Arc Engine Constitution v1

## WHY → GOAL → RISK → SOLUTION → TASK

### WHY

업무 엔진마다 호출, 결과, 근거, 이력, 성과 기록 방식이 달라지면 운영자가 같은 결정을 재현하거나 비교할 수 없다. Engine Core는 업무 알고리즘을 소유하지 않고 모든 엔진이 지켜야 할 최소 계약과 기록 경계만 제공한다.

### GOAL

Engine Core v1 MVP는 기존 Construction Department Engine을 첫 adapter로 연결한다. 기존 입력 정규화, 규칙 우선순위, 충돌 처리, 점수, 공개 API, 권한, 추천 snapshot 및 확정값은 바꾸지 않는다. Core 기록 실패는 기존 업무 처리를 막지 않는다.

### RISK

공통화가 기존 계산을 바꾸거나, 중복 실행이 이력과 지표를 부풀리거나, 최신 실행을 잘못 결정에 연결하거나, 개인정보와 원문 입력을 과도하게 저장할 수 있다. 따라서 알고리즘과 저장 책임을 분리하고 idempotency, 특정 execution 연결, 최소 JSON, 실패 격리를 강제한다.

### SOLUTION

Core는 단순 JavaScript SDK, 명시적 adapter, append-only history, registry, 원자적 metrics로 구성한다. Integration의 `ENGINE_CORE_ENABLED`가 `true`일 때만 부수 기록을 활성화하고, 기존 Construction 평가와 snapshot 저장은 독립적으로 계속 수행한다.

### TASK

Constitution, Migration, SDK/repository, Construction adapter, Issue event 연결, 결정 연결, 회귀·무결성·실패 격리 검증 순으로 구현한다. Production은 변경하지 않는다.

## 공통 원칙

- 엔진은 추천을 만들고, 사용자가 결정을 확정한다. Core가 업무 결정을 자동 확정하지 않는다.
- 외부 공개 API와 UI 계약은 adapter 연결 때문에 변경하지 않는다.
- history는 append-only이며 수정·삭제 API를 제공하지 않는다.
- 저장 JSON은 크기가 제한된 구조화 근거만 허용하며 사용자 이름, 전화번호, 원문 제목·설명 등 PII 또는 전체 raw input을 저장하지 않는다.
- 새 enum을 DB CHECK로 폐쇄하지 않는다. engine name, event type, lifecycle status는 검증된 문자열로 확장 가능해야 한다.
- Core 장애는 기록 가능한 audit 대상으로 취급하되 기존 업무 흐름을 차단하지 않는다.

## 1. Input Contract

- 목적: adapter가 평가에 필요한 정규화 입력과 추적용 메타데이터를 분리한다.
- 필수: `entityType`, `entityId`, `siteId`, `entityRevision`, `eventType`, `inputHash`, `normalizedInput`.
- nullable: `actorUserId`, `operationId`.
- 소유권: 업무 모듈이 원본을 소유하고 adapter가 정규화 표현을 소유한다.
- 저장: history에는 `inputHash`와 허용된 비식별 요약만 저장한다. `normalizedInput` 전체는 저장하지 않는다.
- 변경성: 한 evaluation 안에서 immutable이다.
- 실패: 계약 위반 시 Core 평가·기록만 실패하고 기존 업무 평가는 계속된다.
- 개인정보: 원문, 전화번호, 사용자 표시명, 파일 내용 금지.
- 호환성: 기존 engine 정규화를 변경하지 않고 adapter가 그대로 호출한다.
- 확장: engine별 필드는 제한된 `attributes` 객체에 추가한다.

## 2. Recommendation Contract

- 목적: 서로 다른 engine 결과를 비교·기록 가능한 공통 형태로 표현한다.
- 필수: `code`, `confidence`, `reasonCodes`, `ruleIds`, `requiresReview`, `engineVersion`.
- nullable: `label`, `candidateCodes`.
- 소유권: engine adapter.
- 저장: history의 제한된 result JSON과 기존 업무 snapshot에 각자의 계약대로 저장한다.
- 변경성: execution 생성 후 immutable이다.
- 실패: 결과가 유효하지 않으면 Core 기록을 거부하되 기존 adapter 결과는 기존 fallback 정책을 따른다.
- 개인정보: 설명문에 사용자 입력 원문을 복제하지 않는다.
- 호환성: 기존 공개 응답 필드명과 값은 업무 모듈 mapper가 유지한다.
- 확장: 선택 필드는 additive 방식만 허용한다.

## 3. Decision Contract

- 목적: 사람이 확정한 결정을 그 근거가 된 특정 evaluation에 연결한다.
- 필수: `entityType`, `entityId`, `decisionCode`, `decidedByUserId`, `decidedAt`.
- nullable: `executionId`, `overrideReasonCode`.
- 소유권: 업무 모듈의 기존 확정 절차.
- 저장: 기존 snapshot의 결정 필드와 `latest_engine_execution_id`를 함께 사용한다. `executionId`는 “최신 history”를 재조회해 추정하지 않는다.
- 변경성: 기존 업무의 재확정 정책을 따르며 history 자체는 변경하지 않는다.
- 실패: Core 연결 기록 실패가 기존 권한 있는 확정을 막지 않는다.
- 개인정보: 사용자 ID 외 표시명·연락처 저장 금지.
- 호환성: 기존 audit, revision, 권한, response를 유지한다.
- 확장: 후속 engine은 자기 snapshot 또는 명시적 decision link를 사용한다.

## 4. History Contract

- 목적: 평가 실행을 재현·감사할 최소 근거를 append-only로 남긴다.
- 필수: `executionId`, engine identity/version, entity identity/revision, event, input hash, result JSON, success, timestamps, idempotency key.
- nullable: `siteId`, `actorUserId`, `errorCode`, `durationMs`.
- 소유권: Core repository.
- 저장: D1 `engine_history`; update/delete 금지.
- 변경성: immutable.
- 실패: 동일 idempotency key는 기존 execution을 반환하고 지표를 중복 증가시키지 않는다.
- 개인정보: 전체 raw input과 PII 금지, JSON 길이 제한.
- 호환성: 과거 row는 해당 engine/version 계약으로 해석한다.
- 확장: event와 engine 문자열은 additive 확장 가능하다.

## 5. Metrics Contract

- 목적: engine/version/event별 실행·성공·실패·review·결정·override 수와 시간 합계를 운영 측정한다.
- 필수: engine identity/version, metric date, counters.
- nullable: 없음. 카운터 기본값은 0이다.
- 소유권: Core repository.
- 저장: D1 `engine_metrics`의 복합 키 row.
- 변경성: append 의미를 가진 원자적 UPSERT 누적만 허용한다.
- 실패: metrics 실패는 evaluation과 업무 흐름을 막지 않는다.
- 개인정보: 개인·entity 식별자 저장 금지.
- 호환성: 새 카운터는 기본값 0으로 추가한다.
- 확장: read-modify-write 금지; SQL `ON CONFLICT ... DO UPDATE SET counter=counter+excluded.counter`를 사용한다.

## 6. Version Contract

- 목적: 같은 engine의 결과를 생성 구현과 정확히 연결한다.
- 필수: `engineName`, `engineVersion`, `contractVersion`.
- nullable: `buildReference`.
- 소유권: engine definition과 registry.
- 저장: registry와 각 history row.
- 변경성: 등록된 identity/version 의미는 변경하지 않는다.
- 실패: 같은 identity/version에 충돌하는 definition은 등록 실패한다.
- 개인정보: 없음.
- 호환성: app version과 engine version은 독립적이며 app은 기존 v0.24.x 정책을 따른다.
- 확장: 새 version은 새 registry row로 등록한다.

## 7. Event Contract

- 목적: 평가가 왜 실행됐는지 결정론적으로 기록한다.
- 필수 이벤트: `ISSUE_CREATED`, `TITLE_CHANGED`, `DESCRIPTION_CHANGED`, `TRADE_CHANGED`, `MANUAL_REQUEST`.
- nullable: 없음.
- 소유권: 업무 모듈이 감지하고 Core가 검증한다.
- 저장: history event type.
- 변경성: execution 후 immutable.
- 실패: 알 수 없는 유효 문자열은 향후 확장을 위해 허용하되 빈 값과 비정상 형식은 거부한다.
- 개인정보: event 문자열에 사용자 입력 포함 금지.
- 호환성: 한 변경에 복수 필드가 바뀌면 한 번만 실행하며 우선순위는 `TRADE_CHANGED > DESCRIPTION_CHANGED > TITLE_CHANGED`다.
- 확장: 대문자 snake-case 문자열을 additive로 허용한다.

## 8. Audit Contract

- 목적: 기존 업무 audit과 Core 성공·실패의 추적 경계를 명확히 한다.
- 필수: actor 또는 system, action, outcome, request/operation reference, entity reference.
- nullable: actor user ID.
- 소유권: 기존 업무 모듈 audit가 권한·업무 변경을 소유하고 Core는 실행 기록을 소유한다.
- 저장: 기존 `audit_logs`와 `engine_history`를 중복 원문 없이 사용한다.
- 변경성: append-only.
- 실패: Core audit 실패를 이유로 기존 업무 transaction을 되돌리지 않는다.
- 개인정보: metadata 최소화.
- 호환성: 기존 Construction audit action과 outcome을 변경하지 않는다.
- 확장: 새 audit action은 기존 명명 규칙을 따른다.

## 9. Override Contract

- 목적: 추천과 다른 사람의 확정을 명시적으로 측정한다.
- 필수: recommended code, decided code, `manualOverride` 계산.
- nullable: override reason code.
- 소유권: 업무 확정 절차.
- 저장: 기존 snapshot과 metrics counter.
- 변경성: 확정 당시 execution 기준으로 immutable하게 해석한다.
- 실패: metrics 기록 실패가 확정을 막지 않는다.
- 개인정보: 자유 입력 사유 원문은 Core에 저장하지 않는다.
- 호환성: 기존 `manual_override` 계산과 공개 응답을 유지한다.
- 확장: 구조화 reason code만 additive 허용한다.

## 10. Lifecycle Contract

- 목적: engine의 등록, 활성, 중단, 대체 상태를 관리한다.
- 필수: engine identity/version, lifecycle status, enabled 환경.
- nullable: replaced-by reference, disabled reason code.
- 소유권: 배포 설정과 registry.
- 저장: `engine_registry`.
- 변경성: registry status는 운영 절차로 변경할 수 있으나 history는 영향받지 않는다.
- 실패: 미등록·비활성 Core는 부수 기록을 생략하며 기존 업무 engine은 계속 동작한다.
- 개인정보: 없음.
- 호환성: `ENGINE_CORE_ENABLED` 기본값은 false로 해석한다. Integration에서만 명시적으로 활성화한다.
- 확장: 신규 lifecycle 문자열은 문서와 검증을 함께 추가한다.

## SDK v1

SDK는 다음 함수를 제공한다.

- `register(definition)`
- `evaluate(definition, context)`
- `confirm(definition, decision)`
- `history(query)`
- `metrics(query)`
- `compare(left, right)`
- `version(definition)`

SDK는 framework, plugin loader, dependency injection container를 사용하지 않는다. DB와 clock/ID 생성기는 생성 함수의 명시적 dependency로 받는다. adapter는 업무 engine 호출과 공통 contract mapping만 수행한다.

## Construction adapter 보존 계약

- `normalizeClassificationInput`, `inputHash`, rule loading, priority, conflict, confidence 계산을 변경하지 않는다.
- 추천 snapshot의 기존 필드와 공개 Issue response를 변경하지 않는다.
- 재추천은 기존 confirmed 필드를 덮지 않는다.
- Core execution 저장 성공 시 snapshot이 해당 `executionId`를 가리킨다.
- Core 저장 실패 또는 flag 비활성 시 기존 snapshot 저장과 API 응답은 그대로 성공한다.
- 결정은 snapshot에 이미 연결된 특정 execution을 사용하며 “가장 최근 history”를 조회해 대체하지 않는다.

## 배포 경계

Engine Core v1 MVP는 Integration에서만 Migration, flag 활성화, Worker/Pages 검증을 수행한다. Production Migration, secret, binding, deployment, data 변경은 금지한다.

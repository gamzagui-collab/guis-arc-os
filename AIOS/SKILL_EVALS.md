# GUI's Arc Skill Trigger 평가

정적 구조와 Trigger 문구를 검토하는 자료다. 현재 Codex 신규 세션의 실제 자동 발견 E2E는 `NOT_EXECUTED`이며, 아래 `실제 실행 여부`는 모두 `NOT_EXECUTED`다.

| Skill | 유형 | 사례 | 예상 Skill | 호출 금지 Skill | 판단 이유 | 실제 실행 여부 |
| --- | --- | --- | --- | --- | --- | --- |
| guis-arc-architecture-review | 명시 | `$guis-arc-architecture-review` 새 기능의 Platform·Issue·Today 경계를 검토해줘. | architecture-review | code-review | 구현 전 시스템 경계 요청 | NOT_EXECUTED |
| guis-arc-architecture-review | 암묵 | 새 기능의 데이터 원본과 장기 확장 위험을 검토해줘. | architecture-review | bug-investigation | 장애가 아닌 사전 경계 검토 | NOT_EXECUTED |
| guis-arc-architecture-review | 오호출 금지 | 버튼 문구만 한국어로 바꿔줘. | 없음 | architecture-review | 단일 UI 문구 수정 | NOT_EXECUTED |
| guis-arc-code-review | 명시 | `$guis-arc-code-review` 현재 변경 코드의 회귀를 검토해줘. | code-review | architecture-review | 구현 후 코드 결함 검토 | NOT_EXECUTED |
| guis-arc-code-review | 암묵 | 이 diff에 예외 처리 누락이 있는지 봐줘. | code-review | bug-investigation | 재현 장애가 아닌 diff 리뷰 | NOT_EXECUTED |
| guis-arc-code-review | 오호출 금지 | 새 모듈의 데이터 소유권을 설계해줘. | architecture-review | code-review | 구현 전 경계 설계 | NOT_EXECUTED |
| guis-arc-bug-investigation | 명시 | `$guis-arc-bug-investigation` 공종 후보가 사라지는 원인을 조사해줘. | bug-investigation | ui-ux-review | 재현 가능한 장애 조사 | NOT_EXECUTED |
| guis-arc-bug-investigation | 암묵 | 업체 변경 후 후보가 갱신되지 않는 Root Cause를 찾아줘. | bug-investigation | code-review | 증상 재현과 원인 확인 필요 | NOT_EXECUTED |
| guis-arc-bug-investigation | 오호출 금지 | 선택창 폭을 100%로 바꿔줘. | implement | bug-investigation | 명확한 스타일 변경 | NOT_EXECUTED |
| guis-arc-test-generator | 명시 | `$guis-arc-test-generator` 권한·Revision 테스트를 추가해줘. | test-generator | security-audit | 확정 계약 기반 테스트 작성 | NOT_EXECUTED |
| guis-arc-test-generator | 암묵 | 직영 전환의 실패·회귀 사례를 테스트로 만들어줘. | test-generator | api-contract-validator | 테스트 산출물 요청 | NOT_EXECUTED |
| guis-arc-test-generator | 오호출 금지 | 500 오류 원인부터 조사해줘. | bug-investigation | test-generator | 계약 미확정 장애 조사 | NOT_EXECUTED |
| guis-arc-browser-e2e | 명시 | `$guis-arc-browser-e2e` Integration 화면을 검증해줘. | browser-e2e | verify | 실제 배포 URL 상호작용 | NOT_EXECUTED |
| guis-arc-browser-e2e | 암묵 | 390px에서 Swipe와 Network 호출을 실제로 확인해줘. | browser-e2e | ui-ux-review | 실제 브라우저·Viewport 요청 | NOT_EXECUTED |
| guis-arc-browser-e2e | 오호출 금지 | 소스에서 모바일 미디어쿼리만 확인해줘. | code-review | browser-e2e | 정적 소스 검토 | NOT_EXECUTED |
| guis-arc-migration-data-integrity | 명시 | `$guis-arc-migration-data-integrity` 0027 Backfill을 검증해줘. | migration-data-integrity | cloudflare-deployment | Migration 데이터 보존 검토 | NOT_EXECUTED |
| guis-arc-migration-data-integrity | 암묵 | 기존 행 수와 Audit을 보존하는지 확인해줘. | migration-data-integrity | test-generator | 이관 무결성 중심 요청 | NOT_EXECUTED |
| guis-arc-migration-data-integrity | 오호출 금지 | Pages를 Integration에 배포해줘. | cloudflare-deployment | migration-data-integrity | 배포 실행 요청 | NOT_EXECUTED |
| guis-arc-security-audit | 명시 | `$guis-arc-security-audit` 다른 회사 사용자 노출을 감사해줘. | security-audit | api-contract-validator | 교차 범위 접근 보안 | NOT_EXECUTED |
| guis-arc-security-audit | 암묵 | 협력업체가 원도급 사용자 목록을 볼 수 없는지 확인해줘. | security-audit | ui-ux-review | 권한·정보 노출 검토 | NOT_EXECUTED |
| guis-arc-security-audit | 오호출 금지 | 카드 간격을 조정해줘. | implement | security-audit | 보안과 무관한 UI 변경 | NOT_EXECUTED |
| guis-arc-api-contract-validator | 명시 | `$guis-arc-api-contract-validator` Bulk null·Revision 계약을 검증해줘. | api-contract-validator | migration-data-integrity | API 필드·동시성 계약 | NOT_EXECUTED |
| guis-arc-api-contract-validator | 암묵 | 생략과 null 응답이 하위 호환되는지 봐줘. | api-contract-validator | code-review | 요청·응답 계약 검증 | NOT_EXECUTED |
| guis-arc-api-contract-validator | 오호출 금지 | D1 Backfill 결과를 확인해줘. | migration-data-integrity | api-contract-validator | DB 이관 검증 | NOT_EXECUTED |
| guis-arc-ui-ux-review | 명시 | `$guis-arc-ui-ux-review` Dashboard 현장 사용성을 검토해줘. | ui-ux-review | architecture-review | 정보 우선순위·사용성 | NOT_EXECUTED |
| guis-arc-ui-ux-review | 암묵 | 50대 현장관리자가 주요 행동을 찾기 쉬운지 봐줘. | ui-ux-review | browser-e2e | UX 검토이며 실제 E2E 명시 없음 | NOT_EXECUTED |
| guis-arc-ui-ux-review | 오호출 금지 | Worker 500 Stack Trace를 조사해줘. | bug-investigation | ui-ux-review | 서버 장애 Root Cause | NOT_EXECUTED |
| guis-arc-cloudflare-deployment | 명시 | `$guis-arc-cloudflare-deployment` Integration D1·Worker·Pages를 배포해줘. | cloudflare-deployment | migration-data-integrity | Cloudflare 환경 실제 배포 | NOT_EXECUTED |
| guis-arc-cloudflare-deployment | 암묵 | 미적용 Migration 확인 후 dev Worker와 Pages를 배포해줘. | cloudflare-deployment | package | Integration 배포 순서 요청 | NOT_EXECUTED |
| guis-arc-cloudflare-deployment | 오호출 금지 | ZIP과 SHA-256만 생성해줘. | package | cloudflare-deployment | 배포 없는 패키징 | NOT_EXECUTED |

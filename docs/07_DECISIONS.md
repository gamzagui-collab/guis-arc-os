# Decision Log

## GDR-001 — Modular Monolith 전환
- Date: 2026-07-22
- Status: ACCEPTED
- Context: 다중 인증, callback, client secret, cross-origin, 중복 session과 API 지연이 현장 운영을 복잡하게 한다.
- Decision: Integrated 단일 배포와 D1 안에서 module boundary를 유지한다.
- Impact: 신규 Integrated 코드에 적용하며 legacy runtime은 rollback reference로 유지한다.
- Review Trigger: 독립 배포가 법적·기술적으로 필요한 경우.

## GDR-002 — Platform을 Integrated Core로 전환
- Date: 2026-07-22
- Status: ACCEPTED
- Decision: Platform identity·organization·authorization을 외부 인증 앱이 아닌 Core로 소유한다.
- Alternative: 기존 App Authentication Bridge 영구 유지.
- Review Trigger: 외부 소비자 인증 계약이 다시 필요할 때.

## GDR-003 — 공통 화면 구조 우선
- Date: 2026-07-22
- Status: ACCEPTED
- Decision: 최종 미술 디자인 전 App Shell과 정보 위치를 고정한다.
- Impact: 시각 교체 시 기능 구조를 보존할 수 있다.
- Review Trigger: 사용자 연구가 정보 구조 변경을 요구할 때.

## GDR-004 — 임시 흑백 테마
- Date: 2026-07-22
- Status: ACCEPTED
- Decision: 검정·회색·흰색을 기본으로 하고 상태 색만 제한한다.
- Review Trigger: 승인된 최종 Figma token이 전달될 때.

## GDR-005 — Figma 생성 코드 직접 병합 금지
- Date: 2026-07-22
- Status: ACCEPTED
- Decision: 생성 코드는 참고 자료이며 design token과 공통 component로 수동 이식한다.
- Impact: 접근성, 권한, 반응형, 성능 검증을 유지한다.
- Review Trigger: 검증 가능한 공식 design-to-code pipeline이 승인될 때.

## GDR-006 — Login Context bootstrap and synchronous audit

- Date: 2026-07-22
- Status: ACCEPTED
- Decision: login and session use one canonical Context builder. Login returns Context to remove the duplicate first-load session request. The transfer is one-time, tab-scoped and removed immediately; it is not trusted for API authorization.
- Security: HttpOnly cookie, CSRF, contextVersion and server-side permission checks remain unchanged. PBKDF2 stays at 100,000 iterations and login audit remains synchronous.
- Review Trigger: all observed PIN-submit samples exceed the performance target after D1 query consolidation.

## GDR-007 — Git main as official source baseline

- Date: 2026-07-22
- Status: ACCEPTED
- Decision: verified `main` plus annotated release tags is the official source lineage. Integrated ZIP remains an untracked release artifact.
- Impact: development occurs on feature/hotfix branches and merges only with truthful verification evidence. Production still requires separate approval.
- Review Trigger: an approved hosted repository introduces enforceable server-side branch protection.

## GDR-008 — Construction inspection and legal Quality boundary

- Date: 2026-07-27
- Status: ACCEPTED
- Decision: 시공 상태 검측은 Construction, 법적·계획상 품질시험과 검사 기록은 Quality가 소유한다. Safety periodic은 체크리스트 게시판이 아니라 서류 instance와 승인 snapshot을 만드는 공통 일정 엔진 소비자로 정의한다.
- Data: `CONSTRUCTION_INSPECTION`은 독립 상태·revision·review를 보존한다. Quality 생성에는 허용된 근거 유형과 관리자 현장 적용 판정이 필요하다.
- Migration: 기존 기록은 자동 이동·삭제하지 않고 분류 보고서에서 관리자 확인을 기다린다.
- Review Trigger: 법령·품질계획 검증 책임자와 Documents 출력 계약이 승인될 때.

## GDR-009 — Quality is a CSI preparation system

- Date: 2026-07-27
- Status: ACCEPTED
- Decision: GUI’s Arc Quality는 CSI 입력 전 품질시험 자료를 준비하고 내부 승인한다. `READY_FOR_CSI`는 제출이 아니며, `CSI_RECORDED`는 실제 외부 입력일·입력자·확인 근거를 사용자가 명시적으로 기록할 때만 생성한다.
- Security: CSI 자격증명과 추정 API를 저장하거나 사용하지 않는다.
- Boundary: 시공 검측은 Construction에 남고 국가 제출과 공식 기록은 CSI에 남는다.

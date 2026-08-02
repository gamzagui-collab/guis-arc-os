# GUI's Arc 현재 프로젝트 상태

## v0.24.12 안정화 Hotfix 상태 (2026-08-02)

- `ISSUE-ASSIGN-001`의 원인은 일반 협력업체 선택 UI가 `assignmentType=CONTRACTOR`를 보내지 않아 Worker가 기존 `UNASSIGNED`를 유지한 계약 불일치였다.
- 단건·일괄 UI와 Worker가 `UNASSIGNED`·`DIRECT`·`CONTRACTOR` 유형 및 `OPEN`·`ASSIGNED` 상태 전이를 공유하며, 잘못된 업체·공종·담당자 조합은 원자적 저장 전에 거부한다.
- `ISSUE-AUTH-UI-002`는 완료 요청·완료 확인·재조치의 capability, 관리자 우회, 작성자·담당자 범위 및 상태 판정을 `issueCompletionDecision`으로 단일화했다.
- Integration Worker `c55742ca-0700-45f9-8698-caead3c67cb6`와 canonical Pages `8d8fda5e`에 배포했으며, 현장소장 Browser E2E에서 완료 확인·재조치 노출, 완료 처리, 새로고침 유지를 확인했다.
- Migration과 Production 변경은 없다.

## v0.24.11 안정화 Hotfix 상태 (2026-08-02)

- `CONTRACTOR_ASSIGNEE` 내부 테스트 fixture의 ISSUE access를 공식 역할 기본값과 공유하여 EDIT로 정렬했다.
- 조치 입력·완료 요청 UI는 선택 현장, ISSUE EDIT/MANAGE, capability, 개인 담당자, 상태 및 활성 조치 사진 조건을 Worker 계약과 동일하게 평가한다.
- VIEW-only 사용자는 상세과 기존 조치 이력은 조회하지만 textarea·사진 입력·등록·완료 요청 UI는 보지 않는다.
- `ISSUE-ASSIGN-001`은 UI가 일반 업체 선택 시 assignmentType을 명시하지 않아 기존 UNASSIGNED가 유지되는 `NEXT_HOTFIX_CANDIDATE`이며 v0.24.11 범위에서 제외한다.
- Migration·DB schema·R2·인증·Production 변경은 없다.
- Integration Worker `76bb7930-5d0a-453d-9aa6-c19bf1c2fd8d`와 Pages `7ebba5fa-233f-4551-bb72-1d02474f1062`에 v0.24.11을 배포했다.
- 실제 Browser E2E에서 VIEW-only 조치 UI 비노출과 접근 없음 차단을 확인했다. 신규 조치 저장·완료 재실행은 조치 가능 담당자 fixture가 없고 ISSUE-ASSIGN-001로 준비가 차단되어 `NOT_EXECUTED`이며 v0.24.10 실제 모바일 저장·완료 증거를 유지한다.

## v0.24.10 Hotfix 상태 (2026-08-02)

- 실제 Integration 공사담당자는 SITE scope와 ISSUE EDIT grant를 보유하지만 레거시 permission 배열이 비어 `/issues/options`의 `canBulkManage`만 false가 되는 권한 조건 불일치를 재현했다.
- v0.24.10은 UI capability를 서버 저장 권한과 동일한 SITE scope + Board EDIT/MANAGE 조건으로 맞추고, 선택 전 클릭에는 한국어 선택 필요 안내를 표시한다.
- 기존 단건 배정, 서버 일괄 변경 계약, 역할·권한·Migration은 변경하지 않는다.
- Integration Worker `e1e1593d-8022-43e1-a9ec-9f3a9f07b9d5`와 Pages canonical v0.24.10 배포를 확인했다.
- 실제 공사담당자 Browser E2E에서 미선택 안내, 단일 1건·다중 2건 직영 저장, 새로고침 유지, 전체 12건 선택 UI, Console 오류 0건을 확인했다. Production은 변경하지 않았다.

## v0.24.7 Board grant 이력 Hotfix 기준 (2026-08-02)

- v0.24.6 확정 후 Integration apply에서 기존 활성 Board grant와 비활성 역사 행을 동시에 재활성화해 partial UNIQUE index가 충돌하는 결함을 확인했다.
- 실패 batch는 원자적으로 rollback되어 fixture 계정 7개·활성 Membership 8개 상태가 보존됐고 부분 생성은 없다.
- v0.24.7은 활성 Board grant만 갱신하며 비활성 이력을 보존한다. Migration과 Production은 변경하지 않는다.

## v0.24.6 계약 ID·PIN Hotfix 기준 (2026-08-02)

- v0.24.5 내부 테스트 계정 apply 실패의 Root Cause는 기존 GC 계약의 실제 ID `gc-contract-e2e-v021-site-a`와 하위 관계가 가정한 `e2e-v021-contract-gc`의 불일치다.
- v0.24.6은 `(company_id, site_id)` 자연키로 실제 계약 ID를 결정하고 계약 공종·근로자 등록에서 동일 ID를 재사용한다.
- 신규 DB, 기존 v0.21 fixture, 2회 적용, batch rollback, 모호성·OPERATIONAL 차단 회귀 테스트를 추가했다.
- 내부 테스트 공통 PIN은 운영 계정과 동일한 4자리 숫자·PBKDF2-SHA256 100,000회 정책을 사용하고 반복·연속된 단순 PIN은 거부한다.
- Migration 변경은 없고 Integration Worker·Pages 재배포와 실제 fixture 재시도·Browser E2E는 검증 절차에서 수행한다. Production은 `NOT_CHANGED`다.

## v0.24.5 배포 기준 (2026-08-02)

- Integration D1 Migration `0028_internal_test_site.sql` 적용 완료, 재조회 미적용 0건이다.
- Integration Worker `guis-arc-integrated-api-dev` 배포 완료. Version ID `05a9f880-8965-462c-b1e6-8d8b9052092b`, health는 v0.24.5/integration/D1·R2 정상이다.
- Integration Pages `guis-arc-integrated-dev` canonical 배포 완료. 고유 URL은 `https://c788b05c.guis-arc-integrated-dev.pages.dev`이며 canonical의 version.js와 Service Worker cache는 v0.24.5다.
- 기존 E2E 현장 2개는 `INTERNAL_TEST`, 일반 계정 교차 목적 충돌은 0건이다. 기존 fixture 7계정·활성 Membership 8건은 보존됐다.
- E2E provisioning Secret과 공통 PIN이 없어 12계정 `plan/apply/show` 및 인증 Browser E2E는 `NOT_EXECUTED`다. 관리 API는 비활성 상태를 유지한다.
- v0.24.5 당시 공통 8자리 시험 PIN 계약은 v0.24.6에서 운영 계정과 동일한 4자리 정책으로 대체됐다.
- ChatGPT는 설계·결과 검토, Codex는 공식 구현·검증·배포·Git·패키징을 담당하는 원칙을 `DEVELOPMENT_RULES.md`와 `AGENTS.md`에 반영했다.
- 직접 기준본은 v0.24.4 공식 ZIP과 SHA-256 `455A993C035AD55722DEC5D71324158894159E11BEB3860BD3F98BDBD5560BA8`이다.
- v0.24.5는 `sites.purpose` (`OPERATIONAL`, `INTERNAL_TEST`)와 Migration `0028_internal_test_site.sql`을 추가한다.
- 일반 계정은 서로 다른 목적의 현장 Membership을 가질 수 없으며 `PLATFORM_OWNER`, `INTEGRATED_OWNER`만 예외다.
- 현장 선택 UI는 “운영 현장”과 “개발 도구”로 분리되고 내부 테스트 현장에는 실제 업무 데이터가 아니라는 문구를 항상 표시한다.
- 기존 `e2e-v021` fixture를 12개 역할별 계정으로 확장하고 Integration 전용 `plan/apply/show/disable/enable` 관리 명령을 추가했다.
- 실제 12계정 생성과 인증 Browser E2E는 `NOT_EXECUTED`다. Production은 `NOT_CHANGED`다.
- 아래 v0.24.4 기록은 직접 기준본의 과거 배포 사실이며 v0.24.5 배포 상태를 뜻하지 않는다.

## 공식 기준본

| 항목 | 상태 |
| --- | --- |
| 현재 공식 릴리스 | v0.24.4 |
| 직접 기준 버전 | v0.24.4 |
| 기준 ZIP | `GUI_Arc_Integrated_v0.24.4_Integrated.zip` |
| 기준 SHA-256 | `455A993C035AD55722DEC5D71324158894159E11BEB3860BD3F98BDBD5560BA8` |
| 기준 ZIP 패키징 | 확정 |
| Integration 배포 | v0.24.4 `DEPLOYED` |
| Integration D1 | `0027_issue_assignment_type.sql` 적용 완료, 미적용 Migration 0건 |
| 운영 검증 상태 | `OPERATIONAL_VERIFICATION_PENDING` |
| Production 변경 | `NOT_CHANGED` |
| v0.24.4 전체 테스트 | 293/293 `PASS` |
| Typecheck | 108개 모듈 `PASS` |
| Skill 정적 검증 | 15개 `PASS`, WARNING 0개 |
| Validate | `PASS` |
| Build | `PASS` |
| 한국어 검사 | 18개 파일 `PASS` |
| Browser E2E | 인증 전 버전·반응형 셸 `PASS`; 인증 후 직영 단건·일괄 배정, 권한·Revision·Idempotency·Audit `NOT_EXECUTED` |
| Skill Trigger E2E | 별도 신규 Codex 세션 자동 선택 검증 `NOT_EXECUTED` |

v0.24.4 공식 기준 ZIP과 SHA-256은 프로젝트 루트 밖의 검증된 릴리스 파일을 기준으로 확정했다. 개인 절대경로는 기록하지 않으며 파일명과 SHA-256만 공식 기준으로 사용한다.

v0.24.4는 기존 5개 상위 Skill과 10개 전문 Skill, 정적 Validator와 Trigger 평가 자료를 포함한다. v0.24.3 직영 배정 기능과 Migration 0027을 유지하며 검증된 패키지는 Integration에 배포됐다. Production은 변경하지 않았다.

## v0.24.4 Integration 배포·기준선 검증 (2026-08-01)

- Integration Worker health는 `version: 0.24.4`, `environment: integration`이며 Worker·D1·R2 바인딩이 정상이다.
- Integration Pages 프로젝트 `guis-arc-integrated-dev`의 배포를 확인했다.
- Integration D1의 `d1_migrations`에서 `0027_issue_assignment_type.sql`을 확인했고 미적용 Migration은 0건이다.
- 전체 테스트 293/293, Typecheck 108개 모듈, Validate, Build, 한국어 UI 18개 파일이 PASS했다.
- Skill 정적 검증은 15개 PASS, WARNING 0개다.
- 인증 후 직영 단건·일괄 배정, 전환, 권한 격리, Revision·Idempotency·Audit 실제 원격 검증은 `NOT_EXECUTED`다.
- 별도 신규 Codex 세션의 Skill Trigger 자동 선택 검증은 `NOT_EXECUTED`다.
- 운영 검증 상태는 `OPERATIONAL_VERIFICATION_PENDING`이며 Production은 `NOT_CHANGED`다.

## 과거 기록: v0.24.2 Integration 배포·검증 (2026-08-01)

- Integrated ZIP SHA-256: `A967FC03A389BEF24FE2C1150202AD5F7480FD7D2CF88A48E91358CA4E4283C4`.
- Integration D1 재조회 결과 미적용 Migration은 0건이며 Migration을 새로 적용하지 않았다.
- Integration Worker Version ID: `85d1b93e-471c-46c1-9131-75d51a3ca187`.
- Integration Pages Deployment ID: `81c488b0-84f8-44ec-be62-a9b8972c1d57`.
- 배포 URL: `https://81c488b0.guis-arc-integrated-dev.pages.dev`.
- Worker health는 `version: 0.24.2`, `environment: integration`, Worker·D1·R2 바인딩 정상이다.
- 전체 테스트 281/281, Typecheck 105개 모듈, Validate, Build, 한국어 UI 18개 파일이 PASS했다.
- 실제 브라우저에서 1280·1024·768px v0.24.2 로그인 표면과 가로 오버플로 없음을 확인했다.
- 재사용 가능한 Integration 인증 세션이 없어 실제 Issue 선택·일괄 변경·Audit Browser E2E는 `NOT_EXECUTED`다.
- Production Worker, Pages, D1, R2는 변경하지 않았다.

## v0.24.1 Integration 배포·검증 (2026-08-01)

- Integration D1에 미적용 상태였던 `0026_construction_department_engine.sql`을 적용했고 재조회 결과 미적용 Migration은 0건이다.
- Integration Worker `guis-arc-integrated-api-dev` 배포 완료. Version ID: `9fd0607f-7c46-4a3b-b3fa-efe06baa3ba2`.
- Integration Pages `guis-arc-integrated-dev` 배포 완료. Deployment ID: `aa71130c-717f-4b81-b28b-db8f1f05dea4`.
- 배포 URL: `https://aa71130c.guis-arc-integrated-dev.pages.dev`.
- Worker health는 `version: 0.24.1`, `environment: integration`, Worker·D1·R2 바인딩 정상이다.
- 배포 전 테스트 278/278, Typecheck 105개 모듈, Validate, Build, 한국어 UI 18개 파일이 모두 PASS했다.
- 실제 브라우저에서 고유 배포 URL과 canonical Integration URL의 v0.24.1 표면을 확인했다. 1280·1024·768·360·390·412px 인증 전 로그인 화면은 가로 오버플로가 없었다.
- 재사용 가능한 Integration 인증 세션과 E2E 계정이 없어 PC Issue Dashboard 액션·권한·Audit·Today 회귀 검증은 `NOT_EXECUTED`다.
- Production Worker, Pages, D1, R2는 변경하지 않았다.

## 현재 모듈 상태

| 모듈 | 상태 | 확인 근거 요약 |
| --- | --- | --- |
| 인증·계정·권한 | `IMPLEMENTED` | 통합 세션, CSRF, 현장 Context, 역할·게시판 권한 코드와 테스트 |
| Today | `IMPLEMENTED` | 통합 Today API, Provider 집계, 60초 갱신과 상태 보존 |
| Issue | `IMPLEMENTED` | 간편 등록·등록 후 배정과 PC 목록·모바일 기본 사진 슬라이드·Overlay·Swipe·단계적 원본 Viewer |
| Workforce | `IMPLEMENTED` | 가입·승인·QR 출역·출력일보·Today Provider |
| Construction | `IMPLEMENTED` | 공사일보·Revision·검측·공사 Today·권한 계약 |
| Safety | `IMPLEMENTED` | 사례·위험성평가·개선조치·정기업무·Today Provider |
| Quality | `PARTIAL` | 내부 품질시험·검사·CSI 입력 준비는 구현, 국가 CSI 자동 제출은 미구현 |
| Admin | `IMPLEMENTED` | 회사·현장·역할·초대·권한·공종 관리 코드와 테스트 |
| R2 업로드 | `IMPLEMENTED` | Issue·Construction·Safety 비공개 미디어 및 원본 업로드 계약 |
| 월간 공사일보 | `IMPLEMENTED` | R2 직접 업로드·분석·경고·날짜 확정·Revision·대형 세션 회귀 |
| 월간계획 | `IMPLEMENTED` | 기간 일정 CRUD·회사별 공종·Revision·Audit·취소 사유 |
| 공사 Today 카드 | `IMPLEMENTED` | v0.20.0 정보 우선순위·반응형·출처·자동 갱신 테스트 |
| Construction Engine | `IMPLEMENTED` | v0.24.1 부서 Master·Rule 평가·Issue 추천 Snapshot·관리자 확정·Audit |

## 현재 확정 사실

- Integrated Core가 계정·회사·현장·Membership·역할·게시판 권한의 원본이다.
- 사용자 UI는 한국어가 기본이며 Production은 명시적 승인 없이 변경하지 않는다.
- 검증된 Integrated ZIP 한 개가 다음 개발의 기준본이다.
- Today는 60초 자동 갱신 후 스크롤과 지원되는 펼침 상태를 보존한다.
- 오늘의 공사 Today는 확정 공사일보를 우선하고, 없으면 월간계획을 사용한다. 내일·모레는 월간계획을 사용한다.
- 공사 Today는 Provider 원본 순서를 유지하고 회사·위치·인원·작업내용을 추론하거나 임의 재계산하지 않는다.
- 공사 Today 카드의 우선순위는 회사 → 공종·인원 → 위치 → 작업내용 → 시간·주의사항이다. 회사가 없으면 공종·인원이 주 제목이다.
- 공사일보 확정은 기존 Revision·Audit·idempotency 계약을 유지하며 월간 `analysis_json`을 다시 저장하지 않는다.
- Issue 최초 등록은 사진·위치·내용만 사용하며 업체·공종·담당자는 미배정 상태로 저장한 뒤 권한 있는 관리자가 상세 화면에서 배정한다.
- Issue Photo Viewer는 목록 API 1회와 앞·현재·뒤 썸네일을 사용하며 원본은 사용자 요청 시에만 불러온다.
- Construction Engine v1.0은 외부 AI 없이 Issue 제목·내용·현재 공종을 명시적 Rule로 평가한다. 추천과 관리자 확정은 분리되며 충돌과 무일치는 미분류다.

## 폐기되었거나 더 이상 기준이 아닌 내용

- `AIOS/00_PROJECT.md`의 v0.2.2 상태는 역사 기록이며 현재 기준이 아니다.
- `AIOS/12_NEXT_CHAT.md`의 v0.3.0·v0.4.0 작업 지시는 역사 기록이며 현재 기준이 아니다.
- 과거 Placeholder였던 모듈을 현재도 Placeholder라고 자동 간주하지 않는다.
- 과거 Handoff의 다음 작업을 현재 Backlog로 자동 복원하지 않는다.

## 알려진 제한과 검증 공백

- v0.20.0과 v0.20.1은 Integration에 배포하지 않았다.
- 인증 전 버전·반응형 셸 Browser 검증은 완료했지만 인증 후 직영 단건·일괄 배정과 권한·Revision·Idempotency·Audit E2E는 실행하지 않았다.
- 별도 신규 Codex 세션의 Skill Trigger 자동 선택 E2E는 실행하지 않았다.
- 운영 검증 상태는 `OPERATIONAL_VERIFICATION_PENDING`이다.
- Production은 `NOT_CHANGED`다.
- Issue 상태 흐름 단순화와 Today의 사용자별 조치 동선은 v0.21.1 범위에 포함하지 않았다.

## 문서 충돌 및 정리 필요 항목

| 문서 | 오래된 내용 | 실제 현재 상태 | 처리 방식 | 삭제 여부 | 근거 |
| --- | --- | --- | --- | --- | --- |
| `AIOS/00_PROJECT.md` | v0.2.2, 다수 Placeholder | v0.20.1 문서 릴리스와 위 모듈 상태 | 상단 `HISTORICAL` 표시 | 유지 | 버전 매트릭스·코드·테스트 |
| `AIOS/12_NEXT_CHAT.md` | v0.3.0·v0.4.0 다음 작업 | 현재 작업으로 자동 승계하지 않음 | 상단 `HISTORICAL` 표시 | 유지 | 현재 VERSION·BASELINE |
| `docs/98_NEXT_CHAT_HANDOFF.md` | v0.3.0·v0.8.0 기준과 과거 공백 | 공식 전달 원본은 `AIOS/NEXT_TASK.md` | 상단 `HISTORICAL` 표시 | 유지 | 저장소 참조 테스트 존재 |
| `docs/99_START_NEXT_CHAT.md` | v0.3.0·v0.4.0 시작 지시 | 현재 진입점은 `AGENTS.md` | 상단 `HISTORICAL` 표시 | 유지 | validate 필수 문서 |
| `docs/20_TODAY_PROVIDER_CONTRACT.md` 서두 | Workforce·Construction·Safety·Quality Placeholder | 해당 Provider는 현재 구현됨 | 역사적 v0.3.0 표로 보존, 이 문서를 우선 근거로 사용하지 않음 | 유지 | 현재 Provider 코드·테스트 |
| `docs/03_DATA_OWNERSHIP.md` 서두 | 다수 OS 모듈 Placeholder | 후속 절과 코드에서 구현 확인 | 역사적 기초 계약으로 보존, 최신 상태는 이 문서 사용 | 유지 | 후속 계약·버전 매트릭스 |

## 다음 작업

다음 단일 작업은 `AIOS/NEXT_TASK.md`에서 현재 사용자 요청으로만 지정한다. 과거 Roadmap이나 Handoff를 자동 복원하지 않는다.

- Issue 모바일 목록: 사진 중심 슬라이드, 25% 하단 Overlay, Swipe·Double Tap·Pinch Zoom과 단계적 원본 로딩 구현 완료. PC 목록과 기존 상세 처리 흐름 유지.

## v0.22.0 Integration 배포·브라우저 검증 (2026-08-01)

- Integration Worker `guis-arc-integrated-api-dev` 배포 완료. Version ID: `e1dbd863-bc95-42f7-bbc3-2d93c40b89a1`.
- Integration Pages `guis-arc-integrated-dev` 배포 완료. Deployment ID: `81e0c92f-1790-48a9-a323-c773a7cd21af`.
- 배포 URL: `https://81e0c92f.guis-arc-integrated-dev.pages.dev`.
- Worker health에서 `version: 0.22.0`, `environment: integration`, Worker·D1·R2 binding 정상 확인.
- 원격 Integration D1은 미적용 Migration 없음. Migration 변경·적용 없음.
- 배포 전 검증: 전체 테스트 250/250, Typecheck 100개 모듈, Validate, Build, 한국어 UI 17개 파일 모두 PASS.
- 실제 브라우저에서 로그인 화면과 문서 제목의 v0.22.0 표면 확인.
- 인증된 Integration 세션과 허용된 E2E 계정 준비 수단이 없어 Issue Photo Viewer PC·360·390·412px 상호작용, 권한·회귀 Browser E2E는 `NOT_EXECUTED`.
- 실제 삼성 인터넷 및 실제 모바일 기기 검증은 `NOT_EXECUTED`.
- Production 리소스는 변경하지 않음.

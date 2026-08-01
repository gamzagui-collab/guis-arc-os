# Issue Module Contract — v0.2.0

Issue is the first implemented business module in the Integrated modular monolith. It runs in the shared App Shell and accepts only the canonical Integrated session. Separate credentials, OAuth callbacks, app clients, client secrets, cross-origin authentication and module-local sessions are forbidden.

Core owns identity, company, site, membership, role, permission, entitlement, session, contractor and trade records. Issue owns issue records, assignments, actions, media references, status history, completion requests and comments. Cross-boundary identity and site references use Core primary keys and Issue never mutates Core master data.

Every write validates the session, CSRF token, context version, module entitlement, feature permission, selected-site scope, request data and expected revision. Replay-sensitive creates use an idempotency key. Stale revisions return HTTP 409. Successful and denied state-changing operations are auditable.

Canonical routes are `/api/v1/issues`, `/api/v1/issues/:id`, `/assign`, `/actions`, `/request-completion`, `/confirm`, `/rework`, `/cancel`, and `/api/v1/issues/summary`. List filtering and pagination are server-side.

## v0.21.0 간편 등록과 등록 후 배정

- 최초 등록은 사진, 위치, 내용만 요구한다. 업체, 공종, 담당자, 우선순위, 목표일과 내부 분류는 최초 등록자가 선택하지 않는다.
- 사진과 썸네일은 기존 필수 R2 계약을 유지한다. 위치와 내용도 필수이며, 내용의 앞 160자를 제목 snapshot으로 사용한다.
- 미배정 이슈는 `OPEN` 상태로 정상 저장한다. `contractor_company_id`, `trade_id`, `trade_code`, `assigned_to_user_id`는 `NULL`일 수 있으며 가짜 업체·공종·사용자를 만들지 않는다.
- 기존 클라이언트가 유효한 업체·공종·담당자를 함께 보내는 생성 계약은 계속 허용한다.
- `/api/v1/issues/:id/assign`은 기존 담당자 전용 요청을 호환하면서 업체·공종·담당자를 함께 지정하거나 재배정할 수 있다. 업체는 현장 계약 업체, 공종은 해당 업체의 계약 공종, 담당자는 해당 업체의 활성 현장 사용자여야 한다.
- 배정은 기존 `issue.assign`과 현장·회사·역할 범위를 유지하며 변경 전후 업체·공종·담당자를 기존 Audit에 기록한다.
- 미배정 이슈는 작성자에게 계속 보이지만, 다른 협력업체 사용자에게 새로 노출되지 않는다.


## v0.21.1 사진 중심 슬라이드 검토 계약

- 모바일 이슈 목록은 기본적으로 한 화면에 한 이슈 사진을 표시하는 슬라이드 모드를 사용한다.
- 슬라이드 이동 단위는 사진 파일이 아니라 이슈 1건이다.
- 사진은 상단 메뉴 아래 남은 화면을 최대한 사용하며 `object-fit: contain`으로 잘림 없이 표시한다.
- 위치, 내용, 배정 상태와 현재 주요 행동은 사진 위 하단 오버레이에 표시한다.
- 오버레이는 새 진입 시 기본 펼침이며 사용자가 접은 상태는 같은 브라우저 세션의 다음 이슈에서도 유지한다.
- 슬라이드 이동은 목록 응답 메타데이터를 재사용하고 현재·이전·다음 썸네일만 준비한다. 이동할 때 상세 API를 재호출하지 않는다.
- 기존 PC 목록, 상세 화면, 상태 머신, 조치·완료 API 계약은 변경하지 않는다.

## v0.22.0 사진 중심 작업 Viewer 계약

- PC는 목록, 모바일은 슬라이드를 매 진입 시 기본 보기로 사용한다. 사용자가 현재 화면에서 목록과 사진 보기를 전환할 수 있다.
- 상단 Overlay에는 뒤로가기, 현재 순번, 상태, 목록보기를 제공한다.
- 사진 영역은 Swipe 전용이며 위치·내용·조치 Overlay와 이벤트 영역을 분리한다.
- 정보 Overlay는 사진 위에 절대 배치하고 기본 높이 25%, 최대 35%로 제한한다. 접으면 약 56px만 남기며 같은 브라우저 세션에서 다음 이슈로 이동해도 접힘 상태를 유지한다.
- 목록 API는 한 번만 호출하고 슬라이드 이동은 메모리 배열의 index만 변경한다. 현재 사진과 앞·뒤 썸네일만 준비한다.
- 기본 Viewer는 목록 썸네일을 사용한다. 사용자가 `원본 보기`를 선택한 경우에만 기존 인증 원본 URL을 요청한다.
- 사진은 Pinch Zoom과 Double Tap 확대를 지원하며, 내용이나 상태별 단일 주요 버튼으로 기존 상세·조치 화면에 진입한다.

## v0.24.0 Construction Engine 연동 계약

- Issue 생성과 제목·내용·공종 변경 시 공통 Construction Engine이 부서 추천 Snapshot을 생성한다. 추천 실패는 Issue 등록을 막지 않는다.
- 추천 부서·근거·Rule 일치 강도와 관리자 확정 부서는 서로 분리해 저장한다. 재추천은 기존 확정값을 덮어쓰지 않는다.
- 상세 화면의 부서 확정·재추천은 기존 SITE scope와 `issue.assign` 또는 `issue.manage_all` 권한을 모두 요구한다. 협력업체는 변경할 수 없다.
- 단건 API는 `POST /api/v1/issues/:id/department/recommend`, `POST /api/v1/issues/:id/department/confirm`이며 기존 상태 머신·배정·조치·완료 API는 변경하지 않는다.
- 전체 계약은 `docs/35_CONSTRUCTION_ENGINE_V1_CONTRACT.md`를 따른다.

## v0.24.3 직영 배정 계약

- 배정 유형은 `CONTRACTOR`, `DIRECT`, `UNASSIGNED` 세 가지이며 업체 값의 `NULL`만으로 직영과 미배정을 구분하지 않는다.
- 직영은 가짜 업체를 만들지 않고 `contractor_company_id=NULL`, `assignment_type='DIRECT'`로 저장한다.
- 직영 공종은 현재 현장의 활성 계약에 연결된 canonical 공종만 허용하고, 담당자는 `sites.company_id` 원도급사 소속의 활성 현장 사용자만 허용한다.
- 협력업체는 기존 활성 현장 계약 공종과 해당 업체 활성 현장 사용자를 사용한다. 미배정은 업체와 담당자를 비우며 공종 해제는 명시적으로 처리한다.
- 단건·일괄 배정은 SITE 범위, Issue Board EDIT 이상, `issue.assign` 권한과 Revision·Audit 계약을 유지한다. 협력업체 사용자는 직영 배정을 변경할 수 없다.
- 기존 업체 배정 데이터는 `CONTRACTOR`, 업체가 없는 데이터는 명시적 직영 근거가 없으므로 `UNASSIGNED`로 이관한다.

# GUI's Arc Integrated Constitution v1.0.0

## C-018 공사일보 공식 원본 원칙

- 회사 보고용 `.xlsx` 공사일보 업로드와 사용자의 명시적 확정을 해당 날짜의 공식 공사일보 원본으로 사용한다.
- Today의 금일 작업과 예정 인원은 최신 확정 업로드의 파싱 결과만 사용하며 실제 출역 인원과 혼합하지 않는다.
- 같은 날짜의 재업로드는 기존 원본을 덮어쓰지 않고 Revision과 Audit를 남긴다.
- 출력일보는 날짜·회사별 원본 사진 증빙으로만 비공개 보관하며 OCR 또는 AI 자동 판독 결과를 만들지 않는다.
- 기존 전자식 출력일보 테이블과 API는 이력 호환을 위해 보존하되 신규 공사일보와 Today 계산에서는 사용하지 않는다.
- 엑셀 원문 회사명이 canonical 회사와 정확히 일치하지 않거나 원본에 없으면 임의 연결하지 않고 확인 필요 상태로 보존한다.
- 공사일보 자재·장비는 임시 일일 기록이며 Materials·Equipment 정식 모듈과 연결된 것처럼 표시하지 않는다.

## 사용자 입력 오류 명확화 원칙

- 검증 실패 시 잘못된 필드와 이유, 사용자가 다음에 해야 할 행동을 구체적인 한국어로 표시한다.
- 일반 오류 문구만으로 원인을 추측하게 하지 않으며, 첫 오류 위치로 이동하고 입력값을 보존한다.
- 서버의 canonical 오류 코드와 사용자 문구를 분리하고, 프론트와 서버가 동일한 필수값·형식 규칙을 각각 검증한다.

## Canonical 공종 원칙

- 공종은 전역 고유 key와 canonical ID를 가진 대분류·중분류·세부 공종 계층으로 관리하며 업무 데이터에 자유 문자열을 저장하지 않는다.
- 회사 보유 공종과 현장 계약 공종을 구분하고, 모든 업무 모듈은 같은 공종 마스터 ID를 참조한다.
- 기존 넓은 공종은 기존 ID의 일반 공종으로 보존하며 임의로 세분화하지 않는다.
- 사용 이력이 있는 공종은 물리 삭제하지 않고 비활성화하며 신규 공종은 마스터 검토를 거친다.
- 사용자 화면은 한국어 경로를 표시하고 미구현 모듈은 migration 완료 대상으로 주장하지 않는다.

- C-016 게시판 권한 단일 원본: Today는 모든 활성 현장 Membership의 공통 시작 화면이다. 구현된 업무 화면의 메뉴 노출과 API 접근은 현장별 게시판 권한을 단일 원본으로 사용하며, 앱 범위나 모듈 entitlement를 중복 권한 원본으로 사용하지 않는다. 역할은 직무 분류이고 권한 등급이 아니며, 회사·역할 그룹은 관리 화면의 조회와 일괄 설정을 위한 표현일 뿐 개별 권한 검증을 대체하지 않는다. 사용자 목록과 Today에는 업무에 필요한 최소 정보와 집계만 표시한다.

  제품 메뉴 골격과 게시판 데이터 접근은 분리한다. 마스터와 현장소장은 고정된 전체 제품 메뉴 골격을 보되, 계획 모듈은 `PLANNED` 상태의 공통 “준비 중” 화면만 제공한다. 실제 게시판 조회·수정·관리는 활성 게시판의 명시적 사용자별 grant로만 허용하며 런타임 역할 우회는 금지한다. 관리자 역할 생성, 기존 데이터 마이그레이션, 새 게시판 활성화 시 필요한 `MANAGE` grant를 데이터로 생성하고 Audit에 기록한다.

  게시판 권한 관리 화면은 현재 현장의 사용자를 회사 유형·회사·현장 역할 순으로 구분해 표시한다. 다중 사용자 일괄 적용, 기존 사용자 권한 복사, 역할별 기본값 적용은 모두 개별 `board_access_grants` 변경으로 귀결되어야 하며, 역할 기본값은 수정 가능한 초기값일 뿐 고정 권한 등급이 아니다. 모든 변경은 대상 현장·활성 Membership·관리 가능한 게시판·revision을 서버에서 재검증하고 원자적으로 처리하며, 개인정보·PIN·credential은 권한 응답과 Audit에 포함하지 않는다.

- C-001 Single Product: Platform, OS, Issue, Safety, Quality는 별도 제품이 아니라 GUI's Arc 내부 업무 모듈이다.
- C-002 Single Login and Session: 관리자는 하나의 로그인과 하나의 HttpOnly session만 사용한다. 모듈 전환에 callback, popup, client secret을 사용하지 않는다.
- C-003 Modular Monolith: 단일 배포·D1을 사용하되 Core와 업무 모듈의 코드·데이터 소유권을 분리한다.
- C-004 Shared App Shell: Header, Sidebar, Page Header, Filter, Main Action, Mobile Navigation 위치를 공유한다.
- C-005 Fixed Menu Order: 오늘 현장, 출역, 공사, 이슈, 안전, 품질, 자재, 장비, 문서, 통합관리 순서를 고정한다.
- C-006 Monochrome Foundation: 기본 UI는 검정·회색·흰색 중심이고 상태 색상만 제한적으로 사용한다.
- C-007 Replaceable Final Design: 기능·권한·접근성·반응형·성능을 보존하며 최종 Figma 결과로 교체할 수 있어야 한다.
- C-008 No Direct Figma Code Merge: Figma 생성 코드는 참고만 하며 공통 component와 token으로 수동 이식한다.
- C-009 Shared Components First: 모듈별 Button, Card, Dialog, Badge, Filter, Table, Navigation 중복 구현을 금지한다.
- C-010 Data Ownership: 같은 D1에서도 다른 모듈 원본 데이터를 임의 수정하지 않는다.
- C-011 Implementation Truth: Placeholder, Mock, UI-only, Local-only, 미연결 서비스는 명시하고 실제 기능처럼 표시하지 않는다.
- C-012 Integrated First: 각 버전은 하나의 Integrated ZIP만 공식 기준으로 사용한다.
- C-013 Production Protection: 명시적 승인 없이 Production Worker, Pages, D1, R2, Secret, 데이터를 변경하지 않는다.

## C-014 — Official Git baseline

Verified source on `main` is the official development baseline. Feature and hotfix branches contain unmerged work. Annotated tags identify verified releases; Integrated ZIPs are archive and recovery artifacts. Production changes require separate explicit approval, and secrets or credentials are forbidden from Git history.

- C-015 사용자 화면 한국어 우선: 사용자에게 보이는 메뉴, 제목, 버튼, 상태, 역할, 권한, 안내와 오류는 한국어를 기본으로 한다. API·DB·route·permission key의 canonical 값은 변경하지 않고 공통 표시 사전에서 한국어로 변환한다. 서버의 영문 상세 메시지를 화면에 직접 노출하지 않으며, 새 사용자 문자열은 `npm run validate:korean-ui` 검사를 통과해야 한다. GUI’s Arc, PWA, API, QR, PIN, URL, HTTP, CSRF, Git, Cloudflare, Pages, Workers, D1, R2처럼 제품명·표준 기술 용어만 제한적으로 허용한다.
# C-017 Workforce 핵심 업무 원칙

- 근로자 출역은 출력일보 작성보다 먼저 발생하며, 근로자는 출역할 때 작업내용을 입력하지 않는다.
- 기존 전자식 출력일보 작성 흐름은 폐기하고 출력일보는 날짜·회사별 사진 증빙으로 보관한다.
- 출역에는 GPS·카드·지문을 사용하지 않고 현장 단위의 서명된 동적 QR을 사용한다.
- 근로자 개인정보는 명시적인 게시판 권한과 업무 범위 없이 노출하지 않는다.
- 일반 근로자에게 다른 근로자의 명단을 제공하지 않으며 소속 팀의 당일 인원은 집계 숫자로만 제공한다.
- 공종은 canonical trade ID, 작업 위치는 canonical site location ID를 사용한다.
- 출역 정정과 출력일보 사진 무효 처리는 원본을 물리 삭제하지 않고 변경 이력과 사유를 보존한다.
- 사용자 오류는 원인과 다음 행동을 알 수 있는 구체적인 한국어로 표시한다.

# C-018 Safety 원본·정기 업무 원칙

- Safety 사례는 Issue와 공사일보 원본을 복제하지 않고 canonical ID와 revision으로 참조한다.
- 위험 분류와 근본 원인은 활성 canonical master 값만 사용하며 자유 문자열을 집계 기준으로 사용하지 않는다.
- 수시 위험 사례와 정기 안전 업무는 별도 업무 흐름으로 표시한다.
- 정기 업무 엔진은 module key와 board key로 Safety와 향후 Quality 계약을 분리하며, 미구현 Quality 화면을 완성 기능처럼 표시하지 않는다.
- 부적합 또는 미확인 정기 점검 결과는 후속 사례 연결이나 권한 있는 검토자의 면제 없이 완료할 수 없다.
- 종결된 안전 사례는 일반 수정할 수 없고, 상태 변경과 원본 revision 반영은 Audit에 기록한다.

# C-019 Safety 증빙·반복 생성 안정성 원칙

- 공사일보에서 Safety 사례를 만들 때 원본 report·item canonical ID와 revision을 함께 보존하며, 동일 원본 작업의 중복 등록을 차단한다.
- 원본 갱신은 회사·공종·위치·작업 내용·인원·참조 사진만 새 revision으로 반영하고, Safety에서 작성한 위험성평가·근본 원인·통제·개선조치는 덮어쓰지 않는다.
- 개선조치 완료 요청에는 조치 내용과 조치 후·증빙·재조치 사진 중 하나가 필요하다. 사진을 남길 수 없는 경우에만 구체적인 예외 사유로 대체하며 Audit에 남긴다.
- Safety 미디어는 현장·게시판·담당자 또는 관리자 권한을 API에서 다시 검사하고, R2 객체 키를 사용자 응답에 노출하지 않는다.
- 일간·주간·월간 정기 업무는 정의와 기간을 기준으로 멱등 생성한다. 누락 기간은 Catch-up으로 생성하고 동일 정의·기간 중복을 차단하며 생성·중복 건수를 Audit에 남긴다.

# C-020 시공 검측·품질시험·서류 업무 경계

- 시공 상태와 다음 공정 착수 조건을 확인하는 시공 검측은 Construction이 관리한다.
- 재료·시료·성능·시험 결과를 확인하는 품질시험·검사는 Quality가 관리한다.
- ‘검측’이라는 명칭만으로 Quality 업무로 분류하지 않는다.
- Quality에는 검증된 법령, 승인된 품질관리·시험계획, 적용 기준·시방서에 근거한 항목만 허용한다.
- Quality 업무는 근거 문서, 관련 조항, 현장 적용 사유와 승인자를 저장한다.
- 법적 의무는 근거 버전과 시행·종료일을 보존하며 관리자 적용 판정 없이 현장 의무로 확정하지 않는다.
- Safety 정기업무는 법정·계획·현장 의무에 따른 서류 업무이며 체크리스트는 완성 서류를 구성하는 데이터다.
- 업무 문서는 해당 모듈에서 완성·승인되고 Documents는 snapshot 보관·검색·출력·revision 조회를 담당한다.
- 현장명, 회사, 날짜, 공종, 위치, 출역, 공사일보, 위험성평가, 조치, 사진, 참석자 등 기존 데이터를 서류마다 다시 입력하지 않는다.

# C-021 Quality CSI 전처리 원칙

- GUI’s Arc Quality는 국가 건설공사 품질관리 시스템 CSI를 대체하지 않는다.
- Quality는 CSI 입력 전 시험·검사 자료의 수집, 내부 검토, 보완과 준비 승인을 담당한다.
- 실제 CSI 입력과 법정 제출은 담당자가 국가 시스템에서 직접 수행한다.
- `READY_FOR_CSI`와 `CSI_RECORDED`를 구분하고, 준비 완료를 실제 입력 완료로 표시하지 않는다.
- CSI 입력 완료는 사용자의 명시적 확인, 완료일, 입력자, 관리번호 또는 확인 근거와 Audit를 필요로 한다.
- CSI 계정, 비밀번호와 자격증명을 저장하지 않으며 공식 연계 계약 없이 자동 로그인·업로드·제출을 구현하지 않는다.
- 시공 검측은 Construction에 유지하고 재료·시료·성능의 품질시험·검사만 Quality에서 관리한다.
- 시험 사진과 시험성적서는 원본을 중복 업로드하지 않고 여러 시험 업무에서 참조할 수 있어야 한다.

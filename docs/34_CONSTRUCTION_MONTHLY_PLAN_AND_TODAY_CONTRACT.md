# 월간 공사계획·공사 Today·공사일보 경고 계약

## v0.20.0 공사 Today 정보 우선순위

- 회사 정보가 있으면 회사 → 공종·예정 인원 → 위치 → 작업내용 → 시간 → 주의사항 순으로 표시한다.
- 회사 정보가 없으면 공종·예정 인원을 주 제목으로 유지하고 `회사 미지정`은 보조 정보로 표시한다.
- 위치 정보 없음과 시간 미정은 낮은 강조의 보조 문구로 표시하고, 주의사항은 값이 있을 때만 표시한다.
- 날짜 구역은 단일 `source` 계약을 사용하므로 구역 상단의 출처 안내를 유지하고 카드별 출처 반복은 제거한다.
- 공사일보 회사·위치 추론, 월간계획 회사 결합, 작업내용 요약, 인원 재계산을 하지 않는다.
- PC는 충분한 폭에서 2열, 좁은 화면과 모바일은 1열이며 Provider 순서와 자동 갱신 스크롤 복원을 유지한다.
- 신규 Migration은 없고 Integration에는 배포하지 않았으며 Production은 변경하지 않았다.

## 월간계획의 목적

- 월간계획은 앞으로 수행할 공사를 사용자가 직접 등록하는 공식 계획 원본이다.
- 공사일보는 당일 실제 작업을 확정한 공식 기록이며 월간계획이 기존 Revision을 수정하거나 덮어쓰지 않는다.
- 공사일보 Parser는 미래 일정을 생성하지 않는다.
- 월간계획은 브라우저 저장소나 Mock 데이터가 아니라 D1의 `construction_monthly_plans`에 저장한다.

## 일정 원본과 Today 우선순위

- 오늘은 해당 날짜의 최신 `ACTIVE`·`CONFIRMED` 공사일보가 있으면 이를 우선한다.
- 오늘 확정 공사일보가 없으면 월간계획을 표시하고 그 사실을 한국어로 안내한다.
- 오늘 공사일보가 있으면 같은 날짜의 월간계획을 중복 작업으로 표시하지 않고 계획 건수만 참고 안내한다.
- 내일과 모레는 월간계획을 사용한다.
- Construction Provider는 `today`, `tomorrow`, `dayAfterTomorrow` 각각에 `date`, `source`, `entries`, `notice`를 반환한다.
- 출처는 화면에서 `확정 공사일보` 또는 `월간계획`으로 표시한다.

## 월간계획 CRUD

- 일정 원본은 `start_date`부터 `end_date`까지의 기간 한 행으로 저장한다. 날짜별 복제 행은 만들지 않는다.
- 필수값은 현장, 시작일, 종료일, 공종, 작업내용, 생성·수정 사용자다.
- 회사, 위치, 예정 인원, 시작·종료 시간, 주의사항, 메모는 선택값이다.
- 상태는 `SCHEDULED`, `CHANGED`, `CANCELLED`이며 화면에는 `예정`, `변경`, `취소`로만 표시한다.
- 삭제 요청은 물리 삭제하지 않고 `CANCELLED`로 무효화한다. 취소 사유, 처리자와 처리 시각을 보존한다.
- 생성은 사용자·현장·중복 제출 방지 값의 고유 제약으로 중복 저장을 막는다. 수정·취소는 Revision을 검사한다.

## 권한과 현장 격리

- 조회는 현재 현장에 접근 가능하고 `CONSTRUCTION_DAILY_REPORT` 조회 권한이 있는 사용자에게 허용한다.
- 등록·수정·취소는 기존 Construction 편집 역할과 게시판 `EDIT` 이상 권한을 모두 확인한다.
- 협력업체 역할만 가진 사용자는 전체 일정 편집을 할 수 없다.
- 모든 상세·수정·취소 쿼리는 현재 `site_id`를 함께 검사한다.
- 회사 선택은 현재 현장 참여 회사만 허용한다.

## 날짜와 KST

- 날짜는 `YYYY-MM-DD` 날짜 전용 의미로 저장한다.
- 종료일은 시작일보다 빠를 수 없다.
- Today의 오늘·내일·모레 계산과 요일 표시는 `Asia/Seoul` 기준을 사용한다.
- 월·연도 경계에서도 UTC 변환으로 날짜가 이동하지 않도록 날짜 전용 계산을 사용한다.
- 반복 일정은 v0.19.0 범위에서 지원하지 않는다.

## 감사

- 기존 `audit_logs`를 재사용한다.
- 생성, 수정, 취소에 현장·일정 식별자, 변경 전·후 값 또는 취소 사유를 기록한다.
- 별도 Audit 테이블을 만들지 않는다.

## 공사일보 경고 상세

- 날짜 카드의 경고 수를 누르면 같은 화면에서 전체 상세를 펼친다.
- 경고는 실제 Parser 코드 의미를 기준으로 `확인 필요`와 `참고`로 분류한다.
- 사용자 화면에는 내부 영문 코드를 표시하지 않는다.
- 실제 데이터가 있을 때만 관련 공종, 작업내용, 원본 셀 위치를 표시한다. 없으면 `원본 위치 정보 없음`을 표시한다.
- 기존의 날짜·필수 머리글·행 구조 차단 정책을 유지한다. 새 확정 차단 규칙은 추가하지 않는다.
- 상태는 `확정 가능`, `확인 후 확정 권장`, `확정 불가`로 표시하며 확정 불가이면 이유를 함께 표시한다.

## 현재 미구현 범위

- 반복 일정
- 공사일보와 월간계획의 자동 진도율·실적률 계산
- 작업내용 차이에 대한 자동 오류 판정이나 자동 수정
- 음성 입력
- 협력업체별 제한 편집 정책

이 항목은 실제 운영 요구, 권한 계약과 데이터 근거가 확정될 때 별도 버전에서 재검토한다.
# v0.19.1 날짜·Revision·Audit 무결성

- 날짜는 실제 달력에 존재하는 `YYYY-MM-DD`만 허용하며 JavaScript의 날짜 자동 보정을 허용하지 않는다.
- 수정·취소는 Revision 기반 낙관적 잠금을 사용하고, 누락·비정수·오래된 Revision은 409로 처리한다.
- 조건부 UPDATE와 Audit은 하나의 D1 배치 트랜잭션에서 처리한다. 해당 요청의 고유 처리 시각과 새 Revision이 실제 저장 행에 모두 일치할 때만 Audit을 생성한다.
- UPDATE 또는 Audit이 정확히 1행이 아니면 성공으로 응답하지 않으며, UPDATE 실패 요청의 성공 Audit은 생성하지 않는다.
- 수정·취소 성공 시에만 Revision이 1 증가한다. 이미 취소된 일정의 재취소는 기존 멱등 계약을 유지한다.
- v0.19.1은 DB Schema와 Migration을 변경하지 않는다. Integration Migration과 Integration 배포를 적용하지 않았고 Production은 변경하지 않았다.
# v0.19.2 취소 사유·공종 데이터 무결성

- 일반 `note`와 구조화된 `cancellation_reason`을 분리한다. 신규 취소부터 취소 사유를 별도 저장하며 기존 취소 일정은 `cancellationReason`이 없을 수 있다.
- 기존 메모와 기존 취소 문자열은 자동 분석·변환·삭제하지 않는다.
- API는 DB 컬럼명을 노출하지 않고 `cancellationReason`을 반환한다. 취소 Audit의 before/after에서도 메모와 취소 사유를 별도 필드로 기록한다.
- `tradeKey`가 공식 식별자다. 서버는 현재 현장의 활성 `company_site_contracts`와 `company_site_contract_trades`, 활성·선택 가능 `trade_master`를 확인하고 공식 `display_name`을 `trade_label` snapshot으로 저장한다.
- 클라이언트가 공종명을 함께 보내고 공식명과 다르면 400으로 차단한다. 다른 현장 전용·비활성·존재하지 않는 공종 및 자유 공종 fallback은 허용하지 않는다.
- 회사가 지정되면 그 회사의 활성 현장 공종 계약도 검증한다. 회사 미지정 일정은 현재 현장의 활성 계약 중 하나에 포함된 공종을 허용한다.
- 기존 월간계획 공종 데이터는 자동 수정하지 않는다. 아래 읽기 전용 점검 쿼리는 운영 DB에 자동 실행하지 않는다.

```sql
SELECT p.trade_key, COUNT(DISTINCT p.trade_label) AS label_count,
       GROUP_CONCAT(DISTINCT p.trade_label) AS stored_labels
FROM construction_monthly_plans p
GROUP BY p.trade_key
HAVING COUNT(DISTINCT p.trade_label) > 1;

SELECT p.id,p.site_id,p.trade_key,p.trade_label
FROM construction_monthly_plans p
LEFT JOIN trade_master tm ON tm.trade_key=p.trade_key
WHERE trim(p.trade_key)='' OR trim(p.trade_label)='' OR tm.id IS NULL OR p.trade_label<>tm.display_name;

SELECT id,site_id,note
FROM construction_monthly_plans
WHERE status='CANCELLED' AND cancellation_reason IS NULL;
```

- Migration 0025는 로컬 산출물에만 포함했다. Remote Migration과 Integration 배포는 적용하지 않았고 R2와 Production은 변경하지 않았다.
# v0.19.3 PATCH 공종·회사별 선택 계약

- PATCH body에 `tradeKey`가 있고 `tradeLabel`이 없으면 이전 일정의 label을 검증 입력으로 재사용하지 않는다. 서버가 현재 활성 현장·회사 계약과 공종 master에서 공식 label을 다시 결정한다.
- `tradeKey`가 없으면 기존 공종을 유지하고, 같은 key 또는 새 key를 label 없이 보내도 서버 공식값을 최종 snapshot으로 저장한다.
- label을 함께 보내면 공식값과 일치해야 하며 검증 실패 시 DB·Revision·성공 Audit을 변경하지 않는다.
- `GET /api/v1/construction/options`는 기존 무필터 응답을 유지하고 선택적 `companyId`가 있으면 현재 인증 사용자의 현장에서 해당 활성 회사 계약 공종만 반환한다.
- 월간계획 폼은 회사 변경 시 공종 옵션만 다시 조회한다. 새 회사에서 사용할 수 없는 기존 선택은 비우고 날짜·작업내용·인원·위치 등 다른 입력값은 보존한다.
- 옵션 필터링은 사용자 편의 기능이며 서버의 현장·회사·공종 저장 검증을 대체하지 않는다.
- v0.19.3은 DB와 Migration을 변경하지 않는다. Remote D1·R2·Integration·Production은 변경하거나 배포하지 않았다.

# v0.19.4 확정 공사일보와 Today 계약

- 오늘 날짜에 `CONFIRMED`·`ACTIVE` 공사일보 Revision이 있으면 Today의 오늘 일정은 `CONFIRMED_DAILY_REPORT`를 사용한다.
- 오늘 확정 공사일보가 없으면 Today의 오늘 일정은 월간계획을 사용한다.
- 내일과 모레는 공사일보 확정 여부와 관계없이 월간계획을 사용한다.
- 이 계약의 Provider 로직은 v0.19.4에서 변경하지 않았고 회귀 테스트로 유지 여부만 검증한다.
- Remote D1·R2·Integration·Production은 변경하거나 배포하지 않았다.

# v0.19.5 기존 세션 확정과 Today 연결

- 기존 월간 업로드 세션에서 오늘 날짜를 확정해도 신규 업로드 직후 확정과 동일한 Revision 계약을 사용한다.
- 확정 후 Today는 기존 계약대로 오늘의 최신 `ACTIVE`·`CONFIRMED` Revision을 `확정 공사일보` 출처로 사용하고 같은 날짜 월간계획을 중복 표시하지 않는다.
- 조회 전용 사용자는 기존 세션 상세를 볼 수 있지만 확정할 수 없다.
- Today Provider 우선순위와 월간계획 코드는 변경하지 않았다.
- Integration에는 배포하지 않았고 Production은 변경하지 않았다.

# v0.19.6 대형 기존 세션 확정과 Today

- 대형 기존 월간 세션에서 오늘 날짜 Revision을 확정해도 Today는 최신 `ACTIVE`·`CONFIRMED` 공사일보를 우선한다.
- confirm은 월간 `analysis_json`을 다시 저장하지 않지만 상세 조회와 Today는 각각 기존 분석 원본과 확정 Revision을 사용하므로 계약이 유지된다.
- 전체 날짜 확정 실패 시 batch가 롤백되어 월간계획이 잘못 가려지거나 부분 Revision이 Today에 노출되지 않는다.
- Today Provider와 월간계획의 우선순위·표시 코드는 변경하지 않았다.
- Integration에는 배포하지 않았고 Production은 변경하지 않았다.

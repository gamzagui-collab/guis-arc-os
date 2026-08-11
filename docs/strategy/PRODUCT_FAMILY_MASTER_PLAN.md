# GUI's Arc Product Family Master Plan v1.1 — Critical Review & Revised Roadmap

- 작성일: 2026-08-11
- 상태: PROPOSED → 운영 기준 후보
- 목적: GUI's Arc / Issue / Schedule 독립제품 전략의 구조적·수익·운영·권한·1인개발 리스크를 먼저 드러내고, 실제 개발 가능 시간과 판매 실험을 반영한 실행순서를 고정한다.
- 핵심 변경: **Issue 독립화보다 Schedule 판매 실험을 먼저 한다.**
- 사용자 개발 여건: 건설회사 근무 병행, 평일 퇴근 후 실질 개발 가능 시간 약 5시간, 근무 중 개발 거의 불가.

---

## 0. 이번 문서의 결론

### 결론 1
**독립 제품 전략 자체는 유지할 가치가 있다.**
다만 "모든 모듈을 독립제품으로 만든다"가 아니라, **독립 사용가치가 이미 외부 사용자에게 확인된 기능만 독립화**한다.

### 결론 2
**Schedule을 먼저 완성하고 실제 판매까지 한 사이클을 경험한다.**
Issue는 v0.27.x FIELD_USABLE baseline을 확정한 후 잠시 동결한다.

### 결론 3
Issue 독립화는 Schedule 판매 경험으로 다음을 확인한 뒤 진행한다.
- 실제 구매자
- 결제 방식
- Trial 필요성
- 계정 필요성
- 고객지원량
- 데이터 백업/복구 요구
- 라이선스 공유 문제
- 업데이트 배포 난이도
- 가격 민감도

### 결론 4
GUI's Arc는 독립 앱의 복제품이 아니라 **상위 분석·운영·Assistant 플랫폼**으로 남긴다.

### 결론 5
1인 개발에서 가장 큰 위험은 기술이 아니라 **동시 진행 프로젝트 수와 아이디어 확장**이다.
따라서 WIP(동시 진행) 제한을 개발 규칙으로 둔다.

---

# 1. 독립 제품 전략의 실질적 문제점

## 1.1 구조적 문제 — 제품을 나누면 코드보다 "운영 경계"가 늘어난다

독립화하면 단순히 화면이 하나 더 생기는 것이 아니다.

각 제품마다 잠재적으로 다음이 필요하다.

- 로그인
- 계정 복구
- 라이선스
- 체험판
- 저장
- 백업
- 버전
- 배포
- 오류 대응
- 개인정보/약관
- 결제
- 고객지원
- 문의창구
- 사용법 문서

Issue와 Schedule을 각각 완전 독립 SaaS로 만들면,
기능 개발보다 이런 공통 운영 기능이 반복될 수 있다.

### 방지 원칙
제품마다 Auth/Billing/Account를 따로 만들지 않는다.

장기적으로:

```text
GUI's Arc Identity / Account Service
           │
 ┌─────────┴───────────┐
 │                     │
Issue                Schedule
 │                     │
Product Role         Product Role
```

처럼 공통 계정·Entitlement를 사용한다.

단, 이것을 지금 먼저 플랫폼화하지 않는다.
Schedule 첫 판매에서 필요한 최소 기능부터 구현한다.

---

## 1.2 공유 Core의 위험 — 너무 일찍 공통화하면 개발이 느려진다

"Shared Core"는 장기적으로 좋은 구조지만,
아직 Issue와 Schedule 두 제품의 실제 공통 요구가 충분히 드러나지 않았다.

너무 일찍:
- common-auth
- common-license
- common-storage
- common-product-sdk
- common-event-bus

를 만들면 제품보다 플랫폼을 먼저 만드는 오류가 생긴다.

### 기준
**두 제품에서 실제로 두 번 구현된 문제만 공통화 후보로 승격한다.**

첫 번째 구현은 제품 내부에 둔다.
두 번째 제품에서 같은 문제가 실제 발생하면 추출을 검토한다.

---

# 2. 사용자 관점의 문제

## 2.1 Issue를 너무 단순하게 만들면 가치가 사라질 수 있다

독립 Issue를:

> 사진 찍기 → 위치 → 내용 → 리스트

만으로 제한하면,
사진첩, 메신저, Notion, Trello, Google Drive보다
구매 이유가 약해질 가능성이 있다.

즉 "Dashboard가 없어서 단순하다"는 것이 장점이지만,
**너무 단순해서 돈을 받을 이유가 없어질 위험도 있다.**

### 독립 Issue의 최소 차별화 후보
- 사진 촬영 즉시 마킹
- 현장/프로젝트별 구조화
- 위치 자동완성
- 사진 중심 빠른 탐색
- 상태 최소값(예: 미확인/처리/완료)
- 공유용 사진 생성
- 원본 + 마킹본 보존
- 빠른 검색

단, 업체 배정·종합 대시보드·AI 등은 GUI's Arc에 남긴다.

---

## 2.2 Schedule은 범용화할수록 정체성이 흐려질 수 있다

기계 연구, 건설, 제조 등 다양한 사람이 원할 수 있다는 것은 장점이다.

하지만 모두의 요구를 받으면:
- 건설은 층/공종
- 연구는 Task/Experiment
- 제조는 공정/라인
- 행사팀은 Event/Resource

등 데이터 구조가 갈라질 수 있다.

### 방지 원칙
Schedule Core는 업종 중립적으로 유지한다.

```text
Group
Item
Task/Bar
Dependency
Date
Color
Note
```

업종별 용어는 Template/Label 수준으로 처리한다.

첫 판매 전에 "건설용/연구용/제조용" 세 제품으로 분기하지 않는다.

---

# 3. 수익 모델의 문제

## 3.1 구독제가 항상 맞는 것은 아니다

Schedule처럼 개인 생산성 도구는 사용자가:
- 1회 구매
- 연간 라이선스
- 저가 월구독

중 어떤 방식을 선호할지 아직 모른다.

초기부터 월 구독 시스템을 만들면:
- 결제 실패
- 해지
- 환불
- 청구
- 세금
- entitlement expiry

까지 구현해야 한다.

### Schedule 첫 판매 권장
처음 3~10명은 **수동 라이선스 판매**를 권장한다.

예:
- 30일 무료 Trial
- 구매 시 1년 라이선스 또는 1회 구매형 가설
- 운영자가 수동으로 entitlement 활성화

첫 고객이 생기기 전 자동 PG를 구현하지 않는다.

---

## 3.2 Issue는 B2C보다 B2B에 가까울 수 있다

Issue는 사진 저장·현장 데이터·조직 권한 때문에
개인 사용자가 좋아해도 실제 매출은 회사 사용에서 더 클 가능성이 있다.

따라서:
- 개인 무료/저가
- 회사 유료

같은 구조가 필요할 수 있다.

하지만 이것도 지금 확정하지 않는다.
실제 외부 사용자 행동을 보고 결정한다.

---

## 3.3 GUI's Arc 포함 라이선스가 독립 제품 매출을 잠식할 수 있다

"GUI's Arc 구매자는 Issue/Schedule 무료 포함"은 판매 문구로는 좋지만,
잘못 설계하면 독립 제품 수익이 없어질 수 있다.

### 권장
'무료'가 아니라 **Bundle Entitlement**로 본다.

GUI's Arc 가격에는 이미 Product 비용이 포함되어 있다고 간주한다.

```text
Direct Schedule 구매
Schedule entitlement = DIRECT

GUI's Arc 구매
Schedule entitlement = BUNDLE
```

향후 가격 계산이 가능하게 source를 기록한다.

---

# 4. 관리/운영 문제

## 4.1 제품 수가 늘수록 고객지원이 선형 이상으로 증가한다

1인 개발의 현실적인 위험:

```text
Issue 오류 문의
Schedule 저장 문제
GUI's Arc 권한 문제
결제 문의
로그인 문의
파일 복구 요청
브라우저 호환 문의
```

각각 하루에 하나씩만 와도 퇴근 후 개발 시간이 사라질 수 있다.

### 운영 원칙
첫 판매 시 지원 범위를 명시한다.

- 지원시간: 예) 평일 야간/익일 응답
- 지원채널: 1개
- 원격지원: 필요한 경우만
- 데이터복구: 정책 명시
- 기능요청: 즉시 구현 약속 금지

---

## 4.2 저장 데이터 손상은 Schedule에서 치명적이다

Schedule은 기능보다 "내가 만든 일정이 사라지지 않는 것"이 더 중요하다.

첫 판매 전 최소 요구:
- 저장 실패 감지
- 자동 백업 또는 복구 포인트
- 파일 Export
- Import 검증
- 버전 호환
- 손상 시 읽기 전용 복구

새 기능보다 우선한다.

---

## 4.3 Issue는 사진 비용과 개인정보가 따라온다

Issue Standalone은:
- 사진 저장량
- 삭제 요청
- 사용자 탈퇴
- 공유 링크
- 사진 접근권한
- 보존기간

등이 Schedule보다 복잡하다.

이 때문에 Issue를 두 번째 독립제품으로 미루는 것이 합리적이다.

---

# 5. 계정/권한 구조 위험

## 5.1 Platform Admin과 고객 Master를 절대 같은 권한 모델로 합치지 않는다

권장:

```text
PLATFORM_ADMIN
  서비스 운영

ORGANIZATION_OWNER
  고객 회사/개인 Workspace 관리

PRODUCT_ROLE
  제품 내부 행동
```

PLATFORM_ADMIN이 고객 데이터에 일상적으로 개입하는 구조는 피한다.

---

## 5.2 Entitlement와 Authorization 분리

```text
Entitlement
이 제품을 사용할 수 있는가?

Role/Permission
그 안에서 무엇을 할 수 있는가?
```

예:
Schedule entitlement ACTIVE + VIEWER
= 사용할 수 있지만 수정은 못함.

---

## 5.3 Personal Organization은 유용하지만 UX에 노출할 필요는 없다

내부 데이터 모델에서는 Organization을 통일한다.

하지만 개인 사용자에게:
"조직을 생성하세요"
라고 보여주지 않는다.

가입하면 자동 Personal Workspace.

---

## 5.4 라이선스 공유/계정 공유 문제

Schedule 판매 시 바로 나올 수 있다.

예:
- 한 사람이 산 계정을 회사 PC 5대가 같이 사용
- ID/PW 공유
- 퇴사한 직원 계정 계속 사용

첫 판매에서는 복잡한 Device DRM을 만들지 않는다.

대신:
- 동시 세션 또는 활성 사용자 정책
- 계정 공유 금지 약관
- 비정상 사용은 운영자가 확인

정도로 시작한다.

---

# 6. 1인 개발의 가장 큰 한계

## 6.1 개발 가능 시간보다 "연속성"이 부족하다

평일 5시간이 있어도 매일 5시간 순수 코딩이 아니다.

실제로는:
- 이전 작업 다시 이해
- Codex 결과 읽기
- 테스트
- 배포
- 아이디어 기록
- 오류 대응

이 포함된다.

따라서 계획에서 5시간을 5시간 개발로 계산하면 항상 늦어진다.

### 현실적 계산
평일 한 세션 5시간 기준:

```text
30분  작업복구/현재상태 확인
3시간 핵심 개발
1시간 검증/수정
30분 기록/다음 작업 고정
```

즉 하루 순수 기능 개발은 약 3시간으로 본다.

---

## 6.2 Context Switching 비용이 매우 크다

현재 동시에:
- GUI's Arc
- Issue
- Schedule
- Google Sheets
- 공정전개도
- Engine/AI 아이디어
- Landing
- 판매전략

을 생각하고 있다.

이 상태에서 매일 다른 것을 건드리면
시간보다 머리의 재로딩 비용이 더 커진다.

### WIP 제한
**Active Product = 1**
**Maintenance Product = 최대 1**
**Idea Backlog = 무제한**

현재:
- Active: Schedule
- Maintenance: GUI's Arc Issue v0.27.x 안정화
- Backlog: Issue Standalone / AI / Landing 확장 / 기타

---

# 7. 아이디어를 잊어버리는 문제 해결

아이디어를 막는 것이 아니라 "개발로 바로 승격하지 않는 시스템"이 필요하다.

## 7.1 Idea Inbox 하나만 사용

모든 아이디어를 하나의 문서/파일에 기록한다.

필드:

```text
날짜
제품
아이디어
문제
누가 필요한가
지금 안 하면 무엇을 잃는가
예상 구현비용
분류
```

분류는 단 세 개:

```text
NOW
NEXT
PARKED
```

아이디어를 떠올린 날에는 구현 여부를 결정하지 않는다.

---

## 7.2 주 1회만 Backlog Review

예:
일요일 30분.

검토:
- 실제 사용가치
- 현재 판매 목표와 직접 연결
- 기존 기능 대비 개선폭
- 구현 비용
- 일정 지연 위험

그때만 NOW로 승격한다.

---

# 8. 수정된 개발 우선순위

## PHASE A — GUI's Arc Issue v0.27.1 종료
기간 목표: 가능한 빨리, 추가기능 금지.

남은 일:
- 사진 편집 UX Hotfix
- Integration
- 모바일 실기기 최종검증
- Commit/Tag/ZIP
- FIELD_USABLE baseline

완료 후 Feature Freeze.

긴급 버그 외 개발 중단.

---

## PHASE B — Schedule SELLABLE MVP
**현재 최우선 Active Product**

목표:
"지인에게 파일을 보여주는 수준"이 아니라
"돈을 받고 전달해도 두렵지 않은 수준".

필수:
1. 핵심 편집 안정화
2. 저장/불러오기
3. Backup/Recovery
4. Print/PDF
5. Undo 또는 실수복구
6. Version compatibility
7. 최소 onboarding
8. Standalone branding
9. Trial/license 최소 구현
10. Release packaging

금지:
- AI
- 실시간 협업
- 복잡한 Dashboard
- 업종별 fork
- 모바일 완전 대응(실제 수요 없으면)
- 자동결제

---

## PHASE C — Schedule Closed Alpha
대상: 이미 "쓰고 싶다"고 말한 지인 3~5명.

기간: 2~4주.

측정:
- 설치/첫 실행 성공
- 첫 Schedule 생성 시간
- 저장 실패
- 기능 질문 수
- 실제 주간 재사용
- 가장 많이 요청한 기능
- 구매의사
- 원하는 가격 방식
- 회사/개인 구매 여부

기능 요청은 즉시 구현하지 않는다.
반복 2명 이상 + 제품 핵심과 일치할 때만 후보.

---

## PHASE D — Schedule First Sale
자동결제 없이 첫 매출을 만든다.

필요:
- 가격 가설 1개
- Trial 정책
- 수동 entitlement
- 간단한 이용안내
- 지원정책
- 결제/입금 절차
- 최소 약관/개인정보 검토

성공 기준:
**실제 외부 사용자 1명이 자신의 돈 또는 회사 예산으로 결제.**

---

## PHASE E — 30~60일 운영 관찰
첫 판매 직후 Issue 독립화를 시작하지 않는다.

최소 한 달 관찰한다.

기록:
- 문의량
- 버그
- 업데이트 빈도
- 라이선스 문제
- 파일복구 문제
- 결제방식 불편
- 사용자 이탈
- 기능요청 패턴

이것이 공통 Account/Entitlement 설계의 실제 입력이다.

---

## PHASE F — Product Family Architecture v2
Schedule 판매 증거를 반영하여 재설계한다.

그때 확정:
- Account
- Personal Workspace
- Organization
- Entitlement
- Trial
- Device/session policy
- Subscription vs perpetual
- Support
- Release/update

---

## PHASE G — Issue Standalone Boundary
이제 Issue 독립화를 시작한다.

목표:
사진 기록 중심 독립 Product.

중요:
현재 GUI's Arc Issue 전체를 복제하지 않는다.

먼저:
1. 어떤 기능이 Standalone 가치인가
2. 어떤 기능이 GUI's Arc 분석 기능인가
3. 어떤 데이터가 shared인가
4. 인증/저장/라이선스를 Schedule 경험에서 재사용할 수 있는가

를 확정.

---

## PHASE H — GUI's Arc Product Integration
Issue/Schedule을 entitlement로 연결.

GUI's Arc는:
- Product launcher
- 통합 Identity
- Organization/Site context
- Dashboard
- Today
- 분석
- Assistant

를 담당.

---

## PHASE I — AI / Engine
독립 앱 판매와 실제 데이터가 충분해진 후.

AI는 사업의 시작점이 아니라 결과물이다.

---

# 9. 주간 작업 운영

## 평일

한 밤에 한 목표만.

예:

### 월
Schedule 핵심 기능

### 화
Schedule 핵심 기능

### 수
Schedule 핵심 기능

### 목
검증/버그/저장 안정성

### 금
패키징/문서/Alpha 준비

GUI's Arc 긴급 버그가 아니면 Schedule 주간에 섞지 않는다.

---

## 주말 또는 휴일

가능하면:
- 30분 Backlog Review
- 다음 주 목표 1개 결정
- Release/실기기 테스트
- 사용자 피드백 정리

---

# 10. 일일 종료 규칙

퇴근 후 개발의 가장 큰 손실은 다음날 "어디까지 했지?"이다.

매 세션 끝 10분에 반드시 기록:

```text
TODAY_DONE
- 오늘 완료

CURRENT_STATE
- 현재 버전
- PASS/FAIL
- dirty files

NEXT_ONE
- 다음 세션에서 제일 먼저 할 한 가지

BLOCKER
- 막힌 것

IDEA_INBOX
- 오늘 떠오른 아이디어
```

다음날은 NEXT_ONE부터 바로 시작한다.

---

# 11. 판단 Gate

## Schedule 판매 진행 Gate

다음이 모두 만족되면 판매 실험:

- 핵심 일정 편집 안정
- 저장/복구 신뢰 가능
- 실제 지인 3명 이상 사용
- 1명 이상 반복 사용
- 설명 없이 기본 기능 사용 가능
- 치명적 데이터 손실 없음

---

## Issue 독립화 시작 Gate

다음 중 최소 조건:

- Schedule 첫 결제 완료
- 30일 이상 실제 외부 운영
- 계정/라이선스/지원 문제를 실제 경험
- Issue Standalone을 쓰겠다는 외부 사용자 3명 이상
- Standalone Issue의 독립 가치가 한 문장으로 명확

---

## AI 시작 Gate

- 원천 데이터 품질 정의 완료
- 실제 데이터 충분
- Rule baseline 존재
- AI가 개선할 명확한 metric 존재

---

# 12. 가장 위험한 실패 시나리오

### 실패 1
Schedule을 팔기 전에 기능을 계속 추가해 6개월이 지나감.

대응:
Sellable MVP 범위 동결.

### 실패 2
Issue/Schedule/GUI's Arc를 동시에 개발하다 셋 다 미완성.

대응:
Active Product 1개.

### 실패 3
Shared Platform을 먼저 만들다가 제품 판매가 늦어짐.

대응:
두 번째 실제 중복이 생기기 전 공통화 금지.

### 실패 4
지인의 "좋다/쓰고 싶다"를 구매의사로 오해.

대응:
실제 사용과 결제로 확인.

### 실패 5
첫 고객 요청을 모두 받아 제품이 고객 맞춤형 SI가 됨.

대응:
2명 이상 반복 + Core 가치 일치 시에만 제품 반영.

### 실패 6
퇴근 후 개발을 무리하게 유지해 본업과 건강에 영향.

대응:
한 세션 5시간을 최대치로 보고, 일정 지연을 기능 확장으로 보상하지 않는다.

---

# 13. 최종 우선순위

```text
1. GUI's Arc v0.27.1 마감
2. Schedule Sellable MVP
3. Schedule Closed Alpha
4. Schedule 첫 판매
5. 30~60일 운영 경험
6. Product Family Architecture v2
7. Issue Standalone
8. GUI's Arc 통합
9. AI / Engine
```

---

# 14. 이 계획에서 일부러 늦추는 것

- Issue 독립화
- 공통 Auth Platform 완성
- 자동 PG
- 복잡한 Subscription
- AI Server
- 모든 랜딩페이지 동시 제작
- 국제화 전면 적용
- 모바일 Schedule 전면 대응
- Real-time Collaboration

이것들은 포기가 아니라 순서 조정이다.

---

# 15. 핵심 운영 문장

> **제품을 많이 만드는 것이 목표가 아니다. 하나를 완성해서 실제 사람이 쓰고 돈을 내는 경험을 먼저 만든다.**

> **아이디어는 잃지 않되, 떠오른 순간 개발하지 않는다.**

> **GUI's Arc는 독립 제품을 집어삼키는 통합앱이 아니라, 독립 제품의 데이터를 연결해 더 높은 가치를 만드는 상위 플랫폼으로 남긴다.**

---

## v0.27.1 FIELD_USABLE 실행 기준

우선순위:

1. Schedule Sellable MVP
2. Schedule Closed Alpha
3. Schedule First Sale
4. 30~60일 운영
5. Product Family Architecture v2
6. Issue Standalone

- Issue는 v0.27.1 이후 Feature Freeze다. 긴급 버그 외 신규 개발을 금지한다.
- PARKED: Photo Work 좌우 swipe를 YouTube Shorts식 상/하 vertical swipe 방식으로 검토한다. v0.27.1에는 포함하지 않는다.

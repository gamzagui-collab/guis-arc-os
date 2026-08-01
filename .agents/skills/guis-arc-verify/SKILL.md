---
name: guis-arc-verify
description: GUI's Arc 변경을 범위에 맞게 테스트하고 PASS, FAIL, NOT_EXECUTED를 구분한다. 구현 후 회귀·Typecheck·Validate·Build·한국어 검사가 필요할 때 사용한다.
---

# GUI's Arc 검증

## 사용하지 않는 경우

- 코드·문서 수정 자체가 목적일 때
- 승인되지 않은 배포나 운영 데이터 검증이 필요할 때

## 먼저 읽기

1. `AGENTS.md`
2. `VERSION.md`
3. `AIOS/PROJECT_STATE.md`
4. `DEVELOPMENT_RULES.md`
5. 변경 파일과 관련 테스트·검증 스크립트

## 절차

1. 직접 관련 테스트를 실행한다.
2. 관련 회귀 테스트를 실행한다.
3. Typecheck를 실행한다.
4. Validate를 실행한다.
5. Build를 실행한다.
6. 한국어 UI 검사를 실행한다.
7. 위험과 릴리스 범위가 요구할 때만 전체 테스트를 최종 1회 실행한다.
8. 배포된 환경과 명시적 범위가 있을 때만 Browser E2E를 실행한다.

## 금지사항

- 실행하지 않은 검증을 PASS로 보고
- 문자열 존재 검사만으로 핵심 동작 완료 주장
- 실패를 숨기거나 후속 명령 성공으로 전체 PASS 처리
- 검증을 위해 Production·운영 데이터를 임의 변경

## 완료 조건

- 각 검증이 `PASS`, `FAIL`, `NOT_EXECUTED` 중 하나로 기록되어 있다.
- 실패 원인과 마지막 성공 실행이 구분되어 있다.
- 회귀 범위와 미검증 공백이 명확하다.

## 결과 보고

직접 테스트, 회귀, 전체 테스트, Typecheck, Validate, Build, 한국어 검사, Browser E2E, 제한 순서로 상태와 건수를 보고한다.

## 액션 피드백 검증

- 처리 중 버튼·aria-busy·중복 클릭 차단, 성공 후 화면 반영, 실패 후 입력·선택 보존, Revision 충돌 재시도를 검증한다.

## 목적
변경 결과를 테스트와 검증 명령으로 종합 판정한다.
## 사용 조건
구현 후 릴리스 게이트 또는 회귀 검증이 필요할 때 사용한다.
## 먼저 읽을 문서
Required file: `AGENTS.md`
Required file: `DEVELOPMENT_RULES.md`
Required file: `VERSION.md`
Required file: `AIOS/PROJECT_STATE.md`
## 예상 문제·부작용·충돌
부분 성공을 전체 PASS로 오인하거나 실행하지 않은 E2E를 혼합하지 않는다.
## 입력
변경 범위, 관련 테스트, 필수 검증 명령.
## 변경 허용 범위
검증 실패의 직접 원인인 테스트·검증 설정만 승인 범위에서 수정한다.
## 테스트 및 검증
PASS·FAIL·NOT_EXECUTED와 마지막 성공 실행을 기록한다.
## 결과 보고 형식
관련 테스트, 전체 테스트, Typecheck, Validate, Build, 한국어 UI, Browser 순서로 보고한다.
## NOT_EXECUTED 기준
환경·계정·배포가 없는 검증은 명시적으로 `NOT_EXECUTED`다.

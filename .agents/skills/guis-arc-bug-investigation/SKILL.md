---
name: guis-arc-bug-investigation
description: GUI's Arc의 실제 오류·재현 가능한 장애·화면과 데이터 불일치에서 Root Cause를 조사할 때 사용한다. 단순 디자인 변경이나 근거 없는 예상 문제 검토에는 사용하지 않는다.
---

# 목적
증상을 우회하지 않고 재현과 증거로 Root Cause를 확인한다.

## 사용 조건
- 400·403·404·409·500, 잘못된 화면 상태 또는 데이터 불일치가 발생했을 때 사용한다.

## 사용하지 않는 경우
- 단순 문구·간격 변경이나 사전 아키텍처 검토에는 사용하지 않는다.

## 먼저 읽을 문서
Required file: `AGENTS.md`
Required file: `DEVELOPMENT_RULES.md`
Required file: `VERSION.md`
Required file: `AIOS/PROJECT_STATE.md`

## 예상 문제·부작용·충돌
재현 조건 누락, 로그 오판, 권한과 서버 오류 혼합, Null·Migration·캐시 문제를 구분한다.

## 입력
재현 절차, 오류 코드, Stack Trace, Network·DB·화면 증거.

## 절차
기준본 확인 → 재현 → Route → Stack Trace → 예외 위치 → Service → Query → Migration → Null → 권한 → Root Cause 보고.

## 변경 허용 범위
조사 단계는 읽기 전용이며, Root Cause 확인 후 승인된 최소 수정만 허용한다.

## 금지사항
추측 수정, 증상 숨김, 데이터 임의 변경, 대규모 리팩터링, Production 변경을 금지한다.

## 테스트 및 검증
수정 전 재현 실패와 수정 후 동일 경로 성공을 분리해 기록한다.

## 완료 조건
Root Cause, 재현, 최소 수정 범위가 근거로 연결된다.

## 결과 보고 형식
증상, 재현, Root Cause, 영향, 최소 수정, 검증, 미확인 순서로 보고한다.

## NOT_EXECUTED 기준
Stack Trace·원격 DB·실제 브라우저를 확인하지 못하면 해당 항목을 `NOT_EXECUTED`로 둔다.

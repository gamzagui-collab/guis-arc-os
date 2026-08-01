---
name: guis-arc-architecture-review
description: GUI's Arc 기능 구현 전에 모듈 경계·데이터 원본·DB·API·권한과 장기 확장 위험을 검토할 때 사용한다. 구현된 코드 결함 리뷰나 재현 장애 Root Cause 조사에는 사용하지 않는다.
---

# 목적
Platform·Issue·Today·Safety·Quality의 책임과 데이터 흐름을 구현 전에 검토한다.

## 사용 조건
- 신규 기능이 여러 모듈, DB, API 또는 권한에 영향을 줄 때 사용한다.

## 사용하지 않는 경우
- 구현 후 세부 코드 결함은 `guis-arc-code-review`, 실제 장애는 `guis-arc-bug-investigation`을 사용한다.

## 먼저 읽을 문서
Required file: `AGENTS.md`
Required file: `DEVELOPMENT_RULES.md`
Required file: `VERSION.md`
Required file: `AIOS/PROJECT_STATE.md`

## 예상 문제·부작용·충돌
데이터 중복, 모듈 간 직접 쓰기, 권한 우회, Migration 확장 비용과 오래된 계약 충돌을 먼저 드러낸다.

## 입력
사용자 요구, 현재 계약, 관련 코드·Schema와 기대 운영 흐름.

## 절차
기준본 확인 → 데이터 원본·소유권 확인 → 경계·의존성·권한 분석 → 최소 범위와 대안 비교 → 미검증 구분 → 결과 보고.

## 변경 허용 범위
기본은 읽기 전용 검토이며, 명시 요청 시 계약 문서만 최소 수정한다.

## 금지사항
전체 구조 재설계, Platform 원본 복제, 근거 없는 성능·성공 주장, Production 변경을 금지한다.

## 테스트 및 검증
계약·Schema·권한 매핑을 근거로 확인하고 실행하지 않은 검증은 분리한다.

## 완료 조건
영향 모듈, 원본 데이터, 위험, 최소 구현 경계가 명확하다.

## 결과 보고 형식
현재 구조, 충돌, 위험, 권고 경계, 영향 없음, 미검증 순서로 보고한다.

## NOT_EXECUTED 기준
코드 실행·DB 조회·브라우저 확인을 하지 않았으면 각각 `NOT_EXECUTED`로 표시한다.

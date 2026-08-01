---
name: guis-arc-browser-e2e
description: GUI's Arc의 실제 배포 URL에서 브라우저·인증 세션·Viewport·Network·상호작용을 검증할 때 사용한다. 정적 테스트만 있거나 배포·인증 없이 권한 E2E를 주장할 때는 사용하지 않는다.
---

# 목적
배포된 사용자 흐름을 실제 브라우저 증거로 검증한다.

## 사용 조건
- 접근 가능한 배포 URL과 필요한 경우 재사용 가능한 인증 세션이 있을 때 사용한다.

## 사용하지 않는 경우
- 로컬 문자열 검사나 인증 없는 권한 검증에는 사용하지 않는다.

## 먼저 읽을 문서
Required file: `AGENTS.md`
Required file: `DEVELOPMENT_RULES.md`
Required file: `VERSION.md`
Required file: `docs/10_BROWSER_E2E.md`

## 예상 문제·부작용·충돌
캐시, Viewport, Network 반복 호출, 세션·권한 부족과 실제 기기 차이를 구분한다.

## 입력
배포 URL, 검증 계정·세션 존재 여부, Viewport와 업무 시나리오.

## 절차
기준본·URL 확인 → 인증 상태 확인 → 화면·상호작용 → Network·캐시 → Viewport → 권한 → 증거 기록.

## 변경 허용 범위
기본은 읽기 전용 검증이다. 결함 발견 시 수정하지 않고 Root Cause와 Hotfix 범위를 먼저 보고한다.

## 금지사항
임의 계정 생성, 운영 데이터 변경, 정적 테스트의 E2E PASS 보고, Production 자동 접근을 금지한다.

## 테스트 및 검증
PC·모바일 viewport와 실제 기기를 구분하고 스크린샷·Network 결과를 기록한다.

## 완료 조건
실행 시나리오별 PASS·FAIL·NOT_EXECUTED와 증거가 남는다.

## 결과 보고 형식
URL, 브라우저·Viewport, 인증, 시나리오, Network, 결함, 미실행 순서로 보고한다.

## NOT_EXECUTED 기준
인증 세션이나 실제 기기가 없으면 관련 권한·기기 항목을 `NOT_EXECUTED`로 표시한다.

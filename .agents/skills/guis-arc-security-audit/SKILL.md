---
name: guis-arc-security-audit
description: GUI's Arc의 인증·권한·교차 현장·회사 접근·입력 검증·Secret·환경변수와 의존성 위험을 감사할 때 사용한다. 요청 없이 인증 구조를 재설계하거나 npm audit fix를 실행할 때는 사용하지 않는다.
---

# 목적
Platform 원본과 서버 권한을 기준으로 접근 경계가 fail-closed인지 검토한다.

## 사용 조건
- 인증, 권한, 데이터 노출, Secret 또는 의존성 위험 검토 요청에 사용한다.

## 사용하지 않는 경우
- 일반 기능 구현이나 UI 사용성 검토만 필요한 경우에는 사용하지 않는다.

## 먼저 읽을 문서
Required file: `AGENTS.md`
Required file: `DEVELOPMENT_RULES.md`
Required file: `VERSION.md`
Required file: `docs/05_PERMISSION_MODEL.md`

## 예상 문제·부작용·충돌
UI 숨김 의존, 회사·현장 범위 누락, 입력 우회, 로그·패키지 Secret 노출을 확인한다.

## 입력
권한 계약, API·Query, 환경 설정, 의존성 검사 결과.

## 절차
기준본 확인 → 자산·행위자·경계 정의 → 인증·권한·입력·Secret 검토 → 재현 가능한 위험 검증 → 최소 완화 권고.

## 변경 허용 범위
기본은 읽기 전용이며 명시 요청 시 관련 보안 결함만 최소 수정한다.

## 금지사항
전체 인증 재설계, `npm audit fix --force`, Secret 출력, Production 변경을 금지한다.

## 테스트 및 검증
허용·거부·교차 범위 사례와 서버 측 검증을 확인한다.

## 완료 조건
위험이 근거·영향·우선순위·완화책과 연결된다.

## 결과 보고 형식
위험, 영향 범위, 증거, 완화, 의존성 경고, 미검증 순서로 보고한다.

## NOT_EXECUTED 기준
실제 계정·원격 환경·의존성 조회가 없으면 해당 감사를 `NOT_EXECUTED`로 표시한다.

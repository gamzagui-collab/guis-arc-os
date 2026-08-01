---
name: guis-arc-api-contract-validator
description: GUI's Arc API의 요청·응답·null과 생략·오류 코드·하위 호환·권한 실패·Revision 충돌·Idempotency 응답을 검증할 때 사용한다. UI 배치 검토나 Migration 무결성 전용 작업에는 사용하지 않는다.
---

# 목적
클라이언트와 Worker 사이의 실제 API 계약이 명확하고 호환되는지 검증한다.

## 사용 조건
- API 추가·변경·회귀 또는 오류 계약 검토가 필요할 때 사용한다.

## 사용하지 않는 경우
- 화면 레이아웃이나 DB Backfill만 검토할 때는 사용하지 않는다.

## 먼저 읽을 문서
Required file: `AGENTS.md`
Required file: `DEVELOPMENT_RULES.md`
Required file: `VERSION.md`
Required file: `docs/01_ARCHITECTURE.md`

## 예상 문제·부작용·충돌
생략과 null 혼합, 상태 코드 오용, 권한 오류 은폐, Revision·Idempotency 불일치를 확인한다.

## 입력
Route, 요청·응답 예시, 클라이언트 호출, Schema와 관련 테스트.

## 절차
기준본 확인 → 소비자·Route 추적 → 필드·오류·권한·동시성 계약표 작성 → 호환성 검증 → 테스트와 미검증 보고.

## 변경 허용 범위
기본은 읽기 전용이며 승인 시 관련 API·클라이언트·테스트만 최소 수정한다.

## 금지사항
오류 삼키기, 무단 하위 호환 파괴, 권한 완화, Production 호출을 금지한다.

## 테스트 및 검증
정상·400·403·404·409·500, null·생략, 재호출 사례를 검증한다.

## 완료 조건
요청·응답·오류·호환성·권한 계약이 근거와 함께 확정된다.

## 결과 보고 형식
Route, 계약표, 불일치, 영향 소비자, 테스트, 미검증 순서로 보고한다.

## NOT_EXECUTED 기준
실제 API 호출이나 인증 계정이 없으면 정적 검토와 실행 검증을 구분한다.

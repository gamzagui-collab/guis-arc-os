---
name: guis-arc-migration-data-integrity
description: GUI's Arc Migration의 순서·Backfill·기존 데이터 보존·FK·Index·Revision·Audit·Idempotency·원자성과 통계 왜곡을 검증할 때 사용한다. 일반 UI 검토나 Cloudflare 배포 실행에는 사용하지 않는다.
---

# 목적
Schema 변경이 기존 데이터와 업무 의미를 안전하게 보존하는지 검증한다.

## 사용 조건
- 신규·미적용 Migration이나 데이터 이관·무결성 검토가 필요할 때 사용한다.

## 사용하지 않는 경우
- UI 검토 또는 실제 배포 실행 자체에는 사용하지 않는다.

## 먼저 읽을 문서
Required file: `AGENTS.md`
Required file: `DEVELOPMENT_RULES.md`
Required file: `VERSION.md`
Required file: `docs/08_MIGRATION_PLAN.md`

## 예상 문제·부작용·충돌
순서 누락, 잘못된 추론 Backfill, 행 손실, 통계 혼합, 비원자 변경을 먼저 확인한다.

## 입력
Migration SQL, 전후 Schema, 기존 데이터 규칙, 원격 적용 목록.

## 절차
기준본 확인 → 이전 Migration 확인 → SQL·Backfill 검토 → 로컬 데이터 보존 테스트 → 원격 목록 확인 → 적용 후 재검증.

## 변경 허용 범위
승인된 Migration·테스트만 최소 수정하며 원격 적용은 명시된 Integration에 한정한다.

## 금지사항
기존 Migration 재작성, 근거 없는 데이터 추론, Production 적용, 실제 데이터 임의 삭제를 금지한다.

## 테스트 및 검증
전후 행 수, 허용 값, FK·Index, Revision·Audit·상태 보존을 검증한다.

## 완료 조건
순서와 Backfill이 결정적이고 데이터 손실·왜곡이 없다.

## 결과 보고 형식
대상 DB, 순서, Backfill, 보존 검증, 적용 결과, 미검증 순서로 보고한다.

## NOT_EXECUTED 기준
원격 목록·적용·사후 Query를 실행하지 않았으면 각각 `NOT_EXECUTED`로 표시한다.

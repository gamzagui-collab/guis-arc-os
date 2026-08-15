---
name: guis-arc-data-change
description: Use when GUI's Arc work changes D1 schema or rows, R2 objects, migrations, backfills, import application, data ownership, or irreversible data contracts.
---

# GUI's Arc 데이터 변경

명시적 사용자 승인과 실행 전후 읽기 증거 없이 데이터를 변경하지 않는다.

1. 대상 환경·binding·database·bucket과 정확한 변경 범위를 확인한다.
2. 기존 행·객체·audit·revision·idempotency·rollback 영향을 검토한다.
3. 관련 테스트와 전체 테스트, syntax, validate를 실행한다.
4. 실행 직전 승인이 범위와 환경을 포함하는지 확인한다.
5. 변경 전후 수치와 식별자를 읽어 실제 영향을 검증한다.

대상 불일치, 예상 밖 migration, 데이터 손실 가능성, 승인 범위 초과가 있으면 실행하지 않는다.

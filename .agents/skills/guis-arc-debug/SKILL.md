---
name: guis-arc-debug
description: Use when GUI's Arc has a reproducible error, failing test, runtime mismatch, regression, or root-cause investigation that may require a minimal fix.
---

# GUI's Arc 오류 대응

재현 → 원인 확인 → 최소 수정 → 회귀 테스트 → 임시 규칙 폐기 순서를 지킨다.

1. 증상을 현재 코드나 테스트로 재현한다.
2. 데이터 흐름과 최초 잘못된 상태를 찾아 Root Cause를 확정한다.
3. 실패하는 회귀 테스트로 제품 계약을 고정한다.
4. 원인을 제거하는 최소 수정만 적용한다.
5. focused regression과 위험도 기반 검증을 실행한다.
6. 임시 진단 규칙을 제거하거나 조건부 runbook으로 돌린다.

추정으로 데이터·권한·API 계약을 바꾸지 않는다. 데이터 변경은 guis-arc-data-change를 사용한다.

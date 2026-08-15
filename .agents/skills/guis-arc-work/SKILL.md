---
name: guis-arc-work
description: Use when GUI's Arc needs ordinary scoped implementation, review, UI work, tests, documentation, or risk-based verification without a reproduced defect, data mutation, deployment, or release.
---

# GUI's Arc 일반 작업

요청을 한 문장으로 확정하고 관련 파일만 변경한다. 제품·데이터·배포 경계를 넓히지 않는다.

1. 변경 대상과 화면·Worker·데이터·배포 영향을 확인한다.
2. 현재 계약과 직접 관련된 코드·테스트만 읽는다.
3. 최소 변경을 적용하고 실제 동작을 보호하는 focused test를 유지한다.
4. DEVELOPMENT_RULES.md의 위험도 기준에서 필요한 검증만 실행한다.
5. 범위를 벗어난 변경이 필요하면 중단한다.

결과, 변경 파일, 테스트, 실제 영향 또는 위험, 사용자 확인 항목 하나를 보고한다.

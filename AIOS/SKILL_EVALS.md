# GUI's Arc Skill Trigger 기준

| Skill | 발동 조건 | 제외 조건 |
| --- | --- | --- |
| guis-arc-work | 일반 구현·검토·UI·문서·범위 검증 | 재현 오류, 데이터 변경, 배포, release |
| guis-arc-debug | 재현 오류·실패 테스트·Root Cause·회귀 수정 | 명확한 일반 변경 |
| guis-arc-data-change | D1·R2·Migration·Backfill·Import Apply | 읽기 전용 확인, Pages-only 배포 |
| guis-arc-deploy | Integration·Production·Cloudflare 배포와 smoke | 구현만 수행, ZIP-only 작업 |
| guis-arc-release | checkpoint 감사·Commit·Push·ZIP·SHA-256 | 일반 구현과 중간 검증 |

각 Skill은 조건이 맞을 때만 읽으며 시작 문서와 고정 테스트 목록을 반복하지 않는다.

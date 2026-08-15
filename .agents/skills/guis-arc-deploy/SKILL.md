---
name: guis-arc-deploy
description: Use when GUI's Arc Integration or Production Pages, Worker, D1, R2, bindings, or Cloudflare deployment execution and post-deployment smoke are requested.
---

# GUI's Arc 배포

승인된 환경과 리소스만 배포한다. Production은 항상 별도 명시적 승인이 필요하다.

1. 대상 프로젝트·환경·revision·배포 리소스를 확인한다.
2. 변경 범위에 필요한 테스트와 build를 통과시킨다.
3. 승인 범위에 포함된 Pages·Worker·데이터 작업만 실행한다.
4. deployment ID, URL, active asset과 Service Worker를 확인한다.
5. 변경 화면 smoke와 console을 검증한다.

환경·binding 불일치, 미승인 migration, 검증 실패, 예상 밖 리소스 변경이 있으면 추가 배포하지 않는다.

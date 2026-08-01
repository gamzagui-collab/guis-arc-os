# GUI's Arc Integrated v0.24.4

현장 이슈는 모바일 사진 슬라이드와 Overlay에서 확인하고, Construction Engine v1.0의 명시적 Rule로 추천 부서를 검토·확정한다. 외부 AI를 사용하지 않으며 Production은 변경하지 않는다.

## Construction Engine v1.0

- Issue 제목·내용·현재 공종을 입력으로 공사·안전·품질·관리·미분류를 추천한다.
- 추천과 관리자 확정은 분리되며 충돌·무일치는 정상적으로 미분류 처리한다.
- 상세 계약: `docs/35_CONSTRUCTION_ENGINE_V1_CONTRACT.md`

Today Module Foundation release of the single-product modular monolith.

## Implementation truth

- One Integrated login, session, shell, company and site context: IMPLEMENTED
- Issue module and private media: IMPLEMENTED
- Today Core and Issue providers: IMPLEMENTED
- Workforce Core and Today provider: IMPLEMENTED
- Construction, Safety, Quality, Materials and Equipment Today providers: PLACEHOLDER
- Weather provider: NOT_CONNECTED
- Role and contractor scope enforcement: IMPLEMENTED
- Stale revision audit and idempotency payload contract: IMPLEMENTED
- Offline draft with fail-closed final submission: IMPLEMENTED
- Admin: FOUNDATION
- Other business modules: PLACEHOLDER
- Production and legacy Platform, OS and Issue resources: UNCHANGED

Integration deployment and operational E2E results are recorded in `docs/16_ISSUE_BROWSER_E2E.md`. `NOT_EXECUTED` is preserved until real remote evidence exists.

Run `npm test`, `npm run typecheck`, `npm run validate`, `npm run build`, `npm run audit:performance`, and `npm audit`.


## v0.21.1 Issue 사진 슬라이드

모바일 이슈 검토는 사진 중심 슬라이드가 기본이며, 하단 위치·내용·조치 오버레이를 접거나 펼칠 수 있습니다. PC에서는 기존 목록 보기를 유지하고 필요할 때 사진 보기로 전환합니다.

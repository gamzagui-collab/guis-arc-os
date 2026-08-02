# GUI's Arc Integrated v0.24.12

v0.24.12는 Issue 단건·일괄 배정에서 UI payload, Worker 검증, DB의 `UNASSIGNED`·`DIRECT`·`CONTRACTOR` 유형과 `OPEN`·`ASSIGNED` 상태 전이를 일치시킨 최소 Hotfix입니다. 일반 협력업체 선택은 명시적으로 `CONTRACTOR`로 저장되며 잘못된 업체·공종·담당자 조합은 저장 전에 거부됩니다.

```powershell
$env:GUI_ARC_TARGET="integration"
$env:GUI_ARC_E2E_PROVISIONING_SECRET="<Integration Secret>"
$env:GUI_ARC_INTERNAL_TEST_PIN="<공통 4자리 시험 PIN>"
npm run internal-test:manage -- plan
npm run internal-test:manage -- apply
npm run internal-test:manage -- show
```

`apply`만 공통 4자리 숫자 PIN이 필요합니다. 반복·연속된 단순 PIN은 거부합니다. CLI는 운영 계정과 동일하게 계정마다 별도 salt와 PBKDF2-SHA256 100,000회 hash를 만들며 PIN 원문을 서버·로그·결과 JSON에 포함하지 않습니다.

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

# v9.4.2 Schedule Visual UX + Version Source Fix

## 기준
- 기준 저장소: GitHub `gamzagui-collab/guis-arc-os` main
- 기준 Stable: v9.3.9
- 현재 버전: v9.4.2

## 변경 사항
- 일정탭을 월간 달력 + 우측 상세 패널 + 하단 새 일정 입력폼 구조로 개편했다.
- 우측 일정 카드를 달력 날짜로 드래그하면 일정 날짜가 변경된다.
- 작업/자재/장비/콘크리트 타설을 서로 다른 색상과 아이콘으로 구분한다.
- 콘크리트 타설은 별도 강조 스타일을 적용했다.
- 상세 카드의 수정/삭제 버튼을 소형화하고, 한 화면에 더 많은 일정이 보이도록 압축했다.
- 날짜 우측에 `1건`, `2건` 형식으로 일정 개수를 표시한다.
- 토요일은 파랑, 일요일과 공휴일은 빨강으로 표시한다.
- 2026년 한국 공휴일을 기본 테이블로 표시하고, 마우스 hover 시 공휴일명이 title 툴팁으로 표시된다.

## 버전 관리 개선
- 헤드라인 버전은 `frontend/js/services/version.js`의 `APP_VERSION`만 참조하도록 변경했다.
- `frontend/index.html`에서 하드코딩된 v9.3.9 표기를 제거했다.
- `scripts/sync-version.mjs`를 추가해 `package.json`, `wrangler.toml`, `wrangler.worker.toml`의 APP_VERSION을 `version.js` 기준으로 동기화할 수 있게 했다.

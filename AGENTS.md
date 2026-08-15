# GUI's Arc Codex 작업 규칙

## 공식 기준

- 공식 작업 루트는 `D:\guis arc\GUI_Arc_Integrated`다.
- 작업 시작 시 `AGENTS.md`, `VERSION.md`, `DEVELOPMENT_RULES.md`만 항상 읽는다.
- 현재 사용자의 명시적 요청, `VERSION.md`와 실제 코드, `DEVELOPMENT_RULES.md` 순으로 판단한다.
- 과거 설계·계획·상태 문서는 요청과 직접 관련될 때만 읽으며 현재 사실로 자동 승계하지 않는다.

## 버전

- 제품 버전과 정적 자산 revision을 구분한다.
- 제품 버전은 공식 checkpoint에서 정한다.
- static revision은 실제 정적 자산 배포에서 cache bust가 필요할 때만 변경한다.

## 변경과 승인

- 사용자 요청 범위의 관련 파일만 변경한다.
- Production 배포, D1·R2·Migration 데이터 변경, 파괴적 작업, 권한·보안·데이터 구조 변경은 명시적 승인을 받는다.
- 사용자가 범위와 실행을 승인하면 구현, 범위 검증, 명시된 Integration Pages 배포를 한 작업으로 처리한다.
- 승인 범위를 벗어나는 기능 확대가 필요하면 중단하고 보고한다.

## 검증

- 변경 위험도에 맞는 검증만 실행한다. 세부 기준은 `DEVELOPMENT_RULES.md`를 따른다.
- 자동 검출 가능한 계약은 문서 반복이 아니라 테스트·타입·스키마·코드 제약으로 유지한다.
- 실행하지 않은 검증이나 배포를 PASS로 보고하지 않는다.

## 프로젝트 Skill

- 일반 작업: `guis-arc-work`
- 오류 재현·수정: `guis-arc-debug`
- D1·R2·Migration 변경: `guis-arc-data-change`
- Integration·Production 배포: `guis-arc-deploy`
- 공식 Commit·Push·ZIP: `guis-arc-release`

## 보고

- 결과, 변경 파일, 실행한 테스트, 실제 영향 또는 남은 위험, 사용자 확인 항목 하나만 짧게 보고한다.
- 상태가 변하지 않은 Branch, HEAD, 버전, URL과 긴 `NOT_CHANGED` 목록을 반복하지 않는다.

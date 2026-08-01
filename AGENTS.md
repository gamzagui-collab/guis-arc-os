# GUI's Arc Codex 진입 지침

## ChatGPT와 Codex 역할 요약

- 기본 설계와 결과 검토는 ChatGPT가 담당한다.
- 공식 코드·테스트·Migration·배포·Git·Integrated ZIP은 Codex가 담당한다.
- Codex 결과는 ChatGPT 검토 후 다음 작업으로 진행한다.
- ChatGPT 직접 구현은 사용자가 명시적으로 선택한 예외에 한한다.
- 전체 역할 원본은 `DEVELOPMENT_RULES.md`의 “ChatGPT와 Codex의 개발 역할”을 따른다.

## 사실과 지침의 우선순위

1. 현재 사용자의 명시적 요청
2. `VERSION.md`와 실제 코드
3. `AIOS/PROJECT_STATE.md`
4. `DEVELOPMENT_RULES.md`
5. 요청 기능의 최신 계약 문서
6. 과거 `CHANGELOG.md`, AIOS, Handoff와 계획 문서

오래된 AIOS·Handoff·계획이 현재 코드나 최신 확정 문서와 충돌하면 현재 기준으로 사용하지 않는다. 충돌을 기록하고, 근거가 충분하지 않으면 코드만 보고 업무 의미를 단정하지 않는다.

## 작업 시작

1. `VERSION.md`, `AIOS/PROJECT_STATE.md`, `DEVELOPMENT_RULES.md`를 읽는다.
2. 사용자 요청을 한 문장으로 확정하고 관련 파일만 찾는다.
3. 전체 `docs/`를 읽지 말고 요청과 직접 관련된 계약 문서만 선택한다.
4. 수정 전에 읽을 파일, 수정할 파일, 화면·Worker·DB·배포 영향 범위를 짧게 선언한다.
5. 작업 성격에 맞는 `.agents/skills`의 Skill을 사용한다.

## 변경 경계

- 작은 변경은 관련 화면·테스트·버전 파일만 수정한다.
- 명시적 필요 없이 구조, DB, 인증, 권한, R2, Provider를 변경하지 않는다.
- 요청하지 않은 전체 분석, 리팩터링, 기능 추가를 하지 않는다.
- Mock, UI-only, Local-only, 미연결 구현을 실제 완료로 보고하지 않는다.
- 사용자의 명시적 승인 없이 Production을 배포하거나 변경하지 않는다.
- Skill이 충돌하면 이 문서와 `DEVELOPMENT_RULES.md`를 우선한다.

사용자는 현장 요구만 설명하면 된다. 파일 병합, Git 판단, 코드 수정, 복잡한 배포 선택을 사용자에게 맡기지 않는다.

사용자 액션을 추가하거나 변경할 때는 `DEVELOPMENT_RULES.md`의 처리 중·성공·실패·중복 방지·접근성 피드백 원칙을 검증하고 완료 보고에 결과를 명시한다.

## 프로젝트 Skill 선택

- 프로젝트 Skill은 `.agents/skills/<skill-name>/SKILL.md`에 둔다.
- 상위 Skill은 `guis-arc-review`, `guis-arc-implement`, `guis-arc-verify`, `guis-arc-deploy`, `guis-arc-package`다.
- 전문 Skill은 `guis-arc-architecture-review`, `guis-arc-code-review`, `guis-arc-bug-investigation`, `guis-arc-test-generator`, `guis-arc-browser-e2e`, `guis-arc-migration-data-integrity`, `guis-arc-security-audit`, `guis-arc-api-contract-validator`, `guis-arc-ui-ux-review`, `guis-arc-cloudflare-deployment`다.
- 기본 흐름은 architecture-review → implement 또는 bug-investigation → code-review → test-generator → api-contract-validator → migration-data-integrity → security-audit → ui-ux-review → browser-e2e → cloudflare-deployment → verify → package다. 모든 작업에 전부 적용하지 않고 필요한 Skill만 선택한다.
- 역할이 겹치는 Skill을 만들지 않으며 실제로 읽은 Skill만 적용했다고 보고한다.
- 상세 원칙 원본은 `DEVELOPMENT_RULES.md`다. 현재 사용자 요청, `VERSION.md`, 실제 코드와 `AIOS/PROJECT_STATE.md`가 Skill보다 우선한다.
- 오래된 Skill과 현재 코드가 충돌하면 실행 전에 충돌과 근거를 보고한다.

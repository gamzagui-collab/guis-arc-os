# GUI's Arc Integrated v0.27.1

GUI's Arc Integrated는 현장 운영을 위한 단일 제품 모듈형 애플리케이션입니다.

- 제품 버전: `v0.27.1`
- Static revision: `v0.27.1-r38`
- 공식 branch: `v0.27.0-official`
- Production: 미배포

현재 checkpoint는 모바일 Issue 음성 입력, canonical·unresolved 위치 처리, 사진 편집, 공유 워터마크, 다중사진 등록과 사진보기 탐색을 포함합니다. Integration 자동·브라우저 검증과 실제 모바일 smoke를 통과했습니다.

## 개발 시작

항상 읽는 문서는 `AGENTS.md`, `VERSION.md`, `DEVELOPMENT_RULES.md`입니다. 과거 설계와 계획 문서는 해당 작업과 직접 관련될 때만 참고합니다.

변경 범위별 검증은 `DEVELOPMENT_RULES.md`를 따릅니다. 공식 release checkpoint에서는 `npm test`, `npm run check:syntax`, `npm run validate`, `npm run build`와 필요한 조건부 검사를 실행합니다.

# GUI's Arc OS v9.4.0 배포 안내

이 ZIP은 v9.3.9 Stable 백업본을 기준으로 실제 프로젝트에 v9.4.0 일정탭 UI를 반영한 전체 프로젝트입니다.

## 적용 방법

1. 현재 사용 중인 `guis-arc-OS-enterprise` 폴더를 복사해서 백업합니다.
2. 이 ZIP을 압축 해제합니다.
3. 압축 해제된 파일 전체를 기존 `guis-arc-OS-enterprise` 폴더에 덮어씁니다.
4. PowerShell에서 프로젝트 루트로 이동합니다.
5. 아래 명령으로 배포합니다.

```powershell
npm run deploy:pages
```

## 확인할 화면

- 일정 탭
- 월간 달력 표시
- 이전달 / 오늘 / 다음달 버튼
- 날짜 클릭 시 우측 상세패널 변경
- 일정 추가 / 수정 / 삭제
- 공종 / 세부공종 / 위치 / 상태 입력

## 버전 동기화

- package.json: 9.4.0
- frontend/js/services/version.js: 9.4.0
- wrangler.toml: 9.4.0
- wrangler.worker.toml: 9.4.0
- CHANGELOG.md: v9.4.0 기록 추가
- docs/NEXT_CHAT_HANDOFF_PROMPT.md: v9.4.0 인수인계 추가

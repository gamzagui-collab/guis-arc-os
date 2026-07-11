# GUI's Arc OS v9.5.0 배포 안내

## 적용 방식
1. 기존 `guis-arc-OS-enterprise` 폴더를 백업합니다.
2. 이 ZIP의 내용을 프로젝트 폴더에 전체 덮어씌웁니다.
3. PowerShell에서 아래 명령을 실행합니다.

```powershell
npm run sync:version
npm run deploy:pages
```

## v9.5.0 핵심
- 안전관리 탭을 일정·날씨·공종/점검 DB와 연결했습니다.
- 오늘 할 일, AI 안전 점검요약, TBM 전달사항을 자동 생성합니다.
- 안전관리자 정기업무 일정표를 매일/주 1회/2주 1회/월 2회 기준으로 구성했습니다.
- 임박 또는 오늘 처리할 정기업무는 안전관리 오늘 할 일에 자동 반영됩니다.

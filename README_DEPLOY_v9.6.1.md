# GUI's Arc OS v9.6.1 적용

1. 기존 작업 폴더를 백업합니다.
2. 이 ZIP의 전체 내용을 프로젝트 폴더에 덮어씁니다.
3. PowerShell에서 실행합니다.

```powershell
npm run sync:version
npm run deploy:pages
```

배포 후 안전관리 탭을 열어 기존 일정이 있어도 화면 로딩 오류가 발생하지 않는지 확인합니다.

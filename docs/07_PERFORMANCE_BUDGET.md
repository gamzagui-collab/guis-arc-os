# Performance Budget

- App Shell JS+CSS gzip: 150KB 이하
- login UI JS gzip: 50KB 이하 목표
- 권한 없는 module code eager load 금지
- route module은 향후 dynamic import
- image lazy loading
- API cache는 사용자·현장 context를 키에 포함

`npm run audit:performance`가 실제 gzip byte를 `dist/performance-report.json`에 기록한다. 시간 목표는 원격 Browser E2E가 수행되기 전 PASS로 선언하지 않는다.

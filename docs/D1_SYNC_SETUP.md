# v7.6 D1 Site Sync 적용

v7.6은 현장코드 + PIN으로 D1 서버 데이터를 불러오는 구조를 강화합니다.

## D1 스키마 재적용

기존 데이터가 중요하면 먼저 백업하세요. 현재 schema.sql은 DROP TABLE을 포함합니다.

```powershell
wrangler d1 execute guis_arc_os --remote --file=database/d1/schema.sql
wrangler d1 execute guis_arc_os --remote --file=database/d1/seed.sql
```

## Worker 배포

```powershell
wrangler deploy backend/src/index.js --name guis-arc-os-api
```

## Pages 배포

```powershell
wrangler pages deploy frontend --project-name=guis-arc-os-enterprise
```

## 테스트

Worker:

```text
https://guis-arc-os-api.<계정명>.workers.dev/health
```

앱에서 샘플 현장:

```text
현장코드: DEMO-001
PIN: 1234
```

## 주의

frontend/js/services/api.js의 기본 API 주소는 `https://guis-arc-os-api.workers.dev`입니다.  
실제 Worker 주소가 다르면 브라우저 콘솔에서 아래를 한 번 실행하세요.

```js
localStorage.setItem("guisArcApiBase", "실제 Worker 주소")
```

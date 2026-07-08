# GUI's Arc OS v8.0 Core UI

- 대시보드를 현장 OS 홈 화면으로 개편
- 오늘 위험도 / 날씨 / 일정 / AI 브리핑 / 기본 체크 카드화
- `wrangler.toml`에서 KV placeholder 제거
- 배치파일 한글 깨짐 방지 개선

배포:

```powershell
wrangler deploy backend/src/index.js --name guis-arc-os-api
wrangler pages deploy frontend --project-name=guis-arc-os
```

# GUI's Arc OS 설치·배포 안내

## 현재 이름

- 공식명: **GUI's Arc OS**
- 설명: **Construction Site Operating System**
- GitHub 저장소: `guis-arc-OS-enterprise`
- Cloudflare Pages 프로젝트명: `guis-arc-os-enterprise`
- Worker 권장 이름: `guis-arc-os-api`
- D1 DB 권장 이름: `guis_arc_os`

## 적용

현재 `guis-arc-OS-enterprise` 폴더에서 이 ZIP 내용을 덮어쓴 뒤:

```powershell
git add .
git commit -m "Brand as GUI's Arc OS"
git push
```

Pages 수동 배포:

```powershell
wrangler pages deploy frontend --project-name=guis-arc-os-enterprise
```

Worker 배포:

```powershell
wrangler deploy backend/src/index.js --name guis-arc-os-api
```

## D1 설정

`wrangler.toml`의 D1은 아래처럼 유지합니다.

```toml
[[d1_databases]]
binding = "DB"
database_name = "guis_arc_os"
database_id = "a3401472-178f-454d-84d9-d25b7515aadb"
```

## 다음 개발 순서

1. v7.0 Core OS: 게스트/현장코드+PIN/D1 저장 안정화
2. v7.1 Weather Intelligence: v6.4 예보 비교 기능 이관
3. v7.2 Schedule: 타설계획/장비운영/자재반입 상세화
4. v7.3 Knowledge DB: 공종·KCS·법령·품질·안전 DB 확장
5. v7.4 AI Assistant: 업무지시·TBM·사고위험·품질·감리지적 자동 요약

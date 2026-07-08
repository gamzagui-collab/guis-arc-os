# GUI's Arc OS v7 배포 절차

기존 GUI's Arc v6.4는 그대로 둡니다. v7은 새 GitHub 저장소와 새 Cloudflare Pages 프로젝트로 배포합니다.

## 1. GitHub 새 저장소 생성

추천 이름:

```text
guis-arc-os
```

## 2. 로컬에서 업로드

```bash
cd guis-arc-os-v7-starter
git init
git add .
git commit -m "Initial GUI's Arc OS v7"
git branch -M main
git remote add origin https://github.com/gamzagui-collab/guis-arc-os.git
git push -u origin main
```

## 3. Cloudflare D1 생성

```bash
npx wrangler d1 create guis_arc_os
```

출력된 database_id를 `wrangler.toml`에 입력합니다.

## 4. D1 테이블 생성

```bash
npx wrangler d1 execute guis_arc_os --remote --file=database/d1/schema.sql
npx wrangler d1 execute guis_arc_os --remote --file=database/d1/seed.sql
```

## 5. Worker 배포

```bash
npx wrangler deploy backend/src/index.js --name guis-arc-os-api
```

## 6. Cloudflare Pages 새 프로젝트

- Project name: `guis-arc-os`
- Repository: `guis-arc-os`
- Framework preset: None
- Build command: 비움
- Build output directory: `frontend`

## 7. 접속

```text
https://guis-arc-os.pages.dev
```

## 8. 기존 v6.4 유지

기존 `construction-weather-v3.pages.dev`는 안정판으로 남깁니다.

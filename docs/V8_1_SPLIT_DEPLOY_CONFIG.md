# GUI's Arc OS v8.1 Split Deploy Config

## 목적

Cloudflare Wrangler 4.x에서 Pages 설정과 Worker 설정이 충돌하지 않도록 분리했습니다.

## 파일

### `wrangler.toml`
기본 Worker 전용 설정입니다.

### `wrangler.worker.toml`
Worker 배포 전용 설정입니다.

```powershell
wrangler deploy --config wrangler.worker.toml
```

### `wrangler.pages.toml`
Pages 설정 참고용입니다.  
수동 Pages 배포는 아래 명령을 사용합니다.

```powershell
wrangler pages deploy frontend --project-name=guis-arc-os-enterprise
```

## 배치파일

```powershell
.\scripts\deploy-worker-only.bat
.\scripts\deploy-pages-only.bat
.\scripts\deploy.bat
.\scripts\doctor.bat
```

## 표준 Cloudflare 이름

- Pages: `guis-arc-os-enterprise`
- Worker: `guis-arc-os-api`
- D1: `guis_arc_os`

## 권장 배포 순서

먼저 Pages만 확인:

```powershell
wrangler pages deploy frontend --project-name=guis-arc-os-enterprise
```

Worker 수정이 있을 때만:

```powershell
wrangler deploy --config wrangler.worker.toml
```

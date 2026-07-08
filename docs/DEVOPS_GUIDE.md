# GUI's Arc OS DevOps Guide

## 표준 이름

- GitHub 저장소: `gamzagui-collab/guis-arc-os`
- Cloudflare Pages 프로젝트: `guis-arc-os`
- Worker 이름: `guis-arc-os-api`
- D1 DB 이름: `guis_arc_os`

## 회사 PC / 집 PC 공통 작업

작업 시작:

```powershell
scripts\update.bat
```

작업 후 배포:

```powershell
scripts\deploy.bat
```

## 배치파일

- `install.bat`: Git, Node, npm, Wrangler 점검
- `update.bat`: GitHub 최신 내용 받기
- `deploy.bat`: Git commit/push + Worker + Pages 배포
- `deploy-pages-only.bat`: Pages만 배포
- `deploy-worker-only.bat`: Worker만 배포
- `d1-reset-seed.bat`: D1 스키마/샘플 재적용
- `health-check.bat`: Worker health 확인

## 기존 v6.4는 그대로 유지

`construction-weather-v3`는 안정판으로 두고, `guis-arc-os`는 차세대 OS로 개발합니다.

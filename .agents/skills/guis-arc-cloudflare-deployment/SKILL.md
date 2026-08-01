---
name: guis-arc-cloudflare-deployment
description: GUI's Arc의 Cloudflare Pages·Workers·D1·R2·Binding·Secret 환경을 확인하고 승인된 Integration Migration·배포·사후 버전을 검증할 때 사용한다. 일반 구현이나 Production 자동 배포에는 사용하지 않는다.
---

# 목적
`guis-arc-deploy`의 조율 아래 Integration Cloudflare 자원을 안전한 순서로 배포한다.

## 사용 조건
- Integration D1·Worker·Pages 배포 또는 Cloudflare 환경 감사가 명시적으로 승인됐을 때 사용한다.

## 사용하지 않는 경우
- 로컬 구현·패키징만 요청됐거나 Production 승인이 없는 Production 작업에는 사용하지 않는다.

## 먼저 읽을 문서
Required file: `AGENTS.md`
Required file: `DEVELOPMENT_RULES.md`
Required file: `VERSION.md`
Required file: `AIOS/PROJECT_STATE.md`
Required file: `wrangler.integration.toml`
Required file: `wrangler.pages.toml`

## 예상 문제·부작용·충돌
환경 혼동, Migration 순서, Binding·캐시 불일치, Secret 노출과 부분 배포를 확인한다.

## 입력
승인 환경, 검증된 ZIP·SHA, Migration 목록, Worker·Pages 대상과 Build 결과.

## 절차
기준본·대상 확인 → 원격 Migration 목록 → 필요 시 Integration D1 적용 → Worker 배포·Health → Build → Pages 배포 → 버전·캐시·Binding 검증.

## 변경 허용 범위
승인된 Integration D1·Worker·Pages만 변경한다. R2·Secret은 요청 없이는 읽기 확인만 한다.

## 금지사항
Production 자동 배포, 설정 임의 변경, Secret 출력, Migration 건너뛰기, 위험한 삭제 명령을 금지한다.

## 테스트 및 검증
미적용 Migration 0건, Worker version·environment, Pages 제목·build.json·version.js·Service Worker 캐시를 확인한다.

## 완료 조건
Deployment ID·URL·버전과 Production 미변경이 확인된다.

## 결과 보고 형식
대상, Migration, Worker, Pages, URL·ID, 원격 검증, 캐시, 미실행 순서로 보고한다.

## NOT_EXECUTED 기준
원격 권한·네트워크·인증 세션이 없으면 해당 배포 또는 운영 E2E를 `NOT_EXECUTED`로 표시한다.

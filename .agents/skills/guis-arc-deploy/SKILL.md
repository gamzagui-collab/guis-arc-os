---
name: guis-arc-deploy
description: GUI's Arc의 승인된 Cloudflare Integration 배포 절차와 Worker·Pages·D1·R2 영향을 관리한다. 배포 계획, 실행, 명령 제공 또는 배포 검증 요청에 사용한다.
---

# GUI's Arc 배포

## 사용하지 않는 경우

- 로컬 구현·검증·패키징만 요청받았을 때
- Production 배포 승인이나 Integration 배포 범위가 없을 때

## 먼저 읽기

1. `AGENTS.md`
2. `VERSION.md`
3. `AIOS/PROJECT_STATE.md`
4. `DEVELOPMENT_RULES.md`
5. 현재 배포 계약·설정·Migration 목록과 릴리스 검증 결과

## 절차

1. 대상이 Integration인지 확인하고 Production과 분리한다.
2. 사용자 승인과 실행 권한을 확인한다.
3. Worker, Pages, D1 Migration, R2, Secret 영향을 각각 판정한다.
4. Migration 필요 시 적용 순서·대상 DB·롤백 가능성을 확인한다.
5. 기존 프로젝트 스크립트와 설정만 사용해 필요한 순서로 실행한다.
6. 실제 URL·버전·API·Browser E2E를 배포 범위에 맞게 검증한다.
7. 실행 권한이 없으면 복사 가능한 PowerShell 명령과 예상 결과를 제공한다.

## 금지사항

- Production 배포 또는 변경
- 검토하지 않은 외부 Cloudflare Skill 자동 사용
- Secret 출력·저장·전송
- 미적용 Migration·미배포 Worker·Pages를 배포 완료로 보고

## 완료 조건

- 대상 환경과 Worker·Pages·D1·R2·Secret 영향이 명확하다.
- 실제 실행 여부와 검증 결과가 구분되어 있다.
- 미배포라면 `NOT_EXECUTED` 또는 미배포로 보고한다.

## 결과 보고

대상 환경, 승인 상태, Migration, Worker, Pages, D1·R2·Secret 영향, 실행 명령, 검증, 배포 URL, 미실행 항목 순서로 보고한다.

## 목적
승인된 환경의 배포를 조율하고 전문 배포 Skill을 선택한다.
## 사용 조건
사용자가 Integration 또는 특정 환경 배포를 명시적으로 요청했을 때 사용한다.
## 먼저 읽을 문서
Required file: `AGENTS.md`
Required file: `DEVELOPMENT_RULES.md`
Required file: `VERSION.md`
Required file: `AIOS/PROJECT_STATE.md`
## 예상 문제·부작용·충돌
환경 혼동, 부분 배포, Migration 순서와 캐시 불일치를 확인한다.
## 입력
승인 환경, 검증 릴리스, 배포 대상과 설정.
## 변경 허용 범위
승인된 환경과 자원만 변경한다.
## 테스트 및 검증
전문 Skill 결과와 원격 버전·URL·Deployment ID를 확인한다.
## 결과 보고 형식
환경, Migration, Worker, Pages, 검증, URL, 미실행 순서로 보고한다.
## NOT_EXECUTED 기준
권한·네트워크·계정 부재로 실행하지 못한 단계를 분리한다.

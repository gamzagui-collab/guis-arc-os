---
name: guis-arc-package
description: GUI's Arc의 검증된 릴리스를 단일 Integrated ZIP으로 패키징하고 SHA-256과 내부 버전을 확인한다. 공식 버전 결과물 생성·검증 요청에 사용한다.
---

# GUI's Arc 패키징

## 사용하지 않는 경우

- 검증되지 않은 변경이나 버전이 확정되지 않았을 때
- 단순 진단·구현 중간 단계일 때

## 먼저 읽기

1. `AGENTS.md`
2. `VERSION.md`
3. `AIOS/PROJECT_STATE.md`
4. `DEVELOPMENT_RULES.md`
5. `CHANGELOG.md`, `BASELINE.json`, 버전 검증·패키징 스크립트

## 절차

1. 모든 버전 표면과 CHANGELOG를 동기화한다.
2. 필수 전체 검증이 통과했는지 확인한다.
3. 동일 버전 ZIP 존재 여부를 확인하고 다른 결과물을 덮어쓰지 않는다.
4. 공식 `scripts/package-integrated.mjs`를 사용한다.
5. ZIP과 `.sha256`을 생성하고 SHA-256을 다시 계산한다.
6. ZIP 내부의 VERSION, package, Skill·상태 문서 포함 여부를 확인한다.
7. 결과 경로, 크기, 해시를 보고한다.

## 금지사항

- 같은 버전 번호의 서로 다른 ZIP 생성
- 검증 실패 상태의 공식 패키징
- Secret·자격증명·세션·로컬 운영 데이터 포함
- 패키징을 Integration 또는 Production 배포로 보고

## 완료 조건

- 단일 버전 ZIP과 대응 `.sha256`이 존재한다.
- 재계산 해시와 파일의 해시가 일치한다.
- ZIP 내부 버전·필수 문서·Skill이 확인되었다.

## 결과 보고

버전, 기준본, 검증 상태, ZIP 경로, ZIP 크기, SHA-256, 내부 확인, 배포 여부 순서로 보고한다.

## 액션 피드백 패키징

- 액션 피드백 변경의 테스트 결과와 미실행 Browser 검증을 구분한 뒤 패키징한다.

## 목적
검증된 버전과 문서를 단일 Integrated ZIP·SHA-256으로 조율한다.
## 사용 조건
공식 릴리스 결과물 생성과 내부 검증이 필요할 때 사용한다.
## 먼저 읽을 문서
Required file: `AGENTS.md`
Required file: `DEVELOPMENT_RULES.md`
Required file: `VERSION.md`
Required file: `AIOS/PROJECT_STATE.md`
## 예상 문제·부작용·충돌
동일 버전 덮어쓰기, 누락 파일, 버전 불일치와 Secret 포함을 확인한다.
## 입력
검증 결과, 버전 표면, 포함 계약과 기준 ZIP.
## 변경 허용 범위
버전·릴리스 문서와 패키징 결과물만 변경한다.
## 테스트 및 검증
ZIP 목록, 재계산 해시와 `.sha256` 일치를 확인한다.
## 결과 보고 형식
버전, 기준본, 검증, ZIP, 크기, SHA, 내부 파일, 배포 여부 순서로 보고한다.
## NOT_EXECUTED 기준
검증이나 내부 확인이 없으면 공식 패키지 완료로 보고하지 않는다.

# 내부 테스트 현장 격리 계약

## 목적

Integration의 동일 서버·애플리케이션·D1에서 역할별 기능을 검증하되 운영 현장 데이터와 테스트 데이터를 섞지 않는다. 별도 서버나 DB, 회사·사용자·Issue별 테스트 플래그를 만들지 않는다.

## 원본과 경계

- `sites.purpose`가 `OPERATIONAL` 또는 `INTERNAL_TEST`를 가진다.
- 테스트 데이터의 유일한 업무 경계는 내부 테스트 현장의 `site_id`다.
- 회사는 현재 현장의 활성 `company_site_contracts`, 담당자는 현재 현장의 활성 Membership, 근로자는 현재 현장의 승인된 Enrollment로 검증한다.
- Issue·Workforce·Today·Construction·Safety·Quality의 현장 화면과 집계는 선택된 `site_id`를 그대로 사용한다.
- 여러 현장을 합산하는 운영 조회를 추가할 때는 `sites.purpose='OPERATIONAL'`을 명시한다. 내부 테스트 현장을 직접 선택한 현장 조회에는 테스트 데이터가 포함된다.

## Membership 격리

- 운영 Membership이 있는 일반 사용자에게 내부 테스트 Membership을 추가할 수 없다.
- 내부 테스트 Membership이 있는 테스트 계정에 운영 Membership을 추가할 수 없다.
- `PLATFORM_OWNER`, `INTEGRATED_OWNER`만 명시적 Membership을 통해 양쪽 용도 현장에 접근할 수 있다.
- 마스터라는 이유로 회사·담당자·근로자 선택 범위를 넓히지 않는다. 선택 목록은 언제나 현재 현장 관계를 사용한다.

## 화면

- 현장 선택기는 운영 현장을 `운영 현장`, 내부 테스트 현장을 `개발 도구`로 구분한다.
- 내부 테스트 현장을 선택하면 모든 화면 상단에 `내부 테스트 현장 / 실제 업무 데이터가 아닙니다.` 문구를 표시한다.
- 표시는 색상에만 의존하지 않는다.

## Integration fixture

`npm run internal-test:manage -- plan|apply|show|disable|enable`을 사용한다. 명령은 `GUI_ARC_TARGET=integration`과 보호된 provisioning secret이 없으면 실패한다. `apply`만 `GUI_ARC_INTERNAL_TEST_PIN`의 공통 4자리 숫자 PIN 하나를 요구하며 반복·연속된 단순 PIN은 거부한다. CLI는 운영 계정과 동일하게 계정마다 별도 salt와 PBKDF2-SHA256 100,000회 hash를 만들고 서버에는 hash·salt·iteration만 전달하며 PIN 원문을 저장·전송·출력하지 않는다. `plan`, `show`, `disable`, `enable`에는 PIN이 필요 없다. 재실행은 고정 namespace를 갱신하고, `disable`은 비활성화하며 물리 삭제하지 않는다.

기존 `e2e-v021` namespace는 내부 테스트 현장으로 편입한다. Production 실행, Migration 기반 계정 생성, 자동 로그인, 실제 사용자·회사·현장 변경과 prefix 기반 삭제를 금지한다.

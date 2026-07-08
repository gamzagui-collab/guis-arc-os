# v7.7 설정 · 백업 · API 주소 관리

## 목적

PC가 바뀌어도 설정과 게스트 데이터를 쉽게 옮길 수 있게 합니다.

## 추가된 기능

- 설정 탭
- Worker API 주소 저장
- API /health 테스트
- 글자 크기/고대비/화면 밀도 설정
- 게스트 데이터 JSON 백업/복원
- Worker `/admin/status` 기반

## 실제 Worker 주소 설정

앱에서 설정 탭 → Worker API 주소에 실제 주소를 입력합니다.

예:

```text
https://guis-arc-os-api.<계정명>.workers.dev
```

## 백업

설정 탭 → 백업 다운로드

## 복원

설정 탭 → 백업 복원 → JSON 선택

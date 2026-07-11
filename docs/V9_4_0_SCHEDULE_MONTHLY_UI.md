# v9.4.0 Schedule Monthly UI Foundation

GUI's Arc OS v9.4.0은 일정 탭을 현장 의사결정 플랫폼의 중심 화면으로 확장하기 위한 첫 단계이다.

## 적용 내용

- 월간 달력 UI
- 이전달 / 다음달 / 오늘 이동
- 날짜 클릭 및 선택 상태 표시
- 우측 상세 패널
- 일정 추가 / 수정 / 삭제
- 공종 / 세부공종 / 위치 / 상태 데이터 구조 준비
- 기존 타설 / 자재 / 장비 빠른 추가 기능 유지

## 데이터 구조

```js
{
  id,
  date,
  title,
  description,
  type,
  trade,
  subTrade,
  location,
  status,
  checklist,
  createdAt,
  updatedAt
}
```

## 다음 확장 방향

- v9.5.0 공종 DB 연동
- v9.6.0 공정 진도 / 간트 차트
- v9.7.0 날씨와 일정 위험도 연동
- v9.8.0 안전·품질 체크리스트 자동 연결

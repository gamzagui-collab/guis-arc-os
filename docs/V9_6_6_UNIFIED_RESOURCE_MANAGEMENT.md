# GUI's Arc OS v9.6.6

## 목표
공정 DB에서 필요한 자재와 장비를 Work Instance별로 자동 생성하고 모든 관리 탭과 같은 Work ID를 공유한다.

## 통합 구조
- 기준: Process Database `materialsEquipment`
- 실행: Work Instance Database
- 기록: `workResources`
- 연결키: `WORK-YYYYMMDD-NNN`

## 관리 항목
- 자재/장비 구분
- 품명 및 장비명
- 수량과 단위
- 업체·담당자
- 반입·배치 예정일
- 필요/발주/반입예정/준비완료/사용중/반출완료 상태
- 자재 검수 및 장비 점검 여부
- 보관·배치 위치

## 마이그레이션
기존 Work Instance를 순회해 공정 DB 기준 자원 항목을 생성한다. 기존 일정, 오늘업무, 안전, 품질, 공사 데이터는 변경하지 않는다.

# GUI's Arc OS v9.6.3 — Work Instance DB

## 핵심 변경
- 통합 `workInstances` 저장소와 `tasks` 저장소 추가
- 일정과 오늘업무가 동일한 `WORK-YYYYMMDD-NNN` ID 사용
- 기존 일정·오늘업무 데이터 최초 실행 시 자동 마이그레이션
- 공정 DB를 기준으로 TBM, 안전점검, 필요서류, 품질체크, 공사체크 Task 자동 생성
- 일정 수정·이동·삭제 시 연결 Work Instance와 Task 동기화
- 안전관리 오늘업무가 개별 탭 데이터가 아니라 통합 Work Instance DB를 참조

## 데이터 원칙
새 기능별 DB를 만들지 않고 `Process DB → Work Instance DB → Task DB` 구조를 확장한다.

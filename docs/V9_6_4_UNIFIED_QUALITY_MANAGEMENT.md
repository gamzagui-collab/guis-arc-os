# GUI's Arc OS v9.6.4 — Unified Quality Management

## 목적
품질관리 탭이 별도 데이터를 생성하지 않고 v9.6.3의 Work Instance DB와 Task DB를 직접 참조하도록 확장한다.

## 통합 구조
- Work Instance: 실제 작업의 공통 기준
- QUALITY_CHECK Task: 공정 DB에서 자동 생성된 품질 체크
- Quality Inspection: 검측 상태·확인자·결과
- Quality Test: 시험명·예정일·완료 상태
- Specimen: 콘크리트 작업의 공시체 계획과 시험 일정
- Quality Photo: Work ID에 연결된 품질 증빙 메타데이터

## 자동 동작
1. 일정 또는 오늘업무에 공정을 등록한다.
2. 동일 Work ID로 품질체크 Task가 생성된다.
3. 품질관리의 오늘 품질업무에서 해당 작업을 바로 확인한다.
4. 콘크리트 작업은 공시체 계획을 생성할 수 있다.
5. 검측·시험·사진 기록은 모두 동일 Work ID에 저장된다.

## 마이그레이션
기존 타설과 공시체 기록은 날짜·콘크리트 작업·위치를 기준으로 가능한 범위에서 Work ID에 자동 연결한다.

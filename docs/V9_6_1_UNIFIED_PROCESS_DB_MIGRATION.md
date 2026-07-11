# v9.6.1 Unified Process DB Migration

## 목적
일정, 오늘업무, 안전관리, 향후 품질·공사·자재·장비 관리가 하나의 공정 지식 DB를 참조하도록 데이터 구조를 통일한다.

## 핵심 변경
- 기존 일정 데이터의 `type/category`, `subTrade/subProcess`, `processId` 누락을 자동 보정한다.
- 기존 오늘업무 데이터의 빈 항목과 구형 구조를 자동 정리한다.
- `processId`가 있으면 공정 DB를 최우선으로 참조한다.
- `processId`가 없는 구형 데이터는 제목·공종·세부공종 문자열로 공정 DB를 찾아 연결한다.
- 안전관리 화면은 데이터 일부가 비어 있어도 중단되지 않는다.

## 통합 기준
모든 업무 레코드는 가능한 경우 `processId`를 핵심키로 사용한다. 공정 지식은 `frontend/js/data/processIntegrationDatabase.js`에서 관리한다.

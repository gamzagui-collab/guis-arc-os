# Safety document work contract

`periodic_task_definitions`는 어떤 안전 서류가 언제 발생하는지 정의한다. `periodic_task_instances`는 날짜·기간별 실제 작성 업무다. `periodic_task_checklist_results`는 서류 구성 데이터이며 최종 산출물이 아니다. `periodic_task_documents`는 제출·검토·승인 당시의 완성 데이터 snapshot과 revision을 보존한다.

초안은 현장, 날짜, 출역, 공사일보, 미종결 위험 사례와 개선조치 데이터를 읽어 구성한다. 원본 모듈 데이터를 수정하지 않는다. 확인되지 않은 예시는 법정 의무로 표시하지 않으며 `basis_type`, 근거명과 문서 위치를 함께 저장한다.

Documents 정식 기능 전까지 Safety 문서보관은 snapshot 조회만 제공한다. 출력·다운로드·보존기간 집행을 완성된 기능으로 표시하지 않는다.

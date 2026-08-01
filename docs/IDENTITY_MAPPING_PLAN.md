# Identity Mapping Plan

매핑 table 후보:

- `legacy_platform_user_id -> integrated_user_id`
- `legacy_os_user_id -> integrated_user_id`
- `legacy_issue_user_id -> integrated_user_id`
- legacy company/site ID와 integrated company/site ID

전화번호는 국가코드 canonical form, 이메일은 trim/NFKC/domain lowercase 정책을 적용한다. 동일 이름은 병합 근거가 아니다. 자동·수동·거부 상태와 근거, 승인자, rollback reference를 감사 기록으로 남긴다.

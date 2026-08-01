# Construction inspection contract

공정별 시공 검측은 시공 상태와 다음 공정 진행 조건을 확인한다. canonical board key는 `CONSTRUCTION_INSPECTION`이다.

상태는 `DRAFT → REQUESTED → UNDER_REVIEW → APPROVED`, 보완 시 `REVISION_REQUESTED → RESUBMITTED`, 취소 시 `CANCELLED`이다. 협력업체는 소속 회사 검측만 작성·조회하며 원도급사 현장 관리자만 검토·보완 요청·승인한다. 승인 시 부적합·미확인 항목이 없어야 한다.

감리가 시스템 사용자가 아닌 경우 사용자 승인으로 위조하지 않는다. 외부 확인자, 확인 일시, 증빙 문서와 등록자를 별도 증빙으로 저장한다.

export const ROLE_LABELS={
 PLATFORM_OWNER:"마스터",INTEGRATED_OWNER:"마스터",SITE_MANAGER:"현장소장",
 GENERAL_CONTRACTOR_STAFF:"원도급사 직원",GENERAL_CONTRACTOR_FOREMAN:"총괄반장",
 CONSTRUCTION_MANAGER:"공사 담당자",SAFETY_MANAGER:"안전 담당자",QUALITY_MANAGER:"품질 담당자",
 MATERIALS_MANAGER:"자재 담당자",EQUIPMENT_MANAGER:"장비 담당자",
 CONTRACTOR_MANAGER:"협력업체 관리자",CONTRACTOR_SITE_MANAGER:"협력업체 현장소장",
 CONTRACTOR_FOREMAN:"반장",CONTRACTOR_EMPLOYEE:"협력업체 근로자",
 CONTRACTOR_ASSIGNEE:"협력업체 담당자",FIELD_WORKER:"현장 근로자"
};
export const MODULE_LABELS={today:"오늘",issue:"현장 이슈",workforce:"인력 관리",construction:"공사 관리",safety:"안전 관리",quality:"품질 관리",materials:"자재 관리",equipment:"장비 관리",documents:"문서 관리",admin:"통합 관리"};
export const STATUS_LABELS={
 ACTIVE:"활성",INACTIVE:"비활성",PENDING:"승인 요청 중",APPROVED:"승인 완료",REJECTED:"반려",
 SUSPENDED:"사용 중지",ACCEPTED:"사용 완료",EXPIRED:"만료",CANCELLED:"취소",REVOKED:"비활성",
 READY:"사용 가능",IMPLEMENTED:"구현됨",NOT_IMPLEMENTED:"준비 중",NO_PERMISSION:"권한 없음",
 OPEN:"미조치",COMPLETION_REQUESTED:"완료 확인",COMPLETED:"완료",
 PRESENT:"출역",ADJUSTED:"정정",CHECKED_OUT:"퇴장",
 DRAFT:"작성 중",SUBMITTED:"제출",REVISION_REQUESTED:"수정 요청",RESUBMITTED:"재제출",FINALIZED:"확정"
};
export const ACCESS_LABELS={NONE:"권한 없음",VIEW:"열람",EDIT:"수정",MANAGE:"관리"};
export const COMPANY_TYPE_LABELS={GENERAL_CONTRACTOR:"원도급사",SUBCONTRACTOR:"협력업체"};
export const DEPARTMENT_LABELS={CONSTRUCTION:"공사",SAFETY:"안전",QUALITY:"품질",ADMINISTRATION:"관리",UNCLASSIFIED:"미분류"};
const ISSUE_HISTORY_REASON_LABELS={
 "Issue created without assignment":"담당자 미배정 상태로 이슈가 등록되었습니다.",
 ISSUE_CREATED_WITHOUT_ASSIGNMENT:"담당자 미배정 상태로 이슈가 등록되었습니다.",
 "Issue created and assigned":"담당자가 배정된 상태로 이슈가 등록되었습니다.",
 ISSUE_CREATED_AND_ASSIGNED:"담당자가 배정된 상태로 이슈가 등록되었습니다."
};
const ERROR_MESSAGES={
 LOGIN_FAILED:"로그인 정보를 확인해 주세요.",UNAUTHORIZED:"로그인이 필요합니다.",SESSION_REQUIRED:"로그인이 필요합니다.",
 SESSION_INVALID:"세션이 만료되었습니다. 다시 로그인해 주세요.",SESSION_EXPIRED:"로그인 시간이 만료되었습니다.",
 CSRF_INVALID:"요청 검증에 실패했습니다. 새로고침 후 다시 시도해 주세요.",
 CONTEXT_VERSION_STALE:"현장 정보가 변경되었습니다. 새로고침 후 다시 시도해 주세요.",
 SITE_CONTEXT_REQUIRED:"현장을 선택해 주세요.",SITE_SCOPE_DENIED:"현재 현장에 접근할 수 없습니다.",
 TODAY_SITE_SCOPE_DENIED:"오늘 화면을 열 수 있는 현장 소속 정보가 없습니다.",
 BOARD_VIEW_DENIED:"게시판 열람 권한이 없습니다.",BOARD_EDIT_DENIED:"게시판 수정 권한이 없습니다.",
 BOARD_MANAGE_DENIED:"게시판 관리 권한이 없습니다.",BOARD_ACCESS_DENIED:"게시판 접근 권한이 없습니다.",
 BOARD_ACCESS_TARGET_DENIED:"대상 사용자는 현재 현장의 활성 사용자가 아닙니다.",
 BOARD_ACCESS_REVISION_CONFLICT:"다른 관리자가 권한을 변경했습니다. 새로고침 후 다시 시도해 주세요.",
 ISSUE_PERMISSION_DENIED:"이슈 작업 권한이 없습니다.",ISSUE_ENTITLEMENT_REQUIRED:"이슈 접근 권한이 없습니다.",
 WORKFORCE_PERMISSION_DENIED:"인력 관리 작업 권한이 없습니다.",WORKFORCE_ENTITLEMENT_REQUIRED:"인력 관리 접근 권한이 없습니다.",
 WORKFORCE_QR_SECRET_MISSING:"출역 QR 서명 설정이 필요합니다. 관리자에게 문의해 주세요.",
 WORKFORCE_SITE_INACTIVE:"비활성 현장에서는 출역 QR을 사용할 수 없습니다.",
 WORKFORCE_ENROLLMENT_NOT_APPROVED:"가입 승인 후 출역할 수 있습니다.",
 WORKFORCE_ENROLLMENT_NOT_FOUND:"가입 요청을 찾을 수 없습니다.",
 WORKFORCE_APPROVAL_INVALID:"승인 또는 반려 상태를 선택해 주세요.",
 WORKFORCE_ROLE_INVALID:"선택한 역할이 회사 유형과 맞지 않습니다.",
 WORKFORCE_REJECTION_REASON_REQUIRED:"반려 사유를 입력해 주세요.",
 WORKFORCE_BIRTH_DATE_REQUIRED:"생년월일을 입력해 주세요.",
 WORKFORCE_SELECTION_REQUIRED:"처리할 가입 요청을 선택해 주세요.",
 WORKFORCE_COMPANY_REQUIRED:"회사를 선택해 주세요.",WORKFORCE_COMPANY_SCOPE_DENIED:"해당 회사의 인력 정보에 접근할 수 없습니다.",
 WORKFORCE_TRADE_REQUIRED:"공종을 선택해 주세요.",WORKFORCE_TRADE_SCOPE_INVALID:"선택한 공종은 해당 회사의 현재 현장 계약 공종이 아닙니다.",
 WORKFORCE_TEAM_REQUIRED:"팀 또는 반을 선택해 주세요.",WORKFORCE_TEAM_INVALID:"선택한 팀 또는 반을 다시 확인해 주세요.",
 WORKFORCE_TEAM_SCOPE_DENIED:"본인 팀의 인력 정보만 처리할 수 있습니다.",WORKFORCE_TEAM_NAME_REQUIRED:"팀 또는 반 이름을 입력해 주세요.",
 WORKFORCE_TEAM_DUPLICATE:"같은 이름의 팀 또는 반이 이미 있습니다.",
 WORKFORCE_DUPLICATE_ATTENDANCE:"오늘 이미 출역 처리되었습니다.",WORKFORCE_ATTENDANCE_NOT_FOUND:"출역 기록을 찾을 수 없습니다.",
 WORKFORCE_CORRECTION_REASON_REQUIRED:"출역 정정 사유를 입력해 주세요.",
 WORKFORCE_REPORT_NOT_FOUND:"출력일보를 찾을 수 없습니다.",WORKFORCE_REPORT_STATE_INVALID:"현재 상태에서는 출력일보를 변경할 수 없습니다.",
 WORKFORCE_REPORT_REVISION_CONFLICT:"다른 사용자가 출력일보를 수정했습니다. 새로고침 후 다시 시도해 주세요.",
 WORKFORCE_DESCRIPTION_REQUIRED:"금일 작업내용을 입력해 주세요.",WORKFORCE_LOCATION_INVALID:"작업 위치를 다시 선택해 주세요.",
 WORKFORCE_EXCLUSION_REASON_REQUIRED:"출력일보에서 제외한 근로자의 사유를 입력해 주세요.",
 WORKFORCE_DIFFERENCE_REASON_REQUIRED:"출역 인원과 출력일보 인원의 차이 사유를 입력해 주세요.",
 WORKFORCE_REVISION_REASON_REQUIRED:"수정 요청 사유를 입력해 주세요.",
 QR_INVALID:"올바른 출역 QR이 아닙니다.",QR_TAMPERED:"변조된 출역 QR입니다.",
 QR_WRONG_SITE:"현재 가입된 현장의 QR이 아닙니다.",QR_EXPIRED:"출역 QR이 만료되었습니다. 새 QR을 스캔해 주세요.",
 QR_FUTURE_ISSUED:"출역 QR 발급 시각이 올바르지 않습니다.",
 IDEMPOTENCY_KEY_REQUIRED:"중복 방지 키가 필요합니다.",IDEMPOTENCY_PAYLOAD_MISMATCH:"같은 요청 키로 다른 내용을 처리할 수 없습니다.",
 CONSTRUCTION_CONFIRM_SAVE_FAILED:"공사일보 확정 데이터를 저장하지 못했습니다. 선택한 날짜는 확정되지 않았습니다. 잠시 후 다시 시도해 주세요.",
 INVITATION_UNAVAILABLE:"사용할 수 없는 초대입니다.",INVITATION_NOT_FOUND:"초대 정보를 찾을 수 없습니다.",
 INVITATION_INVALID:"유효하지 않은 초대입니다.",INVITATION_EXPIRED:"초대가 만료되었습니다.",
 INVITATION_ALREADY_USED:"이미 사용된 초대입니다.",INVITATION_CANCELLED:"취소된 초대입니다.",
 INVITATION_SCOPE_DENIED:"초대 관리 권한이 없습니다.",INVITATION_ADMIN_SCOPE_DENIED:"통합 관리 접근 권한을 부여할 수 없습니다.",
 INVITATION_ACCEPT_INVALID:"가입 정보를 확인해 주세요.",INVITATION_ROLE_SCOPE_DENIED:"회사·현장·역할 조합을 확인해 주세요.",
 INVITATION_ROLE_INVALID:"초대 역할을 사용할 수 없습니다.",INVITATION_EXPIRY_INVALID:"미래 만료일을 선택해 주세요.",
 INVITATION_NOT_CANCELLABLE:"취소할 수 없는 초대입니다.",PIN_INVALID:"PIN은 숫자 4자리여야 합니다.",PHONE_INVALID:"휴대전화 번호 숫자 11자리를 입력해 주세요.",
 COMPANY_CREATE_INVALID:"회사 등록 정보를 확인해 주세요.",COMPANY_UPDATE_INVALID:"회사 수정 정보를 확인해 주세요.",
 COMPANY_SCOPE_DENIED:"회사 관리 범위를 벗어났습니다.",SITE_CONTRACT_INVALID:"현장 참여 회사 정보를 확인해 주세요.",
 USER_ROLE_SCOPE_DENIED:"선택한 회사에 부여할 수 없는 역할입니다.",USER_ADMIN_SCOPE_DENIED:"해당 관리 권한을 부여할 수 없습니다.",
 LOCATION_INVALID:"위치 정보를 확인해 주세요.",UNIT_LOCATION_INVALID:"호수 정보를 확인해 주세요.",
 VALIDATION_ERROR:"잘못된 항목과 안내 문구를 확인해 주세요.",NOT_FOUND:"요청한 정보를 찾을 수 없습니다.",METHOD_NOT_ALLOWED:"지원하지 않는 요청입니다.",
 COMPANY_NAME_REQUIRED:"회사명을 입력해 주세요.",COMPANY_NAME_TOO_LONG:"회사명은 120자 이하로 입력해 주세요.",
 COMPANY_TYPE_REQUIRED:"회사 유형을 선택해 주세요.",COMPANY_TYPE_INVALID:"선택한 회사 유형이 올바르지 않습니다.",
 BUSINESS_NUMBER_REQUIRED:"사업자등록번호를 입력해 주세요.",BUSINESS_NUMBER_INVALID_LENGTH:"사업자등록번호는 숫자 10자리로 입력해 주세요.",
 BUSINESS_NUMBER_INVALID_FORMAT:"사업자등록번호에는 숫자만 입력할 수 있습니다.",BUSINESS_NUMBER_DUPLICATE:"이미 등록된 사업자등록번호입니다.",
 COMPANY_TRADES_REQUIRED:"표준 공종을 하나 이상 선택해 주세요.",COMPANY_TRADE_INVALID:"선택한 공종 정보를 다시 확인해 주세요.",
 TRADE_NOT_FOUND:"공종을 찾을 수 없습니다.",TRADE_INPUT_INVALID:"공종 입력값을 확인해 주세요.",TRADE_GROUP_INVALID:"중분류를 다시 선택해 주세요.",
 TRADE_KEY_INVALID:"공종 키는 영문 대문자와 숫자, 밑줄만 사용할 수 있습니다.",TRADE_KEY_DUPLICATE:"이미 사용 중인 공종 키입니다.",
 ISSUE_CONTRACT_TRADE_SCOPE_INVALID:"회사가 보유한 활성 공종만 계약 공종으로 선택할 수 있습니다.",
 ISSUE_CONTRACT_SCOPE_DENIED:"선택한 공종은 해당 회사의 현장 계약 공종이 아닙니다."
 ,CONSTRUCTION_REPORT_NOT_FOUND:"공사일보를 찾을 수 없습니다.",CONSTRUCTION_SITE_SCOPE_DENIED:"현재 현장의 공사일보에 접근할 수 없습니다.",
 CONSTRUCTION_CONTRACTOR_EDIT_DENIED:"협력업체 사용자는 공사일보 전체를 수정할 수 없습니다.",CONSTRUCTION_ROLE_EDIT_DENIED:"공사일보를 작성하거나 수정할 역할이 아닙니다.",
 CONSTRUCTION_STALE_REVISION:"다른 사용자가 먼저 공사일보를 변경했습니다. 최신 내용을 확인해 주세요.",CONSTRUCTION_OUTPUT_STALE:"참조 중인 출력일보가 변경되었습니다. 최신 내용을 확인해 주세요.",
 CONSTRUCTION_TODAY_WORK_REQUIRED:"금일 작업내용을 하나 이상 입력해 주세요.",CONSTRUCTION_MISSING_OUTPUT_REASON_REQUIRED:"출력일보를 제출하지 않은 업체의 사유를 입력해 주세요.",
 CONSTRUCTION_DIFFERENCE_REASON_REQUIRED:"출역 인원과 출력일보 인원이 다른 업체의 사유를 확인해 주세요.",CONSTRUCTION_FINALIZED_LOCKED:"확정된 공사일보는 일반 수정할 수 없습니다.",
 CONSTRUCTION_REVISION_REQUEST_REQUIRED:"수정 요청 내용을 입력해 주세요.",CONSTRUCTION_CHANGE_REASON_REQUIRED:"변경 사유를 입력해 주세요.",
 CONSTRUCTION_PHOTO_REQUIRED:"첨부할 현장 사진을 선택해 주세요.",CONSTRUCTION_PHOTO_UPLOAD_FAILED:"현장 사진 업로드에 실패했습니다. 다시 시도해 주세요.",
 CONSTRUCTION_XLSX_TOO_LARGE:"파일 크기가 너무 큽니다. 50MB 이하의 .xlsx 파일을 선택해 주세요.",
 CONSTRUCTION_XLSX_TYPE_INVALID:"지원하지 않는 파일입니다. .xlsx 파일을 선택해 주세요.",
 CONSTRUCTION_XLSX_SIGNATURE_INVALID:"지원하지 않는 파일입니다. .xlsx 파일을 선택해 주세요.",
 CONSTRUCTION_UPLOAD_SESSION_EXPIRED:"업로드 시간이 만료되었습니다. 파일을 다시 선택해 주세요.",
 CONSTRUCTION_UPLOAD_SESSION_NOT_FOUND:"업로드 정보를 찾을 수 없습니다.",
 CONSTRUCTION_UPLOAD_DATES_REQUIRED:"저장할 공사일보 날짜를 하나 이상 선택해 주세요.",
 CONSTRUCTION_DIRECT_UPLOAD_UNAVAILABLE:"공사일보 업로드 설정을 확인하고 있습니다. 잠시 후 다시 시도해 주세요.",
 CONSTRUCTION_ANALYSIS_SAVE_FAILED:"공사일보 분석 결과를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
 CONSTRUCTION_ANALYSIS_PAYLOAD_TOO_LARGE:"공사일보 분석 데이터의 크기가 처리 한도를 초과했습니다. 관리자에게 문의해 주세요.",
 CONSTRUCTION_MONTHLY_PLAN_REQUIRED:"필수 일정 정보를 입력해 주세요.",
 CONSTRUCTION_MONTHLY_PLAN_TEXT_TOO_LONG:"입력 가능한 글자 수를 초과했습니다.",
 CONSTRUCTION_MONTHLY_PLAN_DATE_INVALID:"일정 날짜를 확인해 주세요.",
 CONSTRUCTION_MONTHLY_PLAN_TIME_INVALID:"시간은 24시간 형식으로 입력해 주세요.",
 CONSTRUCTION_MONTHLY_PLAN_RANGE_INVALID:"종료일은 시작일보다 빠를 수 없습니다.",
 CONSTRUCTION_MONTHLY_PLAN_WORKFORCE_INVALID:"예정 인원은 0 이상의 정수로 입력해 주세요.",
 CONSTRUCTION_MONTHLY_PLAN_STATUS_INVALID:"일정 상태를 확인해 주세요.",
 CONSTRUCTION_MONTHLY_PLAN_COMPANY_INVALID:"현재 현장 참여 회사를 선택해 주세요.",
 CONSTRUCTION_MONTHLY_PLAN_NOT_FOUND:"월간 공사계획을 찾을 수 없습니다.",
 CONSTRUCTION_MONTHLY_PLAN_STALE:"다른 사용자가 먼저 일정을 변경했습니다. 최신 내용을 확인해 주세요.",
 CONSTRUCTION_MONTHLY_PLAN_CANCELLED:"취소된 일정은 수정할 수 없습니다."
};
const COMPANY_ERROR_MESSAGES=Object.fromEntries(Object.entries(ERROR_MESSAGES).filter(([key])=>key.startsWith("COMPANY_")||key.startsWith("BUSINESS_")));
export const companyErrorMessage=code=>COMPANY_ERROR_MESSAGES[code]||"회사를 등록하지 못했습니다. 입력 내용을 확인한 뒤 다시 시도해 주세요.";
export const roleLabel=value=>ROLE_LABELS[value]||value||"역할 없음";
export const moduleLabel=value=>MODULE_LABELS[value]||value||"알 수 없는 모듈";
export const statusLabel=value=>STATUS_LABELS[value]||value||"상태 없음";
export const accessLabel=value=>ACCESS_LABELS[value]||value||"권한 없음";
export const companyTypeLabel=value=>COMPANY_TYPE_LABELS[value]||value||"회사 유형 미지정";
export const departmentLabel=value=>DEPARTMENT_LABELS[value]||value||"미분류";
export function issueHistoryReasonLabel(value){
 const reason=String(value||"").trim();
 if(!reason)return "상세 사유 없음";
 if(ISSUE_HISTORY_REASON_LABELS[reason])return ISSUE_HISTORY_REASON_LABELS[reason];
 if(/(?:^|\n)\s*at\s+\S+|\b(?:Error|stack trace)\b/i.test(reason))return "상세 사유를 표시할 수 없습니다.";
 return reason;
}
export function errorMessage(body={},status=0){
 const code=typeof body==="string"?body:body?.error;if(ERROR_MESSAGES[code])return ERROR_MESSAGES[code];
 if(status===400)return "잘못된 항목과 안내 문구를 확인해 주세요.";if(status===401)return "로그인이 필요합니다.";
 if(status===403)return "이 작업을 수행할 권한이 없습니다.";if(status===404)return "요청한 정보를 찾을 수 없습니다.";
 if(status===409)return "다른 변경 사항과 충돌했습니다. 새로고침 후 다시 시도해 주세요.";
 if(status>=500)return "서버 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.";
 return "요청을 처리하지 못했습니다. 네트워크 연결을 확인해 주세요.";
}

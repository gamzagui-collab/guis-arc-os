export const placeholderProvider = (code, label, status = "PLACEHOLDER") => async () => ({
  code,
  label,
  implementationStatus: status,
  state: "NOT_IMPLEMENTED",
  message: "해당 모듈은 아직 준비 중입니다."
});

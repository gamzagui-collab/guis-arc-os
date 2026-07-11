export const WORK_DOCUMENT_DB = [
  {
    documentType:"WORK_PLAN",
    title:"작업계획서",
    ownerRole:"construction",
    supportRoles:["safety","resource","foreman"],
    referenceRoles:["director","quality"],
    purpose:"작업을 어떤 순서와 방법으로 수행할지 사전에 계획하는 문서입니다.",
    question:"이 작업을 어떻게 수행할 것인가?",
    contents:["작업순서·작업방법","투입 장비·인원","작업구역·동선","주요 위험요인과 안전조치","비상조치·연락체계"],
    completionRule:"작업조건과 실제 장비·인원·순서가 일치하고 필요한 검토가 완료됨",
    evidenceRequired:true,
    note:"법령상 작성 대상과 세부 책임은 작업 종류와 사업장 조직에 따라 달라질 수 있습니다. GUI's Arc OS의 기본 주담당은 공사관리로 두고 안전관리자는 위험요인·안전조치 검토에 협조합니다."
  },
  {
    documentType:"WORK_PERMIT",
    title:"작업허가서",
    ownerRole:"safety",
    supportRoles:["construction","foreman","resource"],
    referenceRoles:["director"],
    purpose:"당일 현장조건과 안전조치가 갖춰져 작업을 시작해도 되는지 확인하는 통제 문서입니다.",
    question:"오늘 이 작업을 시작해도 되는가?",
    contents:["위험요인 제거·통제 확인","보호구·안전시설 확인","감시자·신호수 배치","가스·전기·화재 등 작업별 조건 확인","허가자·작업책임자 확인"],
    completionRule:"작업 직전 현장조건 확인과 허가자 승인 완료",
    evidenceRequired:true,
    note:"모든 작업에 일률적으로 법정 의무인 문서는 아닙니다. 법령, 발주처 기준, 회사 안전보건관리규정 또는 현장 작업허가제 적용 여부를 구분해 관리합니다."
  }
];

export const DOCUMENT_BY_TYPE = Object.fromEntries(WORK_DOCUMENT_DB.map(x=>[x.documentType,x]));

export function classifyWorkDocument(title=""){
  const text=String(title);
  if(/작업허가|허가서/.test(text)) return DOCUMENT_BY_TYPE.WORK_PERMIT;
  if(/작업계획|계획서/.test(text)) return DOCUMENT_BY_TYPE.WORK_PLAN;
  return null;
}

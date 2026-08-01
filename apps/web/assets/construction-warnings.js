import {escapeHtml} from "../../../packages/ui/components.js";

const REVIEW_CODES=new Set(["TRADE_MATCH_REVIEW_REQUIRED","TRADE_MATCH_MULTIPLE_CANDIDATES","TRADE_MATCH_CONFLICT","TRADE_UNMATCHED","WORKFORCE_TOTAL_MISMATCH","WORKFORCE_INVALID","FORMULA_DATE_UNRESOLVED","DATE_UNRESOLVED","REQUIRED_HEADER_MISSING"]);
const BLOCK_CODES=new Set(["FORMULA_DATE_UNRESOLVED","DATE_UNRESOLVED","REQUIRED_HEADER_MISSING"]);
const LABELS={
 TRADE_MATCH_REVIEW_REQUIRED:["공종을 자동으로 확정하기 어렵습니다.","출력현황 공종과 작업내용의 공종 후보를 하나로 확정하지 못했습니다."],
 TRADE_MATCH_MULTIPLE_CANDIDATES:["여러 공종 후보가 확인되었습니다.","연결 가능한 공종 후보가 여러 개이므로 원문 확인이 필요합니다."],
 TRADE_MATCH_CONFLICT:["서로 다른 공종 후보가 충돌합니다.","자동 연결하면 안 되는 공종 후보가 함께 확인되었습니다."],
 TRADE_UNMATCHED:["연결할 공종을 찾지 못했습니다.","작업내용과 연결되는 현장 공종을 확인하지 못했습니다."],
 WORKFORCE_TOTAL_MISMATCH:["인원 합계가 원본 총계와 다릅니다.","개별 출력인원의 합계와 원본 총계가 일치하지 않습니다."],
 WORKFORCE_INVALID:["인원 값을 숫자로 확인할 수 없습니다.","원본 인원 값을 숫자로 해석하지 못했습니다."],
 FORMULA_DATE_UNRESOLVED:["수식 날짜를 확정할 수 없습니다.","저장된 수식 계산값이 없어 날짜 확인이 필요합니다."],
 DATE_UNRESOLVED:["공사일보 날짜를 확인할 수 없습니다.","원본에서 유효한 작업 날짜를 확정하지 못했습니다."],
 REQUIRED_HEADER_MISSING:["필수 공사일보 항목이 없습니다.","공사일보를 식별하는 필수 머리글을 찾지 못했습니다."],
 WORK_TEXT_UNCERTAIN:["작업내용 원문을 그대로 사용했습니다.","위치를 확실하게 분리하지 못해 입력된 문장을 보존했습니다."],
 COMPANY_BREAKDOWN_UNAVAILABLE:["회사별 인원 정보가 없습니다.","원본 공사일보에 회사명 정보가 없어 회사별 인원을 표시하지 않습니다."],
 OUTPUT_WITHOUT_WORK:["작업내용이 없는 출력 공종이 있습니다.","출력현황에는 있으나 대응 작업내용이 없어 노코멘트 항목으로 보완했습니다."],
 OUTPUT_WORKFORCE_FALLBACK:["출력현황 인원을 보완 적용했습니다.","대응 작업이 없는 공종의 출력현황 인원을 보완 항목으로 보존했습니다."]
};

export function presentConstructionWarning(item={}){
 const pair=LABELS[item.code]||["원본 내용을 확인해 주세요.",String(item.message||"공사일보 분석 중 확인할 내용이 발견되었습니다.")];
 const level=REVIEW_CODES.has(item.code)?"REVIEW":"REFERENCE",blocking=BLOCK_CODES.has(item.code);
 return {
  level,blocking,title:pair[0],description:pair[1],
  trade:item.tradeRaw||item.tradeName||item.canonicalTradeLabel||null,
  work:item.workDescription||item.rawWorkText||item.rawValue||null,
  source:item.sourceCellRange||item.cellRange||item.sourceRow?`${item.sourceSheetName?`${item.sourceSheetName} · `:""}${item.sourceCellRange||`행 ${item.sourceRow}`}`:null,
  automatic:level==="REFERENCE",
  action:blocking?"원본 날짜와 필수 항목을 수정한 뒤 다시 분석해 주세요.":level==="REVIEW"?"원본과 공종·인원 값을 확인해 주세요.":"자동 처리 또는 원문 보존 내용을 참고해 주세요."
 };
}

const warningItemHtml=item=>`<article class="construction-warning-item">
 <header><strong>${escapeHtml(item.title)}</strong><span>${item.blocking?"확정 차단":item.level==="REVIEW"?"확인 필요":"참고"}</span></header>
 <p>${escapeHtml(item.description)}</p>
 <dl>${item.trade?`<div><dt>관련 공종</dt><dd>${escapeHtml(item.trade)}</dd></div>`:""}${item.work?`<div><dt>관련 작업내용</dt><dd>${escapeHtml(item.work)}</dd></div>`:""}<div><dt>원본 위치</dt><dd>${escapeHtml(item.source||"원본 위치 정보 없음")}</dd></div><div><dt>자동 반영</dt><dd>${item.automatic?"자동 처리 또는 원문 보존":"직접 확인 필요"}</dd></div><div><dt>확인 사항</dt><dd>${escapeHtml(item.action)}</dd></div></dl>
</article>`;

export function constructionWarningsHtml(row){
 const warnings=(row.warnings||[]).map(presentConstructionWarning);
 if(!warnings.length)return "";
 const review=warnings.filter(item=>item.level==="REVIEW"),reference=warnings.filter(item=>item.level==="REFERENCE"),id=`warnings-${String(row.workDate||"unknown").replace(/[^0-9-]/g,"")}`;
 const hasBlocking=warnings.some(item=>item.blocking)||Number(row.blockingWarningCount)>0||["WARNING","INVALID"].includes(row.comparisonStatus),confirmation=hasBlocking?"확정 불가":review.length?"확인 후 확정 권장":"확정 가능";
 return `<section class="construction-warning-group">
  <button class="construction-warning-toggle" type="button" aria-expanded="false" aria-controls="${id}">경고 ${warnings.length}건 <span aria-hidden="true">▼</span></button>
  <div id="${id}" class="construction-warning-detail" hidden>
   <p class="construction-confirmation-state"><strong>${confirmation}</strong>${hasBlocking?" · 날짜 또는 필수 문서 구조를 확인해 주세요.":""}</p>
   ${review.length?`<section><h4>확인 필요 ${review.length}건</h4>${review.map(warningItemHtml).join("")}</section>`:""}
   ${reference.length?`<section><h4>참고 ${reference.length}건</h4>${reference.map(warningItemHtml).join("")}</section>`:""}
  </div>
 </section>`;
}

export function bindConstructionWarningToggles(root=document){
 root.querySelectorAll(".construction-warning-toggle").forEach(button=>{
  if(button.dataset.bound)return;button.dataset.bound="true";
  const toggle=()=>{const open=button.getAttribute("aria-expanded")!=="true",panel=root.querySelector(`#${CSS.escape(button.getAttribute("aria-controls"))}`);button.setAttribute("aria-expanded",String(open));if(panel)panel.hidden=!open};
  button.addEventListener("click",toggle);
  button.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "||event.key==="Spacebar"){event.preventDefault();toggle()}});
 });
}

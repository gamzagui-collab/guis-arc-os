import {SITE_TRADE_DICTIONARY} from "./site-trade-dictionary.js";
import {SITE_TRADE_CONFLICTS} from "./site-trade-conflicts.js";

export const SITE_TRADE_ALIAS_STATUSES=Object.freeze(["CONFIRMED","REGISTERED","REVIEW_REQUIRED"]);
export const isAutoMatchAlias=alias=>alias?.status==="CONFIRMED"||alias?.status==="REGISTERED";

const requiredText=(value,label)=>{
 if(typeof value!=="string"||!value.trim())throw new Error(`현장 공종 데이터 오류: ${label} 값이 비어 있습니다.`);
 return value.trim();
};
const normalizedAlias=value=>String(value??"").normalize("NFKC").replace(/[▶▷▸◆◇\s]+/g,"").trim();
const conflictKey=value=>[value.leftCanonicalTradeId,value.rightCanonicalTradeId].sort().join("::");

export function validateSiteTradeData(dictionary=SITE_TRADE_DICTIONARY,conflicts=SITE_TRADE_CONFLICTS){
 if(!Array.isArray(dictionary))throw new Error("현장 공종 데이터 오류: 공종 사전은 배열이어야 합니다.");
 if(!Array.isArray(conflicts))throw new Error("현장 공종 데이터 오류: 충돌 목록은 배열이어야 합니다.");
 const ids=new Set(),aliases=new Map();
 for(const [index,trade] of dictionary.entries()){
  const id=requiredText(trade?.canonicalTradeId,`공종 ${index+1} 표준 ID`);
  if(ids.has(id))throw new Error(`현장 공종 데이터 오류: 표준 공종 ID '${id}'가 중복되었습니다.`);
  ids.add(id);
  requiredText(trade.displayNameKo,`${id} 한글 표시명`);
  requiredText(trade.category,`${id} 분류`);
  if(trade.scope!=="SITE")throw new Error(`현장 공종 데이터 오류: ${id} 적용 범위는 SITE여야 합니다.`);
  if(!Array.isArray(trade.aliases))throw new Error(`현장 공종 데이터 오류: ${id} 별칭은 배열이어야 합니다.`);
  if(!Array.isArray(trade.keywords))throw new Error(`현장 공종 데이터 오류: ${id} 핵심어는 배열이어야 합니다.`);
  for(const alias of trade.aliases){
   const value=requiredText(alias?.value,`${id} 별칭`);
   if(!SITE_TRADE_ALIAS_STATUSES.includes(alias.status))throw new Error(`현장 공종 데이터 오류: '${value}'의 별칭 상태 '${alias.status}'는 허용되지 않습니다.`);
   const normalized=normalizedAlias(value);
   if(aliases.has(normalized)&&aliases.get(normalized)!==id)throw new Error(`현장 공종 데이터 오류: 정규화 별칭 '${normalized}'이 ${aliases.get(normalized)}와 ${id}에 중복되었습니다.`);
   aliases.set(normalized,id);
  }
 }
 const conflictKeys=new Set();
 for(const conflict of conflicts){
  const left=requiredText(conflict?.leftCanonicalTradeId,"충돌 왼쪽 공종 ID");
  const right=requiredText(conflict?.rightCanonicalTradeId,"충돌 오른쪽 공종 ID");
  if(left===right)throw new Error(`현장 공종 데이터 오류: ${left} 공종이 자기 자신과 충돌합니다.`);
  if(!ids.has(left)||!ids.has(right))throw new Error(`현장 공종 데이터 오류: 충돌 관계 ${left}/${right}가 존재하지 않는 공종을 참조합니다.`);
  requiredText(conflict.reasonKo,`${left}/${right} 충돌 사유`);
  if(conflict.scope!=="SITE")throw new Error(`현장 공종 데이터 오류: ${left}/${right} 충돌 범위는 SITE여야 합니다.`);
  const key=conflictKey(conflict);
  if(conflictKeys.has(key))throw new Error(`현장 공종 데이터 오류: 충돌 관계 ${left}/${right}가 중복되었습니다.`);
  conflictKeys.add(key);
 }
 return true;
}

validateSiteTradeData();

export {SITE_TRADE_DICTIONARY,SITE_TRADE_CONFLICTS};

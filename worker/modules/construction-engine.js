const DEPARTMENTS=Object.freeze(["CONSTRUCTION","SAFETY","QUALITY","ADMINISTRATION","UNCLASSIFIED"]);
export const DEPARTMENT_CODES=DEPARTMENTS;
export const DEPARTMENT_LABELS=Object.freeze({CONSTRUCTION:"공사",SAFETY:"안전",QUALITY:"품질",ADMINISTRATION:"관리",UNCLASSIFIED:"미분류"});

export function normalizeClassificationInput({title="",description="",tradeId=null}={}){
 const normalize=value=>String(value||"").normalize("NFKC").toLowerCase().replace(/\s+/g," ").trim();
 return {text:normalize(`${title} ${description}`),tradeId:tradeId?String(tradeId):null};
}
const parseList=value=>{try{const list=Array.isArray(value)?value:JSON.parse(value||"[]");return list.map(v=>String(v).normalize("NFKC").toLowerCase().trim()).filter(Boolean)}catch{return []}};
const scopeRank=rule=>rule.site_id?2:1;
const matchedRule=(rule,input)=>{
 if(!Number(rule.is_active??1))return null;
 if(rule.trade_id&&rule.trade_id!==input.tradeId)return null;
 const include=parseList(rule.include_keywords_json),exclude=parseList(rule.exclude_keywords_json);
 if(exclude.some(word=>input.text.includes(word)))return null;
 if(include.length&&!include.every(word=>input.text.includes(word)))return null;
 if(!include.length&&!rule.trade_id)return null;
 return {...rule,include,score:Number(rule.base_confidence),scope:scopeRank(rule)};
};
export function evaluateDepartmentRules(inputValue,rules=[]){
 const input=normalizeClassificationInput(inputValue),matches=rules.map(rule=>matchedRule(rule,input)).filter(Boolean).sort((a,b)=>b.scope-a.scope||Number(b.priority)-Number(a.priority)||b.score-a.score||String(a.id).localeCompare(String(b.id)));
 if(!matches.length)return {departmentCode:"UNCLASSIFIED",confidence:0,confidenceLabel:"UNCLASSIFIED",conflict:false,candidateDepartments:[],ruleIds:[],reasons:["일치하는 부서 규칙이 없습니다."]};
 const best=matches[0],leaders=matches.filter(rule=>rule.scope===best.scope&&Number(rule.priority)===Number(best.priority)),departments=[...new Set(leaders.map(rule=>rule.department_code))].sort();
 if(departments.length>1)return {departmentCode:"UNCLASSIFIED",confidence:Math.min(50,Math.max(...leaders.map(rule=>rule.score))),confidenceLabel:"REVIEW_REQUIRED",conflict:true,candidateDepartments:departments,ruleIds:leaders.map(rule=>rule.id),reasons:leaders.map(rule=>`${rule.rule_name}: ${rule.include.join(", ")||"공종"}`)};
 return {departmentCode:best.department_code,confidence:best.score,confidenceLabel:best.score>=85?"HIGH":"REVIEW_REQUIRED",conflict:false,candidateDepartments:[best.department_code],ruleIds:[best.id],reasons:[`${best.rule_name}: ${best.include.join(", ")||"공종"}`]};
}
export const buildDepartmentRecommendation=evaluateDepartmentRules;

export async function loadDepartmentRules(env,siteId){return (await env.DB.prepare("SELECT id,site_id,department_code,rule_name,include_keywords_json,exclude_keywords_json,trade_id,priority,base_confidence,source,is_active FROM construction_department_rules WHERE is_active=1 AND (site_id IS NULL OR site_id=?1) ORDER BY CASE WHEN site_id IS NULL THEN 1 ELSE 0 END,priority DESC,id").bind(siteId).all()).results}
export async function inputHash(input){const normalized=normalizeClassificationInput(input),bytes=new TextEncoder().encode(JSON.stringify(normalized)),digest=await crypto.subtle.digest("SHA-256",bytes);return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,"0")).join("")}
export async function recommendIssueDepartment(env,issue){
 try{const rules=await loadDepartmentRules(env,issue.site_id),result=evaluateDepartmentRules({title:issue.title,description:issue.description,tradeId:issue.trade_id},rules);return {...result,inputHash:await inputHash({title:issue.title,description:issue.description,tradeId:issue.trade_id}),engineError:false}}
 catch{return {departmentCode:"UNCLASSIFIED",confidence:0,confidenceLabel:"UNCLASSIFIED",conflict:false,candidateDepartments:[],ruleIds:[],reasons:["부서 추천을 생성하지 못했습니다."],inputHash:await inputHash({title:issue.title,description:issue.description,tradeId:issue.trade_id}),engineError:true}}
}
export async function persistRecommendationSnapshot(env,issue,result){
 await env.DB.prepare("INSERT INTO issue_department_recommendations(issue_id,site_id,recommended_department_code,confidence,confidence_label,conflict,reason_json,rule_ids_json,candidate_departments_json,input_hash) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10) ON CONFLICT(issue_id) DO UPDATE SET recommended_department_code=excluded.recommended_department_code,confidence=excluded.confidence,confidence_label=excluded.confidence_label,conflict=excluded.conflict,reason_json=excluded.reason_json,rule_ids_json=excluded.rule_ids_json,candidate_departments_json=excluded.candidate_departments_json,input_hash=excluded.input_hash,evaluated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP").bind(issue.id,issue.site_id,result.departmentCode,result.confidence,result.confidenceLabel,result.conflict?1:0,JSON.stringify(result.reasons),JSON.stringify(result.ruleIds),JSON.stringify(result.candidateDepartments),result.inputHash).run();
}

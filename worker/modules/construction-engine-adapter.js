import {ENGINE_CONTRACT_VERSION} from "../core/engine-contract.js";
import {inputHash,recommendIssueDepartment} from "./construction-engine.js";

export const CONSTRUCTION_DEPARTMENT_ENGINE=Object.freeze({
 engineName:"CONSTRUCTION_DEPARTMENT",
 engineVersion:"1.0.0",
 contractVersion:ENGINE_CONTRACT_VERSION,
 capabilities:["ISSUE_DEPARTMENT_RECOMMENDATION"],
 evaluate:context=>recommendIssueDepartment(context.env,context.issue),
 toRecommendation:value=>({code:value.departmentCode,confidence:value.confidence,label:value.confidenceLabel,reasonCodes:value.reasons,ruleIds:value.ruleIds,candidateCodes:value.candidateDepartments,requiresReview:value.conflict||value.confidenceLabel!=="HIGH",engineVersion:"1.0.0",success:!value.engineError,errorCode:value.engineError?"CONSTRUCTION_ENGINE_EVALUATION_FAILED":null})
});
export async function constructionEvaluationContext({env,issue,eventType,actorUserId,operationId}){return {env,issue,entityType:"ISSUE",entityId:issue.id,siteId:issue.site_id,entityRevision:Number(issue.revision),eventType,inputHash:await inputHash({title:issue.title,description:issue.description,tradeId:issue.trade_id}),actorUserId:actorUserId||null,operationId:operationId||null}}

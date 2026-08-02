import {compareRecommendations,engineVersion,limitedJson,validateEngineDefinition,validateEvaluationContext,validateRecommendation} from "./engine-contract.js";
import {createEngineRepository} from "./engine-repository.js";

const hashText=async value=>{const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,"0")).join("")};
export function createEngineSdk({db,clock=()=>Date.now(),uuid=()=>crypto.randomUUID()}={}){
 const repository=createEngineRepository(db);
 const register=async definition=>{validateEngineDefinition(definition);const definitionHash=await hashText(limitedJson({engineName:definition.engineName,engineVersion:definition.engineVersion,contractVersion:definition.contractVersion,capabilities:definition.capabilities||[]}));await repository.register({...definition,definitionHash});return engineVersion(definition)};
 const evaluate=async(definition,context)=>{
  validateEngineDefinition(definition);validateEvaluationContext(context);await register(definition);const started=clock();let value,recommendation,errorCode=null;
  try{value=await definition.evaluate(context);recommendation=validateRecommendation(definition.toRecommendation(value));}
  catch(error){errorCode=String(error?.message||"ENGINE_EVALUATION_FAILED").slice(0,120);throw error}
  finally{if(recommendation){errorCode=errorCode||recommendation.errorCode||null;const operationPart=context.eventType==="MANUAL_REQUEST"?`:${context.operationId||"NO_OPERATION"}`:"",idempotencyKey=`${context.entityType}:${context.entityId}:${context.entityRevision}:${context.eventType}:${context.inputHash}${operationPart}`,record=await repository.append({executionId:uuid(),...engineVersion(definition),entityType:context.entityType,entityId:context.entityId,siteId:context.siteId,entityRevision:Number(context.entityRevision),eventType:context.eventType,inputHash:context.inputHash,result:{code:recommendation.code,confidence:Number(recommendation.confidence),reasonCodes:recommendation.reasonCodes.slice(0,20),ruleIds:recommendation.ruleIds.slice(0,50),candidateCodes:(recommendation.candidateCodes||[]).slice(0,20),requiresReview:Boolean(recommendation.requiresReview)},success:recommendation.success!==false&&!errorCode,requiresReview:Boolean(recommendation.requiresReview),actorUserId:context.actorUserId||null,operationId:context.operationId||null,idempotencyKey,errorCode,durationMs:Math.max(0,clock()-started)});context.executionId=record.executionId}}
  return {value,recommendation,executionId:context.executionId};
 };
 const confirm=async(definition,decision)=>{validateEngineDefinition(definition);if(!decision?.executionId||!await repository.execution(decision.executionId,definition.engineName))return {recorded:false};await repository.increment({engineName:definition.engineName,engineVersion:definition.engineVersion,eventType:"DECISION_CONFIRMED",decisionCount:1,overrideCount:decision.manualOverride?1:0});return {recorded:true,executionId:decision.executionId}};
 return {register,evaluate,confirm,history:repository.history,metrics:repository.metrics,compare:compareRecommendations,version:engineVersion};
}

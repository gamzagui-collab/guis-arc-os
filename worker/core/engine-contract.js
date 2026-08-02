const NAME=/^[A-Z][A-Z0-9_]{1,79}$/;
const VERSION=/^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][A-Za-z0-9.-]+)?$/;
const EVENT=/^[A-Z][A-Z0-9_]{1,79}$/;
export const ENGINE_CONTRACT_VERSION="1.0.0";
export const ENGINE_EVENTS=Object.freeze({ISSUE_CREATED:"ISSUE_CREATED",TITLE_CHANGED:"TITLE_CHANGED",DESCRIPTION_CHANGED:"DESCRIPTION_CHANGED",TRADE_CHANGED:"TRADE_CHANGED",MANUAL_REQUEST:"MANUAL_REQUEST"});

const required=(value,name)=>{if(value===null||value===undefined||value==="")throw new Error(`ENGINE_${name}_REQUIRED`);return value};
export function validateEngineDefinition(definition){
 required(definition,"DEFINITION");
 if(!NAME.test(String(definition.engineName||"")))throw new Error("ENGINE_NAME_INVALID");
 if(!VERSION.test(String(definition.engineVersion||"")))throw new Error("ENGINE_VERSION_INVALID");
 if(String(definition.contractVersion)!==ENGINE_CONTRACT_VERSION)throw new Error("ENGINE_CONTRACT_VERSION_UNSUPPORTED");
 if(typeof definition.evaluate!=="function"||typeof definition.toRecommendation!=="function")throw new Error("ENGINE_ADAPTER_INVALID");
 return definition;
}
export function validateEventType(value){const event=String(value||"");if(!EVENT.test(event))throw new Error("ENGINE_EVENT_INVALID");return event}
export function validateEvaluationContext(context){
 for(const key of["entityType","entityId","siteId","entityRevision","eventType","inputHash"])required(context?.[key],key.toUpperCase());
 validateEventType(context.eventType);
 if(!Number.isInteger(Number(context.entityRevision))||Number(context.entityRevision)<0)throw new Error("ENGINE_ENTITY_REVISION_INVALID");
 if(!/^[a-f0-9]{64}$/.test(String(context.inputHash)))throw new Error("ENGINE_INPUT_HASH_INVALID");
 return context;
}
export function validateRecommendation(value){
 for(const key of["code","confidence","reasonCodes","ruleIds","requiresReview","engineVersion"])required(value?.[key],`RECOMMENDATION_${key.toUpperCase()}`);
 if(!Number.isFinite(Number(value.confidence))||Number(value.confidence)<0||Number(value.confidence)>100)throw new Error("ENGINE_RECOMMENDATION_CONFIDENCE_INVALID");
 if(!Array.isArray(value.reasonCodes)||!Array.isArray(value.ruleIds))throw new Error("ENGINE_RECOMMENDATION_ARRAY_INVALID");
 return value;
}
export function selectIssueEvent({tradeChanged=false,descriptionChanged=false,titleChanged=false}={}){return tradeChanged?ENGINE_EVENTS.TRADE_CHANGED:descriptionChanged?ENGINE_EVENTS.DESCRIPTION_CHANGED:titleChanged?ENGINE_EVENTS.TITLE_CHANGED:null}
export function compareRecommendations(left,right){return {sameCode:left?.code===right?.code,confidenceDelta:Number(right?.confidence||0)-Number(left?.confidence||0),reviewChanged:Boolean(left?.requiresReview)!==Boolean(right?.requiresReview)} }
export function engineVersion(definition){validateEngineDefinition(definition);return {engineName:definition.engineName,engineVersion:definition.engineVersion,contractVersion:definition.contractVersion}}
export function limitedJson(value,max=8192){const json=JSON.stringify(value);if(new TextEncoder().encode(json).byteLength>max)throw new Error("ENGINE_JSON_TOO_LARGE");return json}

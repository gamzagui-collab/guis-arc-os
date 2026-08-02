const COMPLETION_RULES=Object.freeze({
 "request-completion":Object.freeze({permission:"issue.request_completion",status:"ACTION_IN_PROGRESS",scope:"assignee"}),
 "confirm-completion":Object.freeze({permission:"issue.confirm_completion",status:"COMPLETION_REQUESTED",scope:"creator"}),
 rework:Object.freeze({permission:"issue.rework",status:"COMPLETION_REQUESTED",scope:"creator"})
});

export function issueCompletionDecision({action,permissions=[],userId=null,assigneeUserId=null,createdByUserId=null,status=null}){
 const rule=COMPLETION_RULES[action],grants=new Set(permissions),manage=grants.has("issue.manage_all");
 if(!rule)return {allowed:false,reason:"UNSUPPORTED_ACTION"};
 if(status!==rule.status)return {allowed:false,reason:"STATE"};
 if(!manage&&!grants.has(rule.permission))return {allowed:false,reason:"PERMISSION"};
 const scopedUserId=rule.scope==="assignee"?assigneeUserId:createdByUserId;
 if(!manage&&scopedUserId!==userId)return {allowed:false,reason:"SCOPE"};
 return {allowed:true,reason:null};
}

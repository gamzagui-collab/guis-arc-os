export const ISSUE_ASSIGNEE_RESPONSES=Object.freeze(["ACKNOWLEDGED","NOT_MY_RESPONSIBILITY","DUE_DATE_DISCUSSION","BLOCKED"]);
export const ISSUE_ASSIGNEE_RESPONSE_LABELS=Object.freeze({ACKNOWLEDGED:"확인함",NOT_MY_RESPONSIBILITY:"내 담당 아님",DUE_DATE_DISCUSSION:"기한 협의 필요",BLOCKED:"진행 차단됨"});

export function normalizeAssigneeResponse(input={}){
 const response=String(input.response||"").toUpperCase(),note=String(input.note||"").trim()||null;
 if(!ISSUE_ASSIGNEE_RESPONSES.includes(response))return {ok:false,error:"ISSUE_ASSIGNEE_RESPONSE_INVALID"};
 if(note&&note.length>500)return {ok:false,error:"ISSUE_ASSIGNEE_RESPONSE_NOTE_TOO_LONG"};
 return {ok:true,value:{response,note}};
}

export function assigneeResponseDecision({userId,assignedToUserId,siteId,issueSiteId,boardAccess,permissions=[],status}={}){
 if(siteId!==issueSiteId)return {allowed:false,reason:"SITE"};
 if(!["EDIT","MANAGE"].includes(boardAccess)||!permissions.includes("issue.act"))return {allowed:false,reason:"PERMISSION"};
 if(!assignedToUserId||userId!==assignedToUserId)return {allowed:false,reason:"ASSIGNEE"};
 if(["COMPLETED","CANCELLED"].includes(status))return {allowed:false,reason:"STATE"};
 return {allowed:true,reason:null};
}

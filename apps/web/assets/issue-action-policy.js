import {issueCompletionDecision} from "./issue-completion-policy.js?v=0.24.12-r1";
const EDIT_LEVELS=new Set(["EDIT","MANAGE"]),ACTION_STATES=new Set(["ASSIGNED","ACTION_IN_PROGRESS","REWORK_REQUIRED"]);
export function issueActionVisibility({session,issue,hasActionPhoto=false}){
 const context=session?.context||{},permissions=new Set(context.permissions||[]),manage=permissions.has("issue.manage_all"),personal=manage||issue?.assigneeUserId===context.user?.id,validContext=Boolean(context.selectedSiteId&&issue?.siteId===context.selectedSiteId),canEdit=EDIT_LEVELS.has(context.boardAccess?.ISSUE?.accessLevel);
 const completion=action=>validContext&&canEdit&&issueCompletionDecision({action,permissions:[...permissions],userId:context.user?.id,assigneeUserId:issue?.assigneeUserId,createdByUserId:issue?.createdByUserId,status:issue?.status}).allowed;
 return {showActionForm:validContext&&canEdit&&personal&&(manage||permissions.has("issue.act"))&&ACTION_STATES.has(issue?.status),showCompletionRequest:completion("request-completion")&&hasActionPhoto,showCompletionConfirm:completion("confirm-completion"),showRework:completion("rework")};
}

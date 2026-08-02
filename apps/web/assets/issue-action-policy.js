const EDIT_LEVELS=new Set(["EDIT","MANAGE"]),ACTION_STATES=new Set(["ASSIGNED","ACTION_IN_PROGRESS","REWORK_REQUIRED"]);
export function issueActionVisibility({session,issue,hasActionPhoto=false}){
 const context=session?.context||{},permissions=new Set(context.permissions||[]),manage=permissions.has("issue.manage_all"),personal=manage||issue?.assigneeUserId===context.user?.id,validContext=Boolean(context.selectedSiteId&&issue?.siteId===context.selectedSiteId),canEdit=EDIT_LEVELS.has(context.boardAccess?.ISSUE?.accessLevel);
 return {showActionForm:validContext&&canEdit&&personal&&(manage||permissions.has("issue.act"))&&ACTION_STATES.has(issue?.status),showCompletionRequest:validContext&&canEdit&&personal&&(manage||permissions.has("issue.request_completion"))&&issue?.status==="ACTION_IN_PROGRESS"&&hasActionPhoto};
}

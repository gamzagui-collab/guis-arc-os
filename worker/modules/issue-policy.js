export const ISSUE_SCOPE = Object.freeze({ SITE: "SITE", CONTRACTOR: "CONTRACTOR", ASSIGNEE: "ASSIGNEE", SELF_CREATED: "SELF_CREATED", NONE: "NONE" });

export function resolveIssueScope(roleCodes = []) {
  const roles = new Set(roleCodes);
  if (roles.has("INTEGRATED_OWNER") || roles.has("SITE_MANAGER") || roles.has("GENERAL_CONTRACTOR_STAFF") || roles.has("GENERAL_CONTRACTOR_FOREMAN") || roles.has("CONSTRUCTION_MANAGER") || roles.has("SAFETY_MANAGER") || roles.has("QUALITY_MANAGER") || roles.has("MATERIALS_MANAGER") || roles.has("EQUIPMENT_MANAGER")) return ISSUE_SCOPE.SITE;
  if (roles.has("CONTRACTOR_MANAGER") || roles.has("CONTRACTOR_SITE_MANAGER") || roles.has("CONTRACTOR_FOREMAN") || roles.has("CONTRACTOR_EMPLOYEE")) return ISSUE_SCOPE.CONTRACTOR;
  if (roles.has("CONTRACTOR_ASSIGNEE")) return ISSUE_SCOPE.ASSIGNEE;
  if (roles.has("FIELD_WORKER")) return ISSUE_SCOPE.SELF_CREATED;
  return ISSUE_SCOPE.NONE;
}

export function issueWithinScope({ scope, userId, companyId }, issue) {
  if (scope === ISSUE_SCOPE.SITE) return true;
  if (scope === ISSUE_SCOPE.CONTRACTOR) return issue.created_by_user_id === userId || Boolean(companyId && issue.contractor_company_id === companyId);
  if (scope === ISSUE_SCOPE.ASSIGNEE) return issue.created_by_user_id === userId || (issue.assigned_to_user_id === userId && Boolean(companyId && issue.contractor_company_id === companyId));
  if (scope === ISSUE_SCOPE.SELF_CREATED) return issue.created_by_user_id === userId;
  return false;
}

export function assignmentWithinScope(actor, target) {
  if (actor.scope === ISSUE_SCOPE.SITE) return true;
  if (actor.scope === ISSUE_SCOPE.CONTRACTOR) return actor.companyId === target.companyId;
  return actor.scope === ISSUE_SCOPE.ASSIGNEE && actor.userId === target.userId;
}

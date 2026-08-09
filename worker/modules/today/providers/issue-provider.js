import { ISSUE_SCOPE } from "../../issue-policy.js";

export async function issueProvider({ env, ctx, scope }) {
  if (!ctx.modules.includes("issue") || (!ctx.permissions.includes("issue.read") && !ctx.permissions.includes("issue.manage_all"))) {
    return { implementationStatus: "IMPLEMENTED", state: "NO_PERMISSION", message: "이슈 정보를 볼 권한이 없습니다.", cards: [] };
  }
  if (scope.issueScope === ISSUE_SCOPE.NONE) {
    return { implementationStatus: "IMPLEMENTED", state: "NO_PERMISSION", message: "현재 역할에는 이슈 조회 범위가 없습니다.", cards: [] };
  }
  const company = scope.issueScope === ISSUE_SCOPE.CONTRACTOR || scope.issueScope === ISSUE_SCOPE.ASSIGNEE ? scope.companyId : null;
  const assignee = scope.issueScope === ISSUE_SCOPE.ASSIGNEE ? scope.userId : null;
  const [aggregate, recent, urgentItems] = await env.DB.batch([
    env.DB.prepare("SELECT SUM(CASE WHEN status IN ('OPEN','ASSIGNED','ACTION_IN_PROGRESS','REWORK_REQUIRED') THEN 1 ELSE 0 END) AS unhandled,SUM(CASE WHEN status='COMPLETION_REQUESTED' THEN 1 ELSE 0 END) AS completion_requested,SUM(CASE WHEN assigned_to_user_id=?2 AND status NOT IN ('COMPLETED','CANCELLED') THEN 1 ELSE 0 END) AS assigned_to_me,SUM(CASE WHEN priority='URGENT' AND status NOT IN ('COMPLETED','CANCELLED') THEN 1 ELSE 0 END) AS urgent,SUM(CASE WHEN EXISTS (SELECT 1 FROM issue_assignee_responses r WHERE r.issue_id=issue_items.id AND r.response_revision=(SELECT MAX(r2.response_revision) FROM issue_assignee_responses r2 WHERE r2.issue_id=issue_items.id) AND r.response IN ('NOT_MY_RESPONSIBILITY','DUE_DATE_DISCUSSION','BLOCKED')) THEN 1 ELSE 0 END) AS response_attention FROM issue_items WHERE site_id=?1 AND (?3 IS NULL OR contractor_company_id=?3) AND (?4 IS NULL OR assigned_to_user_id=?4)").bind(scope.siteId, scope.userId, company, assignee),
    env.DB.prepare("SELECT id,title,completed_at,priority FROM issue_items WHERE site_id=?1 AND status='COMPLETED' AND (?2 IS NULL OR contractor_company_id=?2) AND (?3 IS NULL OR assigned_to_user_id=?3) ORDER BY datetime(completed_at) DESC,id DESC LIMIT 5").bind(scope.siteId, company, assignee),
    env.DB.prepare("SELECT id,title,location_text,created_at,due_at,assigned_to_name_snapshot,status,priority FROM issue_items WHERE site_id=?1 AND priority='URGENT' AND status NOT IN ('COMPLETED','CANCELLED') AND (?2 IS NULL OR contractor_company_id=?2) AND (?3 IS NULL OR assigned_to_user_id=?3) ORDER BY CASE WHEN due_at IS NULL THEN 1 ELSE 0 END,datetime(due_at),datetime(created_at) DESC LIMIT 6").bind(scope.siteId, company, assignee)
  ]);
  const counts = aggregate.results[0] || {};
  return {
    implementationStatus: "IMPLEMENTED",
    state: "LOADED",
    urgentItems: urgentItems.results.map((item) => ({
      id: item.id,
      title: item.title,
      location: item.location_text,
      createdAt: item.created_at,
      dueAt: item.due_at,
      assignee: item.assigned_to_name_snapshot,
      status: item.status,
      priority: item.priority,
      href: `/issues/${encodeURIComponent(item.id)}`
    })),
    cards: [
      { code: "UNHANDLED", label: "미조치 이슈", count: Number(counts.unhandled || 0), href: "/issues/open", priority: "A" },
      { code: "COMPLETION_REQUESTED", label: "완료 확인 대기", count: Number(counts.completion_requested || 0), href: "/issues/review", priority: "A" },
      { code: "ASSIGNED_TO_ME", label: "내가 담당한 이슈", count: Number(counts.assigned_to_me || 0), href: "/issues?view=mine", priority: "B" },
      { code: "RESPONSE_ATTENTION", label: "응답 확인 필요", count: Number(counts.response_attention || 0), href: "/issues", priority: "A" },
      { code: "URGENT", label: "긴급 이슈", count: Number(counts.urgent || 0), href: "/issues?view=urgent", priority: "A" },
      { code: "RECENT_COMPLETED", label: "최근 완료 이슈", count: recent.results.length, href: "/issues/completed", priority: "C", items: recent.results }
    ]
  };
}

import { ApiError, json, parseJson, requestId } from "../core/response.js";
import { authenticate, context } from "../core/session.js";
import { BOARD_KEYS, requireBoardAccess } from "../core/board-access.js";

const MANAGE_ROLES = new Set([
  "PLATFORM_OWNER",
  "INTEGRATED_OWNER",
  "SITE_MANAGER",
  "SAFETY_MANAGER",
]);
const CONTRACTOR_ROLES = new Set([
  "CONTRACTOR_MANAGER",
  "CONTRACTOR_SITE_MANAGER",
  "CONTRACTOR_FOREMAN",
  "CONTRACTOR_EMPLOYEE",
  "CONTRACTOR_ASSIGNEE",
  "FIELD_WORKER",
]);
const SAFETY_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_SAFETY_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_SAFETY_THUMBNAIL_BYTES = 700 * 1024;
const clean = (value, max = 2000) =>
  String(value ?? "")
    .trim()
    .slice(0, max);
const kstDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const auditStatement = (env, actor, action, id, meta = {}) =>
  env.DB.prepare(
    "INSERT INTO audit_logs(id,actor_user_id,action,outcome,request_id,metadata_json) VALUES(?1,?2,?3,'ALLOWED',?4,?5)",
  ).bind(crypto.randomUUID(), actor, action, id, JSON.stringify(meta));

async function authorize(
  request,
  env,
  { boardKey = BOARD_KEYS.SAFETY_CASE, required = "VIEW", write = false } = {},
) {
  const row = await authenticate(request, env, { csrf: write }),
    ctx = await context(env, row),
    siteId = ctx.selectedSiteId;
  if (!siteId)
    throw new ApiError(400, "SITE_CONTEXT_REQUIRED", "현장을 선택해 주세요.");
  if (
    write &&
    Number(request.headers.get("x-context-version")) !== ctx.contextVersion
  )
    throw new ApiError(
      409,
      "CONTEXT_VERSION_STALE",
      "현장 정보가 변경되었습니다. 새로고침 후 다시 시도해 주세요.",
    );
  const membership = await env.DB.prepare(
    "SELECT company_id FROM memberships WHERE user_id=?1 AND site_id=?2 AND status='ACTIVE'",
  )
    .bind(row.user_id, siteId)
    .first();
  if (!membership)
    throw new ApiError(
      403,
      "SAFETY_SITE_SCOPE_DENIED",
      "현재 현장의 안전 업무에 접근할 수 없습니다.",
    );
  const roles = (
    await env.DB.prepare(
      "SELECT r.code FROM user_site_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=?1 AND ur.site_id=?2 AND ur.status='ACTIVE'",
    )
      .bind(row.user_id, siteId)
      .all()
  ).results.map((v) => v.code);
  await requireBoardAccess(env, {
    userId: row.user_id,
    siteId,
    boardKey,
    required,
    requestId: requestId(request),
  });
  return {
    row,
    ctx,
    siteId,
    userId: row.user_id,
    companyId: membership.company_id,
    roles,
    manage: roles.some((v) => MANAGE_ROLES.has(v)),
    contractor:
      roles.some((v) => CONTRACTOR_ROLES.has(v)) &&
      !roles.some((v) => MANAGE_ROLES.has(v)),
  };
}
const scoped = (auth, alias = "c") =>
  auth.contractor
    ? {
        sql: ` AND (${alias}.company_id=?2 OR EXISTS(SELECT 1 FROM safety_corrective_actions assigned_action WHERE assigned_action.safety_case_id=${alias}.id AND assigned_action.site_id=?1 AND (assigned_action.owner_company_id=?2 OR assigned_action.owner_user_id=?3)))`,
        args: [auth.siteId, auth.companyId, auth.userId],
      }
    : { sql: "", args: [auth.siteId] };
async function caseRow(env, id, auth) {
  const scope = scoped(auth, "c"),
    row = await env.DB.prepare(
      `SELECT c.*,rc.display_name risk_name,root.display_name root_cause_name,co.name company_name,t.display_name trade_name,l.display_name location_name,u.display_name owner_name FROM safety_cases c JOIN safety_risk_categories rc ON rc.id=c.risk_category_id LEFT JOIN safety_root_causes root ON root.id=c.root_cause_id LEFT JOIN companies co ON co.id=c.company_id LEFT JOIN trade_master t ON t.id=c.trade_id LEFT JOIN site_locations l ON l.id=c.location_id LEFT JOIN users u ON u.id=c.owner_user_id WHERE c.id=?${scope.args.length + 1} AND c.site_id=?1${scope.sql}`,
    )
      .bind(...scope.args, id)
      .first();
  if (!row)
    throw new ApiError(
      404,
      "SAFETY_CASE_NOT_FOUND",
      "안전 사례를 찾을 수 없습니다.",
    );
  return row;
}
async function casePayload(env, id, auth) {
  const safetyCase = await caseRow(env, id, auth),
    [sources, media, assessment, actions, actionMedia, reviews] =
      await Promise.all([
        env.DB.prepare(
          "SELECT * FROM safety_case_sources WHERE safety_case_id=?1 ORDER BY is_primary DESC,created_at",
        )
          .bind(id)
          .all(),
        env.DB.prepare(
          "SELECT id,media_role,source_type,source_media_id,original_name,mime_type,description,created_at FROM safety_case_media WHERE safety_case_id=?1 AND status='ACTIVE' ORDER BY created_at",
        )
          .bind(id)
          .all(),
        env.DB.prepare(
          "SELECT a.*,u.display_name assessed_by_name FROM safety_risk_assessments a JOIN users u ON u.id=a.assessed_by_user_id WHERE a.safety_case_id=?1",
        )
          .bind(id)
          .first(),
        env.DB.prepare(
          "SELECT a.*,u.display_name owner_name,co.name owner_company_name FROM safety_corrective_actions a JOIN users u ON u.id=a.owner_user_id JOIN companies co ON co.id=a.owner_company_id WHERE a.safety_case_id=?1 ORDER BY a.created_at",
        )
          .bind(id)
          .all(),
        env.DB.prepare(
          "SELECT id,action_id,media_role,source_type,source_media_id,original_name,mime_type,description,location_id,sort_order,uploaded_by_user_id,created_at FROM safety_corrective_action_media WHERE safety_case_id=?1 AND status='ACTIVE' ORDER BY action_id,sort_order,created_at",
        )
          .bind(id)
          .all(),
        env.DB.prepare(
          "SELECT r.*,u.display_name reviewed_by_name FROM safety_case_reviews r JOIN users u ON u.id=r.reviewed_by_user_id WHERE r.safety_case_id=?1 ORDER BY r.reviewed_at DESC",
        )
          .bind(id)
          .all(),
      ]);
  const mappedMedia = media.results.map((v) => ({
    ...v,
    thumbnailUrl: `/api/v1/safety/cases/${id}/media/${v.id}/thumbnail`,
    originalUrl: `/api/v1/safety/cases/${id}/media/${v.id}/original`,
  }));
  const stale = [];
  for (const source of sources.results) {
    let current = source.source_revision;
    if (source.source_type === "ISSUE")
      current = Number(
        (
          await env.DB.prepare(
            "SELECT revision FROM issue_items WHERE id=?1 AND site_id=?2",
          )
            .bind(source.source_id, auth.siteId)
            .first()
        )?.revision || source.source_revision,
      );
    if (source.source_type.startsWith("CONSTRUCTION"))
      current = Number(
        (
          await env.DB.prepare(
            "SELECT revision FROM construction_daily_reports WHERE id=?1 AND site_id=?2",
          )
            .bind(source.source_id, auth.siteId)
            .first()
        )?.revision || source.source_revision,
      );
    stale.push({
      ...source,
      current_source_revision: current,
      stale: current !== Number(source.source_revision),
    });
  }
  return {
    case: safetyCase,
    sources: stale,
    media: mappedMedia,
    assessment,
    actions: actions.results.map((action) => ({
      ...action,
      media: actionMedia.results
        .filter((v) => v.action_id === action.id)
        .map((v) => ({
          ...v,
          thumbnailUrl: `/api/v1/safety/cases/${id}/actions/${action.id}/media/${v.id}/thumbnail`,
          originalUrl: `/api/v1/safety/cases/${id}/actions/${action.id}/media/${v.id}/original`,
        })),
    })),
    reviews: reviews.results,
  };
}
async function validateRef(env, table, id, siteId, extra = "") {
  if (!id) return null;
  const row = await env.DB.prepare(
    `SELECT id FROM ${table} WHERE id=?1 AND site_id=?2 ${extra}`,
  )
    .bind(id, siteId)
    .first();
  if (!row)
    throw new ApiError(
      400,
      "SAFETY_REFERENCE_INVALID",
      "선택한 현장 정보를 다시 확인해 주세요.",
    );
  return id;
}
async function sourceSnapshot(env, auth, type, sourceId, itemId) {
  if (type === "DIRECT") return null;
  if (type === "ISSUE") {
    const row = await env.DB.prepare(
      "SELECT id,title,description,revision,contractor_company_id company_id,trade_id,COALESCE(room_location_id,unit_location_id,building_location_id) location_id FROM issue_items WHERE id=?1 AND site_id=?2",
    )
      .bind(sourceId, auth.siteId)
      .first();
    if (!row)
      throw new ApiError(
        404,
        "SAFETY_SOURCE_NOT_FOUND",
        "연결할 Issue를 찾을 수 없습니다.",
      );
    return {
      type,
      id: row.id,
      revision: Number(row.revision),
      row,
      media: await env.DB.prepare(
        "SELECT id,original_name,mime_type FROM issue_media WHERE issue_id=?1 AND status='ACTIVE'",
      )
        .bind(row.id)
        .all(),
    };
  }
  const report = await env.DB.prepare(
    "SELECT id,work_date_kst,revision,today_summary FROM construction_daily_reports WHERE id=?1 AND site_id=?2",
  )
    .bind(sourceId, auth.siteId)
    .first();
  if (!report)
    throw new ApiError(
      404,
      "SAFETY_SOURCE_NOT_FOUND",
      "연결할 공사일보를 찾을 수 없습니다.",
    );
  let item = null;
  if (itemId) {
    item = await env.DB.prepare(
      "SELECT * FROM construction_daily_report_items WHERE id=?1 AND report_id=?2",
    )
      .bind(itemId, sourceId)
      .first();
    if (!item)
      throw new ApiError(
        404,
        "SAFETY_SOURCE_ITEM_NOT_FOUND",
        "연결할 공사일보 작업을 찾을 수 없습니다.",
      );
  }
  return {
    type,
    id: report.id,
    itemId,
    revision: Number(report.revision),
    row: { ...report, ...item },
    media: await env.DB.prepare(
      "SELECT id,original_name,mime_type FROM construction_daily_report_media WHERE report_id=?1 AND status='ACTIVE'",
    )
      .bind(report.id)
      .all(),
  };
}
async function createCase(request, env, auth) {
  const body = await parseJson(request),
    type = clean(body.sourceType || "DIRECT", 50),
    source = await sourceSnapshot(
      env,
      auth,
      type,
      clean(body.sourceId, 80),
      clean(body.sourceItemId, 80),
    ),
    base = source?.row || {},
    title = clean(
      body.title || base.title || base.manager_summary || base.today_summary,
      200,
    ),
    description = clean(
      body.description ||
        base.description ||
        base.manager_summary ||
        base.today_summary,
    ),
    riskId = clean(body.riskCategoryId, 80);
  if (!title || !description || !riskId)
    throw new ApiError(
      400,
      "SAFETY_CASE_INPUT_REQUIRED",
      "제목, 내용, 위험 분류를 입력해 주세요.",
    );
  const risk = await env.DB.prepare(
    "SELECT id FROM safety_risk_categories WHERE id=?1 AND is_active=1",
  )
    .bind(riskId)
    .first();
  if (!risk)
    throw new ApiError(
      400,
      "SAFETY_RISK_CATEGORY_INVALID",
      "위험 분류를 다시 선택해 주세요.",
    );
  const companyId = clean(body.companyId || base.company_id, 80) || null,
    tradeId = clean(body.tradeId || base.trade_id, 80) || null,
    locationId = clean(body.locationId || base.location_id, 80) || null;
  if (
    companyId &&
    !(await env.DB.prepare(
      "SELECT 1 FROM company_site_contracts WHERE company_id=?1 AND site_id=?2 AND status='ACTIVE'",
    )
      .bind(companyId, auth.siteId)
      .first())
  )
    throw new ApiError(
      400,
      "SAFETY_COMPANY_INVALID",
      "선택한 회사는 현재 현장 참여 회사가 아닙니다.",
    );
  if (locationId)
    await validateRef(env, "site_locations", locationId, auth.siteId);
  const primaryType =
    type === "CONSTRUCTION_DAILY_REPORT_ITEM"
      ? "CONSTRUCTION_DAILY_REPORT"
      : type;
  if (source) {
    const duplicate = await env.DB.prepare(
      "SELECT safety_case_id FROM safety_case_sources WHERE site_id=?1 AND source_type=?2 AND source_id=?3 AND COALESCE(source_item_id,'')=COALESCE(?4,'') LIMIT 1",
    )
      .bind(auth.siteId, primaryType, source.id, source.itemId || null)
      .first();
    if (duplicate)
      throw new ApiError(
        409,
        "SAFETY_SOURCE_ALREADY_LINKED",
        "이미 Safety에 등록된 공사일보 작업입니다.",
        { details: { existingCaseId: duplicate.safety_case_id } },
      );
  }
  const id = crypto.randomUUID(),
    statements = [
      env.DB.prepare(
        `INSERT INTO safety_cases(id,site_id,title,description,primary_source_type,primary_source_id,primary_source_revision,primary_issue_id,company_id,trade_id,location_id,work_date_kst,discovered_by_user_id,risk_category_id,risk_category_note,status,immediate_control_required,owner_user_id,due_date)
 VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,'DISCOVERED',?16,?17,?18)`,
      ).bind(
        id,
        auth.siteId,
        title,
        description,
        primaryType,
        source?.id || null,
        source?.revision || null,
        type === "ISSUE" ? source.id : null,
        companyId,
        tradeId,
        locationId,
        clean(body.workDate || kstDate(), 10),
        auth.userId,
        riskId,
        clean(body.riskCategoryNote, 500) || null,
        body.immediateControlRequired ? 1 : 0,
        clean(body.ownerUserId, 80) || auth.userId,
        clean(body.dueDate, 10) || null,
      ),
    ];
  if (source) {
    statements.push(
      env.DB.prepare(
        "INSERT INTO safety_case_sources(id,safety_case_id,site_id,source_type,source_id,source_item_id,source_revision,source_snapshot_json,is_primary,created_by_user_id) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,1,?9)",
      ).bind(
        crypto.randomUUID(),
        id,
        auth.siteId,
        primaryType,
        source.id,
        source.itemId || null,
        source.revision,
        JSON.stringify(source.row),
        auth.userId,
      ),
    );
    for (const m of source.media.results)
      statements.push(
        env.DB.prepare(
          "INSERT OR IGNORE INTO safety_case_media(id,safety_case_id,site_id,media_role,source_type,source_media_id,original_name,mime_type,uploaded_by_user_id) VALUES(?1,?2,?3,'DISCOVERY',?4,?5,?6,?7,?8)",
        ).bind(
          crypto.randomUUID(),
          id,
          auth.siteId,
          type === "ISSUE" ? "ISSUE_MEDIA" : "CONSTRUCTION_MEDIA",
          m.id,
          m.original_name,
          m.mime_type,
          auth.userId,
        ),
      );
  }
  const errorNumber = requestId(request);
  statements.push(
    auditStatement(env, auth.userId, "SAFETY_CASE_CREATED", errorNumber, {
      caseId: id,
      siteId: auth.siteId,
      sourceType: type,
      sourceId: source?.id || null,
    }),
  );
  try {
    await env.DB.batch(statements);
  } catch (error) {
    if (env.APP_ENV === "integration")
      console.log(
        `SAFETY_CASE_CREATE_FAILED ${String(error?.message || error)} sourceType=${type} sourceId=${source?.id || ""} sourceItemId=${source?.itemId || ""}`,
      );
    throw new ApiError(
      500,
      "SAFETY_CASE_PERSIST_FAILED",
      `Safety Case를 저장하지 못했습니다. 관리자 확인을 위한 오류 번호: ${errorNumber}`,
    );
  }
  return json(await casePayload(env, id, auth), 201);
}
async function controlCase(request, env, auth, id) {
  const c = await caseRow(env, id, auth);
  if (c.status === "FINALIZED")
    throw new ApiError(
      409,
      "SAFETY_FINALIZED_LOCKED",
      "종결된 안전 사례는 수정할 수 없습니다.",
    );
  const b = await parseJson(request),
    description = clean(b.description);
  if (!description)
    throw new ApiError(
      400,
      "SAFETY_CONTROL_REQUIRED",
      "즉시 통제 내용을 입력해 주세요.",
    );
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE safety_cases SET immediate_control_completed=1,immediate_control_description=?2,immediate_control_owner_user_id=?3,immediate_control_at=CURRENT_TIMESTAMP,work_stopped=?4,access_restricted=?5,hazard_zone_marked=?6,status='ASSESSMENT_REQUIRED',revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?1",
    ).bind(
      id,
      description,
      auth.userId,
      b.workStopped ? 1 : 0,
      b.accessRestricted ? 1 : 0,
      b.hazardZoneMarked ? 1 : 0,
    ),
    auditStatement(
      env,
      auth.userId,
      "SAFETY_IMMEDIATE_CONTROL_COMPLETED",
      requestId(request),
      { caseId: id },
    ),
  ]);
  return json(await casePayload(env, id, auth));
}
async function assessCase(request, env, auth, id) {
  const c = await caseRow(env, id, auth);
  if (c.status === "FINALIZED")
    throw new ApiError(
      409,
      "SAFETY_FINALIZED_LOCKED",
      "종결된 안전 사례는 수정할 수 없습니다.",
    );
  const b = await parseJson(request),
    likelihood = Number(b.likelihood),
    severity = Number(b.severity),
    score = likelihood * severity,
    root = clean(b.rootCauseId, 80);
  if (
    !clean(b.workName, 200) ||
    !clean(b.hazardFactor) ||
    !clean(b.currentControls) ||
    ![1, 2, 3, 4, 5].includes(likelihood) ||
    ![1, 2, 3, 4, 5].includes(severity) ||
    !root
  )
    throw new ApiError(
      400,
      "SAFETY_ASSESSMENT_REQUIRED",
      "작업, 위험요인, 현재 조치, 가능성, 중대성, 근본 원인을 입력해 주세요.",
    );
  if (
    !(await env.DB.prepare(
      "SELECT 1 FROM safety_root_causes WHERE id=?1 AND is_active=1",
    )
      .bind(root)
      .first())
  )
    throw new ApiError(
      400,
      "SAFETY_ROOT_CAUSE_INVALID",
      "근본 원인을 표준 목록에서 선택해 주세요.",
    );
  const existing = await env.DB.prepare(
      "SELECT id,revision FROM safety_risk_assessments WHERE safety_case_id=?1",
    )
      .bind(id)
      .first(),
    aid = existing?.id || crypto.randomUUID(),
    level =
      score >= 20
        ? "VERY_HIGH"
        : score >= 12
          ? "HIGH"
          : score >= 6
            ? "MEDIUM"
            : "LOW";
  const statement = existing
    ? env.DB.prepare(
        "UPDATE safety_risk_assessments SET work_name=?2,hazard_factor=?3,current_controls=?4,likelihood=?5,severity=?6,risk_score=?7,risk_level=?8,acceptable=?9,additional_measures=?10,assessed_by_user_id=?11,assessed_on=?12,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?1",
      ).bind(
        aid,
        clean(b.workName, 200),
        clean(b.hazardFactor),
        clean(b.currentControls),
        likelihood,
        severity,
        score,
        level,
        b.acceptable ? 1 : 0,
        clean(b.additionalMeasures) || null,
        auth.userId,
        kstDate(),
      )
    : env.DB.prepare(
        "INSERT INTO safety_risk_assessments(id,safety_case_id,site_id,work_name,company_id,trade_id,location_id,hazard_factor,current_controls,likelihood,severity,risk_score,risk_level,acceptable,additional_measures,assessed_by_user_id,assessed_on) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17)",
      ).bind(
        aid,
        id,
        auth.siteId,
        clean(b.workName, 200),
        c.company_id,
        c.trade_id,
        c.location_id,
        clean(b.hazardFactor),
        clean(b.currentControls),
        likelihood,
        severity,
        score,
        level,
        b.acceptable ? 1 : 0,
        clean(b.additionalMeasures) || null,
        auth.userId,
        kstDate(),
      );
  await env.DB.batch([
    statement,
    env.DB.prepare(
      "UPDATE safety_cases SET root_cause_id=?2,root_cause_note=?3,status='ACTION_IN_PROGRESS',revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?1",
    ).bind(id, root, clean(b.rootCauseNote, 500) || null),
    auditStatement(
      env,
      auth.userId,
      "SAFETY_RISK_ASSESSED",
      requestId(request),
      { caseId: id, score, level },
    ),
  ]);
  return json(await casePayload(env, id, auth));
}
async function addAction(request, env, auth, id) {
  const c = await caseRow(env, id, auth);
  if (!auth.manage)
    throw new ApiError(
      403,
      "SAFETY_ACTION_ASSIGN_DENIED",
      "현장소장 또는 안전 관리자만 개선조치를 새로 배정할 수 있습니다.",
    );
  if (c.status === "FINALIZED")
    throw new ApiError(
      409,
      "SAFETY_FINALIZED_LOCKED",
      "종결된 안전 사례는 수정할 수 없습니다.",
    );
  const existing = await env.DB.prepare(
    "SELECT id,status FROM safety_corrective_actions WHERE safety_case_id=?1 AND site_id=?2 AND status<>'CANCELLED' LIMIT 1",
  )
    .bind(id, auth.siteId)
    .first();
  if (existing)
    throw new ApiError(
      409,
      "SAFETY_ACTION_ALREADY_EXISTS",
      "이미 배정된 개선조치가 있습니다. 기존 조치를 완료·재조치하거나 잘못 만든 조치를 취소해 주세요.",
    );
  const b = await parseJson(request),
    owner = clean(b.ownerUserId, 80),
    company = clean(b.ownerCompanyId || c.company_id, 80),
    description = clean(b.description),
    due = clean(b.dueDate, 10);
  if (!owner || !company || !description || !due)
    throw new ApiError(
      400,
      "SAFETY_ACTION_REQUIRED",
      "개선조치 내용, 담당자, 회사, 기한을 입력해 주세요.",
    );
  const assignmentScope = await env.DB.prepare(
    `SELECT
      EXISTS(
        SELECT 1 FROM memberships m JOIN users u ON u.id=m.user_id
        WHERE m.user_id=?1 AND m.site_id=?2 AND m.status='ACTIVE' AND u.status='ACTIVE'
      ) active_site_member,
      EXISTS(
        SELECT 1 FROM memberships m
        WHERE m.user_id=?1 AND m.site_id=?2 AND m.company_id=?3 AND m.status='ACTIVE'
      ) same_company_member,
      EXISTS(
        SELECT 1 FROM user_site_roles usr JOIN roles r ON r.id=usr.role_id
        WHERE usr.user_id=?1 AND usr.site_id=?2 AND usr.status='ACTIVE'
          AND r.code IN ('PLATFORM_OWNER','INTEGRATED_OWNER','SITE_MANAGER','SAFETY_MANAGER')
      ) privileged_manager`,
  )
    .bind(owner, auth.siteId, company)
    .first();
  if (
    !assignmentScope?.active_site_member ||
    (!assignmentScope.same_company_member &&
      !assignmentScope.privileged_manager)
  )
    throw new ApiError(
      400,
      "SAFETY_ACTION_OWNER_INVALID",
      "담당자는 선택한 회사의 현재 현장 활성 사용자이거나 현장 전체 조치 권한이 있는 관리자여야 합니다.",
    );
  const actionId = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO safety_corrective_actions(id,safety_case_id,site_id,action_type,description,owner_user_id,owner_company_id,due_date,budget_required,budget_amount,status,created_by_user_id) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,'ASSIGNED',?11)",
    ).bind(
      actionId,
      id,
      auth.siteId,
      clean(b.actionType || "OTHER", 50),
      description,
      owner,
      company,
      due,
      b.budgetRequired ? 1 : 0,
      b.budgetAmount == null ? null : Number(b.budgetAmount),
      auth.userId,
    ),
    auditStatement(
      env,
      auth.userId,
      "SAFETY_ACTION_ASSIGNED",
      requestId(request),
      {
        caseId: id,
        actionId,
        owner,
        crossCompanyManagerAssignment: Boolean(
          !assignmentScope.same_company_member &&
            assignmentScope.privileged_manager,
        ),
      },
    ),
  ]);
  return json(await casePayload(env, id, auth), 201);
}
async function updateActionAssignment(request, env, auth, caseId, actionId) {
  const safetyCase = await caseRow(env, caseId, auth);
  if (safetyCase.status === "FINALIZED")
    throw new ApiError(
      409,
      "SAFETY_FINALIZED_LOCKED",
      "종결된 안전 사례는 수정할 수 없습니다.",
    );
  const body = await parseJson(request),
    company = clean(body.ownerCompanyId, 80),
    owner = clean(body.ownerUserId, 80),
    revision = Number(body.revision),
    action = await env.DB.prepare(
      "SELECT owner_company_id,owner_user_id,status,revision FROM safety_corrective_actions WHERE id=?1 AND safety_case_id=?2 AND site_id=?3",
    )
      .bind(actionId, caseId, auth.siteId)
      .first();
  if (!action)
    throw new ApiError(
      404,
      "SAFETY_ACTION_NOT_FOUND",
      "개선조치를 찾을 수 없습니다.",
    );
  if (["COMPLETED", "CANCELLED"].includes(action.status))
    throw new ApiError(
      409,
      "SAFETY_ACTION_ASSIGNMENT_LOCKED",
      "완료되거나 취소된 개선조치의 담당자는 변경할 수 없습니다.",
    );
  if (revision !== Number(action.revision))
    throw new ApiError(
      409,
      "SAFETY_ACTION_STALE",
      "개선조치가 변경되었습니다. 새로고침 후 다시 시도해 주세요.",
    );
  const connectedCompany = await env.DB.prepare(
    "SELECT 1 FROM company_site_contracts WHERE company_id=?1 AND site_id=?2 AND status='ACTIVE'",
  )
    .bind(company, auth.siteId)
    .first();
  if (!connectedCompany)
    throw new ApiError(
      400,
      "SAFETY_ACTION_COMPANY_INVALID",
      "현재 현장에 참여 중인 활성 회사를 선택해 주세요.",
    );
  const assignmentScope = await env.DB.prepare(
    `SELECT
      EXISTS(SELECT 1 FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.user_id=?1 AND m.site_id=?2 AND m.status='ACTIVE' AND u.status='ACTIVE') active_site_member,
      EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=?1 AND m.site_id=?2 AND m.company_id=?3 AND m.status='ACTIVE') same_company_member,
      EXISTS(SELECT 1 FROM user_site_roles usr JOIN roles r ON r.id=usr.role_id WHERE usr.user_id=?1 AND usr.site_id=?2 AND usr.status='ACTIVE' AND r.code IN ('PLATFORM_OWNER','INTEGRATED_OWNER','SITE_MANAGER','SAFETY_MANAGER')) privileged_manager`,
  )
    .bind(owner, auth.siteId, company)
    .first();
  if (
    !assignmentScope?.active_site_member ||
    (!assignmentScope.same_company_member &&
      !assignmentScope.privileged_manager)
  )
    throw new ApiError(
      400,
      "SAFETY_ACTION_OWNER_INVALID",
      "담당자는 선택한 회사의 현재 현장 활성 사용자이거나 현장 전체 조치 권한이 있는 관리자여야 합니다.",
    );
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE safety_corrective_actions SET owner_company_id=?2,owner_user_id=?3,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?1",
    ).bind(actionId, company, owner),
    auditStatement(
      env,
      auth.userId,
      "SAFETY_ACTION_ASSIGNMENT_UPDATED",
      requestId(request),
      {
        caseId,
        actionId,
        beforeCompanyId: action.owner_company_id,
        afterCompanyId: company,
        beforeOwnerUserId: action.owner_user_id,
        afterOwnerUserId: owner,
      },
    ),
  ]);
  return json(await casePayload(env, caseId, auth));
}
async function cancelAction(request, env, auth, caseId, actionId) {
  const safetyCase = await caseRow(env, caseId, auth);
  if (safetyCase.status === "FINALIZED")
    throw new ApiError(
      409,
      "SAFETY_FINALIZED_LOCKED",
      "종결된 안전 사례는 수정할 수 없습니다.",
    );
  const action = await actionForUser(env, auth, caseId, actionId, true),
    body = await parseJson(request),
    revision = Number(body.revision),
    reason = clean(body.reason, 500);
  if (!auth.manage)
    throw new ApiError(
      403,
      "SAFETY_ACTION_CANCEL_DENIED",
      "현장소장 또는 안전 관리자만 개선조치를 취소할 수 있습니다.",
    );
  if (revision !== Number(action.revision))
    throw new ApiError(
      409,
      "SAFETY_ACTION_STALE",
      "개선조치가 변경되었습니다. 새로고침 후 다시 시도해 주세요.",
    );
  if (!reason)
    throw new ApiError(
      400,
      "SAFETY_ACTION_CANCEL_REASON_REQUIRED",
      "개선조치 취소 사유를 입력해 주세요.",
    );
  if (["COMPLETED", "CANCELLED"].includes(action.status))
    throw new ApiError(
      409,
      "SAFETY_ACTION_CANCEL_INVALID",
      "이미 완료되거나 취소된 개선조치는 취소할 수 없습니다.",
    );
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE safety_corrective_actions SET status='CANCELLED',revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?1",
    ).bind(actionId),
    env.DB.prepare(
      `UPDATE safety_cases SET status=CASE
        WHEN EXISTS(SELECT 1 FROM safety_corrective_actions WHERE safety_case_id=?1 AND id<>?2 AND status='COMPLETION_REQUESTED') THEN 'REVIEW_PENDING'
        WHEN EXISTS(SELECT 1 FROM safety_corrective_actions WHERE safety_case_id=?1 AND id<>?2 AND status='REWORK_REQUIRED') THEN 'REWORK_REQUIRED'
        WHEN EXISTS(SELECT 1 FROM safety_corrective_actions WHERE safety_case_id=?1 AND id<>?2 AND status NOT IN ('COMPLETED','CANCELLED')) THEN 'ACTION_IN_PROGRESS'
        ELSE 'REVIEW_PENDING' END,
        revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?1`,
    ).bind(caseId, actionId),
    auditStatement(
      env,
      auth.userId,
      "SAFETY_ACTION_CANCELLED",
      requestId(request),
      { caseId, actionId, reason },
    ),
  ]);
  return json(await casePayload(env, caseId, auth));
}
async function actionForUser(env, auth, caseId, actionId, write = false) {
  await caseRow(env, caseId, auth);
  const action = await env.DB.prepare(
    "SELECT * FROM safety_corrective_actions WHERE id=?1 AND safety_case_id=?2 AND site_id=?3",
  )
    .bind(actionId, caseId, auth.siteId)
    .first();
  if (!action)
    throw new ApiError(
      404,
      "SAFETY_ACTION_NOT_FOUND",
      "개선조치를 찾을 수 없습니다.",
    );
  return action;
}
async function storeActionMedia(request, env, auth, caseId, actionId) {
  await actionForUser(env, auth, caseId, actionId, true);
  const form = await request.formData(),
    photo = form.get("photo"),
    thumbnail = form.get("thumbnail"),
    role = clean(form.get("mediaRole") || "AFTER", 20);
  if (!["BEFORE", "AFTER", "EVIDENCE", "DOCUMENT", "RECHECK"].includes(role))
    throw new ApiError(
      400,
      "SAFETY_MEDIA_ROLE_INVALID",
      "증빙 구분을 다시 선택해 주세요.",
    );
  if (
    !(photo instanceof File) ||
    !(thumbnail instanceof File)
  )
    throw new ApiError(
      400,
      "SAFETY_EVIDENCE_PHOTO_REQUIRED",
      "등록할 증빙 사진을 선택해 주세요.",
    );
  if (
    !SAFETY_IMAGE_TYPES.has(photo.type) ||
    !SAFETY_IMAGE_TYPES.has(thumbnail.type)
  )
    throw new ApiError(
      400,
      "SAFETY_EVIDENCE_TYPE_INVALID",
      "JPG, PNG, WebP 사진만 등록할 수 있습니다.",
    );
  if (!photo.size || !thumbnail.size)
    throw new ApiError(
      400,
      "SAFETY_EVIDENCE_EMPTY",
      "비어 있거나 손상된 사진은 등록할 수 없습니다.",
    );
  if (
    photo.size > MAX_SAFETY_IMAGE_BYTES ||
    thumbnail.size > MAX_SAFETY_THUMBNAIL_BYTES
  )
    throw new ApiError(
      413,
      "SAFETY_EVIDENCE_TOO_LARGE",
      "원본 사진은 12MB, 미리보기는 700KB 이하만 등록할 수 있습니다.",
    );
  const photoBytes = new Uint8Array(await photo.arrayBuffer());
  const signatureValid =
    (photo.type === "image/jpeg" &&
      photoBytes[0] === 0xff &&
      photoBytes[1] === 0xd8 &&
      photoBytes[2] === 0xff) ||
    (photo.type === "image/png" &&
      photoBytes[0] === 0x89 &&
      photoBytes[1] === 0x50 &&
      photoBytes[2] === 0x4e &&
      photoBytes[3] === 0x47) ||
    (photo.type === "image/webp" &&
      String.fromCharCode(...photoBytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...photoBytes.slice(8, 12)) === "WEBP");
  if (!signatureValid)
    throw new ApiError(
      400,
      "SAFETY_EVIDENCE_CORRUPT",
      "읽을 수 없거나 손상된 사진입니다. 다른 사진을 선택해 주세요.",
    );
  const digest = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", photoBytes)),
  )
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  const duplicate = await env.DB.prepare(
    "SELECT id FROM safety_corrective_action_media WHERE action_id=?1 AND media_role=?2 AND content_digest=?3 AND status='ACTIVE' LIMIT 1",
  )
    .bind(actionId, role, digest)
    .first();
  if (duplicate)
    throw new ApiError(
      409,
      "SAFETY_EVIDENCE_DUPLICATE",
      "같은 사진이 이미 해당 증빙 구분으로 등록되어 있습니다.",
    );
  const mediaId = crypto.randomUUID(),
    safeName = String(photo.name || "evidence.jpg").replace(
      /[^a-zA-Z0-9._-]/g,
      "_",
    ),
    prefix = `sites/${auth.siteId}/safety/${caseId}/actions/${actionId}/${mediaId}`,
    originalKey = `${prefix}/original/${safeName}`,
    thumbnailKey = `${prefix}/thumbnail/${safeName}`,
    uploaded = [];
  try {
    await env.FILES.put(originalKey, photo.stream(), {
      httpMetadata: { contentType: photo.type },
      customMetadata: {
        siteId: auth.siteId,
        caseId,
        actionId,
        mediaId,
        variant: "original",
      },
    });
    uploaded.push(originalKey);
    await env.FILES.put(thumbnailKey, thumbnail.stream(), {
      httpMetadata: { contentType: thumbnail.type },
      customMetadata: {
        siteId: auth.siteId,
        caseId,
        actionId,
        mediaId,
        variant: "thumbnail",
      },
    });
    uploaded.push(thumbnailKey);
    const locationId = clean(form.get("locationId"), 80) || null;
    if (locationId)
      await validateRef(env, "site_locations", locationId, auth.siteId);
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO safety_corrective_action_media(id,action_id,safety_case_id,site_id,media_role,original_key,thumbnail_key,original_name,mime_type,description,location_id,uploaded_by_user_id,content_digest) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)",
      ).bind(
        mediaId,
        actionId,
        caseId,
        auth.siteId,
        role,
        originalKey,
        thumbnailKey,
        photo.name || safeName,
        photo.type,
        clean(form.get("description"), 500) || null,
        locationId,
        auth.userId,
        digest,
      ),
      env.DB.prepare(
        "INSERT INTO files(id,owner_module,owner_record_id,r2_key,content_type,size_bytes) VALUES(?1,'safety',?2,?3,?4,?5)",
      ).bind(
        crypto.randomUUID(),
        actionId,
        originalKey,
        photo.type,
        photo.size,
      ),
      auditStatement(
        env,
        auth.userId,
        "SAFETY_ACTION_EVIDENCE_ADDED",
        requestId(request),
        { caseId, actionId, mediaId, role, locationId },
      ),
    ]);
  } catch (error) {
    await Promise.allSettled(uploaded.map((key) => env.FILES.delete(key)));
    if (error instanceof ApiError) throw error;
    if (String(error).includes("UNIQUE"))
      throw new ApiError(
        409,
        "SAFETY_EVIDENCE_DUPLICATE",
        "같은 사진이 이미 해당 증빙 구분으로 등록되어 있습니다.",
      );
    throw new ApiError(
      502,
      "SAFETY_EVIDENCE_UPLOAD_FAILED",
      "사진 업로드를 완료하지 못했습니다. 입력값은 유지한 채 다시 시도해 주세요.",
    );
  }
  return json(await casePayload(env, caseId, auth), 201);
}
async function referenceActionMedia(request, env, auth, caseId, actionId) {
  await actionForUser(env, auth, caseId, actionId, true);
  const b = await parseJson(request),
    sourceType = clean(b.sourceType, 30),
    sourceMediaId = clean(b.sourceMediaId, 80),
    role = clean(b.mediaRole || "BEFORE", 20);
  if (
    !["ISSUE_MEDIA", "CONSTRUCTION_MEDIA", "SAFETY_MEDIA"].includes(
      sourceType,
    ) ||
    !sourceMediaId ||
    !["BEFORE", "AFTER", "EVIDENCE", "DOCUMENT", "RECHECK"].includes(role)
  )
    throw new ApiError(
      400,
      "SAFETY_SOURCE_MEDIA_INVALID",
      "참조할 사진과 증빙 구분을 다시 선택해 주세요.",
    );
  let source;
  if (sourceType === "ISSUE_MEDIA")
    source = await env.DB.prepare(
      "SELECT m.id,m.original_name,m.mime_type FROM issue_media m JOIN issue_items i ON i.id=m.issue_id WHERE m.id=?1 AND m.site_id=?2 AND m.status='ACTIVE'",
    )
      .bind(sourceMediaId, auth.siteId)
      .first();
  else if (sourceType === "CONSTRUCTION_MEDIA")
    source = await env.DB.prepare(
      "SELECT id,original_name,mime_type FROM construction_daily_report_media WHERE id=?1 AND site_id=?2 AND status='ACTIVE'",
    )
      .bind(sourceMediaId, auth.siteId)
      .first();
  else
    source = await env.DB.prepare(
      "SELECT id,original_name,mime_type FROM safety_case_media WHERE id=?1 AND site_id=?2 AND status='ACTIVE'",
    )
      .bind(sourceMediaId, auth.siteId)
      .first();
  if (!source)
    throw new ApiError(
      404,
      "SAFETY_SOURCE_MEDIA_DELETED",
      "이미 삭제되었거나 접근할 수 없는 사진입니다. 다른 사진을 선택해 주세요.",
    );
  await env.DB.batch([
    env.DB.prepare(
      "INSERT OR IGNORE INTO safety_corrective_action_media(id,action_id,safety_case_id,site_id,media_role,source_type,source_media_id,original_name,mime_type,description,uploaded_by_user_id) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)",
    ).bind(
      crypto.randomUUID(),
      actionId,
      caseId,
      auth.siteId,
      role,
      sourceType,
      source.id,
      source.original_name,
      source.mime_type,
      clean(b.description, 500) || null,
      auth.userId,
    ),
    auditStatement(
      env,
      auth.userId,
      "SAFETY_ACTION_SOURCE_MEDIA_LINKED",
      requestId(request),
      { caseId, actionId, sourceType, sourceMediaId, role },
    ),
  ]);
  return json(await casePayload(env, caseId, auth), 201);
}
async function actionMediaContent(
  request,
  env,
  auth,
  caseId,
  actionId,
  mediaId,
  variant,
) {
  await actionForUser(env, auth, caseId, actionId);
  const media = await env.DB.prepare(
    "SELECT * FROM safety_corrective_action_media WHERE id=?1 AND action_id=?2 AND safety_case_id=?3 AND site_id=?4 AND status='ACTIVE'",
  )
    .bind(mediaId, actionId, caseId, auth.siteId)
    .first();
  if (!media)
    throw new ApiError(
      404,
      "SAFETY_MEDIA_NOT_FOUND",
      "증빙 사진을 찾을 수 없습니다.",
    );
  let key = variant === "original" ? media.original_key : media.thumbnail_key;
  if (!key && media.source_type === "ISSUE_MEDIA") {
    const row = await env.DB.prepare(
      `SELECT ${variant === "original" ? "original_key" : "thumbnail_key"} object_key FROM issue_media WHERE id=?1 AND site_id=?2 AND status='ACTIVE'`,
    )
      .bind(media.source_media_id, auth.siteId)
      .first();
    key = row?.object_key;
  }
  if (!key && media.source_type === "CONSTRUCTION_MEDIA") {
    const row = await env.DB.prepare(
      `SELECT ${variant === "original" ? "original_key" : "thumbnail_key"} object_key FROM construction_daily_report_media WHERE id=?1 AND site_id=?2 AND status='ACTIVE'`,
    )
      .bind(media.source_media_id, auth.siteId)
      .first();
    key = row?.object_key;
  }
  if (!key && media.source_type === "SAFETY_MEDIA") {
    const row = await env.DB.prepare(
      `SELECT ${variant === "original" ? "original_key" : "thumbnail_key"} object_key FROM safety_case_media WHERE id=?1 AND site_id=?2 AND status='ACTIVE'`,
    )
      .bind(media.source_media_id, auth.siteId)
      .first();
    key = row?.object_key;
  }
  if (!key)
    throw new ApiError(
      404,
      "SAFETY_SOURCE_MEDIA_DELETED",
      "원본 사진이 삭제되었거나 접근할 수 없습니다.",
    );
  const object = await env.FILES.get(key);
  if (!object)
    throw new ApiError(
      404,
      "SAFETY_MEDIA_OBJECT_MISSING",
      "증빙 사진 파일을 찾을 수 없습니다.",
    );
  const headers = new Headers({
    "cache-control": "private, max-age=300",
    "content-security-policy": "default-src 'none'",
    "x-content-type-options": "nosniff",
  });
  object.writeHttpMetadata(headers);
  return new Response(object.body, { headers });
}
async function transition(request, env, auth, id, action) {
  const c = await caseRow(env, id, auth),
    b = await parseJson(request);
  if (Number(b.revision) !== Number(c.revision))
    throw new ApiError(
      409,
      "SAFETY_STALE_REVISION",
      "다른 사용자가 먼저 변경했습니다. 최신 내용을 확인해 주세요.",
    );
  if (action === "refresh-source") {
    const sources = (
        await env.DB.prepare(
          "SELECT * FROM safety_case_sources WHERE safety_case_id=?1",
        )
          .bind(id)
          .all()
      ).results,
      statements = [],
      before = JSON.stringify(c);
    let primary = null;
    for (const s of sources) {
      const next = await sourceSnapshot(
        env,
        auth,
        s.source_type,
        s.source_id,
        s.source_item_id,
      );
      if (s.is_primary) primary = next;
      statements.push(
        env.DB.prepare(
          "UPDATE safety_case_sources SET source_revision=?2,source_snapshot_json=?3 WHERE id=?1",
        ).bind(s.id, next.revision, JSON.stringify(next.row)),
      );
    }
    if (primary) {
      const row = primary.row || {},
        nextCompany = clean(row.company_id, 80) || c.company_id,
        nextTrade = clean(row.trade_id, 80) || c.trade_id,
        nextLocation = clean(row.location_id, 80) || c.location_id,
        nextTitle =
          clean(row.title || row.manager_summary || row.today_summary, 200) ||
          c.title,
        nextDescription =
          clean(row.description || row.manager_summary || row.today_summary) ||
          c.description;
      statements.push(
        env.DB.prepare(
          "UPDATE safety_cases SET title=?2,description=?3,company_id=?4,trade_id=?5,location_id=?6,work_date_kst=?7,primary_source_revision=?8,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?1",
        ).bind(
          id,
          nextTitle,
          nextDescription,
          nextCompany,
          nextTrade,
          nextLocation,
          clean(row.work_date_kst, 10) || c.work_date_kst,
          primary.revision,
        ),
      );
      const sourceType =
        primary.type === "ISSUE" ? "ISSUE_MEDIA" : "CONSTRUCTION_MEDIA";
      for (const m of primary.media.results)
        statements.push(
          env.DB.prepare(
            "INSERT OR IGNORE INTO safety_case_media(id,safety_case_id,site_id,media_role,source_type,source_media_id,original_name,mime_type,uploaded_by_user_id) VALUES(?1,?2,?3,'DISCOVERY',?4,?5,?6,?7,?8)",
          ).bind(
            crypto.randomUUID(),
            id,
            auth.siteId,
            sourceType,
            m.id,
            m.original_name,
            m.mime_type,
            auth.userId,
          ),
        );
    }
    statements.push(
      env.DB.prepare(
        "INSERT INTO safety_case_revisions(id,safety_case_id,revision,snapshot_json,change_type,change_reason,changed_by_user_id) VALUES(?1,?2,?3,?4,'SOURCE_REFRESH',?5,?6)",
      ).bind(
        crypto.randomUUID(),
        id,
        c.revision,
        before,
        clean(b.reason, 500) || "원본 변경 반영",
        auth.userId,
      ),
      auditStatement(
        env,
        auth.userId,
        "SAFETY_SOURCE_REFRESHED",
        requestId(request),
        { caseId: id, sourceCount: sources.length },
      ),
    );
    await env.DB.batch(statements);
    return json(await casePayload(env, id, auth));
  }
  if (!auth.manage)
    throw new ApiError(
      403,
      "SAFETY_REVIEW_DENIED",
      "현장소장 또는 안전 관리자만 검토·종결할 수 있습니다.",
    );
  const note = clean(b.note, 1000);
  if (!note)
    throw new ApiError(
      400,
      "SAFETY_REVIEW_NOTE_REQUIRED",
      "검토 의견을 입력해 주세요.",
    );
  let status, result;
  if (action === "review") {
    result = clean(b.result, 30);
    if (
      ![
        "APPROPRIATE",
        "REVISION_REQUIRED",
        "RECHECK_REQUIRED",
        "FINALIZABLE",
      ].includes(result)
    )
      throw new ApiError(
        400,
        "SAFETY_REVIEW_RESULT_INVALID",
        "검토 결과를 선택해 주세요.",
      );
    status =
      result === "RECHECK_REQUIRED"
        ? "RECHECK_REQUIRED"
        : result === "REVISION_REQUIRED"
          ? "REWORK_REQUIRED"
          : result === "FINALIZABLE"
            ? "REVIEW_PENDING"
            : "ACTION_IN_PROGRESS";
  } else {
    const actionCounts = await env.DB.prepare(
      "SELECT SUM(status NOT IN ('COMPLETED','CANCELLED')) open_count,SUM(status='COMPLETED') completed_count FROM safety_corrective_actions WHERE safety_case_id=?1",
    )
      .bind(id)
      .first();
    if (Number(actionCounts.open_count))
      throw new ApiError(
        409,
        "SAFETY_ACTIONS_OPEN",
        "미완료 개선조치를 먼저 완료해 주세요.",
      );
    if (!Number(actionCounts.completed_count))
      throw new ApiError(
        409,
        "SAFETY_ACTION_COMPLETION_REQUIRED",
        "완료 확인된 개선조치가 하나 이상 있어야 사례를 종결할 수 있습니다.",
      );
    const assessment = await env.DB.prepare(
      "SELECT 1 FROM safety_risk_assessments WHERE safety_case_id=?1 AND status='CONFIRMED'",
    )
      .bind(id)
      .first();
    if (!assessment || !c.root_cause_id || !c.immediate_control_completed)
      throw new ApiError(
        409,
        "SAFETY_FINALIZE_REQUIREMENTS",
        "즉시 통제, 위험성평가, 근본 원인을 모두 확인해 주세요.",
      );
    status = "FINALIZED";
    result = "FINALIZABLE";
  }
  const statements = [
    env.DB.prepare(
      "UPDATE safety_cases SET status=?2,review_result=?3,finalized_by_user_id=CASE WHEN ?2='FINALIZED' THEN ?4 ELSE finalized_by_user_id END,finalized_at=CASE WHEN ?2='FINALIZED' THEN CURRENT_TIMESTAMP ELSE finalized_at END,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?1",
    ).bind(id, status, result, auth.userId),
    env.DB.prepare(
      "INSERT INTO safety_case_reviews(id,safety_case_id,site_id,review_result,review_note,reviewed_by_user_id) VALUES(?1,?2,?3,?4,?5,?6)",
    ).bind(crypto.randomUUID(), id, auth.siteId, result, note, auth.userId),
    auditStatement(
      env,
      auth.userId,
      action === "finalize" ? "SAFETY_CASE_FINALIZED" : "SAFETY_CASE_REVIEWED",
      requestId(request),
      { caseId: id, result },
    ),
  ];
  await env.DB.batch(statements);
  return json(await casePayload(env, id, auth));
}
async function actionTransition(
  request,
  env,
  auth,
  caseId,
  actionId,
  actionName,
) {
  await caseRow(env, caseId, auth);
  const row = await actionForUser(env, auth, caseId, actionId, true),
    b = await parseJson(request);
  if (Number(b.revision) !== Number(row.revision))
    throw new ApiError(
      409,
      "SAFETY_ACTION_STALE",
      "개선조치가 변경되었습니다.",
    );
  const completionNote = clean(b.completionNote, 2000),
    exceptionReason = clean(b.evidenceExceptionReason, 1000);
  if (
    actionName === "request-completion" &&
    !["ASSIGNED", "REWORK_REQUIRED"].includes(row.status)
  )
    throw new ApiError(
      409,
      "SAFETY_ACTION_TRANSITION_INVALID",
      "현재 상태에서는 조치 완료·검증 요청을 할 수 없습니다.",
    );
  if (
    ["complete", "rework"].includes(actionName) &&
    row.status !== "COMPLETION_REQUESTED"
  )
    throw new ApiError(
      409,
      "SAFETY_ACTION_TRANSITION_INVALID",
      "검증 요청된 개선조치만 완료 확인 또는 재조치할 수 있습니다.",
    );
  if (actionName === "request-completion") {
    if (!completionNote)
      throw new ApiError(
        400,
        "SAFETY_ACTION_COMPLETION_NOTE_REQUIRED",
        "완료 내용을 입력해 주세요.",
      );
    const requiredRoles =
      row.status === "REWORK_REQUIRED"
        ? ["RECHECK"]
        : ["AFTER", "EVIDENCE"];
    const evidence = await env.DB.prepare(
      `SELECT 1 FROM safety_corrective_action_media WHERE action_id=?1 AND site_id=?2 AND media_role IN (${requiredRoles.map((_, index) => `?${index + 3}`).join(",")}) AND status='ACTIVE' LIMIT 1`,
    )
      .bind(actionId, auth.siteId, ...requiredRoles)
      .first();
    if (!evidence && !exceptionReason)
      throw new ApiError(
        400,
        "SAFETY_ACTION_EVIDENCE_REQUIRED",
        "조치 후 사진이나 증빙 자료를 등록해 주세요. 사진 증빙이 어려우면 사유를 입력해 주세요.",
      );
  }
  const next =
    actionName === "request-completion"
      ? "COMPLETION_REQUESTED"
      : actionName === "complete"
        ? "COMPLETED"
        : "REWORK_REQUIRED";
  if (["complete", "rework"].includes(actionName) && !auth.manage)
    throw new ApiError(
      403,
      "SAFETY_ACTION_REVIEW_DENIED",
      "안전 관리자만 완료 또는 재조치를 결정할 수 있습니다.",
    );
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE safety_corrective_actions SET status=?2,review_status=?3,completion_note=CASE WHEN ?2='COMPLETION_REQUESTED' THEN ?5 ELSE completion_note END,evidence_exception_reason=CASE WHEN ?2='COMPLETION_REQUESTED' THEN ?6 ELSE evidence_exception_reason END,completed_at=CASE WHEN ?2='COMPLETED' THEN CURRENT_TIMESTAMP ELSE completed_at END,completed_by_user_id=CASE WHEN ?2='COMPLETED' THEN ?4 ELSE completed_by_user_id END,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?1",
    ).bind(
      actionId,
      next,
      next === "COMPLETED"
        ? "APPROVED"
        : next === "REWORK_REQUIRED"
          ? "REWORK_REQUIRED"
          : "PENDING",
      auth.userId,
      completionNote || null,
      exceptionReason || null,
    ),
    env.DB.prepare(
      "UPDATE safety_cases SET status=?2,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?1",
    ).bind(
      caseId,
      next === "COMPLETION_REQUESTED"
        ? "REVIEW_PENDING"
        : next === "REWORK_REQUIRED"
          ? "REWORK_REQUIRED"
          : "REVIEW_PENDING",
    ),
    auditStatement(
      env,
      auth.userId,
      `SAFETY_ACTION_${next}`,
      requestId(request),
      {
        caseId,
        actionId,
        note: clean(b.note, 500),
        hasEvidenceException: Boolean(exceptionReason),
      },
    ),
  ]);
  return json(await casePayload(env, caseId, auth));
}

async function options(env, auth) {
  const [risks, roots, companies, trades, locations, users] = await Promise.all(
    [
      env.DB.prepare(
        "SELECT id,code,display_name FROM safety_risk_categories WHERE is_active=1 ORDER BY sort_order",
      ).all(),
      env.DB.prepare(
        "SELECT r.id,r.code,r.display_name,g.display_name group_name,c.display_name category_name FROM safety_root_causes r JOIN safety_root_cause_groups g ON g.id=r.group_id JOIN safety_root_cause_categories c ON c.id=g.category_id WHERE r.is_active=1 AND g.is_active=1 AND c.is_active=1 ORDER BY c.sort_order,g.sort_order,r.sort_order",
      ).all(),
      env.DB.prepare(
        "SELECT c.id,c.name,c.company_type FROM company_site_contracts sc JOIN companies c ON c.id=sc.company_id WHERE sc.site_id=?1 AND sc.status='ACTIVE' AND c.status='ACTIVE' ORDER BY c.name",
      )
        .bind(auth.siteId)
        .all(),
      env.DB.prepare(
        "SELECT DISTINCT t.id,t.display_name FROM company_site_contracts sc JOIN company_site_contract_trades ct ON ct.site_contract_id=sc.id JOIN trade_master t ON t.id=ct.trade_id WHERE sc.site_id=?1 AND sc.status='ACTIVE' AND ct.status='ACTIVE' AND t.status='ACTIVE' AND t.is_selectable=1 ORDER BY t.display_name",
      )
        .bind(auth.siteId)
        .all(),
      env.DB.prepare(
        "SELECT id,display_name,location_type FROM site_locations WHERE site_id=?1 AND is_active=1 ORDER BY sort_order,display_name",
      )
        .bind(auth.siteId)
        .all(),
      env.DB.prepare(
        "SELECT u.id,u.display_name,m.company_id,MAX(CASE WHEN r.code IN ('PLATFORM_OWNER','INTEGRATED_OWNER','SITE_MANAGER','SAFETY_MANAGER') THEN 1 ELSE 0 END) site_wide_manager FROM memberships m JOIN users u ON u.id=m.user_id LEFT JOIN user_site_roles usr ON usr.user_id=u.id AND usr.site_id=m.site_id AND usr.status='ACTIVE' LEFT JOIN roles r ON r.id=usr.role_id WHERE m.site_id=?1 AND m.status='ACTIVE' AND u.status='ACTIVE' GROUP BY u.id,u.display_name,m.company_id ORDER BY u.display_name",
      )
        .bind(auth.siteId)
        .all(),
    ],
  );
  return {
    risks: risks.results,
    rootCauses: roots.results,
    companies: companies.results,
    trades: trades.results,
    locations: locations.results,
    users: users.results,
  };
}

async function periodicList(env, auth, url = null) {
  await materializeDaily(env, auth);
  const scope = auth.contractor
    ? " AND (i.assigned_user_id=?2 OR i.assigned_user_id IS NULL)"
    : "";
  const recurrence = clean(url?.searchParams.get("recurrenceType"), 30);
  const status = clean(url?.searchParams.get("status"), 30);
  const args = auth.contractor
    ? [auth.siteId, auth.userId]
    : [auth.siteId];
  const recurrenceFilter = recurrence
    ? ` AND i.recurrence_type=?${args.length + 1}`
    : "";
  if (recurrence) args.push(recurrence);
  const statusFilter = status ? ` AND i.status=?${args.length + 1}` : "";
  if (status) args.push(status);
  const rows = await env.DB.prepare(
    `SELECT i.*,d.title,d.document_type,d.basis_type,d.basis_name,d.basis_reference,d.required_attachment_count,
      u.display_name assignee_name,rv.display_name reviewer_name,pd.review_result,
      (SELECT COUNT(*) FROM periodic_task_checklist_results r WHERE r.task_instance_id=i.id AND r.result IN ('INAPPROPRIATE','UNCONFIRMED') ) finding_count,
      (SELECT COUNT(*) FROM periodic_checklist_items ci WHERE ci.template_id=d.checklist_template_id AND ci.is_active=1)
       -(SELECT COUNT(*) FROM periodic_task_checklist_results rr WHERE rr.task_instance_id=i.id AND rr.result<>'UNCONFIRMED') incomplete_count,
      (SELECT COUNT(*) FROM periodic_task_instance_media pm WHERE pm.task_instance_id=i.id) attachment_count
     FROM periodic_task_instances i JOIN periodic_task_definitions d ON d.id=i.definition_id
     LEFT JOIN users u ON u.id=i.assigned_user_id LEFT JOIN users rv ON rv.id=d.reviewer_user_id
     LEFT JOIN periodic_task_documents pd ON pd.task_instance_id=i.id
     WHERE i.site_id=?1 AND d.module_key='safety'${scope}${recurrenceFilter}${statusFilter} ORDER BY i.scheduled_date_kst DESC,d.title`,
  )
    .bind(...args)
    .all();
  return { items: rows.results };
}
const dateOnly = (value) => new Date(`${value}T00:00:00Z`),
  dateText = (value) => value.toISOString().slice(0, 10),
  addDays = (value, days) => {
    const d = dateOnly(value);
    d.setUTCDate(d.getUTCDate() + days);
    return dateText(d);
  },
  monthLast = (value) => {
    const d = dateOnly(`${value.slice(0, 7)}-01`);
    d.setUTCMonth(d.getUTCMonth() + 1);
    d.setUTCDate(0);
    return dateText(d);
  },
  mondayOf = (value) =>
    addDays(value, -((dateOnly(value).getUTCDay() + 6) % 7));
export function scheduledDates(definition, today = kstDate()) {
  let rule = {};
  try {
    rule = JSON.parse(definition.recurrence_rule || "{}");
  } catch {}
  const dates = [];
  if (definition.recurrence_type === "DAILY") {
    for (let i = 6; i >= 0; i--) dates.push(addDays(today, -i));
  } else if (definition.recurrence_type === "WEEKLY") {
    const thisMonday = mondayOf(today),
      weekday = Math.min(7, Math.max(1, Number(rule.weekday || 1)));
    for (let i = 7; i >= 0; i--)
      dates.push(addDays(addDays(thisMonday, -7 * i), weekday - 1));
  } else if (definition.recurrence_type === "MONTHLY") {
    const base = dateOnly(`${today.slice(0, 7)}-01`);
    for (let i = 11; i >= 0; i--) {
      const month = new Date(base);
      month.setUTCMonth(month.getUTCMonth() - i);
      const first = dateText(month),
        type = rule.type || "DAY";
      if (type === "LAST_DAY") dates.push(monthLast(first));
      else if (type === "FIRST_WEEKDAY") {
        let candidate = first;
        while ([0, 6].includes(dateOnly(candidate).getUTCDay()))
          candidate = addDays(candidate, 1);
        dates.push(candidate);
      } else {
        const last = Number(monthLast(first).slice(8));
        dates.push(
          `${first.slice(0, 8)}${String(Math.min(last, Math.max(1, Number(rule.day || 1)))).padStart(2, "0")}`,
        );
      }
    }
  } else dates.push(today);
  return dates.filter(
    (value) => value >= definition.start_date && value <= today,
  );
}
async function materializeDaily(env, auth) {
  const defs = (
      await env.DB.prepare(
        "SELECT * FROM periodic_task_definitions WHERE site_id=?1 AND module_key='safety' AND is_active=1 AND start_date<=?2",
      )
        .bind(auth.siteId, kstDate())
        .all()
    ).results,
    statements = [];
  for (const d of defs) {
    const existing = new Set(
      (
        await env.DB.prepare(
          "SELECT scheduled_period FROM periodic_task_instances WHERE definition_id=?1",
        )
          .bind(d.id)
          .all()
      ).results.map((row) => row.scheduled_period),
    );
    let generatedCount = 0,
      duplicateCount = 0;
    for (const scheduledDate of scheduledDates(d)) {
      const period =
          d.recurrence_type === "MONTHLY"
            ? scheduledDate.slice(0, 7)
            : d.recurrence_type === "WEEKLY"
              ? mondayOf(scheduledDate)
              : scheduledDate,
        generated = scheduledDate === kstDate() ? "ON_DEMAND" : "CATCH_UP";
      if (existing.has(period)) {
        duplicateCount += 1;
        continue;
      }
      existing.add(period);
      generatedCount += 1;
      statements.push(
        env.DB.prepare(
          "INSERT OR IGNORE INTO periodic_task_instances(id,definition_id,site_id,scheduled_date_kst,due_at,status,assigned_user_id,source_revision,scheduled_period,recurrence_type,generated_by) VALUES(?1,?2,?3,?4,?5,CASE WHEN datetime(?5)<CURRENT_TIMESTAMP THEN 'OVERDUE' ELSE 'AVAILABLE' END,?6,?7,?8,?9,?10)",
        ).bind(
          crypto.randomUUID(),
          d.id,
          auth.siteId,
          scheduledDate,
          `${scheduledDate}T${d.due_time}+09:00`,
          d.assignee_user_id,
          d.revision,
          period,
          d.recurrence_type,
          generated,
        ),
      );
    }
    if (generatedCount || duplicateCount)
      statements.push(
        auditStatement(
          env,
          auth.userId,
          generatedCount
            ? "SAFETY_PERIODIC_INSTANCES_GENERATED"
            : "SAFETY_PERIODIC_DUPLICATE_SKIPPED",
          crypto.randomUUID(),
          {
            definitionId: d.id,
            recurrenceType: d.recurrence_type,
            generatedCount,
            duplicateCount,
          },
        ),
      );
  }
  if (statements.length) await env.DB.batch(statements);
  await env.DB.prepare(
    "UPDATE periodic_task_instances SET status='OVERDUE',updated_at=CURRENT_TIMESTAMP WHERE site_id=?1 AND status IN ('AVAILABLE','SCHEDULED') AND datetime(due_at)<CURRENT_TIMESTAMP",
  )
    .bind(auth.siteId)
    .run();
}
async function createPeriodicDefinition(request, env, auth) {
  if (!auth.manage)
    throw new ApiError(
      403,
      "SAFETY_PERIODIC_MANAGE_DENIED",
      "안전 정기 업무는 현장소장 또는 안전 관리자만 설정할 수 있습니다.",
    );
  const b = await parseJson(request),
    title = clean(b.title, 200),
    recurrence = clean(b.recurrenceType || "DAILY", 30),
    assignee = clean(b.assigneeUserId, 80),
    rule =
      recurrence === "WEEKLY"
        ? { weekday: Math.min(7, Math.max(1, Number(b.weekday || 1))) }
        : recurrence === "MONTHLY"
          ? {
              type: clean(b.monthlyRuleType || "DAY", 30),
              day: Math.min(31, Math.max(1, Number(b.monthlyDay || 1))),
            }
          : {};
  if (
    !title ||
    !["DAILY", "WEEKLY", "MONTHLY"].includes(recurrence) ||
    !assignee
  )
    throw new ApiError(
      400,
      "SAFETY_PERIODIC_INPUT_REQUIRED",
      "업무명, 주기, 담당자를 입력해 주세요.",
    );
  const basisType = clean(b.basisType || "SITE_PLAN", 40);
  if (
    ![
      "LEGAL_VERIFIED",
      "APPROVED_SAFETY_PLAN",
      "SITE_PLAN",
      "CONTRACT",
      "CONFIRMATION_REQUIRED",
    ].includes(basisType)
  )
    throw new ApiError(
      400,
      "SAFETY_DOCUMENT_BASIS_INVALID",
      "서류 업무의 근거 유형을 다시 선택해 주세요.",
    );
  if (
    ["LEGAL_VERIFIED", "APPROVED_SAFETY_PLAN", "CONTRACT"].includes(
      basisType,
    ) &&
    (!clean(b.basisName, 300) || !clean(b.basisReference, 300))
  )
    throw new ApiError(
      400,
      "SAFETY_DOCUMENT_BASIS_REQUIRED",
      "확인된 근거명과 관련 조항·문서 위치를 입력해 주세요.",
    );
  if (
    recurrence === "MONTHLY" &&
    !["DAY", "FIRST_WEEKDAY", "LAST_DAY"].includes(rule.type)
  )
    throw new ApiError(
      400,
      "SAFETY_PERIODIC_RULE_INVALID",
      "월간 생성 규칙을 다시 선택해 주세요.",
    );
  const id = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(
    "INSERT INTO periodic_task_definitions(id,site_id,module_key,board_key,task_key,title,description,recurrence_type,recurrence_rule,start_date,due_time,assignee_user_id,reviewer_user_id,checklist_template_id,created_by_user_id,document_type,basis_type,basis_name,basis_reference,required_attachment_count) VALUES(?1,?2,'safety','SAFETY_PERIODIC_TASK',?3,?4,?5,?6,?7,?8,?9,?10,?11,'periodic-template-safety-daily',?12,?13,?14,?15,?16,?17)",
    ).bind(
      id,
      auth.siteId,
      `SAFETY-${Date.now()}`,
      title,
      clean(b.description, 500),
      recurrence,
      JSON.stringify(rule),
      clean(b.startDate || kstDate(), 10),
      clean(b.dueTime || "17:00", 5),
      assignee,
      clean(b.reviewerUserId, 80) || auth.userId,
      auth.userId,
      clean(b.documentType || "SAFETY_CHECK_SHEET", 80),
      basisType,
      clean(b.basisName, 300) || null,
      clean(b.basisReference, 300) || null,
      Math.max(0, Number(b.requiredAttachmentCount || 0)),
    ),
    auditStatement(
      env,
      auth.userId,
      "SAFETY_PERIODIC_DEFINITION_CREATED",
      requestId(request),
      { definitionId: id, recurrenceType: recurrence, recurrenceRule: rule },
    ),
  ]);
  await materializeDaily(env, auth);
  return json(await periodicList(env, auth), 201);
}
async function periodicDetail(env, id, auth) {
  const instance = await env.DB.prepare(
    "SELECT i.*,d.title,d.description,d.recurrence_type,d.checklist_template_id,d.document_type,d.basis_type,d.basis_name,d.basis_reference,d.required_attachment_count,u.display_name assignee_name,rv.display_name reviewer_name,s.name site_name FROM periodic_task_instances i JOIN periodic_task_definitions d ON d.id=i.definition_id JOIN sites s ON s.id=i.site_id LEFT JOIN users u ON u.id=i.assigned_user_id LEFT JOIN users rv ON rv.id=d.reviewer_user_id WHERE i.id=?1 AND i.site_id=?2 AND d.module_key='safety'",
  )
    .bind(id, auth.siteId)
    .first();
  if (!instance)
    throw new ApiError(
      404,
      "SAFETY_PERIODIC_NOT_FOUND",
      "안전 정기 업무를 찾을 수 없습니다.",
    );
  if (
    auth.contractor &&
    instance.assigned_user_id &&
    instance.assigned_user_id !== auth.userId
  )
    throw new ApiError(
      403,
      "SAFETY_PERIODIC_SCOPE_DENIED",
      "담당 정기 업무만 열람할 수 있습니다.",
    );
  const rows = await env.DB.prepare(
      "SELECT ci.id checklist_item_id,ci.prompt,ci.guidance,ci.requires_photo,r.id result_id,r.result,r.note FROM periodic_checklist_items ci LEFT JOIN periodic_task_checklist_results r ON r.checklist_item_id=ci.id AND r.task_instance_id=?1 WHERE ci.template_id=?2 AND ci.is_active=1 ORDER BY ci.sort_order",
    )
      .bind(id, instance.checklist_template_id)
      .all(),
    findings = await env.DB.prepare(
      "SELECT * FROM periodic_task_findings WHERE task_instance_id=?1",
    )
      .bind(id)
      .all(),
    document = await env.DB.prepare(
      "SELECT * FROM periodic_task_documents WHERE task_instance_id=?1",
    )
      .bind(id)
      .first();
  const autoDraft = await env.DB.prepare(
    `SELECT
      (SELECT COUNT(*) FROM workforce_attendance WHERE site_id=?1 AND work_date=?2 AND cancelled_at IS NULL) workforce_count,
      (SELECT today_summary FROM construction_daily_reports WHERE site_id=?1 AND work_date_kst=?2 ORDER BY revision DESC LIMIT 1) construction_summary,
      (SELECT COUNT(*) FROM safety_cases WHERE site_id=?1 AND work_date_kst=?2 AND status NOT IN ('FINALIZED','CANCELLED')) open_safety_count,
      (SELECT COUNT(*) FROM safety_corrective_actions WHERE site_id=?1 AND status NOT IN ('COMPLETED','CANCELLED')) open_action_count`,
  ).bind(auth.siteId, instance.scheduled_date_kst).first();
  return {
    instance,
    items: rows.results,
    findings: findings.results,
    document,
    autoDraft,
  };
}
async function savePeriodic(request, env, auth, id, action) {
  const data = await periodicDetail(env, id, auth),
    b = await parseJson(request);
  if (Number(b.revision) !== Number(data.instance.revision))
    throw new ApiError(
      409,
      "SAFETY_PERIODIC_STALE",
      "정기 업무가 변경되었습니다. 최신 내용을 확인해 주세요.",
    );
  const editableStatuses = new Set([
    "AVAILABLE",
    "OVERDUE",
    "IN_PROGRESS",
    "REVISION_REQUESTED",
  ]);
  if (
    ["save", "submit"].includes(action) &&
    !editableStatuses.has(data.instance.status)
  )
    throw new ApiError(
      409,
      "SAFETY_PERIODIC_STATUS_INVALID",
      "현재 상태에서는 안전 서류를 수정하거나 다시 제출할 수 없습니다.",
    );
  if (
    ["complete", "revision-request"].includes(action) &&
    data.instance.status !== "REVIEW_PENDING"
  )
    throw new ApiError(
      409,
      "SAFETY_PERIODIC_REVIEW_STATUS_INVALID",
      "검토 대기 중인 안전 서류만 승인하거나 보완 요청할 수 있습니다.",
    );
  if (
    ["save", "submit"].includes(action) &&
    data.instance.assigned_user_id &&
    data.instance.assigned_user_id !== auth.userId &&
    !auth.manage
  )
    throw new ApiError(
      403,
      "SAFETY_PERIODIC_ASSIGNEE_DENIED",
      "담당자만 안전 서류를 작성하거나 제출할 수 있습니다.",
    );
  if (action === "save") {
    if (
      data.instance.assigned_user_id &&
      data.instance.assigned_user_id !== auth.userId &&
      !auth.manage
    )
      throw new ApiError(
        403,
        "SAFETY_PERIODIC_ASSIGNEE_DENIED",
        "담당자만 점검 결과를 입력할 수 있습니다.",
      );
    const valid = new Set(data.items.map((v) => v.checklist_item_id)),
      statements = [];
    for (const item of Array.isArray(b.items) ? b.items : []) {
      if (
        !valid.has(item.checklistItemId) ||
        ![
          "APPROPRIATE",
          "INAPPROPRIATE",
          "NOT_APPLICABLE",
          "UNCONFIRMED",
        ].includes(item.result)
      )
        throw new ApiError(
          400,
          "SAFETY_PERIODIC_RESULT_INVALID",
          "점검 결과를 다시 확인해 주세요.",
        );
      statements.push(
        env.DB.prepare(
          "INSERT INTO periodic_task_checklist_results(id,task_instance_id,checklist_item_id,result,note,created_by_user_id) VALUES(?1,?2,?3,?4,?5,?6) ON CONFLICT(task_instance_id,checklist_item_id) DO UPDATE SET result=excluded.result,note=excluded.note,revision=periodic_task_checklist_results.revision+1,updated_at=CURRENT_TIMESTAMP",
        ).bind(
          crypto.randomUUID(),
          id,
          item.checklistItemId,
          item.result,
          clean(item.note, 500),
          auth.userId,
        ),
      );
    }
    statements.push(
      env.DB.prepare(
        "UPDATE periodic_task_instances SET status='IN_PROGRESS',started_at=COALESCE(started_at,CURRENT_TIMESTAMP),revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?1",
      ).bind(id),
      auditStatement(
        env,
        auth.userId,
        "SAFETY_PERIODIC_SAVED",
        requestId(request),
        { instanceId: id },
      ),
    );
    await env.DB.batch(statements);
  } else if (action === "submit") {
    const refreshed = await periodicDetail(env, id, auth);
    if (refreshed.items.some((v) => !v.result))
      throw new ApiError(
        400,
        "SAFETY_PERIODIC_CHECKLIST_INCOMPLETE",
        "모든 점검 항목의 결과를 선택해 주세요.",
      );
    const unresolved = refreshed.items.filter(
      (v) =>
        ["INAPPROPRIATE", "UNCONFIRMED"].includes(v.result) &&
        !refreshed.findings.some(
          (f) =>
            f.checklist_result_id === v.result_id &&
            ["LINKED", "WAIVED", "RESOLVED"].includes(f.status),
        ),
    );
    if (unresolved.length)
      throw new ApiError(
        409,
        "SAFETY_PERIODIC_FOLLOWUP_REQUIRED",
        "부적합·미확인 항목은 안전 사례 연결 또는 검토자 면제가 필요합니다.",
      );
    const snapshot = JSON.stringify({
      instance: {
        id,
        title: refreshed.instance.title,
        scheduledDate: refreshed.instance.scheduled_date_kst,
        revision: refreshed.instance.revision,
      },
      document: {
        title: refreshed.instance.title,
        type: refreshed.instance.document_type,
        siteName: refreshed.instance.site_name,
        basisType: refreshed.instance.basis_type,
        basisName: refreshed.instance.basis_name,
        basisReference: refreshed.instance.basis_reference,
        assignee: refreshed.instance.assignee_name,
        reviewer: refreshed.instance.reviewer_name,
      },
      autoDraft: refreshed.autoDraft,
      checklist: refreshed.items.map((v) => ({
        prompt: v.prompt,
        result: v.result,
        note: v.note,
      })),
    });
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO periodic_task_documents(id,task_instance_id,document_title,document_template_id,document_data_json,submitted_by_user_id,submitted_at) VALUES(?1,?2,?3,?4,?5,?6,CURRENT_TIMESTAMP) ON CONFLICT(task_instance_id) DO UPDATE SET document_title=excluded.document_title,document_data_json=excluded.document_data_json,revision=periodic_task_documents.revision+1,submitted_by_user_id=excluded.submitted_by_user_id,submitted_at=CURRENT_TIMESTAMP,review_result=NULL,review_note=NULL,approved_by_user_id=NULL,approved_at=NULL,updated_at=CURRENT_TIMESTAMP",
      ).bind(crypto.randomUUID(), id, refreshed.instance.title, refreshed.instance.document_type, snapshot, auth.userId),
      env.DB.prepare(
        "UPDATE periodic_task_instances SET status='REVIEW_PENDING',submitted_at=CURRENT_TIMESTAMP,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?1",
      ).bind(id),
      auditStatement(
        env,
        auth.userId,
        "SAFETY_PERIODIC_SUBMITTED",
        requestId(request),
        { instanceId: id },
      ),
    ]);
  } else {
    if (!auth.manage)
      throw new ApiError(
        403,
        "SAFETY_PERIODIC_REVIEW_DENIED",
        "현장소장 또는 안전 관리자만 검토할 수 있습니다.",
      );
    const note = clean(b.note, 1000);
    if (!note)
      throw new ApiError(
        400,
        "SAFETY_PERIODIC_REVIEW_NOTE_REQUIRED",
        "검토 의견을 입력해 주세요.",
      );
    const next = action === "complete" ? "COMPLETED" : "REVISION_REQUESTED";
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE periodic_task_instances SET status=?2,reviewed_at=CURRENT_TIMESTAMP,reviewed_by_user_id=?3,completed_at=CASE WHEN ?2='COMPLETED' THEN CURRENT_TIMESTAMP ELSE completed_at END,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?1",
      ).bind(id, next, auth.userId),
      env.DB.prepare(
        "UPDATE periodic_task_documents SET review_result=?2,review_note=?3,approved_by_user_id=CASE WHEN ?2='APPROVED' THEN ?4 ELSE NULL END,approved_at=CASE WHEN ?2='APPROVED' THEN CURRENT_TIMESTAMP ELSE NULL END,updated_at=CURRENT_TIMESTAMP WHERE task_instance_id=?1",
      ).bind(id, action === "complete" ? "APPROVED" : "REVISION_REQUESTED", note, auth.userId),
      env.DB.prepare(
        "INSERT INTO periodic_task_revisions(id,task_instance_id,revision,snapshot_json,change_type,change_reason,changed_by_user_id) VALUES(?1,?2,?3,?4,?5,?6,?7)",
      ).bind(
        crypto.randomUUID(),
        id,
        data.instance.revision,
        JSON.stringify(data),
        action.toUpperCase(),
        note,
        auth.userId,
      ),
      auditStatement(
        env,
        auth.userId,
        `SAFETY_PERIODIC_${next}`,
        requestId(request),
        { instanceId: id },
      ),
    ]);
  }
  return json(await periodicDetail(env, id, auth));
}
async function waivePeriodicFinding(request, env, auth, id) {
  if (!auth.manage)
    throw new ApiError(
      403,
      "SAFETY_PERIODIC_WAIVE_DENIED",
      "검토자만 후속조치를 면제할 수 있습니다.",
    );
  await periodicDetail(env, id, auth);
  const b = await parseJson(request),
    resultId = clean(b.checklistResultId, 80),
    reason = clean(b.reason, 1000);
  if (!resultId || !reason)
    throw new ApiError(
      400,
      "SAFETY_PERIODIC_WAIVE_REASON_REQUIRED",
      "면제할 항목과 사유를 입력해 주세요.",
    );
  const result = await env.DB.prepare(
    "SELECT r.id,r.result,ci.prompt FROM periodic_task_checklist_results r JOIN periodic_checklist_items ci ON ci.id=r.checklist_item_id WHERE r.id=?1 AND r.task_instance_id=?2 AND r.result IN ('INAPPROPRIATE','UNCONFIRMED')",
  )
    .bind(resultId, id)
    .first();
  if (!result)
    throw new ApiError(
      400,
      "SAFETY_PERIODIC_WAIVE_TARGET_INVALID",
      "면제할 부적합·미확인 항목을 다시 확인해 주세요.",
    );
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO periodic_task_findings(id,task_instance_id,checklist_result_id,finding_type,description,status) VALUES(?1,?2,?3,'REVIEW',?4,'WAIVED') ON CONFLICT(checklist_result_id,finding_type) DO UPDATE SET description=excluded.description,status='WAIVED',updated_at=CURRENT_TIMESTAMP",
    ).bind(crypto.randomUUID(), id, resultId, `${result.prompt}: ${reason}`),
    auditStatement(
      env,
      auth.userId,
      "SAFETY_PERIODIC_FINDING_WAIVED",
      requestId(request),
      { instanceId: id, resultId, reason },
    ),
  ]);
  return json(await periodicDetail(env, id, auth));
}

export async function handleSafetyRequest(
  request,
  env,
  url = new URL(request.url),
) {
  const path = url.pathname,
    method = request.method;
  if (!path.startsWith("/api/v1/safety")) return null;
  if (method === "GET" && path === "/api/v1/safety/options") {
    const auth = await authorize(request, env);
    return json(await options(env, auth));
  }
  if (method === "GET" && path === "/api/v1/safety/dashboard") {
    const auth = await authorize(request, env, {
      boardKey: BOARD_KEYS.SAFETY_DASHBOARD,
    });
    const scope = scoped(auth),
      [counts, root] = await Promise.all([
        env.DB.prepare(
          `SELECT COUNT(*) total,SUM(status='FINALIZED') finalized,SUM(status NOT IN ('FINALIZED','CANCELLED')) open,SUM(status='REVIEW_PENDING') review FROM safety_cases c WHERE c.site_id=?1${scope.sql}`,
        )
          .bind(...scope.args)
          .first(),
        env.DB.prepare(
          `SELECT r.display_name,COUNT(*) count FROM safety_cases c JOIN safety_root_causes r ON r.id=c.root_cause_id WHERE c.site_id=?1${scope.sql} GROUP BY r.id ORDER BY count DESC LIMIT 5`,
        )
          .bind(...scope.args)
          .all(),
      ]);
    const periodic = await periodicList(env, auth);
    return json({
      counts: {
        total: Number(counts.total || 0),
        open: Number(counts.open || 0),
        review: Number(counts.review || 0),
        finalized: Number(counts.finalized || 0),
        overdue: periodic.items.filter((v) =>
          ["OVERDUE", "MISSED"].includes(v.status),
        ).length,
      },
      rootCauses: root.results,
    });
  }
  if (method === "GET" && path === "/api/v1/safety/periodic-documents") {
    const auth = await authorize(request, env, {
      boardKey: BOARD_KEYS.SAFETY_PERIODIC_TASK,
    });
    const rows = await env.DB.prepare(
      `SELECT pd.id,pd.document_title,pd.revision,pd.review_result,pd.submitted_at,pd.approved_at,
        i.scheduled_date_kst,u.display_name submitted_by_name,au.display_name approved_by_name
       FROM periodic_task_documents pd JOIN periodic_task_instances i ON i.id=pd.task_instance_id
       JOIN periodic_task_definitions d ON d.id=i.definition_id
       LEFT JOIN users u ON u.id=pd.submitted_by_user_id LEFT JOIN users au ON au.id=pd.approved_by_user_id
       WHERE i.site_id=?1 AND d.module_key='safety' ORDER BY pd.submitted_at DESC`,
    )
      .bind(auth.siteId)
      .all();
    return json({ items: rows.results });
  }
  if (method === "GET" && path === "/api/v1/safety/cases") {
    const auth = await authorize(request, env),
      scope = scoped(auth),
      rows = await env.DB.prepare(
        `SELECT c.*,r.display_name risk_name,
          COALESCE(assigned.owner_user_id,c.owner_user_id) effective_owner_user_id,
          COALESCE(assigned.owner_company_id,c.company_id) effective_company_id,
          COALESCE(assigned_user.display_name,case_user.display_name) owner_name,
          COALESCE(assigned_company.name,case_company.name) company_name
         FROM safety_cases c
         JOIN safety_risk_categories r ON r.id=c.risk_category_id
         LEFT JOIN safety_corrective_actions assigned ON assigned.id=(
           SELECT latest.id FROM safety_corrective_actions latest
           WHERE latest.safety_case_id=c.id AND latest.status NOT IN ('CANCELLED','COMPLETED')
           ORDER BY latest.created_at DESC LIMIT 1
         )
         LEFT JOIN users assigned_user ON assigned_user.id=assigned.owner_user_id
         LEFT JOIN users case_user ON case_user.id=c.owner_user_id
         LEFT JOIN companies assigned_company ON assigned_company.id=assigned.owner_company_id
         LEFT JOIN companies case_company ON case_company.id=c.company_id
         WHERE c.site_id=?1${scope.sql} ORDER BY c.created_at DESC LIMIT 100`,
      )
        .bind(...scope.args)
        .all();
    return json({ items: rows.results });
  }
  if (method === "POST" && path === "/api/v1/safety/cases") {
    const auth = await authorize(request, env, {
      required: "EDIT",
      write: true,
    });
    return createCase(request, env, auth);
  }
  if (method === "GET" && path === "/api/v1/safety/periodic") {
    const auth = await authorize(request, env, {
      boardKey: BOARD_KEYS.SAFETY_PERIODIC_TASK,
    });
    return json(await periodicList(env, auth, url));
  }
  if (method === "POST" && path === "/api/v1/safety/periodic/definitions") {
    const auth = await authorize(request, env, {
      boardKey: BOARD_KEYS.SAFETY_PERIODIC_TASK,
      required: "MANAGE",
      write: true,
    });
    return createPeriodicDefinition(request, env, auth);
  }
  const periodic = path.match(
    /^\/api\/v1\/safety\/periodic\/([^/]+)(?:\/(save|submit|complete|revision-request|waive))?$/,
  );
  if (periodic) {
    const auth = await authorize(request, env, {
      boardKey: BOARD_KEYS.SAFETY_PERIODIC_TASK,
      required:
        method === "GET" ? "VIEW" : periodic[2] === "waive" ? "MANAGE" : "EDIT",
      write: method !== "GET",
    });
    if (method === "GET" && !periodic[2])
      return json(await periodicDetail(env, periodic[1], auth));
    if (method === "POST" && periodic[2] === "waive")
      return waivePeriodicFinding(request, env, auth, periodic[1]);
    if (method === "POST" && periodic[2])
      return savePeriodic(request, env, auth, periodic[1], periodic[2]);
  }
  const actionMediaContentMatch = path.match(
    /^\/api\/v1\/safety\/cases\/([^/]+)\/actions\/([^/]+)\/media\/([^/]+)\/(thumbnail|original)$/,
  );
  if (method === "GET" && actionMediaContentMatch) {
    const auth = await authorize(request, env, {
      boardKey: BOARD_KEYS.SAFETY_CORRECTIVE_ACTION,
    });
    return actionMediaContent(
      request,
      env,
      auth,
      actionMediaContentMatch[1],
      actionMediaContentMatch[2],
      actionMediaContentMatch[3],
      actionMediaContentMatch[4],
    );
  }
  const actionMediaMatch = path.match(
    /^\/api\/v1\/safety\/cases\/([^/]+)\/actions\/([^/]+)\/media$/,
  );
  if (method === "POST" && actionMediaMatch) {
    const auth = await authorize(request, env, {
      boardKey: BOARD_KEYS.SAFETY_CORRECTIVE_ACTION,
      required: "EDIT",
      write: true,
    });
    return storeActionMedia(
      request,
      env,
      auth,
      actionMediaMatch[1],
      actionMediaMatch[2],
    );
  }
  const actionMediaReferenceMatch = path.match(
    /^\/api\/v1\/safety\/cases\/([^/]+)\/actions\/([^/]+)\/media-reference$/,
  );
  if (method === "POST" && actionMediaReferenceMatch) {
    const auth = await authorize(request, env, {
      boardKey: BOARD_KEYS.SAFETY_CORRECTIVE_ACTION,
      required: "EDIT",
      write: true,
    });
    return referenceActionMedia(
      request,
      env,
      auth,
      actionMediaReferenceMatch[1],
      actionMediaReferenceMatch[2],
    );
  }
  const action = path.match(
    /^\/api\/v1\/safety\/cases\/([^/]+)\/actions\/([^/]+)\/(request-completion|complete|rework|cancel)$/,
  );
  if (method === "POST" && action) {
    const auth = await authorize(request, env, {
      boardKey: BOARD_KEYS.SAFETY_CORRECTIVE_ACTION,
      required: "EDIT",
      write: true,
    });
    return action[3] === "cancel"
      ? cancelAction(request, env, auth, action[1], action[2])
      : actionTransition(
          request,
          env,
          auth,
          action[1],
          action[2],
          action[3],
        );
  }
  const actionAssignment = path.match(
    /^\/api\/v1\/safety\/cases\/([^/]+)\/actions\/([^/]+)\/assignment$/,
  );
  if (method === "PUT" && actionAssignment) {
    const auth = await authorize(request, env, {
      boardKey: BOARD_KEYS.SAFETY_CORRECTIVE_ACTION,
      required: "MANAGE",
      write: true,
    });
    return updateActionAssignment(
      request,
      env,
      auth,
      actionAssignment[1],
      actionAssignment[2],
    );
  }
  const match = path.match(
    /^\/api\/v1\/safety\/cases\/([^/]+)(?:\/(control|assessment|actions|review|finalize|refresh-source))?$/,
  );
  if (!match) return null;
  const auth = await authorize(request, env, {
    boardKey:
      match[2] === "assessment"
        ? BOARD_KEYS.SAFETY_RISK_ASSESSMENT
        : match[2] === "actions"
          ? BOARD_KEYS.SAFETY_CORRECTIVE_ACTION
          : BOARD_KEYS.SAFETY_CASE,
    required:
      method === "GET"
        ? "VIEW"
        : match[2] === "finalize" || match[2] === "review"
          ? "MANAGE"
          : "EDIT",
    write: method !== "GET",
  });
  if (method === "GET" && !match[2])
    return json(await casePayload(env, match[1], auth));
  if (method === "POST" && match[2] === "control")
    return controlCase(request, env, auth, match[1]);
  if (method === "POST" && match[2] === "assessment")
    return assessCase(request, env, auth, match[1]);
  if (method === "POST" && match[2] === "actions")
    return addAction(request, env, auth, match[1]);
  if (
    method === "POST" &&
    ["review", "finalize", "refresh-source"].includes(match[2])
  )
    return transition(request, env, auth, match[1], match[2]);
  return null;
}

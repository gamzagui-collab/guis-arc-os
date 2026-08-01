import {
  escapeHtml,
  loadingSkeleton,
  errorState,
} from "../../../packages/ui/components.js";
let state = {};
const csrf = () => sessionStorage.getItem("integrated.csrf") || "",
  label = {
    DISCOVERED: "발견",
    ASSESSMENT_REQUIRED: "평가 필요",
    ASSIGNED: "조치 배정",
    ACTION_IN_PROGRESS: "개선조치 중",
    COMPLETION_REQUESTED: "조치 완료·검증 요청",
    REVIEW_PENDING: "검토 대기",
    RECHECK_REQUIRED: "재확인",
    FINALIZED: "종결",
    REWORK_REQUIRED: "재지시",
    AVAILABLE: "수행 가능",
    IN_PROGRESS: "수행 중",
    REVISION_REQUESTED: "보완 요청",
    COMPLETED: "완료",
    CANCELLED: "취소",
    OVERDUE: "기한 초과",
    MISSED: "미실시",
  },
  documentLabel = {
    SAFETY_CHECK_SHEET: "안전점검표",
    TBM_RECORD: "TBM 기록 및 참석 명부",
    SAFETY_MEETING_MINUTES: "안전회의 회의록",
    RISK_ASSESSMENT_REVIEW: "위험성평가 검토 기록",
    SAFETY_SYSTEM_CONFIRMATION: "안전관리체계 이행 확인서",
  };
async function api(path, options = {}) {
  const isForm = options.body instanceof FormData,
    r = await fetch(`/api/v1/safety${path}`, {
      credentials: "include",
      cache: "no-store",
      ...options,
      headers: {
        ...(isForm ? {} : { "content-type": "application/json" }),
        "x-csrf-token": csrf(),
        "x-context-version": String(state.session.context.contextVersion),
        ...(options.headers || {}),
      },
    }),
    b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(b.message || "안전 업무를 처리하지 못했습니다.");
  return b;
}
async function makeThumbnail(file) {
  if (!(file instanceof File) || !file.size)
    throw new Error("사진을 촬영하거나 선택해 주세요.");
  const bitmap = await createImageBitmap(file),
    scale = Math.min(1, 960 / Math.max(bitmap.width, bitmap.height)),
    canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (value) =>
        value
          ? resolve(value)
          : reject(new Error("사진 크기 조정에 실패했습니다.")),
      "image/webp",
      0.78,
    ),
  );
  return new File([blob], "thumbnail.webp", { type: "image/webp" });
}
const head = (t, d = "") =>
    `<header class="page-header"><div><div class="breadcrumb">안전 관리</div><h1>${escapeHtml(t)}</h1><p>${escapeHtml(d)}</p></div></header>`,
  opt = (a, k = "display_name") =>
    a
      .map((v) => `<option value="${v.id}">${escapeHtml(v[k])}</option>`)
      .join(""),
  can = (k, l = "VIEW") =>
    (({ VIEW: 1, EDIT: 2, MANAGE: 3 })[
      state.session.context.boardAccess?.[k]?.accessLevel
    ] || 0) >= ({ VIEW: 1, EDIT: 2, MANAGE: 3 }[l] || 1),
  busy = async (b, fn) => {
    b.disabled = true;
    try {
      return await fn();
    } finally {
      b.disabled = false;
    }
  };
async function dashboard() {
  state.content.innerHTML = loadingSkeleton();
  try {
    const d = await api("/dashboard");
    state.content.innerHTML =
      head(
        "안전 현황",
        "수시 위험 사례와 정기 안전 업무를 분리해 보여줍니다.",
      ) +
      `<section class="safety-summary">${[
        ["진행 중", d.counts.open],
        ["검토 대기", d.counts.review],
        ["종결", d.counts.finalized],
        ["정기 기한 초과", d.counts.overdue],
      ]
        .map(
          (v) =>
            `<article class="card"><span>${v[0]}</span><strong>${v[1]}</strong></article>`,
        )
        .join(
          "",
        )}</section><section class="safety-links"><a class="card" href="/safety/cases"><strong>위험·개선조치</strong><span>수시 안전 사례 ${d.counts.total}건</span></a><a class="card" href="/safety/periodic"><strong>안전 정기 업무</strong><span>정기 점검 수행</span></a></section><section class="card"><h2>반복 근본 원인</h2>${d.rootCauses.map((v) => `<p>${escapeHtml(v.display_name)} <strong>${v.count}건</strong></p>`).join("") || "<p>집계할 사례가 없습니다.</p>"}</section>`;
  } catch (e) {
    state.content.innerHTML = head("안전 현황") + errorState(e.message);
  }
}
async function cases() {
  state.content.innerHTML = loadingSkeleton();
  try {
    const [d, o] = await Promise.all([api("/cases"), api("/options")]);
    state.options = o;
    state.content.innerHTML =
      head(
        "위험·개선조치",
        "Issue·공사일보 원본을 canonical ID로 연결합니다.",
      ) +
      `${can("SAFETY_CASE", "EDIT") ? '<button id="new-case" class="primary">안전 사례 등록</button>' : ""}<div class="safety-list">${d.items.map((v) => `<article class="card safety-row"><div><span class="status-badge">${label[v.status] || v.status}</span><strong>${escapeHtml(v.title)}</strong></div><small>${escapeHtml(v.risk_name)} · ${escapeHtml(v.company_name || "회사 미지정")} · ${escapeHtml(v.owner_name || "담당 미지정")}</small><button data-id="${v.id}" class="secondary">열기</button></article>`).join("") || "<p>안전 사례가 없습니다.</p>"}</div><div id="safety-editor"></div>`;
    document.querySelector("#new-case")?.addEventListener("click", createForm);
    document
      .querySelectorAll("[data-id]")
      .forEach((b) => (b.onclick = () => openCase(b.dataset.id)));
    if (new URLSearchParams(location.search).get("sourceType")) createForm();
  } catch (e) {
    state.content.innerHTML = head("위험·개선조치") + errorState(e.message);
  }
}
function createForm() {
  const p = new URLSearchParams(location.search),
    type = p.get("sourceType") || "DIRECT",
    o = state.options,
    t = document.querySelector("#safety-editor");
  t.innerHTML = `<form id="case-create" class="card safety-editor"><h2>안전 사례 등록</h2>${type !== "DIRECT" ? `<p class="source-banner">연결 원본 ${escapeHtml(type)} · ${escapeHtml(p.get("sourceId") || "")}</p>` : ""}<input type="hidden" name="sourceType" value="${type}"><input type="hidden" name="sourceId" value="${escapeHtml(p.get("sourceId") || "")}"><input type="hidden" name="sourceItemId" value="${escapeHtml(p.get("sourceItemId") || "")}"><label>제목<input name="title"></label><label>내용<textarea name="description"></textarea></label><label>위험 분류<select name="riskCategoryId" required><option value="">선택</option>${opt(o.risks)}</select></label><label>회사<select name="companyId"><option value="">원본 또는 미지정</option>${opt(o.companies, "name")}</select></label><label>공종<select name="tradeId"><option value="">원본 또는 미지정</option>${opt(o.trades)}</select></label><label>위치<select name="locationId"><option value="">원본 또는 미지정</option>${opt(o.locations)}</select></label><label>담당자<select name="ownerUserId">${opt(o.users)}</select></label><label>기한<input name="dueDate" type="date"></label><label><input name="immediateControlRequired" type="checkbox"> 즉시 통제 필요</label><button class="primary">등록</button><p role="status"></p></form>`;
  t.scrollIntoView({ behavior: "smooth" });
  t.querySelector("form").onsubmit = (e) => {
    e.preventDefault();
    busy(e.submitter, async () => {
      const b = Object.fromEntries(new FormData(e.target));
      b.immediateControlRequired = e.target.immediateControlRequired.checked;
      try {
        renderCase(
          await api("/cases", { method: "POST", body: JSON.stringify(b) }),
        );
      } catch (x) {
        e.target.querySelector("[role=status]").textContent = x.message;
      }
    });
  };
}
async function openCase(id) {
  const t = document.querySelector("#safety-editor");
  t.innerHTML = loadingSkeleton();
  try {
    renderCase(await api(`/cases/${id}`));
  } catch (e) {
    t.innerHTML = errorState(e.message);
  }
}
const formPost = (d, path, b) =>
  api(`/cases/${d.case.id}/${path}`, {
    method: "POST",
    body: JSON.stringify({ revision: d.case.revision, ...b }),
  });
function workflowState(d) {
  const actionStatuses = new Set(d.actions.map((action) => action.status));
  let current = 2;
  if (
    d.case.status === "FINALIZED" ||
    (d.actions.length &&
      d.actions.every((action) =>
        ["COMPLETED", "CANCELLED"].includes(action.status),
      ))
  )
    current = 7;
  else if (
    d.case.status === "REVIEW_PENDING" ||
    actionStatuses.has("COMPLETION_REQUESTED")
  )
    current = 6;
  else if (
    ["REWORK_REQUIRED", "RECHECK_REQUIRED"].includes(d.case.status) ||
    actionStatuses.has("REWORK_REQUIRED")
  )
    current = 4;
  else if (
    d.case.status === "ACTION_IN_PROGRESS" ||
    actionStatuses.has("ASSIGNED") ||
    actionStatuses.has("IN_PROGRESS")
  )
    current = 4;
  else if (d.case.status === "ASSESSMENT_REQUIRED") current = 3;
  const steps = [
    ["원도급사", "위험 발견"],
    ["협력업체", "즉시 조치"],
    ["협력업체", "위험성평가"],
    ["협력업체", "개선조치"],
    ["협력업체", "조치 완료·검증 요청"],
    ["원도급사", "재조치 요청 또는 완료 확인"],
  ];
  const instructions = {
    2: "즉시 통제 내용을 입력하고 통제 완료를 눌러 주세요.",
    3: "위험요인과 대책을 평가한 뒤 평가 저장을 눌러 주세요.",
    4: actionStatuses.has("REWORK_REQUIRED")
      ? "재조치 사진과 완료 내용을 등록한 뒤 조치 완료·검증 요청을 다시 눌러 주세요."
      : "조치 사진과 완료 내용을 등록한 뒤 조치 완료·검증 요청을 눌러 주세요.",
    5: "협력업체가 조치 완료·검증 요청을 진행합니다.",
    6: "원도급사는 재조치 요청 또는 조치 완료 확인 중 하나를 선택해 주세요.",
    7:
      d.case.status === "FINALIZED"
        ? "모든 조치가 완료되어 최종 종결되었습니다."
        : "조치 완료가 확인되었습니다. 원도급사는 사례를 최종 종결해 주세요.",
  };
  return { current, steps, instruction: instructions[current] };
}
function workflowTimeline(d, workflow) {
  return `<section class="card safety-workflow" aria-label="위험 개선조치 진행 단계">
    <div class="workflow-heading"><div><span class="status-badge">${label[d.case.status] || d.case.status}</span><h3>현재 해야 할 일</h3></div><strong>${escapeHtml(workflow.instruction)}</strong></div>
    <ol>${workflow.steps
      .map((step, index) => {
        const number = index + 1;
        const state =
          workflow.current === 7 || number < workflow.current
            ? "done"
            : number === workflow.current
              ? "current"
              : "upcoming";
        return `<li class="${state}" ${state === "current" ? 'aria-current="step"' : ""}><span class="workflow-owner">${step[0]}</span><span class="workflow-dot">${state === "done" ? "✓" : number}</span><strong>${step[1]}</strong></li>`;
      })
      .join("")}</ol>
  </section>`;
}
const workflowPanel = (title, body, step, workflow) =>
  `<details class="card workflow-panel ${workflow.current === step ? "current" : ""}" ${workflow.current === step ? "open" : ""}><summary><span>${title}</span><small>${workflow.current > step || workflow.current === 7 ? "완료됨" : workflow.current === step ? "현재 단계" : "대기"}</small></summary><div class="workflow-panel-body">${body}</div></details>`;
function renderCase(d) {
  const c = d.case,
    o = state.options,
    workflow = workflowState(d),
    stale = d.sources.filter((v) => v.stale),
    t = document.querySelector("#safety-editor");
  const control = c.status !== "FINALIZED" && can("SAFETY_CASE", "EDIT") ? `<form id="control"><label>통제 내용<textarea name="description" required>${escapeHtml(c.immediate_control_description || "")}</textarea></label><label><input name="workStopped" type="checkbox"> 작업 중지</label><label><input name="accessRestricted" type="checkbox"> 출입 통제</label><label><input name="hazardZoneMarked" type="checkbox"> 위험구역 표시</label><button>통제 완료</button><p role="status"></p></form>` : "<p>즉시 조치 정보를 볼 권한이 없습니다.</p>";
  const assessmentBody = c.status !== "FINALIZED" && can("SAFETY_RISK_ASSESSMENT", "EDIT") ? assessment(d, o).replace(' class="card"', "") : d.assessment ? `<dl><dt>작업명</dt><dd>${escapeHtml(d.assessment.work_name)}</dd><dt>위험 수준</dt><dd>${escapeHtml(d.assessment.risk_level || "-")}</dd></dl>` : "<p>위험성평가 대기 중입니다.</p>";
  const allActionsConfirmed =
    d.actions.some((action) => action.status === "COMPLETED") &&
    d.actions.every((action) =>
      ["COMPLETED", "CANCELLED"].includes(action.status),
    );
  const finalization = allActionsConfirmed && can("SAFETY_CASE", "MANAGE") && c.status !== "FINALIZED" ? `<form id="review"><input type="hidden" name="result" value="FINALIZABLE"><label>종결 의견<textarea name="note" required placeholder="최종 확인 내용을 입력해 주세요."></textarea></label><button name="action" value="finalize" class="primary">사례 최종 종결</button><p role="status"></p></form>` : "";
  t.innerHTML = `<section class="safety-editor"><header class="card case-heading"><h2>${escapeHtml(c.title)}</h2><p>${escapeHtml(c.description)}</p></header>${workflowTimeline(d, workflow)}<details class="card case-summary"><summary>사례 기본 정보·원본 보기</summary><div>${stale.length ? '<p class="warning">원본 revision 변경 감지</p><button id="refresh-source">원본 변경 반영</button>' : ""}<dl><dt>위치</dt><dd>${escapeHtml(c.location_name || "-")}</dd><dt>원본 회사·공종</dt><dd>${escapeHtml(c.company_name || "-")} · ${escapeHtml(c.trade_name || "-")}</dd><dt>근본 원인</dt><dd>${escapeHtml(c.root_cause_name || "평가 전")}</dd></dl>${d.media.length ? "<p>원본 사진은 복제 없이 media ID로 참조합니다.</p>" : ""}</div></details>${workflowPanel("1. 즉시 조치", control, 2, workflow)}${workflowPanel("2. 위험성평가", assessmentBody, 3, workflow)}${workflowPanel("3. 개선조치·사진·검증 요청", actions(d, o).replace(' class="card"', ""), workflow.current >= 4 && workflow.current <= 6 ? workflow.current : 4, workflow)}${finalization ? workflowPanel("4. 사례 최종 종결", finalization, 7, workflow) : ""}</section>`;
  markRequiredFields(t);
  t.scrollIntoView({ behavior: "smooth" });
  t.querySelector("#refresh-source")?.addEventListener("click", (e) =>
    busy(e.currentTarget, async () =>
      renderCase(await formPost(d, "refresh-source", {})),
    ),
  );
  bind(t, "#control", async (e, b) => {
    b.workStopped = e.target.workStopped.checked;
    b.accessRestricted = e.target.accessRestricted.checked;
    b.hazardZoneMarked = e.target.hazardZoneMarked.checked;
    renderCase(await formPost(d, "control", b));
  });
  bind(t, "#assessment", async (e, b) =>
    renderCase(await formPost(d, "assessment", b)),
  );
  bind(t, "#action-create", async (e, b) =>
    renderCase(await formPost(d, "actions", b)),
  );
  bind(t, "#review", async (e, b) =>
    renderCase(await formPost(d, e.submitter.value, b)),
  );
  bindActionEvidence(t, d);
  t.querySelectorAll("[data-action]").forEach(
    (b) =>
      (b.onclick = () =>
        b.dataset.action === "request-completion" &&
        t.querySelector(
          `[data-evidence-form="${b.dataset.id}"]`,
        )?.dataset.uploading === "true"
          ? (t.querySelector(
              `[data-evidence-form="${b.dataset.id}"] [role=status]`,
            ).textContent = "사진 업로드가 끝난 뒤 완료를 요청해 주세요.")
          : b.dataset.action === "request-completion" &&
              !validateCompletionForm(t, b.dataset.id)
            ? undefined
            :
        busy(b, async () =>
          renderCase(
            await api(
              `/cases/${c.id}/actions/${b.dataset.id}/${b.dataset.action}`,
              {
                method: "POST",
                body: JSON.stringify({
                  revision: Number(b.dataset.revision),
                  note: "화면 처리",
                  completionNote:
                    b.dataset.action === "request-completion"
                      ? t.querySelector(
                          `[data-completion-form="${b.dataset.id}"]`,
                        ).completionNote.value
                      : undefined,
                  evidenceExceptionReason:
                    b.dataset.action === "request-completion"
                      ? t.querySelector(
                          `[data-completion-form="${b.dataset.id}"]`,
                        ).evidenceExceptionReason.value
                      : undefined,
                }),
              },
            ),
          ),
        )),
  );
}
function markRequiredFields(root) {
  root
    .querySelectorAll("input[required],select[required],textarea[required]")
    .forEach((control) => {
      control.setAttribute("aria-required", "true");
      const fieldLabel = control.closest("label");
      if (!fieldLabel || fieldLabel.querySelector(".required-marker")) return;
      const marker = document.createElement("span");
      marker.className = "required-marker";
      marker.setAttribute("aria-hidden", "true");
      marker.textContent = " *";
      fieldLabel.insertBefore(marker, control);
    });
}
function validateCompletionForm(root, actionId) {
  const form = root.querySelector(`[data-completion-form="${actionId}"]`);
  const note = form?.elements.completionNote;
  if (note?.value.trim()) {
    note.removeAttribute("aria-invalid");
    form.querySelector("[role=status]").textContent = "";
    return true;
  }
  note?.setAttribute("aria-invalid", "true");
  form.querySelector("[role=status]").textContent =
    "완료 내용은 필수 입력 항목입니다. 조치한 내용을 입력해 주세요.";
  note?.scrollIntoView({ behavior: "smooth", block: "center" });
  note?.focus({ preventScroll: true });
  return false;
}
function bind(root, sel, fn) {
  root.querySelector(sel)?.addEventListener("submit", (e) => {
    e.preventDefault();
    busy(e.submitter, async () => {
      try {
        await fn(e, Object.fromEntries(new FormData(e.target)));
      } catch (x) {
        e.target.querySelector("[role=status]").textContent = x.message;
      }
    });
  });
}
const assessment = (d, o) => {
  const a = d.assessment || {};
  return `<form id="assessment" class="card"><h3>위험성평가</h3><label>작업명<input name="workName" value="${escapeHtml(a.work_name || "")}" required></label><label>위험요인<textarea name="hazardFactor" required>${escapeHtml(a.hazard_factor || "")}</textarea></label><label>현재 조치<textarea name="currentControls" required>${escapeHtml(a.current_controls || "")}</textarea></label><label>가능성<input name="likelihood" type="number" min="1" max="5" value="${a.likelihood || 3}"></label><label>중대성<input name="severity" type="number" min="1" max="5" value="${a.severity || 3}"></label><label>표준 근본 원인<select name="rootCauseId" required><option value="">선택</option>${o.rootCauses.map((v) => `<option value="${v.id}" ${d.case.root_cause_id === v.id ? "selected" : ""}>${escapeHtml(v.category_name)} · ${escapeHtml(v.group_name)} · ${escapeHtml(v.display_name)}</option>`).join("")}</select></label><textarea name="additionalMeasures" placeholder="추가 대책">${escapeHtml(a.additional_measures || "")}</textarea><button>평가 저장</button><p role="status"></p></form>`;
};
const evidenceRoleLabel = (role) =>
  ({
    BEFORE: "조치 전",
    AFTER: "조치 후",
    RECHECK: "재조치",
    EVIDENCE: "추가 증빙",
    DOCUMENT: "추가 자료",
  })[role] || role;
function actionAssignmentEditor(d, a, o) {
  if (
    d.case.status === "FINALIZED" ||
    ["COMPLETED", "CANCELLED"].includes(a.status) ||
    !can("SAFETY_CORRECTIVE_ACTION", "MANAGE")
  )
    return "";
  return `<details class="action-assignment-editor">
    <summary>회사·담당자 수정</summary>
    <form data-assignment-form="${a.id}" data-revision="${a.revision}">
      <label>담당 회사<select name="ownerCompanyId" required>${o.companies.map((company) => `<option value="${company.id}" ${company.id === a.owner_company_id ? "selected" : ""}>${escapeHtml(company.name)}</option>`).join("")}</select></label>
      <label>담당자<select name="ownerUserId" required>${o.users.map((user) => `<option value="${user.id}" data-company-id="${user.company_id}" data-site-wide-manager="${user.site_wide_manager ? "true" : "false"}" ${user.id === a.owner_user_id ? "selected" : ""}>${escapeHtml(user.display_name)}</option>`).join("")}</select></label>
      <button class="secondary">배정 수정</button>
      <p role="status" aria-live="polite"></p>
    </form>
  </details>`;
}
function actionEvidenceEditor(d, a, o) {
  if (
    d.case.status === "FINALIZED" ||
    !["ASSIGNED", "REWORK_REQUIRED"].includes(a.status) ||
    !can("SAFETY_CORRECTIVE_ACTION", "EDIT")
  )
    return "";
  const defaultRole = a.status === "REWORK_REQUIRED" ? "RECHECK" : "AFTER";
  const reusable = (d.media || []).filter(
    (m) => m.source_media_id && m.source_type,
  );
  return `<section class="action-evidence" aria-labelledby="evidence-title-${a.id}">
    <h4 id="evidence-title-${a.id}">조치 증빙</h4>
    <p class="state-message">${a.status === "REWORK_REQUIRED" ? "재조치 사진을 추가해 주세요." : "조치 후 사진 또는 추가 증빙을 등록해 주세요."}</p>
    <form data-evidence-form="${a.id}" class="evidence-form">
      <label>증빙 구분<select name="mediaRole">
        <option value="${defaultRole}">${evidenceRoleLabel(defaultRole)}</option>
        <option value="BEFORE">조치 전</option>
        <option value="EVIDENCE">추가 증빙</option>
        <option value="DOCUMENT">추가 자료</option>
      </select></label>
      <label>설명<input name="description" maxlength="500" placeholder="사진 설명"></label>
      <label>위치<select name="locationId"><option value="">위치 없음</option>${opt(o.locations)}</select></label>
      <div class="new-evidence">
        <strong>새 사진 추가</strong>
        <div class="evidence-pickers">
          <label class="button-like" for="camera-${a.id}">사진 촬영</label>
          <input id="camera-${a.id}" class="visually-hidden evidence-input" name="camera" type="file" accept="image/jpeg,image/png,image/webp" capture="environment">
          <label class="button-like secondary" for="file-${a.id}">사진 선택</label>
          <input id="file-${a.id}" class="visually-hidden evidence-input" name="file" type="file" accept="image/jpeg,image/png,image/webp">
        </div>
        <div class="evidence-preview" hidden>
          <img alt="선택한 증빙 사진 미리보기">
          <span data-selected-name>선택한 사진</span>
          <span data-upload-state>업로드 준비</span>
          <div><button type="button" class="secondary" data-clear-photo>삭제</button><label class="button-like secondary" for="file-${a.id}">다시 선택</label></div>
        </div>
        <button type="submit" class="secondary" disabled>사진 저장</button>
      </div>
      ${
        reusable.length
          ? `<div class="existing-evidence"><strong>기존 사진에서 선택</strong>${reusable
              .map(
                (m) =>
                  `<button type="button" class="secondary" data-reference-media="${m.source_media_id}" data-source-type="${m.source_type}" data-action-id="${a.id}" data-reference-role="${defaultRole}">${escapeHtml(m.original_name || "기존 사진")}</button>`,
              )
              .join("")}</div>`
          : ""
      }
      <p role="status" aria-live="polite"></p>
    </form>
    <div class="action-next-step" aria-label="조치 제출 순서">
      <strong>처리 순서</strong>
      <span>1. 사진 저장</span>
      <span>2. 조치 완료·검증 요청</span>
    </div>
    <form data-completion-form="${a.id}" class="completion-form">
      <label>완료 내용<textarea name="completionNote" required>${escapeHtml(a.completion_note || "")}</textarea></label>
      <label>사진 증빙 예외 사유<input name="evidenceExceptionReason" value="${escapeHtml(a.evidence_exception_reason || "")}" placeholder="사진을 등록할 수 없는 경우만 입력"></label>
      <button type="button" class="primary" data-action="request-completion" data-id="${a.id}" data-revision="${a.revision}">조치 완료·검증 요청</button>
      <p role="status" class="field-error" aria-live="assertive"></p>
    </form>
  </section>`;
}
function actions(d, o) {
  const activeAction =
    [...d.actions]
      .reverse()
      .find((a) =>
        ["COMPLETION_REQUESTED", "REWORK_REQUIRED", "ASSIGNED", "IN_PROGRESS"].includes(
          a.status,
        ),
      ) || d.actions[d.actions.length - 1];
  const rows =
    d.actions
      .map(
        (a) => `<details class="safety-action" ${a.id === activeAction?.id ? "open" : ""}>
      <summary><strong>${escapeHtml(a.description)}</strong><span>${escapeHtml(a.owner_name)} · ${label[a.status] || a.status}</span></summary>
      <div class="safety-action-body">
      <small>완료 기한 ${escapeHtml(a.due_date)}</small>
      ${
        a.media?.length
          ? `<div class="safety-evidence-grid">${a.media
              .map(
                (m) =>
                  `<button type="button" class="evidence-thumb" data-photo="${m.originalUrl}" aria-label="${evidenceRoleLabel(m.media_role)} 사진 확대"><img src="${m.thumbnailUrl}" alt="${evidenceRoleLabel(m.media_role)} 증빙"><span>${evidenceRoleLabel(m.media_role)}</span></button>`,
              )
              .join("")}</div>`
          : ""
      }
      ${actionAssignmentEditor(d, a, o)}
      ${actionEvidenceEditor(d, a, o)}
      ${
        a.status === "COMPLETION_REQUESTED" &&
        can("SAFETY_CORRECTIVE_ACTION", "MANAGE")
          ? `<section class="action-review-decision"><h4>원도급사 검증</h4><p>조치 결과를 확인한 뒤 하나만 선택해 주세요.</p><div><button class="secondary" data-action="rework" data-id="${a.id}" data-revision="${a.revision}">재조치 요청</button><button class="primary" data-action="complete" data-id="${a.id}" data-revision="${a.revision}">조치 완료 확인</button></div></section>`
          : a.status === "COMPLETION_REQUESTED"
            ? `<p class="state-message">조치 완료·검증 요청이 접수되었습니다. 원도급사 확인을 기다리고 있습니다.</p>`
            : ""
      }
      ${
        !["COMPLETED", "CANCELLED"].includes(a.status) &&
        can("SAFETY_CORRECTIVE_ACTION", "MANAGE")
          ? `<details class="action-cancel"><summary>잘못 만든 개선조치 취소</summary><form data-cancel-form="${a.id}" data-revision="${a.revision}"><label>취소 사유<input name="reason" required maxlength="500" placeholder="중복 배정, 담당자 오선택 등"></label><p class="state-message">업무 기록과 사진은 삭제하지 않고 취소 상태로 보존합니다.</p><button class="danger">개선조치 취소</button><p role="status"></p></form></details>`
          : ""
      }
      </div>
    </details>`,
      )
      .join("") || "<p>개선조치 없음</p>";
  const create =
    d.case.status !== "FINALIZED" &&
    can("SAFETY_CORRECTIVE_ACTION", "MANAGE") &&
    !d.actions.some((action) => action.status !== "CANCELLED")
      ? `<details class="action-create-panel"><summary>새 개선조치 배정</summary><form id="action-create"><p class="state-message">개선조치가 없을 때만 새로 배정할 수 있습니다.</p><label>조치 내용<input name="description" required placeholder="조치 내용"></label><label>담당 회사<select name="ownerCompanyId" required>${opt(o.companies, "name")}</select></label><label>담당자<select name="ownerUserId" required>${opt(o.users)}</select></label><label>완료 기한<input name="dueDate" type="date" required></label><label>예산<input name="budgetAmount" type="number" min="0" placeholder="예산"></label><input type="hidden" name="actionType" value="OTHER"><button>개선조치 배정</button><p role="status"></p></form></details>`
      : "";
  return `<section class="card"><h3>개선조치</h3>${rows}${create}</section>`;
}
function bindActionEvidence(root, d) {
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  const maxBytes = 12 * 1024 * 1024;
  root.querySelectorAll("[data-evidence-form]").forEach((form) => {
    const camera = form.elements.camera;
    const picker = form.elements.file;
    const preview = form.querySelector(".evidence-preview");
    const previewImage = preview.querySelector("img");
    const selectedName = form.querySelector("[data-selected-name]");
    const uploadState = form.querySelector("[data-upload-state]");
    const status = form.querySelector("[role=status]");
    const submit = form.querySelector('button[type="submit"]');
    const completionButton = root.querySelector(
      `[data-completion-form="${form.dataset.evidenceForm}"] [data-action="request-completion"]`,
    );
    let selectedFile = null;
    let objectUrl = "";

    const resetSelection = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = "";
      selectedFile = null;
      camera.value = "";
      picker.value = "";
      preview.hidden = true;
      previewImage.removeAttribute("src");
      submit.disabled = true;
      status.textContent = "";
    };
    const selectFile = async (input, otherInput) => {
      const file = input.files?.[0];
      if (!file) return;
      otherInput.value = "";
      status.textContent = "";
      if (!allowedTypes.has(file.type)) {
        resetSelection();
        status.textContent = "JPG, PNG, WebP 사진만 선택할 수 있습니다.";
        return;
      }
      if (!file.size) {
        resetSelection();
        status.textContent = "비어 있거나 손상된 사진은 등록할 수 없습니다.";
        return;
      }
      if (file.size > maxBytes) {
        resetSelection();
        status.textContent = "사진은 12MB 이하만 등록할 수 있습니다.";
        return;
      }
      try {
        const bitmap = await createImageBitmap(file);
        if (!bitmap.width || !bitmap.height)
          throw new Error("INVALID_IMAGE_DIMENSION");
        bitmap.close();
      } catch {
        resetSelection();
        status.textContent = "읽을 수 없거나 손상된 사진입니다. 다른 사진을 선택해 주세요.";
        return;
      }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      selectedFile = file;
      objectUrl = URL.createObjectURL(file);
      previewImage.src = objectUrl;
      selectedName.textContent = file.name || "촬영한 사진";
      uploadState.textContent = "업로드 준비";
      preview.hidden = false;
      submit.disabled = false;
    };
    camera.onchange = () => selectFile(camera, picker);
    picker.onchange = () => selectFile(picker, camera);
    form.querySelector("[data-clear-photo]").onclick = resetSelection;

    form.onsubmit = async (event) => {
      event.preventDefault();
      if (!selectedFile || form.dataset.uploading === "true") {
        status.textContent = "등록할 증빙 사진을 선택해 주세요.";
        return;
      }
      const completionForm = root.querySelector(
        `[data-completion-form="${form.dataset.evidenceForm}"]`,
      );
      const preserved = completionForm
        ? {
            completionNote: completionForm.completionNote.value,
            evidenceExceptionReason:
              completionForm.evidenceExceptionReason.value,
          }
        : null;
      form.dataset.uploading = "true";
      submit.disabled = true;
      if (completionButton) completionButton.disabled = true;
      uploadState.textContent = "업로드 중";
      status.textContent = "사진 업로드 중…";
      try {
        const data = new FormData(form);
        data.delete("camera");
        data.delete("file");
        data.set("photo", selectedFile);
        data.set("thumbnail", await makeThumbnail(selectedFile));
        const response = await api(
          `/cases/${d.case.id}/actions/${form.dataset.evidenceForm}/media`,
          { method: "POST", body: data },
        );
        uploadState.textContent = "업로드 완료";
        status.textContent = "사진 업로드가 완료되었습니다.";
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        renderCase(response);
        if (preserved) {
          const restored = document.querySelector(
            `[data-completion-form="${form.dataset.evidenceForm}"]`,
          );
          if (restored) {
            restored.completionNote.value = preserved.completionNote;
            restored.evidenceExceptionReason.value =
              preserved.evidenceExceptionReason;
          }
        }
      } catch (error) {
        form.dataset.uploading = "false";
        submit.disabled = false;
        if (completionButton) completionButton.disabled = false;
        uploadState.textContent = "업로드 실패";
        status.textContent = `사진 업로드에 실패했습니다. 입력한 내용은 유지됩니다. 사진만 다시 시도해 주세요. (${error.message})`;
      }
    };
  });
  root.querySelectorAll("[data-assignment-form]").forEach((form) => {
    const company = form.elements.ownerCompanyId;
    const owner = form.elements.ownerUserId;
    const filterOwners = () => {
      let firstAllowed = null;
      for (const option of owner.options) {
        const allowed =
          option.dataset.companyId === company.value ||
          option.dataset.siteWideManager === "true";
        option.hidden = !allowed;
        option.disabled = !allowed;
        if (allowed && !firstAllowed) firstAllowed = option;
      }
      if (owner.selectedOptions[0]?.disabled && firstAllowed)
        owner.value = firstAllowed.value;
    };
    company.onchange = filterOwners;
    filterOwners();
    form.onsubmit = (event) => {
      event.preventDefault();
      busy(event.submitter, async () => {
        const output = form.querySelector("[role=status]");
        try {
          renderCase(
            await api(
              `/cases/${d.case.id}/actions/${form.dataset.assignmentForm}/assignment`,
              {
                method: "PUT",
                body: JSON.stringify({
                  ownerCompanyId: company.value,
                  ownerUserId: owner.value,
                  revision: Number(form.dataset.revision),
                }),
              },
            ),
          );
        } catch (error) {
          output.textContent = `배정 수정 실패: ${error.message}`;
        }
      });
    };
  });
  root.querySelectorAll("[data-cancel-form]").forEach((form) => {
    form.onsubmit = (event) => {
      event.preventDefault();
      busy(event.submitter, async () => {
        const output = form.querySelector("[role=status]");
        try {
          renderCase(
            await api(
              `/cases/${d.case.id}/actions/${form.dataset.cancelForm}/cancel`,
              {
                method: "POST",
                body: JSON.stringify({
                  revision: Number(form.dataset.revision),
                  reason: form.elements.reason.value.trim(),
                }),
              },
            ),
          );
        } catch (error) {
          output.textContent = `취소 실패: ${error.message}`;
        }
      });
    };
  });
  root.querySelectorAll("[data-photo]").forEach((button) => {
    button.onclick = () => {
      const dialog = document.createElement("dialog");
      dialog.className = "safety-photo-modal";
      dialog.innerHTML = `<button aria-label="닫기">닫기</button><img src="${button.dataset.photo}" alt="개선조치 증빙 원본">`;
      document.body.append(dialog);
      dialog.querySelector("button").onclick = () => dialog.close();
      dialog.onclose = () => dialog.remove();
      dialog.showModal();
    };
  });
  root.querySelectorAll("[data-reference-media]").forEach((button) => {
    button.onclick = () =>
      busy(button, async () =>
        renderCase(
          await api(
            `/cases/${d.case.id}/actions/${button.dataset.actionId}/media-reference`,
            {
              method: "POST",
              body: JSON.stringify({
                sourceType: button.dataset.sourceType,
                sourceMediaId: button.dataset.referenceMedia,
                mediaRole: button.dataset.referenceRole,
              }),
            },
          ),
        ),
      );
  });
}
async function periodic() {
  state.content.innerHTML = loadingSkeleton();
  try {
    const [d, o] = await Promise.all([api("/periodic"), api("/options")]);
    state.options = o;
    state.content.innerHTML =
      head(
        "안전 정기업무",
        "도래한 안전 서류를 기존 현장 데이터로 초안 구성하고 작성·검토·승인·보관합니다.",
      ) +
      `<section class="card boundary-note"><strong>서류 중심 업무</strong><p>체크리스트는 안전점검표·TBM 기록·회의록·위험성평가 검토 기록 등 완성 서류를 구성하는 데이터입니다. 확인되지 않은 예시는 법정 필수로 표시하지 않습니다.</p></section>
      <form id="periodic-filter" class="card periodic-filter"><select name="recurrenceType"><option value="">전체 주기</option><option value="DAILY">일간</option><option value="WEEKLY">주간</option><option value="MONTHLY">월간</option></select><select name="status"><option value="">전체 상태</option><option value="AVAILABLE">작성 가능</option><option value="OVERDUE">기한 초과</option><option value="REVIEW_PENDING">검토 대기</option><option value="REVISION_REQUESTED">보완 요청</option><option value="COMPLETED">승인 완료</option></select><button>조회</button></form>
      ${
        can("SAFETY_PERIODIC_TASK", "MANAGE")
          ? `<details class="card"><summary>안전 서류 업무 설정</summary><form id="periodic-create"><label>서류명<input name="title" required placeholder="안전점검표, TBM 기록 등"></label><label>서류 유형<select name="documentType"><option value="SAFETY_CHECK_SHEET">안전점검표</option><option value="TBM_RECORD">TBM 기록 및 참석 명부</option><option value="SAFETY_MEETING_MINUTES">안전회의 회의록</option><option value="RISK_ASSESSMENT_REVIEW">위험성평가 검토 기록</option><option value="SAFETY_SYSTEM_CONFIRMATION">안전관리체계 이행 확인서</option></select></label><label>업무 근거<select name="basisType"><option value="SITE_PLAN">현장 승인 계획</option><option value="APPROVED_SAFETY_PLAN">승인된 안전관리계획</option><option value="CONTRACT">계약·시방 요구</option><option value="LEGAL_VERIFIED">확인된 법적 근거</option><option value="CONFIRMATION_REQUIRED">근거 확인 필요</option></select></label><label>근거명<input name="basisName" placeholder="계획서·법령·계약 문서명"></label><label>관련 조항·문서 위치<input name="basisReference" placeholder="조항 또는 문서 위치"></label><label>필수 첨부 수<input name="requiredAttachmentCount" type="number" min="0" value="0"></label><select name="recurrenceType" id="periodic-type"><option value="DAILY">일간</option><option value="WEEKLY">주간</option><option value="MONTHLY">월간</option></select><label id="weekly-rule" hidden>생성 요일<select name="weekday"><option value="1">월요일</option><option value="2">화요일</option><option value="3">수요일</option><option value="4">목요일</option><option value="5">금요일</option><option value="6">토요일</option><option value="7">일요일</option></select></label><fieldset id="monthly-rule" hidden><legend>월간 생성 규칙</legend><select name="monthlyRuleType"><option value="DAY">지정일</option><option value="FIRST_WEEKDAY">첫 평일</option><option value="LAST_DAY">말일</option></select><input name="monthlyDay" type="number" min="1" max="31" value="1" aria-label="매월 생성일"></fieldset><label>담당자<select name="assigneeUserId">${opt(o.users)}</select></label><label>검토자<select name="reviewerUserId">${opt(o.users)}</select></label><label>시작일<input name="startDate" type="date" required></label><label>마감 시간<input name="dueTime" type="time" value="17:00"></label><button>서류 업무 설정</button><p role="status"></p></form></details>`
          : ""
      }
      <div class="safety-document-list">${d.items
        .map(
          (v) =>
            `<article class="card safety-document-row"><header><span class="status-badge">${label[v.status] || v.status}</span><strong>${escapeHtml(v.title)}</strong></header><dl><dt>근거</dt><dd>${escapeHtml(v.basis_name || (v.basis_type === "CONFIRMATION_REQUIRED" ? "확인 필요" : "현장 적용 설정"))}${v.basis_reference ? ` · ${escapeHtml(v.basis_reference)}` : ""}</dd><dt>대상 기간</dt><dd>${escapeHtml(v.period_start || v.scheduled_date_kst)} ~ ${escapeHtml(v.period_end || v.scheduled_date_kst)}</dd><dt>담당·검토</dt><dd>${escapeHtml(v.assignee_name || "-")} · ${escapeHtml(v.reviewer_name || "-")}</dd><dt>마감</dt><dd>${escapeHtml(v.due_at)}</dd><dt>필수 첨부</dt><dd>${Number(v.attachment_count || 0)} / ${Number(v.required_attachment_count || 0)}</dd><dt>미완성</dt><dd>${Math.max(0, Number(v.incomplete_count || 0))}항목</dd><dt>검토 결과</dt><dd>${v.review_result === "APPROVED" ? "승인" : v.review_result === "REVISION_REQUESTED" ? "보완 요청" : "검토 전"}</dd></dl><button data-periodic="${v.id}">서류 열기</button></article>`,
        )
        .join("") || "<p>생성된 안전 서류 업무가 없습니다.</p>"}</div><div id="periodic-editor"></div>`;
    const type = document.querySelector("#periodic-type");
    const showRules = () => {
      if (!type) return;
      document.querySelector("#weekly-rule").hidden = type.value !== "WEEKLY";
      document.querySelector("#monthly-rule").hidden =
        type.value !== "MONTHLY";
    };
    type?.addEventListener("change", showRules);
    showRules();
    document.querySelector("#periodic-filter").onsubmit = async (event) => {
      event.preventDefault();
      const params = new URLSearchParams(new FormData(event.target));
      const filtered = await api(`/periodic?${params}`);
      const visible = new Set(filtered.items.map((item) => item.id));
      document.querySelectorAll("[data-periodic]").forEach((button) => {
        button.closest("article").hidden = !visible.has(button.dataset.periodic);
      });
    };
    bind(document, "#periodic-create", async () => {
      await api("/periodic/definitions", {
        method: "POST",
        body: JSON.stringify(
          Object.fromEntries(
            new FormData(document.querySelector("#periodic-create")),
          ),
        ),
      });
      periodic();
    });
    document
      .querySelectorAll("[data-periodic]")
      .forEach((b) => (b.onclick = () => openPeriodic(b.dataset.periodic)));
  } catch (e) {
    state.content.innerHTML = head("안전 정기 업무") + errorState(e.message);
  }
}
async function openPeriodic(id) {
  const d = await api(`/periodic/${id}`),
    t = document.querySelector("#periodic-editor"),
    editable = ["AVAILABLE", "OVERDUE", "IN_PROGRESS", "REVISION_REQUESTED"].includes(
      d.instance.status,
    ),
    reviewable =
      d.instance.status === "REVIEW_PENDING" &&
      can("SAFETY_PERIODIC_TASK", "MANAGE");
  t.innerHTML = `<form id="periodic-form" class="card safety-editor"><h2>${escapeHtml(d.instance.title)}</h2><dl><dt>현장</dt><dd>${escapeHtml(d.instance.site_name)}</dd><dt>서류 유형</dt><dd>${escapeHtml(documentLabel[d.instance.document_type] || "안전 서류")}</dd><dt>업무 근거</dt><dd>${escapeHtml(d.instance.basis_name || "현장 적용 설정")}${d.instance.basis_reference ? ` · ${escapeHtml(d.instance.basis_reference)}` : ""}</dd><dt>담당자</dt><dd>${escapeHtml(d.instance.assignee_name || "-")}</dd><dt>검토자</dt><dd>${escapeHtml(d.instance.reviewer_name || "-")}</dd></dl><section class="document-auto-draft"><h3>기존 데이터 자동 반영</h3><p>대상일 출역 ${Number(d.autoDraft?.workforce_count || 0)}명 · 미종결 안전 사례 ${Number(d.autoDraft?.open_safety_count || 0)}건 · 미완료 개선조치 ${Number(d.autoDraft?.open_action_count || 0)}건</p><p>공사일보 작업 내용: ${escapeHtml(d.autoDraft?.construction_summary || "연결된 공사일보 없음")}</p></section><h3>서류 구성 확인 데이터</h3>${d.items
    .map(
      (v) =>
        `<fieldset data-id="${v.checklist_item_id}"><legend>${escapeHtml(v.prompt)}</legend><select ${editable ? "" : "disabled"}><option value="">선택</option>${[
          ["APPROPRIATE", "적정"],
          ["INAPPROPRIATE", "부적합"],
          ["NOT_APPLICABLE", "해당 없음"],
          ["UNCONFIRMED", "미확인"],
        ]
          .map(
            (x) =>
              `<option value="${x[0]}" ${v.result === x[0] ? "selected" : ""}>${x[1]}</option>`,
          )
          .join(
            "",
          )}</select><input value="${escapeHtml(v.note || "")}" placeholder="확인 내용" ${editable ? "" : "disabled"}>${reviewable && v.result_id && ["INAPPROPRIATE", "UNCONFIRMED"].includes(v.result) ? `<button type="button" data-waive="${v.result_id}">검토자 면제</button>` : ""}</fieldset>`,
    )
    .join(
      "",
    )}${editable ? '<button name="action" value="save">초안 저장</button><button name="action" value="submit" class="primary">검토 요청·snapshot 저장</button>' : ""}${reviewable ? '<textarea name="reviewNote" placeholder="검토 의견" required></textarea><button name="action" value="revision-request">보완 요청</button><button name="action" value="complete" class="primary">승인·문서 보관</button>' : ""}<p role="status"></p>${d.document ? `<p>제출 snapshot revision ${Number(d.document.revision)} · ${d.document.review_result === "APPROVED" ? "승인 완료" : d.document.review_result === "REVISION_REQUESTED" ? "보완 요청" : "검토 대기"}</p>` : ""}</form>`;
  t.scrollIntoView({ behavior: "smooth" });
  t.querySelector("form").onsubmit = (e) => {
    e.preventDefault();
    busy(e.submitter, async () => {
      const items = [...e.target.querySelectorAll("fieldset")].map((f) => ({
        checklistItemId: f.dataset.id,
        result: f.querySelector("select").value,
        note: f.querySelector("input").value,
      }));
      try {
        await api(`/periodic/${id}/${e.submitter.value}`, {
          method: "POST",
          body: JSON.stringify({
            revision: d.instance.revision,
            items,
            note: e.target.reviewNote?.value,
          }),
        });
        openPeriodic(id);
      } catch (x) {
        e.target.querySelector("[role=status]").textContent = x.message;
      }
    });
  };
  t.querySelectorAll("[data-waive]").forEach(
    (b) =>
      (b.onclick = () => {
        const reason = prompt("후속조치 면제 사유를 입력해 주세요.");
        if (reason)
          busy(b, async () => {
            await api(`/periodic/${id}/waive`, {
              method: "POST",
              body: JSON.stringify({
                checklistResultId: b.dataset.waive,
                reason,
              }),
            });
            openPeriodic(id);
          });
      }),
  );
}
async function safetyDocuments() {
  state.content.innerHTML = loadingSkeleton();
  try {
    const d = await api("/periodic-documents");
    state.content.innerHTML =
      head(
        "안전 문서보관",
        "안전 정기업무에서 제출·승인된 revision snapshot을 조회합니다.",
      ) +
      `<section class="card boundary-note"><p>문서는 안전 업무에서 작성·승인되며 이 화면은 보관된 제출본과 revision을 조회합니다. Documents 통합 보관·출력 기능은 별도 구현 전까지 준비 상태입니다.</p></section><div>${d.items.map((v) => `<article class="card safety-document-row"><header><span class="status-badge">${v.review_result === "APPROVED" ? "승인" : v.review_result === "REVISION_REQUESTED" ? "보완 요청" : "검토 대기"}</span><strong>${escapeHtml(v.document_title || "안전 서류")}</strong></header><p>${escapeHtml(v.scheduled_date_kst)} · revision ${Number(v.revision)} · 제출 ${escapeHtml(v.submitted_by_name || "-")} · 승인 ${escapeHtml(v.approved_by_name || "-")}</p></article>`).join("") || "<p>보관된 안전 서류 snapshot이 없습니다.</p>"}</div>`;
  } catch (e) {
    state.content.innerHTML = head("안전 문서보관") + errorState(e.message);
  }
}
export async function renderSafetyPage({ content, path, session }) {
  state = { content, path, session, options: null };
  if (path === "/safety") return dashboard();
  if (path === "/safety/periodic") return periodic();
  if (path === "/safety/documents") return safetyDocuments();
  if (
    [
      "/safety/cases",
      "/safety/assessments",
      "/safety/actions",
      "/safety/recurrence",
    ].includes(path)
  )
    return cases();
  content.innerHTML = errorState("연결된 안전 관리 화면이 없습니다.");
}

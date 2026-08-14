# R35 Mobile Issue Input Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize r34 mobile Issue entry, unresolved-location feedback, editor density, and share watermark as the local-only r35 frontend candidate.

**Architecture:** Keep `IssueDraft` and the existing common share pipeline as the only state/formatting sources. Add behavior through focused pure helpers and existing render/binding paths, with CSS limited to the Issue screen and mobile breakpoints.

**Tech Stack:** Browser ES modules, Canvas 2D, CSS, Node.js built-in test runner, existing build/validation scripts.

## Global Constraints

- Static revision is `v0.27.1-r35`; Service Worker cache is `guis-arc-integrated-v0.27.1-r35-shell`.
- No Worker, API, D1, R2, migration, Location Master, permission, submit, Production, deployment, commit, push, ZIP, `VERSION.md`, or `AIOS/PROJECT_STATE.md` change.
- Preserve `MANUAL > SPEECH > NONE`, immutable raw speech evidence, lookup-only canonical resolution, and List/Photo View share parity.
- Palette colors are exactly red, yellow, blue, and white; every hit target is at least 44×44px and all four stay together.

---

### Task 1: Empty manual ownership bug

**Files:**
- Modify: `tests/issue-draft-state.test.mjs`
- Modify: `apps/web/assets/issue-draft-state.js`

**Interfaces:**
- Consumes: `setManualContent`, `setManualDetail`, `mergeSpeechCandidateIntoDraft`.
- Produces: empty trimmed manual fields with source `NONE`; non-empty fields with source `MANUAL`.

- [ ] Add literal regression cases for empty content, empty detail, whitespace-only input, and non-empty manual protection.
- [ ] Run `node --test tests/issue-draft-state.test.mjs` and record the expected RED ownership assertions.
- [ ] Change only the two manual setters to derive source from cleaned text.
- [ ] Re-run the focused test and require PASS before Task 2.

### Task 2: Unresolved warning and final sentence order

**Files:**
- Modify: `tests/issue-draft-state.test.mjs`
- Modify: `tests/issue-sst-v3.test.mjs`
- Modify: `apps/web/assets/issue-draft-state.js`
- Modify: `apps/web/assets/issues.js`

**Interfaces:**
- Consumes: exact `draft.unresolvedStructural` entries and raw transcript.
- Produces: deduplicated display sentence and safe status rendering without payload mutation.

- [ ] Add RED cases for unresolved UNIT ordering, multiple missing levels, no duplicate display, payload preservation, manual resolution, ordinary numbers, safe DOM rendering, and resolved-token silence.
- [ ] Run the two focused test files and confirm failures are limited to missing r35 behavior.
- [ ] Implement exact tracked-token display extraction and semantic DOM rendering; do not infer with regex.
- [ ] Re-run both focused files and require PASS.

### Task 3: Compact editor, four-color palette, and cloud

**Files:**
- Modify: `tests/issue-operational-stabilization.test.mjs`
- Modify: `tests/issue-v0271-mobile-photo-work-view.test.mjs`
- Modify or create focused editor test if needed under `tests/`
- Modify: `apps/web/assets/issues.js`
- Modify: `apps/web/assets/issues.css`

**Interfaces:**
- Consumes: existing editor `color`, `width`, history, and pointer lifecycle.
- Produces: native `aria-pressed` palette buttons and `cloud` drawing path.

- [ ] Add RED tests that remove ellipse and the seven-color select contract; require cloud, four exact colors, one pressed default, Korean labels, 44×44 targets, white border, stable group order, and color-to-canvas synchronization.
- [ ] Add RED canvas behavior coverage for cloud draw, undo, clear, minimum drag, and pointer cancel.
- [ ] Run focused editor/mobile tests and record RED.
- [ ] Implement operation/shape/history groups, four native palette buttons, and a closed curve-based cloud path.
- [ ] Add responsive CSS that keeps all four colors together and wraps only width when necessary.
- [ ] Re-run focused tests and require PASS.

### Task 4: Mobile location and content compression

**Files:**
- Modify: `tests/issue-v0271-mobile-photo-work-view.test.mjs`
- Modify: `tests/issue-sst-v3.test.mjs`
- Modify: `apps/web/assets/issues.js`
- Modify: `apps/web/assets/issues.css`

**Interfaces:**
- Consumes: existing cascade, suggestions, direct-mode, detail/content controls.
- Produces: mobile-only compact layout with unchanged values and payload.

- [ ] Add RED contracts for the one-row location grid, separated direct mode, wrapped suggestions, two-line required content, `maxlength=4000`, and accessible speech control.
- [ ] Run focused tests and confirm RED.
- [ ] Apply mobile-only markup classes and CSS without changing cascade/direct/speech handlers.
- [ ] Re-run focused tests and require PASS.

### Task 5: Compact common share watermark

**Files:**
- Modify: `tests/issue-share-watermark.test.mjs`
- Modify: relevant share parity test under `tests/`
- Modify only active route files: `apps/web/assets/issue-share-watermark.js` and/or `apps/web/assets/issues.js`

**Interfaces:**
- Consumes: `issueShareDisplay`, `issueShareWatermarkLayout`, `createSharePhoto`.
- Produces: at most three lines, alpha `.58`, compact clipping-safe geometry, unchanged 10:8:6 and KST date.

- [ ] Trace active List and Photo View calls and identify whether any other share creator is user-facing.
- [ ] Add RED fixtures for 320×480, 480×320, and 1200×1600 plus common-pipeline parity.
- [ ] Run focused share tests and confirm RED.
- [ ] Change only the active common layout/render path and render local fixture PNGs if supported.
- [ ] Re-run focused share tests and require PASS.

### Task 6: R35 static revision

**Files:**
- Modify: `apps/web/assets/app.js`
- Modify: `apps/web/assets/integrated-admin.js`
- Modify: `apps/web/index.html`
- Modify: `apps/web/service-worker.js`
- Modify: `scripts/validate.mjs`
- Modify: relevant static revision tests under `tests/`

**Interfaces:**
- Produces: cache-coherent `v0.27.1-r35` frontend.

- [ ] Add or update revision expectations and confirm RED against r34.
- [ ] Replace all active r34 frontend references and cache names with r35.
- [ ] Run revision tests and scan for active r34/r35 mixing.

### Task 7: Real rendering, review, and full verification

**Files:**
- Review all r35 diffs; do not commit.

**Interfaces:**
- Produces: evidence for a separate explicit Integration Pages deployment approval.

- [ ] Build and serve a local preview without deployment.
- [ ] At 320, 360, 412, 760, and desktop widths verify toolbar, location row, direct separation, two-line content, registration access, unresolved warning, and `scrollWidth <= clientWidth`; record console errors separately.
- [ ] Review the active diff for unsafe HTML, wrong token inference, share duplication, accessibility regression, and unrelated changes.
- [ ] Run all required focused IssueDraft, SST, resolver, editor/mobile, share, list parity, import UI, and revision tests.
- [ ] Run `npm test`, `npm run typecheck`, `npm run build`, `npm run validate:korean-ui`, and `npm run validate`.
- [ ] Run `git diff --check` and `git status --short`; confirm only approved frontend/test/spec/plan files changed.
- [ ] Stop with `READY_FOR_EXPLICIT_R35_INTEGRATION_PAGES_DEPLOY_APPROVAL`; do not deploy, commit, push, or create a ZIP.

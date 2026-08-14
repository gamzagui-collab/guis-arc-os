# R34 Zero-Touch Issue Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply completed speech recognition directly to the existing IssueDraft and present one compact, live final sentence without adding another state store.

**Architecture:** Keep IssueDraft as the single source of truth. SpeechCandidate merges into it automatically; manual setters preserve ownership and remove only tracked unresolved tokens for the resolved level. Preview and submit derive from the same draft, while the existing shared photo formatter remains the only share display pipeline.

**Tech Stack:** Browser ES modules, Node.js built-in test runner, CSS, existing GUI's Arc build and validation scripts.

## Global Constraints

- Static revision is `v0.27.1-r34`; Service Worker cache is `guis-arc-integrated-v0.27.1-r34-shell`.
- No Worker, D1, R2, migration, correction-learning activation, Location Master mutation, deployment, r34 commit, push, or Production change.
- Preserve `MANUAL > SPEECH > NONE`, raw speech evidence, and the existing 10:8:6 share typography ratio.

---

### Task 1: Draft final sentence and structured unresolved cleanup

**Files:**
- Modify: `apps/web/assets/issue-draft-state.js`
- Test: `tests/issue-draft-state.test.mjs`

**Interfaces:**
- Consumes: existing IssueDraft and manual setter functions.
- Produces: `buildDraftFinalSentence(draft)` and level-specific tracked-token cleanup.

- [ ] Add failing tests for literal final sentences, payload semantic parity, UNIT/FLOOR/BUILDING cleanup, and manual content/detail ownership.
- [ ] Run `node --test tests/issue-draft-state.test.mjs` and confirm failures are caused by missing r34 behavior.
- [ ] Implement the smallest Draft-only final sentence and safe tracked-token removal.
- [ ] Re-run the focused test and confirm PASS.

### Task 2: Automatic speech merge and compact create UX

**Files:**
- Modify: `apps/web/assets/issues.js`
- Modify: `apps/web/assets/issues.css`
- Test: `tests/issue-sst-v3.test.mjs`
- Test: `tests/issue-v0271-mobile-photo-work-view.test.mjs`

**Interfaces:**
- Consumes: `mergeSpeechCandidateIntoDraft`, `buildDraftFinalSentence`, existing render synchronization.
- Produces: recognition completion with zero additional apply taps and compact `등록 내용` UI.

- [ ] Add failing integration-contract tests for immediate merge, removed apply control, reduced raw-result prominence, narrow-width usability, and no horizontal overflow.
- [ ] Run the two focused files and confirm the intended RED failures.
- [ ] Merge SpeechCandidate immediately in `recognition.onresult`, synchronize controls, and render the compact sentence.
- [ ] Remove the active `내용 적용` control without removing raw evidence fields.
- [ ] Re-run focused tests and confirm PASS.

### Task 3: Share contract and r34 static revision

**Files:**
- Modify only if required: `apps/web/assets/issue-share-watermark.js`
- Modify: `apps/web/assets/app.js`
- Modify: `apps/web/assets/integrated-admin.js`
- Modify: `apps/web/index.html`
- Modify: `apps/web/service-worker.js`
- Modify: `scripts/validate.mjs`
- Test: `tests/issue-share-watermark.test.mjs`
- Test: `tests/site-location-import-ui.test.mjs`
- Test: `tests/issue-sst-v3.test.mjs`

**Interfaces:**
- Consumes: existing `issueShareDisplay` and `issueShareWatermarkLayout`.
- Produces: r34 cache-coherent frontend with line 1 structural location/date and line 2-3 detail/content.

- [ ] Add failing share and static-revision tests.
- [ ] Run them and confirm RED against r33.
- [ ] Adjust only the common share helper if the existing contract fails; otherwise leave it unchanged.
- [ ] Bump every frontend static reference and validation token to r34.
- [ ] Re-run focused tests and confirm PASS.

### Task 4: Full verification and deployment handoff

**Files:**
- Verify all r34 changes; do not create an r34 commit.

**Interfaces:**
- Consumes: completed Tasks 1-3.
- Produces: evidence for explicit Integration Pages deployment approval.

- [ ] Run focused IssueDraft, SST, share, mobile-create, Lean List, and static tests.
- [ ] Run `npm test`.
- [ ] Run `npm run typecheck`, `npm run build`, `npm run validate:korean-ui`, and `npm run validate`.
- [ ] Run `git diff --check` and inspect `git status --short`.
- [ ] Confirm Worker/D1/R2/Location Master/Production were not changed and stop before deployment or commit.

# Simple Location Master v3 Implementation Plan

> **For agentic workers:** Execute inline in the current workspace because the user requires one coherent checkpoint after Integration verification.

**Goal:** Deliver a three-level structural Location Master with free-text Issue detail and two-file applied-workbook retention.

**Architecture:** Reuse `site_locations` BUILDING/FLOOR/UNIT rows and existing Issue ID columns. Reuse immutable Import artifacts and metadata for current/previous downloads; no schema migration.

**Tech Stack:** Node.js ESM, Cloudflare Worker, D1, R2, browser JavaScript, XLSX OpenXML fixtures.

## Global Constraints

- Production remains unchanged.
- No v3 `ROOM` creation.
- Historical ROOM references remain readable.
- Static revision is `v0.27.1-r26`.
- Do not Apply the real Kimje workbook without separate user approval.

### Task 1: V3 workbook contract

**Files:** `worker/modules/site-location-import/contracts.js`, `xlsx-parser.js`, `candidate-tree.js`, shipping template, parser/import tests.

- [ ] Write failing tests for two sheets, three headers, three structural levels, and zero ROOM rows.
- [ ] Verify RED.
- [ ] implement `SIMPLE_LOCATION_MASTER_V3`, parse three columns, and emit root/FLOOR/UNIT only.
- [ ] Generate the official v3 XLSX and verify GREEN.

### Task 2: Inactive exact-parent regression

**Files:** `validation.js`, `tests/site-location-import-api.test.mjs`.

- [ ] Preserve the existing RED/GREEN intent.
- [ ] Verify present inactive exact parent is reactivated with the same ID.
- [ ] Verify absent inactive parent remains rejected.

### Task 3: Issue structural IDs and detail text

**Files:** `worker/modules/issues.js`, `apps/web/assets/issues.js`, resolver/speech helpers, Issue tests.

- [ ] Write failing tests for three canonical selectors, null room ID, detail snapshot, arbitrary speech detail, and direct fallback.
- [ ] Verify RED.
- [ ] Return structural `spaces`, render a separate detail field/suggestions, and submit canonical path plus detail.
- [ ] Keep historical room mapping unchanged and verify GREEN.

### Task 4: Applied original retention and downloads

**Files:** Import repository/route/apply modules, admin page, API/UI tests.

- [ ] Write failing authorization, current/previous, third-file cleanup, and audit-retention tests.
- [ ] Verify RED.
- [ ] Add two-artifact query, site-scoped download, and post-Apply oldest-artifact cleanup.
- [ ] Render current/previous cards and verify GREEN.

### Task 5: Static revision and verification

**Files:** current r25 asset references, service worker, validation tests.

- [ ] Advance only current static contract references to r26.
- [ ] Run focused suites, full tests, typecheck, build, Korean UI validation, validate, and diff check.

### Task 6: Integration delivery

- [ ] Record Integration D1/R2 counts without writes.
- [ ] Deploy Worker and Pages only.
- [ ] Verify health, r26, authenticated UI, template download, console, and D1/R2 guards.
- [ ] Validate the user v3 workbook if available; do not Apply.
- [ ] Create one checkpoint commit only after all technical gates pass.


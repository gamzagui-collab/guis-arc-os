# Site Location Master Excel Import v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Phase A so an authorized site administrator can download the v1 workbook, upload and validate it, preview deterministic Location Master changes, and explicitly apply an atomic site-scoped import.

**Architecture:** Reuse `site_locations`, the existing `fflate` OpenXML parser approach, temporary R2 upload sessions, integrated-admin routing, server authorization, and transactional D1 batches. A focused `site-location-import` Worker module owns parsing, validation, diff, preview fingerprints, and Apply; the browser renders only server-produced results and never chooses the target site. A checked-in static XLSX template is copied by the existing web build and downloaded without runtime workbook generation.

**Tech Stack:** Cloudflare Workers, D1 SQLite, R2, vanilla ES modules, `fflate`, Node test runner, existing web build scripts.

## Global Constraints

- Scope is Phase A only. Do not implement Phase B Issue Location Lookup-only, Phase C Resolver, or Phase D PDF AI.
- Import target is `auth.siteId` from authenticated server context; workbook values never choose or switch the target site.
- Workflow is `UPLOAD -> VALIDATE -> DIFF PREVIEW -> USER APPLY`; validation and preview perform zero Location Master writes.
- `location_id` is stable DB identity; `canonical_key` is the physical-space identity guard.
- Same ID/different key and same key/different ID are blocking errors.
- Automatic inactivation is limited to active rows in the current site with `source='IMPORT'` that are absent from the new workbook.
- Never hard delete locations or aliases. Never automatically inactivate `LEGACY` or `MANUAL` rows.
- Do not add review-only Excel fields to D1.
- Do not add spreadsheet, AI, OCR, resolver, or learning dependencies.
- Production, release version, Issue creation, Speech, and existing dynamic location behavior remain unchanged in Phase A.

## File Structure

**Create:**

- `database/migrations/0036_site_location_master_import.sql` - minimal Location Master metadata, aliases, import history, constraints, and indexes.
- `apps/web/templates/GUI_Arc_현장위치마스터_기본서식_v1.xlsx` - static six-sheet v1 workbook.
- `worker/modules/site-location-import/xlsx-parser.js` - bounded OpenXML reader for the two contract sheets only.
- `worker/modules/site-location-import/contracts.js` - constants, normalization, row schemas, error codes, and public DTO construction.
- `worker/modules/site-location-import/validation.js` - workbook graph, identity, hierarchy, alias, and site-scope validation.
- `worker/modules/site-location-import/diff.js` - deterministic Location/Alias diff and fingerprints.
- `worker/modules/site-location-import/repository.js` - current-site reads and prepared Apply statements.
- `worker/modules/site-location-import/apply.js` - stale-preview verification and transactional Apply orchestration.
- `worker/modules/site-location-import.js` - authenticated HTTP route handler.
- `apps/web/assets/site-location-import.js` - Location Information screen and action state.
- `apps/web/assets/site-location-import.css` - compact upload, summary, error, and preview presentation.
- `tests/site-location-import-migration.test.mjs` - Migration and existing-reference integrity tests.
- `tests/site-location-import-parser.test.mjs` - template and parser tests.
- `tests/site-location-import-validation.test.mjs` - validation and deterministic diff tests.
- `tests/site-location-import-api.test.mjs` - authorization, upload, preview, Apply, atomicity, and history tests.
- `tests/site-location-import-ui.test.mjs` - route, action feedback, and Apply guard tests.

**Modify:**

- `worker/index.js` - dispatch `/api/v1/admin/site-locations/*` to the new handler.
- `apps/web/assets/app.js` - route `/admin/site-locations` to the new page module.
- `apps/web/assets/app.css` - import the feature stylesheet only if the current build does not copy standalone CSS automatically.
- `apps/web/index.html` - link the feature stylesheet and update the static revision only at the final deployment task.
- `apps/web/service-worker.js` - cache the template and changed static assets; update the revision only at the final deployment task.
- `apps/web/assets/integrated-admin.js` - add the Location Information navigation entry if admin navigation is owned here.
- `package.json` - include the new focused tests only if the existing `npm test` glob does not discover them.
- `scripts/validate.mjs` - add template/schema/static-asset assertions without changing product version.

---

### Task 1: Add the Minimal Phase A Schema

**Files:**
- Create: `database/migrations/0036_site_location_master_import.sql`
- Create: `tests/site-location-import-migration.test.mjs`

**Interfaces:**
- Produces: `site_locations.canonical_key`, `site_locations.source`, `site_location_aliases`, and `site_location_imports` for all later tasks.
- Preserves: existing `site_locations.id`, active state, hierarchy, and every Issue foreign-key reference.

- [ ] **Step 1: Write the failing Migration contract test**

Create a test that loads the v0.27.2 test schema through Migration 0035, inserts one Legacy location and one Issue reference, applies 0036, and asserts:

```js
assert.deepEqual(columns("site_locations").filter(name=>["canonical_key","source"].includes(name)),["canonical_key","source"]);
assert.equal(db.prepare("SELECT source FROM site_locations WHERE id='legacy-room'").get().source,"LEGACY");
assert.equal(db.prepare("SELECT room_location_id FROM issue_items WHERE id='issue-1'").get().room_location_id,"legacy-room");
assert.ok(tableExists("site_location_aliases"));
assert.ok(tableExists("site_location_imports"));
assert.equal(sql.includes("last_import_id"),false);
```

Also assert source/status CHECK constraints, the partial `(site_id, canonical_key)` unique index, alias normalized uniqueness, foreign keys, and count columns.

- [ ] **Step 2: Run the Migration test and verify it fails**

Run: `node --test tests/site-location-import-migration.test.mjs`

Expected: FAIL because Migration 0036 and the new columns/tables do not exist.

- [ ] **Step 3: Write Migration 0036**

Use SQLite-compatible statements matching current migrations:

```sql
ALTER TABLE site_locations ADD COLUMN canonical_key TEXT;
ALTER TABLE site_locations ADD COLUMN source TEXT NOT NULL DEFAULT 'LEGACY'
  CHECK(source IN ('LEGACY','MANUAL','IMPORT'));

CREATE UNIQUE INDEX idx_site_locations_site_canonical_key
ON site_locations(site_id,canonical_key)
WHERE canonical_key IS NOT NULL;
```

Create `site_location_aliases` with `id`, `site_id`, `location_id`, `alias_text`, `normalized_alias`, `alias_type`, `source`, `is_active`, timestamps, checks, FK references, and site lookup indexes. Create `site_location_imports` with the approved compact metadata/count columns and status CHECK. Do not add workbook review fields or any row-level import revision column.

- [ ] **Step 4: Run the Migration test and existing Issue schema tests**

Run: `node --test tests/site-location-import-migration.test.mjs tests/issue-foundation.test.mjs`

Expected: PASS; the Legacy row and existing Issue FK remain unchanged.

- [ ] **Step 5: Commit the schema unit**

```powershell
git add database/migrations/0036_site_location_master_import.sql tests/site-location-import-migration.test.mjs
git commit -m "feat: add site location import schema"
```

### Task 2: Add the Static Workbook and Bounded Parser

**Files:**
- Create: `apps/web/templates/GUI_Arc_현장위치마스터_기본서식_v1.xlsx`
- Create: `worker/modules/site-location-import/contracts.js`
- Create: `worker/modules/site-location-import/xlsx-parser.js`
- Create: `tests/site-location-import-parser.test.mjs`
- Modify: build copy script identified in `package.json` or `scripts/build.mjs`

**Interfaces:**
- Produces: `parseSiteLocationWorkbook(buffer)` returning `{locations, aliases, workbookMeta, diagnostics}`.
- Produces: `LOCATION_IMPORT_LIMITS`, required sheet/header constants, `normalizeAlias()`, and stable parser error codes.
- Consumes: `unzipSync` and `strFromU8` from the existing `fflate` dependency.

- [ ] **Step 1: Write the failing static-template contract test**

Assert the checked-in workbook exists, has exactly the required six named sheets, and that only these headers are required:

```js
assert.deepEqual(locationHeaders,["location_id","parent_location_id","location_type","canonical_key","display_name","sort_order"]);
assert.deepEqual(aliasHeaders,["alias_id","location_id","alias_text","alias_type"]);
```

Assert the parser output contains no `site_id` target field and ignores changed values in sheets 00, 03, 04, and 05.

- [ ] **Step 2: Run the parser test and verify it fails**

Run: `node --test tests/site-location-import-parser.test.mjs`

Expected: FAIL because the template/parser do not exist.

- [ ] **Step 3: Create the static XLSX template**

Generate the workbook once as an implementation artifact, then check in the binary under `apps/web/templates`. Include:

```text
00_사용안내
01_위치마스터
02_위치별칭
03_검증_확인필요
04_도면근거
05_ChatGPT작성규칙
```

Mark the four review sheets as `IMPORT 미사용`. Do not place an authoritative site ID in the workbook. Include optional 현장명 guidance cells only.

- [ ] **Step 4: Implement the bounded parser**

Reuse the construction parser's OpenXML techniques without importing its construction-domain interpretation. Enforce:

```js
export const LOCATION_IMPORT_LIMITS={
  compressedBytes:10*1024*1024,
  locations:5000,
  aliases:10000,
  cellChars:500,
  expandedXmlBytes:40*1024*1024
};
```

Read only sheets 01 and 02, reject missing/duplicate required headers, never execute formulas/external links/macros, and normalize cell strings without fuzzy matching.

- [ ] **Step 5: Add the template to the existing web-copy build path**

Extend the current asset copy operation so build produces:

```text
dist/templates/GUI_Arc_현장위치마스터_기본서식_v1.xlsx
```

Do not add runtime XLSX generation or a new spreadsheet dependency.

- [ ] **Step 6: Run parser and build-copy tests**

Run: `node --test tests/site-location-import-parser.test.mjs`

Expected: PASS for Korean text, 1,700 rows, ignored review sheets, invalid signatures, limits, and exact headers.

- [ ] **Step 7: Commit the parser/template unit**

```powershell
git add apps/web/templates worker/modules/site-location-import tests/site-location-import-parser.test.mjs package.json scripts
git commit -m "feat: add location master workbook parser"
```

### Task 3: Implement Validation and Deterministic Diff

**Files:**
- Create: `worker/modules/site-location-import/validation.js`
- Create: `worker/modules/site-location-import/diff.js`
- Create: `tests/site-location-import-validation.test.mjs`

**Interfaces:**
- Consumes: parser rows and repository snapshot DTOs.
- Produces: `validateLocationImport({siteId, workbook, current})` returning `{errors, normalized}`.
- Produces: `buildLocationImportDiff({siteId, normalized, current})` returning `{operations, counts, baseMasterFingerprint, previewHash}`.

- [ ] **Step 1: Write failing validation tests for every blocking rule**

Use small explicit fixtures and assert stable codes:

```text
LOCATION_IMPORT_SHEET_REQUIRED
LOCATION_IMPORT_HEADER_REQUIRED
LOCATION_IMPORT_LOCATION_ID_DUPLICATE
LOCATION_IMPORT_CANONICAL_KEY_DUPLICATE
LOCATION_IMPORT_PARENT_MISSING
LOCATION_IMPORT_PARENT_SELF
LOCATION_IMPORT_PARENT_CYCLE
LOCATION_IMPORT_TYPE_UNSUPPORTED
LOCATION_IMPORT_CROSS_SITE_REFERENCE
LOCATION_IMPORT_IDENTITY_REUSED
LOCATION_IMPORT_CANONICAL_KEY_REUSED
LOCATION_IMPORT_ALIAS_TARGET_MISSING
```

Assert any error sets `applyAllowed:false` and creates no D1 write statement.

- [ ] **Step 2: Run validation tests and verify they fail**

Run: `node --test tests/site-location-import-validation.test.mjs`

Expected: FAIL because validator/diff exports do not exist.

- [ ] **Step 3: Implement deterministic validation**

Validate against the authenticated `siteId` argument only. Treat optional workbook site metadata as mismatch evidence but never as a target. Build one candidate graph from workbook rows plus explicitly referenced active same-site existing parents; use depth-first color marking to reject cycles. Preserve the current valid parent matrix and do not infer hierarchy from labels.

- [ ] **Step 4: Implement deterministic diff and fingerprints**

Sort normalized rows and operations by stable ID before hashing. Emit only:

```text
ADD UPDATE UNCHANGED INACTIVE
ALIAS_ADD ALIAS_UPDATE ALIAS_INACTIVE ERROR
```

Inactivation predicate must be exact:

```js
row.site_id===siteId && row.source==="IMPORT" && row.is_active===1 && !incomingIds.has(row.id)
```

Never emit INACTIVE for `LEGACY` or `MANUAL`. Same ID/key with changed display fields emits UPDATE. Identity collisions emit ERROR, not UPDATE.

- [ ] **Step 5: Run validation/diff tests**

Run: `node --test tests/site-location-import-validation.test.mjs`

Expected: PASS, including shuffled-input determinism, unchanged suppression from detail preview, alias site scope, Legacy protection, and no hard-delete operation.

- [ ] **Step 6: Commit the validation/diff unit**

```powershell
git add worker/modules/site-location-import/validation.js worker/modules/site-location-import/diff.js tests/site-location-import-validation.test.mjs
git commit -m "feat: validate and diff location imports"
```

### Task 4: Implement Upload, Validation, Preview, and History APIs

**Files:**
- Create: `worker/modules/site-location-import/repository.js`
- Create: `worker/modules/site-location-import.js`
- Create: `tests/site-location-import-api.test.mjs`
- Modify: `worker/index.js`

**Interfaces:**
- Produces routes:
  - `GET /api/v1/admin/site-locations/summary`
  - `GET /api/v1/admin/site-locations/template`
  - `POST /api/v1/admin/site-locations/upload-sessions`
  - `POST /api/v1/admin/site-locations/upload-sessions/:id/validate`
  - `GET /api/v1/admin/site-locations/imports`
- Stores only compact import metadata before Apply; no Location/Alias row writes occur in this task.

- [ ] **Step 1: Write failing API contract tests**

Test active-site context, ADMINISTRATION VIEW/MANAGE separation, View-only upload denial, cross-site session denial, `.xlsx` signature/hash checks, R2 key ownership, summary/history counts, and validation response shape. Assert validation errors leave `site_locations` and `site_location_aliases` unchanged.

- [ ] **Step 2: Run the API tests and verify they fail**

Run: `node --test tests/site-location-import-api.test.mjs`

Expected: FAIL with route/module not found.

- [ ] **Step 3: Implement current-site repository reads**

Add focused methods:

```js
loadLocationMasterSnapshot(env,siteId)
loadRecentLocationImports(env,siteId,limit)
countActiveFixedLocations(env,siteId)
getLocationImport(env,siteId,importId)
```

Every query binds `siteId`; no method accepts workbook site identity.

- [ ] **Step 4: Implement temporary upload and validation routes**

Reuse the existing construction presigned R2 pattern with a site/import-scoped key. Validation must fetch the object, verify SHA-256/signature, parse, load current snapshot, validate, build diff, persist compact status/count/hash metadata, and return changed operations plus bounded errors. It must not apply Location/Alias writes.

- [ ] **Step 5: Implement static template download**

Serve `/templates/GUI_Arc_현장위치마스터_기본서식_v1.xlsx` through an authorized endpoint or a same-origin static redirect. Set an attachment filename and do not mutate workbook cells at runtime.

- [ ] **Step 6: Wire the Worker route**

Import `handleSiteLocationImportRequest` in `worker/index.js` and dispatch it before the generic 404, following existing admin module ordering.

- [ ] **Step 7: Run API tests**

Run: `node --test tests/site-location-import-api.test.mjs`

Expected: PASS for upload/validate/preview/history with Location Master write count zero.

- [ ] **Step 8: Commit the read/preview API unit**

```powershell
git add worker/modules/site-location-import/repository.js worker/modules/site-location-import.js worker/index.js tests/site-location-import-api.test.mjs
git commit -m "feat: add location import preview API"
```

### Task 5: Implement Explicit Atomic Apply and Re-import

**Files:**
- Create: `worker/modules/site-location-import/apply.js`
- Modify: `worker/modules/site-location-import/repository.js`
- Modify: `worker/modules/site-location-import.js`
- Modify: `tests/site-location-import-api.test.mjs`

**Interfaces:**
- Produces: `POST /api/v1/admin/site-locations/imports/:id/apply`.
- Consumes: `{previewHash, baseMasterFingerprint}` plus CSRF, context version, and `idempotency-key`.
- Produces: committed counts, import status `APPLIED`, and new master fingerprint.

- [ ] **Step 1: Write failing Apply tests**

Cover explicit Apply, stale preview, duplicate idempotency replay, identity conflict after preview, ADD, UPDATE, imported-row INACTIVE, alias operations, reactivation, Legacy/Manual omission protection, invalid canonical IDs, and a forced middle-statement failure that leaves all Location/Alias rows unchanged.

- [ ] **Step 2: Run Apply tests and verify they fail**

Run: `node --test tests/site-location-import-api.test.mjs --test-name-pattern="apply|re-import|stale|atomic"`

Expected: FAIL because Apply is not implemented.

- [ ] **Step 3: Implement Apply re-verification**

The Apply handler must re-authorize, reload the immutable R2 object, re-hash, reparse, revalidate, reload current DB state, and recompute diff. Return `409 LOCATION_IMPORT_PREVIEW_STALE` if file hash, base fingerprint, or preview hash differs. Never trust client-supplied operation rows.

- [ ] **Step 4: Build prepared transactional statements**

Generate bounded multi-row prepared statements for:

```text
location ADD/UPDATE/INACTIVE
alias ADD/UPDATE/INACTIVE
site_location_imports -> APPLIED with counts
audit_logs -> SITE_LOCATION_IMPORT_APPLIED
idempotency result
```

Execute them in one `env.DB.batch()` transaction. Do not issue DELETE. If the transaction fails, no partial master state remains; record `FAILED` only in a separate best-effort status update that cannot be confused with a committed Apply.

- [ ] **Step 5: Implement idempotency and duplicate-click safety**

Require an idempotency key. Same key/same payload returns the original result; same key/different payload returns the existing mismatch error contract. Compare-and-set import status from READY to APPLYING/APPLIED so concurrent Apply calls cannot both mutate data.

- [ ] **Step 6: Run Apply and maximum-size batch tests**

Run: `node --test tests/site-location-import-api.test.mjs`

Expected: PASS, including a generated 1,700-location fixture and exact zero partial rows after forced failure.

- [ ] **Step 7: Commit the Apply unit**

```powershell
git add worker/modules/site-location-import tests/site-location-import-api.test.mjs
git commit -m "feat: apply location imports atomically"
```

### Task 6: Add the Location Information Admin Screen

**Files:**
- Create: `apps/web/assets/site-location-import.js`
- Create: `apps/web/assets/site-location-import.css`
- Create: `tests/site-location-import-ui.test.mjs`
- Modify: `apps/web/assets/app.js`
- Modify: `apps/web/assets/integrated-admin.js`
- Modify: `apps/web/index.html`

**Interfaces:**
- Consumes: summary, template, upload-session, validate-preview, Apply, and history APIs from Tasks 4-5.
- Produces: `/admin/site-locations` with visible processing/success/failure states and no client-side authority decisions.

- [ ] **Step 1: Write failing route and UI contract tests**

Assert the route is reachable from 현장정보, and rendered markup contains:

```text
현재 등록 위치 수
마지막 Import
기본서식 다운로드
Excel 가져오기
검증 결과
변경 Preview
적용
최근 Import 결과
```

Assert Apply is disabled before a zero-error READY preview, `UNCHANGED` is count-only, changed rows are categorized, errors are accessible, and buttons expose `disabled`/`aria-busy` during requests.

- [ ] **Step 2: Run UI tests and verify they fail**

Run: `node --test tests/site-location-import-ui.test.mjs`

Expected: FAIL because the route/module/styles do not exist.

- [ ] **Step 3: Add admin navigation and route loading**

Add `/admin/site-locations` to the existing managed admin path sets and navigation under 현장정보. Dynamically import `site-location-import.js` using the same static revision mechanism as other admin modules.

- [ ] **Step 4: Implement the minimal screen state machine**

Use explicit states:

```text
IDLE -> UPLOADING -> VALIDATING -> READY -> APPLYING -> APPLIED
                              \-> INVALID
                              \-> FAILED
```

Keep the file and preview after recoverable failures. Disable duplicate upload/validate/Apply actions. Show Korean status text in `role="status"`; errors use `role="alert"`. Require a confirmation dialog that repeats ADD/UPDATE/INACTIVE/Alias counts before Apply.

- [ ] **Step 5: Render changed rows only**

Show summary counts for all categories but detail rows only for ADD, UPDATE, INACTIVE, ALIAS_ADD, ALIAS_UPDATE, ALIAS_INACTIVE, and ERROR. For UPDATE show before/after. Label INACTIVE as 비활성 예정, never 삭제.

- [ ] **Step 6: Add compact responsive styles**

Keep the existing admin visual language. Use a single-column mobile layout, minimum 44px action targets, horizontal containment for wide diffs, and sticky Apply summary only if it does not cover controls.

- [ ] **Step 7: Run UI and existing admin navigation tests**

Run: `node --test tests/site-location-import-ui.test.mjs tests/issue-operational-stabilization.test.mjs`

Expected: PASS with existing mobile/common navigation unchanged.

- [ ] **Step 8: Commit the admin UI unit**

```powershell
git add apps/web/assets/site-location-import.js apps/web/assets/site-location-import.css apps/web/assets/app.js apps/web/assets/integrated-admin.js apps/web/index.html tests/site-location-import-ui.test.mjs
git commit -m "feat: add location import admin screen"
```

### Task 7: Close Security, API, and Data-integrity Gaps

**Files:**
- Modify: `tests/site-location-import-api.test.mjs`
- Modify: `tests/site-location-import-validation.test.mjs`
- Modify: `scripts/validate.mjs`

**Interfaces:**
- Verifies all public Phase A contracts without adding product scope.

- [ ] **Step 1: Add adversarial site-scope tests**

Test foreign-site location IDs, canonical keys, aliases, import IDs, and forged workbook metadata. Assert every read/write uses `auth.siteId`, no Excel field changes target scope, and View-only/SITE-unrelated users cannot upload or Apply.

- [ ] **Step 2: Add archive and payload safety tests**

Test malformed ZIP central directory, oversized expanded XML, excessive shared strings, duplicate headers, control characters, long labels, formula/external-link cells, and hash mismatch. Every case must return a stable 4xx error with zero Location Master writes.

- [ ] **Step 3: Add historical-reference tests**

Create an Issue referencing an imported location, omit that location on re-import, Apply INACTIVE, and assert:

```js
assert.equal(location.is_active,0);
assert.equal(issue.room_location_id,location.id);
assert.equal(renderedHistoricalLocation,"기존 위치명");
```

Also assert inactive rows are absent from current form-option queries.

- [ ] **Step 4: Extend repository validation script**

Add checks that Migration 0036 exists, the template exists, required contract sheets/headers parse, the admin route is wired, and no Phase A file contains resolver/PDF/AI implementation markers.

- [ ] **Step 5: Run the focused Phase A suite**

Run:

```powershell
node --test tests/site-location-import-migration.test.mjs tests/site-location-import-parser.test.mjs tests/site-location-import-validation.test.mjs tests/site-location-import-api.test.mjs tests/site-location-import-ui.test.mjs
```

Expected: all Phase A tests PASS.

- [ ] **Step 6: Commit the contract-hardening unit**

```powershell
git add tests/site-location-import-*.test.mjs scripts/validate.mjs
git commit -m "test: harden location import contracts"
```

### Task 8: Final Local Verification and Integration Handoff

**Files:**
- Modify: `apps/web/index.html` only for the approved new static revision.
- Modify: `apps/web/service-worker.js` only for the same approved revision and template shell entry.
- Modify: static query-bearing files only if the existing revision-chain audit requires them.

**Interfaces:**
- Produces: a locally verified Phase A candidate and an Integration Migration/Worker/Pages deployment checklist.
- Does not execute Production deployment or Phase B/C/D.

- [ ] **Step 1: Run the full local verification once**

Run:

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
git diff --check
```

Expected: all PASS. Stop on the first failure; do not weaken expectations.

- [ ] **Step 2: Audit built template and static chain**

Confirm the built workbook exists at the expected `dist/templates` path, opens through the parser, and retains all six sheets. Confirm source and dist HTML/service worker/module queries use one new unique revision and contain no stale changed-asset revision.

- [ ] **Step 3: Review the final Phase A diff**

Verify modified files are limited to Migration 0036, Phase A Worker/UI/parser/template/tests, required route/build/static revision wiring, and validation metadata. Explicitly verify no changes in `worker/modules/issues.js`, Speech modules, resolver code, Issue Create behavior, version release files, or Production configuration.

- [ ] **Step 4: Commit the verified static handoff**

```powershell
git add apps/web/index.html apps/web/service-worker.js apps/web/assets/app.js apps/web/templates scripts package.json package-lock.json
git commit -m "chore: prepare location import integration assets"
```

Stage only files actually changed by the approved Phase A implementation; omit unchanged paths from the command.

- [ ] **Step 5: Prepare, but do not execute without explicit approval, the Integration sequence**

```text
1. Apply Migration 0036 to Integration D1.
2. Deploy Integration Worker because API/schema-aware Worker code changed.
3. Deploy Integration Pages because admin UI/template/static assets changed.
4. Verify Migration, Worker version, Pages deployment, canonical asset chain, and template download.
5. Device/admin smoke: template -> upload -> invalid blocks Apply -> valid preview -> Apply -> re-import UPDATE/INACTIVE/Alias.
```

Production remains `NOT_CHANGED`. Phase A is not complete until Integration validates ADD, UPDATE, INACTIVE, alias operations, re-import, stale-preview rejection, and Legacy/Manual protection.

## Plan Self-Review

- Phase A covers template, UI, parser, validation, diff, preview, explicit atomic Apply, re-import, aliases, and compact history.
- `site_locations` adds only `canonical_key` and `source`; no row-level Import revision field is planned.
- Workbook metadata never chooses the target site; every repository/API operation binds authenticated `auth.siteId`.
- Every blocking validation path explicitly guarantees Apply disabled and zero Location Master writes.
- Deterministic identity collisions are errors; display and alias updates remain allowed.
- Inactivation is restricted to missing active current-site `IMPORT` rows; Legacy/Manual and historical Issue references are protected.
- Static XLSX is preferred and included in the existing build; runtime workbook generation and new spreadsheet dependencies are excluded.
- Phase B lookup-only, Phase C Resolver, Phase D PDF AI, Speech, Issue Create, Production, release, and unrelated refactors are absent from implementation tasks.
- Each implementation task starts with a failing test, defines exact interfaces, runs focused verification, and ends with a reviewable commit.
- No unresolved placeholder remains in this plan.

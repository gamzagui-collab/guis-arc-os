# Site Location Master Excel Import v1 Design

Date: 2026-08-13
Status: DESIGN READY FOR USER REVIEW
Product baseline: GUI's Arc Integrated v0.27.1
Delivery scope: Design only. No application code, Migration, D1/R2 write, deployment, or Production change.

## PURPOSE

Site Location Master Excel Import v1 provides a controlled way to register and maintain a site's fixed physical spaces in the existing `site_locations` hierarchy. Issue, a future Location Resolver, location statistics, and drawing views must refer to the same stable `location_id` for the same physical space.

The user flow is deliberately approval-based:

```text
UPLOAD
-> VALIDATE
-> DIFF PREVIEW
-> USER APPLY
-> LOCATION MASTER UPDATE
```

Uploading or validating a workbook never changes Location Master data. Only an explicit Apply action may write the approved diff.

Identity priority is:

```text
accurate canonical location
> accurate non-canonical Issue description
> unspecified location
> false canonical location
```

## NON-GOALS

This version does not implement:

- Speech Location Resolver or Speech alias resolution.
- Automatic alias learning, evidence scoring, confidence, or promotion.
- PDF parsing, OCR, or direct AI analysis.
- Automatic drawing-view generation.
- Location statistics dashboards.
- Automatic cleanup of the current Legacy location rows.
- A new `site_spaces` core or a second physical-space graph.
- A tree editor, onboarding wizard, or complex site-management console.
- Automatic creation of BUILDING, FLOOR, UNIT, or ROOM while an Issue is created.
- Hard deletion of existing locations or aliases.
- A database copy of every row for every imported revision.

The Excel workbook may contain review-oriented columns and sheets, but Import v1 does not turn them into operational database columns.

## CURRENT STATE

### Existing schema

The current `site_locations` table already provides the fixed hierarchy foundation:

```text
id
site_id
parent_id
location_type
code
name
display_name
sort_order
is_active
created_at
updated_at
```

It is site-scoped and self-referential through `parent_id`. Existing Issue rows reference building, floor, unit, and room location IDs and also retain a display-oriented `location_text` snapshot. Inactive locations can therefore remain resolvable for historical Issues.

The current schema has no stable physical identity key, source classification, import history, or alias table. Its uniqueness rule around site/type/code is insufficient to detect reuse of one ID for a different physical space across workbook revisions.

### Existing Issue path

- Issue form options read active `site_locations` rows for the selected site.
- Current Issue creation accepts canonical location IDs and contains legacy label-based dynamic resolution through `resolveLocation()`.
- The existing resolver can insert location rows during Issue creation.
- Issue creation permits partial or absent location metadata.

The target contract changes only the long-term ownership boundary: Location Master Import or explicit administration owns fixed locations; Issue Create becomes lookup-only and may submit existing IDs or no location IDs. Resolver or import failure must not block Issue creation.

### Existing administration and permissions

- The integrated administration UI is route-based and has no current Location Master Import screen.
- Site-scoped authorization already uses active site membership, context checks, board grants, and server-side role/permission verification.
- Existing upper administration roles include `PLATFORM_OWNER`, `INTEGRATED_OWNER`, and site-scoped `SITE_MANAGER`.
- Existing mutation flows use CSRF protection, context-version checks, audit records, and idempotency patterns.

### Existing Excel, R2, and database patterns

- The repository already parses XLSX OpenXML packages with `fflate` in the construction Excel module; there is no general-purpose `xlsx` or `exceljs` dependency.
- Existing upload flows validate file extension/signature, compute SHA-256, use temporary R2 upload sessions, analyze before confirmation, and clean temporary objects.
- Existing Worker code uses prepared D1 statements and transactional `D1Database.batch()` patterns.
- Static web assets are built from `apps/web`; the future admin UI should follow the existing integrated-admin routing and asset pipeline rather than introduce a new frontend framework.

## DATA MODEL

The implementation phase should introduce one minimal Migration after a separate schema review. This design does not create or run that Migration.

### `site_locations` extensions

Add only the metadata required for stable identity and safe re-import:

```text
canonical_key TEXT NULL
source TEXT NOT NULL DEFAULT 'LEGACY'
```

`source` accepts only:

```text
MANUAL
IMPORT
LEGACY
```

Rules:

- Existing rows are backfilled by the column default as `LEGACY`; they are not inferred, renamed, moved, or inactivated.
- `canonical_key` is required for new `IMPORT` rows and remains nullable for pre-existing Legacy rows until separately curated.
- Add a partial unique index on `(site_id, canonical_key)` where `canonical_key IS NOT NULL`.
- `id` remains the authoritative stable `location_id`.
- `code`, `name`, `display_name`, `sort_order`, `parent_id`, and `is_active` are mutable attributes subject to identity validation.

`site_locations` stores only the current operational state of a physical location. It does not store a row-level last Import revision. Import revision history belongs exclusively to `site_location_imports`. The exact database enforcement for `source` (CHECK constraint or an existing project enum pattern) is decided during the separately approved implementation planning and Migration review.

`canonical_key` identifies the physical space, not its current display label. Example:

```text
KJHD/202동/F14/P1/거실
```

Allowed update:

```text
same location_id
same canonical_key
display_name: 202-P1 -> 1401호
```

Rejected update:

```text
same location_id
canonical_key: KJHD/202동/F14/P1 -> KJHD/202동/F15/P2
```

A canonical key collision under a different `location_id` is also an error. Import never guesses that two IDs should be merged.

### `site_location_aliases`

Create a separate site-scoped alias table:

```text
id TEXT PRIMARY KEY
site_id TEXT NOT NULL
location_id TEXT NOT NULL
alias_text TEXT NOT NULL
normalized_alias TEXT NOT NULL
alias_type TEXT NOT NULL
source TEXT NOT NULL DEFAULT 'IMPORT'
is_active INTEGER NOT NULL DEFAULT 1
created_at TEXT NOT NULL
updated_at TEXT NOT NULL
```

Constraints and indexes:

- Foreign keys target the same site and existing location through server validation; a database FK to `site_locations(id)` prevents orphan aliases.
- Unique `(site_id, normalized_alias)` prevents one approved site phrase from pointing to multiple physical locations.
- Index `(site_id, location_id, is_active)` supports display and resolver lookup.
- `alias_type` v1 values are `OFFICIAL_VARIANT`, `FIELD_NAME`, and `LEGACY_NAME`.
- Only aliases explicitly approved in the workbook are stored in v1.
- No confidence, evidence, risk, AI source, or automatic promotion fields are added.

Alias rows likewise keep current operational state only. Import attempt/revision metadata is not coupled to individual alias rows.

Normalization is deterministic: Unicode normalization, outer/duplicate whitespace removal, and locale-safe case normalization for Latin characters. It does not perform fuzzy matching, semantic expansion, number inference, or Korean pronunciation conversion.

### `site_location_imports`

Store one compact record per upload/import attempt:

```text
id TEXT PRIMARY KEY
site_id TEXT NOT NULL
file_name TEXT NOT NULL
file_hash TEXT NOT NULL
r2_object_key TEXT NULL
template_version TEXT NOT NULL
status TEXT NOT NULL
base_master_fingerprint TEXT NULL
preview_hash TEXT NULL
created_by TEXT NOT NULL
created_at TEXT NOT NULL
validated_at TEXT NULL
applied_at TEXT NULL
added_count INTEGER NOT NULL DEFAULT 0
updated_count INTEGER NOT NULL DEFAULT 0
unchanged_count INTEGER NOT NULL DEFAULT 0
inactivated_count INTEGER NOT NULL DEFAULT 0
alias_added_count INTEGER NOT NULL DEFAULT 0
alias_updated_count INTEGER NOT NULL DEFAULT 0
alias_inactivated_count INTEGER NOT NULL DEFAULT 0
error_count INTEGER NOT NULL DEFAULT 0
```

Allowed statuses:

```text
UPLOADED
VALIDATING
INVALID
READY
APPLYING
APPLIED
FAILED
CANCELLED
```

The table stores counts, hashes, actor, and timestamps, not 1,700-row snapshots. The verified source workbook is the audit artifact. Error details and preview rows are returned to the current session and may be bounded in an existing audit payload; they are recomputed from the immutable workbook before Apply.

## EXCEL CONTRACT

### File contract

- File name recommendation: `GUI_Arc_현장위치마스터_기본서식_v1.xlsx`.
- Accepted format: `.xlsx` only, with ZIP/OpenXML signature validation.
- Maximum compressed size: 10 MiB.
- Maximum locations: 5,000.
- Maximum aliases: 10,000.
- Parser enforces bounded worksheet, shared-string, cell, and decompressed XML sizes to prevent ZIP expansion abuse.
- Formula results, macros, external links, and embedded objects are not trusted or executed.
- Leading/trailing spaces are normalized for validation; IDs and canonical keys are compared by their documented exact normalized form.

### Sheets

The workbook contains:

```text
00_사용안내
01_위치마스터
02_위치별칭
03_검증_확인필요
04_도면근거
05_ChatGPT작성규칙
```

The Import parser reads only `01_위치마스터` and `02_위치별칭`. All other sheets are human/ChatGPT review material and cannot affect validation, diff, or Apply.

### `01_위치마스터` required headers

```text
location_id
parent_location_id
location_type
canonical_key
display_name
sort_order
```

Rules:

- The authenticated server-side current site context is the only Import target. The sheet cannot select or change the target site.
- `location_id` is required and stable. New IDs use the approved project ID format; Import does not silently generate missing IDs.
- `parent_location_id` is blank only for valid roots.
- `location_type` uses the existing supported site-location enum.
- `canonical_key` is required and immutable for one physical identity.
- `display_name` is required and may change on re-import.
- `sort_order` is a non-negative integer.
- Database `code` is deterministically derived from the stable imported `location_id`; database `name` follows the validated display name. The workbook does not expose redundant storage columns.

Review-only workbook columns such as `space_category`, `floor_code`, `floor_name`, `unit_name`, `room_name`, `physical_line`, `unit_type`, `statistics_enabled`, `resolver_ready`, `master_status`, `source_pages`, `source_kind`, and `notes` may exist after the required columns. They are ignored by Import v1 and are not copied into database columns.

### `02_위치별칭` required headers

```text
alias_id
location_id
alias_text
alias_type
```

Rules:

- The authenticated server-side current site context is applied to every alias operation; the sheet cannot select another site.
- `alias_id` is stable across re-imports; new aliases require an approved ID.
- `location_id` must resolve to an incoming or active existing location in the same site.
- `alias_text` is required and is preserved for display.
- `normalized_alias` is computed by the server, never trusted from Excel.
- `alias_type` must be one of the v1 values.

## IMPORT VALIDATION

Validation runs before diff generation and performs no Location Master write.

Structural errors that block Apply:

- Missing `01_위치마스터` or `02_위치별칭` sheet.
- Missing or duplicate required header.
- Duplicate `location_id` in the workbook.
- Duplicate normalized `canonical_key` in the workbook.
- Missing parent.
- Self parent.
- Parent cycle, detected over the final candidate graph.
- Unsupported `location_type` or invalid parent/type relationship.
- A workbook site name, site code, or site ID metadata value that conflicts with the authenticated current site, when such optional review metadata is present. This value is warning/error evidence only and never selects the DB target.
- An ID already owned by another site.
- Same `location_id` with a different existing `canonical_key`.
- Same `canonical_key` assigned to a different existing `location_id`.
- Alias referencing a missing, foreign-site, or to-be-inactivated location.
- Duplicate `alias_id` or conflicting normalized alias.
- Invalid length, control character, row limit, or archive expansion limit.

The final graph may reference either a row in the workbook or an active existing non-Import parent in the same site. If an imported parent is omitted and scheduled for inactivation while a retained child still references it, validation fails.

The parent compatibility matrix preserves current valid structures:

- Site root types may have no parent.
- `FLOOR` may be below a root location.
- `UNIT` may be below `FLOOR` or an existing compatible root for Legacy compatibility.
- `ROOM` may be below `UNIT`, `FLOOR`, or a compatible root.

The implementation must use the authoritative current enum and explicitly test this matrix; it must not infer hierarchy from labels such as `1601호`.

Any error produces:

```text
APPLY disabled
DB Location Master writes = 0
```

## DIFF ALGORITHM

The server computes the diff from the validated workbook and a transactionally read site snapshot.

### Locations

For every workbook location:

1. No existing ID: `ADD`.
2. Existing ID in another site: `ERROR`.
3. Existing ID in the same site with a different canonical key: `ERROR`.
4. Existing canonical key under another ID: `ERROR`.
5. Same ID and canonical key with mutable differences: `UPDATE`.
6. Same values: `UNCHANGED`.

For existing rows omitted from the workbook:

```text
source = IMPORT
AND same site
AND currently active
AND absent from the newly validated full master
```

becomes `INACTIVE` unless retained by a required parent relationship. `LEGACY` and `MANUAL` rows are never automatically inactivated by omission. The first Import therefore cannot mass-inactivate current Legacy/dynamic rows.

`same site` always means the authenticated server-side current site context. It is never derived from workbook content. A stable imported row and every historical Issue reference to it remain intact after inactivation; no omission path performs hard delete.

### Aliases

Aliases use the same ADD/UPDATE/UNCHANGED/INACTIVE model. Only active `IMPORT` aliases omitted from the new alias sheet are inactivated. A normalized alias cannot be reassigned to another location through UPDATE; that is an identity conflict requiring explicit correction in the workbook.

### Concurrency fingerprint

The preview includes:

- Workbook SHA-256.
- Deterministic master fingerprint over relevant site locations and aliases.
- Deterministic preview hash over sorted diff operations.

Apply recomputes all three. If the workbook or master changed, Apply returns `409 LOCATION_IMPORT_PREVIEW_STALE` and performs no Location Master write.

## PREVIEW UX

Add a future minimal route under the existing integrated site administration UI:

```text
현장정보 > 위치정보
```

The screen shows:

- Current active fixed-location count.
- Last successful Import time and actor.
- `기본서식 다운로드`.
- `Excel 가져오기`.
- Upload/validation progress and clear success/failure feedback.
- Change summary.
- Filtered changed-row details.
- Explicit `적용` action.
- Recent Import results.

Summary example:

```text
신규 위치 34
변경 위치 12
변경 없음 1,704
비활성 예정 6
별칭 신규/변경 18
오류 0
```

Detailed tabs display only:

```text
ADD
UPDATE
INACTIVE
ALIAS ADD
ALIAS UPDATE
ALIAS INACTIVE
ERROR
```

`UNCHANGED` rows are count-only by default. Each UPDATE shows old and new values. Each INACTIVE row is visibly marked as historical-safe, not deleted. Errors show sheet, row, field, stable error code, and Korean remediation text.

Action feedback follows the shared application contract:

- During upload, validation, and Apply, show a visible processing state.
- Disable duplicate submission while a request is active.
- Success identifies counts and completion time.
- Failure keeps the selected file/preview when safe and provides a retry path.
- Apply requires an explicit confirmation dialog summarizing ADD/UPDATE/INACTIVE counts.

## APPLY TRANSACTION

Apply is a server-authorized, idempotent operation. The request contains `importId`, `fileHash`, `previewHash`, `baseMasterFingerprint`, current context version, CSRF proof, and an idempotency key.

The Worker must:

1. Re-check authentication, active site membership, selected site, permission, CSRF, and context version.
2. Lock the import status logically from `READY` to `APPLYING` with compare-and-set semantics.
3. Read the immutable R2 workbook and verify size, SHA-256, signature, and template version.
4. Parse, normalize, and validate again.
5. Re-read current Location Master and recompute the full diff.
6. Reject a stale fingerprint or preview hash without writes.
7. Execute all location, alias, import-status, and audit changes in one D1 transactional batch.
8. Return the committed counts and new master fingerprint.

For 1,700+ rows, prepared multi-row statements are chunked within one D1 batch to stay below parameter and statement limits. The implementation must prove the configured 5,000/10,000 row limits within D1 and Worker execution limits before release. It must not degrade to partially committed chunks.

If any D1 statement fails, the transaction rolls back and the import records `FAILED` in a separate failure-recording attempt without claiming Location Master changes. The source workbook may remain in R2 for diagnosis; R2 retention is not part of the D1 atomic boundary.

Successful Apply writes a bounded audit event containing import ID, site ID, actor, file hash, counts, and timestamp. It does not copy workbook rows or Issue content into audit payloads.

## RE-IMPORT / INACTIVE POLICY

- Same ID and same canonical key: update mutable fields in place and preserve `location_id`.
- New ID: insert an active `IMPORT` row.
- Missing active `IMPORT` row: set `is_active = 0`; never hard delete.
- A previously inactive imported row that returns with the same ID and canonical key may be reactivated.
- Missing `LEGACY` or `MANUAL` row: no automatic action.
- Existing Issue references remain valid regardless of active status.
- Form options exclude inactive rows from new selection while historical Issue rendering continues to use the referenced row and snapshot label.
- Legacy cleanup, deduplication, and canonical-key assignment are separate approved operations, not implicit Import behavior.

## ALIAS MODEL

Aliases are site-scoped, deterministic lookup terms for a future resolver. Examples:

```text
2동 -> location_id of 202동
14층 1호 -> location_id of 1401호
```

Import v1 validates and stores aliases but does not apply them to Speech or Issue creation. Alias resolution must later return the referenced existing location ID; it must never create a location.

An alias is active only within its site. Cross-site reuse is allowed as separate rows, but lookup never crosses the authenticated selected site. One normalized alias within a site cannot point to multiple location IDs in v1; ambiguity must be corrected before Apply.

## LEGACY COMPATIBILITY

- Existing rows become `LEGACY` without physical-identity inference.
- First Import does not alter, deactivate, move, or merge Legacy rows.
- Existing Issues retain all foreign-key references and location snapshots.
- Import may reference an active Legacy parent only when the parent ID is explicit and site/type validation passes.
- An imported physical space that appears similar to a Legacy row is not automatically merged. Administrators must curate identity in a separately approved compatibility process.
- Fixed and Legacy rows may coexist during transition; form-option presentation must avoid duplicate user confusion through explicit source/active filtering designed during implementation.
- Existing Issue Create dynamic insertion must be retired in a separately tested compatibility phase. Until that phase is complete, Import does not silently change Issue behavior.

The target Issue contract is:

```text
Issue Create != Location Master Create
Issue Create = existing location_id references OR no location_id
```

A fixed location not found in the master remains in Issue description with canonical location IDs null. It is excluded from location-ID statistics rather than becoming a guessed master row.

## PERMISSIONS

All endpoints are site-context scoped and re-authorized by the Worker; the frontend never decides permission from role names alone.

Recommended contract using the current administration model:

- Read current counts/history and download the general v1 template: active site member with `ADMINISTRATION` board `VIEW`.
- Upload, validate, preview, and Apply: `ADMINISTRATION` board `MANAGE` plus an existing administrative role allowed by current policy: `PLATFORM_OWNER`, `INTEGRATED_OWNER`, or `SITE_MANAGER` for that site.
- Users with View-only grants cannot upload or Apply.
- Cross-site IDs, aliases, import IDs, R2 keys, and context versions are rejected server-side.
- Apply records the actual actor and role context.

No new role is introduced. If the implementation audit finds a narrower existing permission dedicated to site configuration, it may replace `ADMINISTRATION MANAGE` only after an API/permission contract review.

## FAILURE / ROLLBACK

Failure isolation:

- Upload failure: no DB writes; retry upload.
- Parse/validation failure: import status `INVALID`; no Location Master writes.
- Preview conflict: refresh and revalidate; no writes.
- Apply stale conflict: `409 LOCATION_IMPORT_PREVIEW_STALE`; no writes.
- D1 apply failure: transaction rollback; no partial Location Master.
- R2 read failure before Apply: Apply fails without DB writes.
- Audit/status follow-up failure must not claim success without verifying the committed batch result.

Rollback of an applied import is not a blind file rollback and is not included in v1 UI. A correction is a new validated workbook and a new Apply. Emergency operational rollback requires an explicitly reviewed reverse diff using retained workbook/hash and audit metadata; it never hard deletes referenced locations.

R2 lifecycle:

- Upload uses a temporary, site/import-scoped object key.
- Invalid or abandoned uploads are removed by bounded cleanup policy.
- A successfully applied source workbook is retained as the immutable audit artifact at a non-public site/import key.
- Downloads require re-authorization and signed/streamed access; R2 keys are never accepted directly from the client.

## TEMPLATE DOWNLOAD

Endpoint concept:

```text
GET /api/v1/admin/site-locations/template
```

The response is a generated `.xlsx` attachment named:

```text
GUI_Arc_현장위치마스터_기본서식_v1.xlsx
```

The template is a general-purpose workbook. The download response may place the current site name in an instruction cell for user convenience and identifies template version `LOCATION_MASTER_V1`, but no workbook value controls database identity or target scope. The authenticated server-side current site context remains authoritative throughout upload, validation, preview, and Apply.

Implementation should reuse `fflate` and a checked-in deterministic OpenXML template/generator rather than introduce a broad spreadsheet library solely for this feature. Generated workbook properties and ZIP entry order are deterministic so template tests can compare required sheets and headers.

`00_사용안내` explains identity, parent, full-master re-upload, inactivity, and error rules. `03_검증_확인필요`, `04_도면근거`, and `05_ChatGPT작성규칙` support user/ChatGPT preparation but are explicitly marked `IMPORT 미사용`. The parser ignores their content even if modified.

## TEST STRATEGY

### Schema and Migration tests

- Existing site_locations and Issue references survive Migration unchanged.
- Existing rows default to `LEGACY` and remain active.
- Partial canonical-key uniqueness is site-scoped.
- Alias FK, normalized uniqueness, status checks, and indexes behave as specified.
- Import history stores counts/metadata without row snapshots.

### Template/parser tests

- Downloaded workbook has the exact six sheets and required headers.
- Only sheets 01 and 02 influence parser output.
- Korean names, long valid labels, empty parent roots, and 1,700-row input parse correctly.
- Invalid ZIP, disguised extension, formula/external-link input, oversized XML, excessive rows, and ZIP expansion are rejected safely.

### Validation tests

- Every blocking rule in IMPORT VALIDATION returns a stable error code and zero writes.
- Parent graph detects missing parent, self-parent, indirect cycle, and invalid type hierarchy.
- Same ID/different canonical key and same key/different ID are rejected.
- Cross-site location/alias/import contamination is rejected.

### Diff and re-import tests

- ADD, UPDATE, UNCHANGED, INACTIVE, alias operations, and reactivation are deterministic.
- Display-name change preserves location ID.
- First Import does not inactivate Legacy/Manual rows.
- Missing imported rows become inactive, not deleted.
- Historical Issue display remains intact for inactive locations.
- Concurrent master change invalidates preview.

### Apply tests

- Apply requires explicit authorization, CSRF, context version, and idempotency.
- Apply reparses and recomputes rather than trusting client preview rows.
- Any statement failure leaves zero partial Location Master changes.
- Duplicate Apply returns the original committed result.
- Configured maximum workbook applies within D1/Worker limits using transactional prepared batches.

### Issue compatibility tests

- Existing canonical location selection and historical display remain valid.
- Inactive locations are excluded from new selection.
- Issue creation with no location succeeds.
- Once the separate dynamic-creation retirement phase is implemented, Issue Create never inserts `site_locations` and resolver failure falls back to null IDs.

### UI and accessibility tests

- Upload/validate/apply processing, success, failure, and duplicate-action prevention are visible.
- Apply is impossible with errors or stale preview.
- Changed rows are keyboard accessible and filterable without reviewing unchanged rows.
- Destructive-looking INACTIVE operations require confirmation and are clearly distinguished from hard delete.

## FUTURE PDF AI IMPORT

The future PDF phase is intentionally separate:

```text
PDF UPLOAD
-> AI/API DRAFT
-> DETERMINISTIC VALIDATION
-> DIFF PREVIEW
-> USER CONFIRM
-> APPLY
```

AI output is never written directly to canonical tables. It must produce the same v1 workbook contract or an equivalent server-side draft and pass the same identity, hierarchy, site-scope, diff, permission, and transaction rules.

The current operational validation path remains:

```text
user provides drawing PDF + v1 template to ChatGPT
-> user reviews completed Excel
-> GUI's Arc validates
-> user previews diff
-> user applies
```

No PDF, OCR, AI engine, drawing analysis, or automatic resolver work is part of Import v1.

## IMPLEMENTATION PHASES

Implementation requires separate user approval and proceeds in this fixed order:

### PHASE A - SITE LOCATION MASTER EXCEL IMPORT

- Contract tests and Migration review for `canonical_key`, `source`, aliases, imports, and indexes.
- Deterministic general-purpose template download.
- Bounded XLSX upload and parsing.
- Validation, deterministic diff, changed-row preview, and explicit Apply.
- Alias import and compact Import history.
- Legacy coexistence and historical Issue display regression verification.

Phase A is complete only after Integration verifies location ADD, UPDATE, INACTIVE, alias operations, and re-import behavior without changing Legacy/Manual rows by omission.

### PHASE B - ISSUE LOCATION LOOKUP-ONLY CUTOVER

- Remove every Issue Create path that automatically inserts `site_locations`, including label-only `resolveLocation()` insertion.
- Allow only references to existing canonical location IDs or null canonical IDs.
- If no location is found, continue Issue Create with all unresolved canonical IDs null.
- Prohibit dynamic BUILDING, FLOOR, UNIT, and ROOM creation during Issue Create.
- Preserve all Legacy rows and existing Issue references; perform no hard delete.
- Exclude inactive locations from new form options while preserving historical Issue display.

Phase B is complete only when location-free Issue creation succeeds, existing canonical selection succeeds, Issue Create does not unexpectedly increase the `site_locations` row count, and existing Issue workflows pass regression verification.

### PHASE C - FINAL DESCRIPTION LOCATION RESOLVER

- Analyze only the user-corrected and confirmed final description.
- Read Fixed Location Master and approved aliases without writing them.
- Auto-select only a unique exact or explicitly safe match.
- Do not auto-select ambiguous or unresolved candidates.
- Isolate resolver failures so they never block Issue Create.

Phase C starts only after Phase B lookup-only cutover is complete. Resolver implementation must not precede or bypass the removal of Issue-time location insertion.

### PHASE D AND LATER

- PDF AI Draft Import and other separately approved capabilities.
- Every future source uses deterministic validation, preview, user confirmation, and Apply.

Production is not changed by this design and must require a separate release approval after Integration validation.

## DESIGN SELF REVIEW

- No unresolved design placeholder remains.
- No row-level Import revision field remains in the location or alias model; Import revision history is centralized in `site_location_imports`.
- Authenticated server-side current site context is the sole target scope; Excel cannot select or change a site.
- `location_id` is stable row identity; `canonical_key` is immutable physical-space identity validation. Their roles are distinct.
- First Import cannot automatically inactivate `LEGACY` or `MANUAL` rows.
- Issue Create is explicitly separated from Location Master creation and remains possible without location IDs.
- Phase B lookup-only cutover is mandatory after Phase A and before the Phase C resolver.
- No hard-delete path exists for locations or aliases.
- Alias scope, uniqueness, approval source, and future resolver boundary are explicit.
- Review-only Excel fields and sheets are not copied into database columns or trusted by Import.
- Diff shows changed rows while unchanged rows remain count-only.
- Apply reparses, revalidates, re-authorizes, checks concurrency, and commits atomically.
- Existing Issue references and inactive historical labels remain readable.
- PDF/AI processing is a future phase and cannot bypass validation, preview, confirmation, or Apply.
- No application code, Migration, D1/R2 write, deployment, release artifact, or Production change is part of this design task.

# Site Location Simple List Import v2 Design

Date: 2026-08-13
Status: DESIGN REVISION READY FOR REVIEW
Product baseline: GUI's Arc Integrated v0.27.1
Delivery scope: Design only. No application code, Migration, D1/R2 write, deployment, or Production change.

## PURPOSE

The user uploads human-readable physical location names. The workbook is not a database contract and never exposes internal IDs, parent IDs, canonical keys, types, sort values, sources, or alias IDs.

```text
USER EXCEL IS NOT A DATABASE CONTRACT

UPLOAD -> VALIDATE -> DIFF PREVIEW -> USER APPLY -> LOCATION MASTER UPDATE
```

The server owns stable identity, hierarchy, type mapping, ordering, re-import matching, and safe inactivation. Upload and Preview write no Location Master rows. Explicit Apply is required.

## NON-GOALS

- Phase B Issue lookup-only cutover.
- Phase C Resolver, Speech, learned aliases, or fuzzy matching.
- PDF/OCR/AI import.
- Location statistics, drawing views, Legacy cleanup, or tree editing.
- User-managed database IDs or codes.
- Hard deletion of locations or aliases.
- Automatic rename confirmation.

## USER WORKBOOK V2

File name: `GUI_Arc_현장위치목록_기본서식_v2.xlsx`.

Required sheets:

```text
00_사용안내
01_위치목록
```

An optional `02_검토필요` sheet may contain human review notes. The parser does not depend on it.

Required columns in `01_위치목록`:

```text
동/구역
층
호/공간
세부위치
```

Examples:

```text
201동 | 1층 | 101호 |
201동 | 1층 | 경로당 |
201동 | 2층 | 필로티 |
201동 | 4층 | 401호 | 거실
201동 | 4층 | 401호 | 주방
```

Rules:

- `동/구역` is required.
- `층` is required for ordinary residential units. It may be blank for a valid site-level or root-level facility.
- `호/공간` may be blank when the row represents the floor itself.
- `세부위치` is optional and represents the lowest child space.
- A completely blank trailing segment does not create a node.
- The workbook never contains `location_id`, `parent_location_id`, `canonical_key`, `location_type`, `sort_order`, `source`, or `alias_id`.
- Site name/code cells are advisory only. The authenticated server-side current site remains the sole target.

## NORMALIZATION

Normalization is conservative and deterministic:

- Unicode NFC.
- Trim outer whitespace.
- Collapse repeated whitespace.
- Remove unambiguous spacing around Korean numeric suffixes, so `201 동` and `201동` match.
- Preserve meaningful punctuation and wording.
- No edit-distance, semantic, pronunciation, or aggressive fuzzy matching.

The normalized four-segment path is compared only inside the authenticated site.

## HIERARCHY AND TYPE MAPPING

For `201동 | 4층 | 401호 | 거실`, the server builds or reuses:

```text
201동
201동 > 4층
201동 > 4층 > 401호
201동 > 4층 > 401호 > 거실
```

Minimal mapping to the existing enum:

- `동/구역`: `BUILDING` when the value matches a building form; otherwise `OTHER` root.
- `층`: `FLOOR`.
- `호/공간`: `UNIT` only for an explicit room-number form such as `401호`; otherwise `FACILITY` when parent compatibility permits, or `ROOM` under the nearest compatible parent.
- `세부위치`: `ROOM`.

The implementation must define a deterministic compatibility table using existing schema values. It must not infer detailed taxonomies from arbitrary names. Ambiguous structures are validation errors shown in Preview, not guessed.

## SERVER-MANAGED IDENTITY

`site_locations.id` remains the stable database identity. `canonical_key` and `source` from Migration 0036 remain and are not rolled back.

For a new path, the server generates:

- A stable random `location_id` using the project ID convention.
- A deterministic internal `canonical_key` derived from the normalized typed path and site scope.
- Parent links and sort order.
- `source=IMPORT`.

The canonical key is internal metadata, never user input. Its canonical serialization is versioned and collision-checked before Apply. Re-import of the exact normalized typed path reuses the existing ID.

## MATCHING AND RENAME

Exact match requires:

```text
same authenticated site
+ same normalized parent path
+ same normalized display name
+ same mapped type
```

Results:

- Exact path: `UNCHANGED` or mutable `UPDATE`.
- New path: `ADD`.
- Missing active `IMPORT` path: `INACTIVE` candidate.
- Missing `LEGACY` or `MANUAL` path: no action.

A name change cannot be identified automatically because the workbook has no ID. A nonmatching old/new pair remains `REMOVED candidate + ADDED candidate`. Only a unique 1:1 candidate under the same parent/type may be offered in Preview as:

```text
기존: 노인정
신규: 경로당
[같은 위치로 변경] [새 위치]
```

No rename is applied until the user explicitly chooses. “Same location” preserves the old ID and updates the name. “New location” adds the new path and leaves the omitted imported path as an inactivation candidate.

## DUPLICATE AND CONFLICT POLICY

- Duplicate normalized rows collapse to one path only when all four normalized segments and mapped types are identical.
- One normalized path producing conflicting types is an error.
- A generated canonical key collision with another path is an error.
- A path conflicting with an existing non-Import identity is not silently merged.
- Parent cycles and self-parent relationships are impossible from the linear input model but remain server invariants.
- Any ambiguity disables Apply and produces DB writes of zero.

## ALIAS V1 POLICY

Simple List Import v2 has no alias sheet and writes no `site_location_aliases` rows.

- `거실`, `침실1`, and `주방` are physical child nodes, not aliases.
- Computable expressions such as `14층 1호 -> 1401호` belong to future Resolver logic.
- Site-specific phrases such as `2동 = 202동` belong to a future simple Site Alias setting in Phase C.
- Migration 0036 and the existing alias table remain intact but unused by this import flow.

## VALIDATION

Validation is bounded and write-free. It checks:

- XLSX signature, compressed/decompressed size, worksheet/row/column/cell limits, formulas, macros, external links, embedded objects, and control characters.
- Required sheet and exact required headers.
- Required `동/구역`.
- Residential unit rows have a floor.
- Each nonblank segment is within the cell-length limit.
- Deterministic type and parent compatibility.
- Duplicate/conflicting normalized paths.
- Current-site identity and canonical-key collisions.
- Generated operation count remains within atomic D1 limits.

Errors are collected by row where safe. Any error disables Apply.

## DIFF AND RE-IMPORT

The server derives a complete candidate tree before diffing. Parent nodes generated by multiple rows are deduplicated. Operations are deterministic and sorted:

```text
ADD
UPDATE
UNCHANGED
INACTIVE
RENAME_CANDIDATE
ERROR
```

Only active same-site `source=IMPORT` nodes absent from the new complete candidate tree may become inactive. A parent required by any retained child cannot be inactivated. No path hard-deletes data, changes another site, or invalidates historical Issue references.

## PREVIEW UX

Keep the existing `현장정보 > 위치정보` shell, upload feedback, compact counts, changed-row details, explicit Apply, history, and duplicate-action prevention.

Adapt the Preview to human paths. Internal IDs and canonical keys are hidden from normal users. Rename candidates require an explicit choice before Apply. `UNCHANGED` remains count-only.

## APPLY SAFETY

Keep the existing authenticated site scope, permission, CSRF/context checks, immutable workbook hash, preview hash, master revision/fingerprint, idempotency, stale-preview rejection, atomic D1 batch, audit, and failure recovery.

Apply reparses the workbook, regenerates identities and parents, reloads current state, and recomputes the diff. The client never supplies trusted IDs or mutation operations. Partial master updates are forbidden.

## INTERNAL DB AND MIGRATION 0036

- Migration 0036 is not rolled back.
- `site_locations.canonical_key` becomes server-generated identity metadata.
- `site_locations.source` continues to control Import-only inactivation.
- `site_location_aliases` remains for future use but is untouched by Simple List Import v2.
- Import history, revision, apply guards, and idempotency tables remain valid.
- No new Migration is part of this design revision. Implementation must first determine whether current nullable columns and constraints already support the v2 server-generated values.

## EXISTING IMPLEMENTATION REUSE AUDIT

KEEP:

- `site-location-import.js`: route shell, authorization, upload session, immutable object/hash checks, validation/apply state transitions, history, cleanup.
- `xlsx-parser.js`: ZIP/OpenXML security preflight, namespace support, archive/sheet/row/cell bounds, unsafe-content rejection.
- `apply.js`: capacity checks, Apply ownership, idempotency, stale-preview checks, artifact preservation, D1 batch framework, audit.
- `repository.js`: authenticated-site snapshots, foreign identity probes, import/history state access.
- `site-location-import.js` frontend: upload/apply busy states, duplicate prevention, retry, compact Preview shell.
- Migration 0036: canonical/source columns, revisions, import history, apply guards, idempotency, alias table.

ADAPT:

- `contracts.js`: v2 sheets, Korean headers, row model, limits.
- `xlsx-parser.js`: map four human columns instead of database fields.
- `validation.js`: derive hierarchy/types/internal identity and validate human rows.
- `diff.js`: exact path identity and rename candidates instead of workbook IDs.
- `apply.js`: generated location IDs/parents/keys and no alias mutations.
- `repository.js`: path/canonical collision lookup required by generated identity.
- frontend Preview labels/details: human paths and rename decisions; remove alias counts.
- static XLSX template and template tests.

REMOVE FROM USER CONTRACT:

- `02_위치별칭` sheet and all alias input.
- `location_id`, `parent_location_id`, `canonical_key`, `location_type`, `sort_order`, `source`, `alias_id` columns.
- Alias ADD/UPDATE/INACTIVE counts and confirmation text for this flow.

No database table or applied Migration is removed.

## TEST STRATEGY

- Shipping v2 template parses with the production parser and validates with zero errors.
- `201동 | 4층 | 401호 | 거실` creates one deduplicated four-node tree.
- Repeated parents are generated once.
- Exact re-import preserves IDs and produces no duplicates.
- Safe spacing normalization preserves identity.
- No aggressive fuzzy match.
- Missing residential floor, ambiguous type, duplicate conflict, and collision disable Apply with zero writes.
- Rename requires explicit selection and preserves ID only after confirmation.
- Omitted IMPORT nodes become inactive; LEGACY/MANUAL remain active.
- Cross-site requests and forged client operations are rejected.
- Stale Preview and atomic failure leave no partial data.
- Alias table remains unchanged.

## FUTURE PHASES

- Phase B: Issue Location lookup-only cutover.
- Phase C: final-description Resolver and simple site alias settings.
- Phase D: PDF/AI draft generation followed by deterministic validation, Preview, user confirmation, and Apply.

AI never writes canonical rows directly.

## RELEASE BOUNDARY

The current Phase A Integration smoke remains paused. This document does not authorize implementation, Migration, D1/R2 write, deployment, or Production change.

# Site Location Simple List Import v2 Implementation Plan

Date: 2026-08-13
Status: REVISION DRAFT - IMPLEMENTATION NOT AUTHORIZED
Design: `docs/superpowers/specs/2026-08-13-site-location-master-excel-import-design.md`

## Objective

Replace the current database-shaped workbook contract with a human-readable four-column location list while preserving the proven Phase A upload, authorization, Preview, stale-state, atomic Apply, history, and safety foundations.

This plan is intentionally not executable until separately approved.

## Scope Boundary

Included after approval:

- v2 static template.
- Four-column parser and bounded validation.
- Server-generated hierarchy, types, IDs, canonical keys, and sort order.
- Exact path re-import matching and safe Import-only inactivation.
- Human-path Preview and explicit rename decisions.
- Existing authenticated upload/apply/history UI.

Excluded:

- Phase B Issue lookup-only.
- Phase C Resolver or aliases.
- Speech, PDF, OCR, AI, statistics, tree editor, Legacy cleanup.
- Migration 0036 rollback or Production changes.

## Task 1: Freeze v2 Contract Tests

Files:

- `worker/modules/site-location-import/contracts.js`
- `tests/site-location-import-parser.test.mjs`
- `tests/site-location-import-validation.test.mjs`

Add failing tests for the exact sheets and headers, absent internal columns, parser bounds, blank rules, and safe normalization. Confirm that alias input is not accepted or emitted by the v2 contract.

## Task 2: Build Static Template v2

Files:

- `apps/web/templates/GUI_Arc_현장위치목록_기본서식_v2.xlsx`
- `scripts/build.mjs`
- `scripts/validate.mjs`

Create `00_사용안내` and `01_위치목록`, with optional `02_검토필요` only if review feedback proves it necessary. The shipping workbook must pass the production parser/validator. Remove database-shaped guidance from the user surface.

## Task 3: Adapt the Bounded Parser

Files:

- `worker/modules/site-location-import/contracts.js`
- `worker/modules/site-location-import/xlsx-parser.js`

Keep ZIP/OpenXML protections. Replace the parsed row model with `area`, `floor`, `space`, and `detail`. Collect bounded row diagnostics instead of exposing generated database fields.

## Task 4: Add Deterministic Candidate-Tree Builder

Files:

- `worker/modules/site-location-import/normalization.js`
- `worker/modules/site-location-import/candidate-tree.js`
- focused tests

Implement conservative NFC/whitespace normalization, minimal type mapping, parent generation, parent dedupe, deterministic sort assignment, and versioned internal canonical-key serialization. Generate stable IDs only for genuinely new nodes during server diff/apply preparation.

Stop if the existing enum cannot represent a required common-space parent without a Migration; do not weaken DB constraints.

## Task 5: Adapt Validation and Site-Scope Guards

Files:

- `worker/modules/site-location-import/validation.js`
- `worker/modules/site-location-import/repository.js`

Validate the complete candidate tree, current-site collisions, residential floor requirements, type compatibility, ambiguity, capacity, and foreign identities. Preserve DB write zero on any error.

## Task 6: Replace Identity Diff and Add Rename Decisions

Files:

- `worker/modules/site-location-import/diff.js`
- Worker API response contracts
- focused tests

Match exact normalized typed paths. Produce ADD/UPDATE/UNCHANGED/INACTIVE/RENAME_CANDIDATE/ERROR. Never auto-confirm rename. Bind user rename decisions to preview hash, current master revision, and exact candidate pair.

## Task 7: Adapt Atomic Apply

Files:

- `worker/modules/site-location-import/apply.js`
- `worker/modules/site-location-import.js`
- API tests

Keep CAS ownership, immutable workbook verification, reparse/revalidate/rediff, idempotency, artifact preservation, audit, and one D1 batch. Replace workbook-provided IDs with server-generated operations. Submit no alias mutations and prove the alias table remains unchanged.

## Task 8: Adapt UI and Template Download

Files:

- `apps/web/assets/site-location-import.js`
- `apps/web/assets/site-location-import.css`
- template route/build references
- UI tests

Show human paths, compact counts, changed rows, clear processing feedback, and explicit rename choices. Hide internal IDs/keys and remove alias counts/actions. Preserve duplicate prevention and retry behavior.

## Task 9: Full Local Verification

Run focused parser/tree/validation/diff/apply/API/UI tests, then full test, typecheck, build, and diff check once. Verify source/dist template identity and no unexpected Migration, Issue, Speech, or Production changes.

## Task 10: Integration Migration Compatibility Audit

Before deployment, read-only verify that applied Migration 0036 supports generated canonical keys, generated IDs, Import-only inactive behavior, revisions, and atomic batches without a new Migration. If not, stop for a separate Migration design review.

## Task 11: Integration Smoke

After explicit deployment approval:

- Download v2 template.
- Import a small residential hierarchy.
- Re-import unchanged and confirm stable IDs.
- Confirm parent dedupe and no alias writes.
- Confirm rename requires explicit choice.
- Confirm omitted IMPORT inactive and LEGACY/MANUAL protection.
- Confirm identity conflict, cross-site rejection, stale Preview, and safe atomic behavior.
- Preview the 1,700+ Kimje workbook only after converting it to the four-column v2 contract.

## Reuse Ledger

KEEP:

- Admin route shell and permissions.
- Upload session/R2/hash/security bounds.
- Import history and cleanup.
- Busy/success/failure/duplicate-action UX.
- Stale Preview, idempotency, atomic batch, audit.
- Migration 0036 and existing tables.

ADAPT:

- Contracts, parser row model, validation, diff, apply payloads, repository collision reads, Preview rendering, template.

REMOVE FROM USER CONTRACT:

- All internal IDs, parent IDs, keys, types, sort values, sources, and alias input.

## Completion Gate

Implementation is complete only when a user can maintain a site master using the four Korean columns, exact re-import preserves server IDs, rename is never guessed, alias rows are untouched, all safety tests pass, Integration smoke passes, and Production remains unchanged.

Current status: implementation paused pending design approval.

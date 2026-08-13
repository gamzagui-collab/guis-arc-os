# Task 4 Report

## Scope

- Implemented summary, authorized static template redirect, upload-session creation, validation/preview, and compact history APIs.
- Added current-site repository reads and compact import metadata writes.
- Added Worker dispatch before the generic 404 path.
- Did not implement Apply, Location/Alias master writes, UI, Issue changes, Phase B+, deployment, or Production changes.

## RED

- `node --test tests/site-location-import-api.test.mjs`
- Expected failure: `ERR_MODULE_NOT_FOUND` for `worker/modules/site-location-import.js`.
- Added R2 ownership regression test and observed the expected `Missing expected rejection` failure before adding the prefix guard.

## GREEN

- `node --test tests/site-location-import-api.test.mjs`
- Result: 6/6 PASS after implementation and R2 ownership hardening.
- `node --test tests/site-location-import-api.test.mjs tests/site-location-import-migration.test.mjs tests/site-location-import-parser.test.mjs tests/site-location-import-validation.test.mjs`
- Result: 25/25 PASS.
- `git diff --check`: PASS.

## Contract Coverage

- `auth.siteId` is derived only from the selected authenticated context; workbook metadata never selects the site.
- ADMINISTRATION `VIEW` protects summary, template, and history; `MANAGE` plus CSRF/context-version checks protects upload and validation.
- Every repository read binds `siteId`; import lookup binds both `importId` and `siteId`.
- Upload keys use `sites/{siteId}/location-imports/{importId}/...`; validation rechecks that ownership prefix before R2 access.
- Upload metadata validates `.xlsx`, bounded size, and SHA-256 syntax. Validation verifies ZIP signature and object SHA-256 before parsing.
- Validation stores only status, counts, fingerprints, hash metadata, actor, and timestamps. Preview operations and bounded errors are returned, not persisted.
- Validation code contains no `INSERT`, `UPDATE`, or `DELETE` against `site_locations` or `site_location_aliases`.

## Self-review

- No Apply route or master-write repository method was introduced.
- No workbook-provided site identity reaches a repository method.
- Cross-site import IDs return not found, and mismatched R2 keys are rejected before object access.
- Static template endpoint is authorized and redirects to the existing same-origin immutable workbook with an attachment filename header.
- History is bounded to 20 items by the route and 50 by the repository hard limit.
- Remaining environment-level Worker/R2/D1 integration and browser download behavior are `NOT_EXECUTED`; this task performed focused local tests only.

## Fix Round 1

### Findings addressed

- R2 object `size` is checked before `arrayBuffer()` and must be an integer from 1 byte through 10 MiB. Buffered length must match the R2-reported size.
- ZIP preflight now requires the local-file signature `PK 03 04`, not only the two-byte `PK` prefix.
- Validation uses a site-scoped CAS from `UPLOADED`, `INVALID`, or `READY` to `VALIDATING`; final metadata uses a second CAS from `VALIDATING` only.
- `VALIDATING`, `APPLYING`, `APPLIED`, `CANCELLED`, and `FAILED` cannot be reopened. Missing/oversized/invalid/hash-mismatched objects close the acquired validation state as `INVALID`.
- The authorized template endpoint fetches the existing same-origin static asset through `env.ASSETS.fetch()` and returns the final XLSX body with the correct MIME and attachment filename; it no longer relies on redirect response headers.
- Tests now exercise the real session, active-site membership, ADMINISTRATION board grant, CSRF, context-version, Worker error envelope, and repository paths.
- A recording D1 adapter throws on any `site_locations` or `site_location_aliases` mutation and proves zero master writes for both valid and invalid validation.

### RED

- Focused API tests failed on the ineffective `302` template response, absent pre-buffer R2 size rejection, terminal-state reopening, and the new real repository path.
- The real repository test exposed an unbound D1 `run()` result in the final CAS; implementation was corrected without weakening expectations.

### GREEN

- `node --test tests/site-location-import-api.test.mjs tests/site-location-import-migration.test.mjs tests/site-location-import-parser.test.mjs tests/site-location-import-validation.test.mjs`
- Result: 29/29 PASS.
- Apply, UI, Phase B+, deployment, and Production remain excluded.

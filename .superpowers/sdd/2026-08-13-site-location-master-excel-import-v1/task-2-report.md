# Task 2 Report

## RED

- Command: `node --test tests/site-location-import-parser.test.mjs`
- Result: FAIL as expected, `ERR_MODULE_NOT_FOUND` for `worker/modules/site-location-import/contracts.js`.

## GREEN

- Command: `node --test tests/site-location-import-parser.test.mjs`
- Result: PASS, 6 tests, 0 failures.
- Command: `npm.cmd run build` followed by exact-path assertion.
- Result: PASS; `dist/templates/GUI_Arc_현장위치마스터_기본서식_v1.xlsx` exists.

## Files

- `apps/web/templates/GUI_Arc_현장위치마스터_기본서식_v1.xlsx`
- `worker/modules/site-location-import/contracts.js`
- `worker/modules/site-location-import/xlsx-parser.js`
- `tests/site-location-import-parser.test.mjs`
- `scripts/build.mjs`

## Enforced limits

- Compressed workbook: 10 MiB.
- Expanded package: 40 MiB.
- Locations: 5,000 rows.
- Aliases: 10,000 rows.
- Cell string: 500 characters.
- Formulas, external links, macros, embedded objects, missing/duplicate headers, invalid signatures, and missing required sheets are rejected with stable codes.

## Self-review

- Scope is limited to the Task 2 template, parser contracts, parser, focused tests, and exact build copy wiring.
- Parser imports only sheets `01_위치마스터` and `02_위치별칭`; review sheets cannot affect output.
- Parser does not return or trust a `site_id` target.
- No runtime XLSX generator, temporary generator, dependency, Phase B/C/D, DB, API, permission, or deployment change was added.
- `git diff --check` passed; no actionable self-review finding remained.

## Commit

- Planned message: `feat: add location master workbook parser`

## Fix round 1/5

### Review fixes

- Added a bounded ZIP central-directory preflight that sums declared uncompressed sizes before `unzipSync`; retained `fflate` filter-time and post-decompression byte checks as defense in depth.
- Added explicit limits for worksheet count and bytes, physical rows, columns, total cells, shared-string count and bytes, plus direct alias-row coverage.
- Replaced sparse row arrays with bounded column-keyed objects.
- Rejected namespace-qualified formula tags such as `<x:f>`.
- Strengthened the build-copy test to run `scripts/build.mjs` and compare source/artifact SHA-256 values.

### RED

- Command: `node --test tests/site-location-import-parser.test.mjs`
- Result: FAIL, 3 new groups exposed missing central-directory preflight, structural limits, and namespace formula rejection.
- First implementation run: FAIL, header lookup retained array methods after sparse-array removal.
- Second implementation run: FAIL, alias limit was masked by an equal physical-row threshold; separated the physical-row bound to preserve both contracts.

### GREEN and verification

- Command: `node --test tests/site-location-import-parser.test.mjs`
- Result: PASS, 9 tests, 0 failures.
- Command: `npm.cmd run build`
- Result: PASS.
- Command: `git diff --check`
- Result: PASS.

### Limits after fix

- Compressed workbook: 10 MiB.
- Declared and actual expanded package: 40 MiB.
- Worksheets: 16; worksheet bytes: 20 MiB.
- Physical rows per worksheet: 12,000; columns: 64; total imported-sheet cells: 100,000.
- Shared strings: 20,000 entries and 10 MiB.
- Locations: 5,000 rows; aliases: 10,000 rows; cell string: 500 characters.

### Commit

- Planned fix message: `fix: bound location workbook parsing`

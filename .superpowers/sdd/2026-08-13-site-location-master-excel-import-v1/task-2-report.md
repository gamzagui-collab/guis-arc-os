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

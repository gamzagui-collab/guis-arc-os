# Quality CSI Preparation Contract

## Purpose

Quality collects and reviews field quality-test material before a responsible user enters it into CSI. GUI’s Arc does not log in to, upload to, submit to, or replace CSI.

## Canonical lifecycle

`SCHEDULED → COLLECTING → TEST_COMPLETED → REVIEW_PENDING → REVISION_REQUIRED | READY_FOR_CSI → CSI_RECORDED`

`REVISION_REQUIRED` returns to internal review after missing or incorrect material is corrected. `READY_FOR_CSI` means the internal package is complete. Only explicit user confirmation of the actual external entry creates `CSI_RECORDED`.

## Package

The package records the site, company, trade, location, target, dates, institution, manager, method, criteria, result, judgment, result photographs, reusable report references, nonconformance resolution, reviewer, and CSI status.

## Boundaries

- Construction retains process inspection and next-process decisions.
- Quality retains material, specimen, performance, report, calibration, and nonconformance evidence.
- CSI retains national submission and official records.
- No CSI credentials or guessed APIs are permitted.

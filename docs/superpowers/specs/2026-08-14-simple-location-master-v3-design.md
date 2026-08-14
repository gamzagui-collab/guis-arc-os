# Simple Location Master v3 Design

## Goal

Replace the four-level 1,756-row location import with a three-level structural master: building/area, floor, and unit/space. Issue detail remains free text and never creates a canonical location row.

## Data model

- Root rows retain the existing supported root types inferred from their labels.
- Second-level rows use `FLOOR`.
- Third-level rows use `UNIT`, including named structural spaces. This preserves the existing Issue create ID slots and avoids a new schema or level.
- New v3 imports never create `ROOM` rows. Historical `ROOM` rows and `issue_items.room_location_id` remain stored and readable.
- Before the first APPLIED import, legacy options remain compatible. After APPLIED, only active IMPORT structural rows are selectable.

## Issue storage and UI

- Canonical mode submits building, floor, and unit IDs. `room_location_id` is null.
- `location_text` stores the rendered structural path plus optional detail text, preserving the Issue snapshot without a migration.
- Detail suggestions are small strings selected by label heuristics. They never block submission or mutate the master.
- Direct structural fallback remains mutually exclusive with canonical IDs.
- Phase C may resolve three structural IDs; unmatched residual detail stays text.

## Import and template

- Official workbook version: `SIMPLE_LOCATION_MASTER_V3`.
- Required sheets: `00_사용안내`, `01_위치목록`.
- Editable columns: `건물/구역`, `층`, `호/공간`.
- Missing lower levels may be blank. A third level requires a floor.
- Exact inactive LEGACY parents explicitly present in the candidate graph may be adopted/reactivated with their ID preserved. An inactive parent absent from the candidate graph remains invalid.

## Applied-file retention

- The immutable applied `artifact_object_key` is the downloadable original.
- Summary returns the two newest APPLIED artifacts as current and previous.
- After a successful Apply, artifacts older than those two are deleted and their object keys cleared; Import metadata remains as audit history.
- Downloads require existing ADMINISTRATION VIEW access and are site scoped.

## Deployment boundary

- No migration is required.
- Worker and Pages change; static revision advances from r25 to r26.
- Integration only. The real workbook is validated but never automatically applied.


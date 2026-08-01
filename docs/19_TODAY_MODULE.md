# Today Module Foundation — v0.3.0

## Runtime contract

`GET /api/v1/today` is the only first-load Today data request. It requires the existing Integrated session, selected-site membership and role scope. The work date is calculated in `Asia/Seoul`.

Core context and Issue are real providers. Issue aggregation reuses the canonical Issue entitlement, permission, company, contractor and assignee rules. Cards link to the canonical server-filtered Issue routes. A `FIELD_WORKER` without administrative Issue scope is denied the administrator Today dashboard.

Workforce, Construction, Safety, Quality, Materials and Equipment return `PLACEHOLDER / NOT_IMPLEMENTED`; Weather returns `NOT_CONNECTED / NOT_IMPLEMENTED`. They never return fabricated zero values. Provider failure is isolated as `ERROR` and does not change another provider's result.

## Performance contract

The Today route is a lazy browser bundle. The Worker emits `Server-Timing` for scope, each provider, serialization and total. The browser records route start, API start/response, first render and first usable marks. The gzip budget for Today JavaScript and CSS is 50 KiB.

## Data and deployment

Today derives its view from existing canonical tables. Migration: `NONE`. Production and legacy resources: `UNCHANGED`.

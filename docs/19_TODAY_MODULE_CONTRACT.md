# Today Module Contract — v0.3.0

Today is the authenticated default route in the Unified App Shell. `GET /api/v1/today` returns one KST-dated, selected-site-scoped view with Core context, permitted actions, urgent work, assigned work, site status, module provider states and provider timing.

The module owns presentation and aggregation only. It does not copy canonical Issue, membership, role, permission, entitlement or contractor data. It creates no schema and no migration. Every card has loading, loaded/empty, no-permission, not-implemented and error semantics; unimplemented providers cannot imitate real values.

The administrator dashboard rejects a `FIELD_WORKER` whose canonical Issue scope is none. All Issue data continues to use the existing site, contractor and assignee policy.

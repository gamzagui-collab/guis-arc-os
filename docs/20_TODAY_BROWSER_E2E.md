# Today Browser E2E — v0.3.0

## Required remote evidence

- Worker and Pages both report v0.3.0.
- Authenticated administrator opens `/today` without an external login or second session.
- Company/site context and KST date are correct.
- Core and Issue provider cards reflect canonical Issue API filters.
- No-entitlement and `FIELD_WORKER` access fail closed.
- Desktop and 360/390/412 px layouts have no horizontal overflow and actions remain at least 44 px.
- Ten or more authenticated visits record navigation-to-first-usable, API latency, provider timing, and warm revisit timing.
- Provisioning and failure-injection controls remain disabled after verification.

## 2026-07-22 Integration evidence

- Worker health: v0.3.0, Integration, D1/R2 bindings present.
- Pages shell/title/manifest: v0.3.0.
- Authenticated user: existing approved administrator session; company, selected site, `INTEGRATED_OWNER`, Context v1 and ten visible modules confirmed.
- Today: Core and Issue loaded; six provider cards showed `PLACEHOLDER`; Weather showed `NOT_CONNECTED`; browser console warnings/errors: 0.
- Canonical Issue comparison: Today unhandled 0 matched `/issues/open` empty result; recent completed 1 matched `/issues/completed` total 1.
- KST work date: 2026-07-22.
- Authenticated Today revisit, 12 full reload-to-DOM samples: 271–291 ms; p50 277 ms, p90 283 ms, p95 291 ms, max 291 ms. Valid-session 1.2 s target: PASS.
- Mobile viewport overrides requested at 360/390/412 px. Each rendered Today and Mobile Bottom Navigation, had scroll width equal to client width, and action heights 46.40 px. The in-app browser reported effective client widths of 397/375/397 px, so exact physical-width evidence is PARTIAL.
- Initial pre-activation visit showed cached v0.2.2 shell under v0.3.0 HTML. One reload after the new Service Worker activated showed the correct v0.3.0 shell and Today. Upgrade converged, but zero-reload takeover is not claimed.
- Protected administrator provisioning, E2E provisioning and E2E control endpoints: 404 after deployment.
- Migration: NONE. Production and legacy resources: UNCHANGED.

Not executed: fresh-login/PIN performance 10 samples, FIELD_WORKER policy E2E, no-entitlement E2E, second-site context E2E, screenshot evidence, offline PWA, Issue first-usable timing. Static and local policy regressions cover these contracts where stated but are not substitutes for remote E2E.

Status: `PARTIAL_PASS`. Development Complete: `YES`. Today Operational Ready: `NO`.

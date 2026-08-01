# Performance Budget — v0.3.0

- Shell gzip: 6,744 / 153,600 bytes — PASS
- Issue lazy bundle gzip: 5,921 / 102,400 bytes — PASS
- Login response with Context: six of seven samples 1,444.94–1,781.65 ms — PASS; one sample 3,484.22 ms — FAIL
- Session revisit: 783.37 ms / 1,000 ms — PASS
- Issue First Usable and list First Usable: NOT_MEASURED because the browser surface did not expose Performance entries

Server-Timing separated rate limit, user lookup, PBKDF2 verification, session insert, audit insert, membership, authorization batch, visible-module calculation and total. Repeated latency came from D1 round trips; PBKDF2-SHA256 100,000 measured below the Worker timing resolution and was not changed. Audit remains synchronous because successful authentication must not report success without its audit record.

Operational Ready remains NO because every PIN submit sample must meet two seconds and a 3.48-second outlier did not.
## Today route

- Lazy Today JavaScript + CSS: 50 KiB gzip maximum.
- One Today aggregation request per first route render; no per-card request fan-out.
- Worker `Server-Timing`: scope, Core, Issue, every placeholder provider, serialization and total.
- Browser marks: route start, API start/response, first render and first usable.
- Remote goals: valid-session Today first usable <= 1.2 s; Today↔Issue <= 800 ms; Today API p95 <= 800 ms. Measured misses remain FAIL.
# Workforce v0.4.0 budget

Today Workforce Provider p95 target: 500 ms. Workforce first usable and QR first usable: 1.5 s. Live summary uses a minimal 5–10 second polling response; lists are server bounded. Server-Timing names contain durations only, never personal data.

# Workforce Attendance Policy — v0.4.0

Attendance requires an authenticated active canonical user, Workforce entitlement, `workforce.check_in`, selected-site context, approved site enrollment and a valid dynamic QR for that site. GPS, cards, fingerprints and raw browser/device fingerprints are not collected. The KST calendar date is distinct from stored UTC timestamps.

`UNIQUE(user_id, site_id, work_date)` is the final duplicate barrier. Idempotency replay returns the canonical result; reuse with another payload returns 409. Concurrent uniqueness conflicts resolve to the first attendance row. Check-in time is server time. Administrative adjustments and check-out are deferred; future adjustment must require permission, reason, before/after snapshots and audit while retaining the original timestamp.

New-worker indication means first approval at that site or first attendance there. Education is not implemented, so the UI must say education confirmation is required rather than claiming completion.

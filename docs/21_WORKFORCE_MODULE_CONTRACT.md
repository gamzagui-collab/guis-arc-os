# Workforce Module Contract — v0.4.0

Workforce references the canonical Core `user_id`, company, site, membership, role, permission, Site Contractor and trade context. It does not create another account, OAuth client or identity source. Workforce owns only profile extensions, site enrollment state, hashed device registration, dynamic QR sessions, attendance, attendance events and idempotency records. Today reads Workforce through a provider and owns no Workforce rows.

Implemented: profile/enrollment storage, site approval/rejection API, dynamic QR, check-in, duplicate protection, KST work date, summary/attendance reads, Today provider, manager shell and worker check-in PWA. Daily manpower reports, TBM, education documents, check-out, adjustment and device-management workflows are `NOT_IMPLEMENTED`.

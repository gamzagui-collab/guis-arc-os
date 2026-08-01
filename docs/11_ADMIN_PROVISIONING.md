# Integration Administrator Provisioning

Provisioning is disabled by default (`PROVISIONING_ENABLED=false`). It is available only when the Integration Worker is temporarily deployed with `PROVISIONING_ENABLED=true` and a one-time `PROVISIONING_SECRET`; Production is rejected. Disable the flag and remove the secret immediately after use.

Run `npm run admin:provision -- --target remote --confirm-integration`. The CLI reads PIN and the one-time secret without echo, derives PBKDF2 locally, and never sends or logs the plaintext PIN.

The Worker rejects an existing identifier. Active companies and sites are reused only when exactly one same-name row exists; ambiguous duplicates are rejected. Roles and permission codes are reused. New user, membership, role binding, ten entitlements, missing catalog rows, and audit event are written in one D1 `batch()` transaction. A failed statement rolls back the batch. Read-back verifies user, company, optional site, membership, role, ten role permissions, ten entitlements, and audit.


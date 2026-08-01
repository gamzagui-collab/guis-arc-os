# Workforce Dynamic QR Contract — v0.4.0

The server issues a site-bound, nonce-bearing HMAC-SHA256 token. UI rotation is 60 seconds and every token expires after 90 seconds according to server UTC time. Verification rejects malformed, future-issued, expired, revoked, wrong-site, unknown-key-version and tampered tokens. Payloads contain no personal data. D1 stores only the token hash; the signing key is a Worker secret and is excluded from Git, logs, documents and release ZIPs.

When `WORKFORCE_QR_SIGNING_SECRET` is missing, issuance and check-in fail closed with `WORKFORCE_QR_SECRET_MISSING`; no fixed or local fallback QR exists. Operational Ready remains `NO` until the Integration secret, migration and authenticated E2E are verified.

# Authentication Contract and Performance — v0.2.2

Login returns `ok`, `csrfToken` and canonical `context` while setting the existing HttpOnly session cookie. It does not issue a bearer token. The Context contains user display identity, memberships, permissions, entitlements, visible modules, contextVersion, selected site and default route.

`contextWithTiming` is the single builder used by login and session. Membership is resolved first to select the site; permissions and entitlements then execute in one D1 batch. Server-Timing contains only duration names and numeric milliseconds. It never includes PIN, identifier, credential material, cookies or session values.

PBKDF2-SHA256 remains 100,000 iterations. Credential migration, rehash and iteration reduction are outside v0.2.2. Audit stays synchronous to preserve the success/audit contract.

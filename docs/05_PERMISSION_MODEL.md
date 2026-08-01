# Permission Model

Navigation visibility is derived from authenticated module entitlements. API authorization remains server-side and never trusts hidden UI. Site context changes require active membership and CSRF validation. Platform, OS, Issue, Safety, and Quality remain module boundaries inside one product and one session.

## Operational mutation evidence

Integration entitlement removal was enforced by the existing session: Issue API and media returned 403 and the refreshed Context removed `issue`. Restoring the entitlement and logging in again returned 200. Bilateral contractor tests confirmed list filtering and direct Issue, action and media denial with HTTP 403.
## Today v0.3.0

Today requires an active Integrated session, selected-site membership and active role. It reuses visible module entitlements and canonical Issue read/manage permissions. Issue cards are omitted when Issue is unavailable. A `FIELD_WORKER` with no administrative Issue scope receives a fail-closed Today denial. Today does not add a bypass permission or widen Platform-owner access across sites.
# Workforce v0.4.0

Permissions are `module.workforce.access`, `workforce.read`, `workforce.read_all`, `workforce.enroll`, `workforce.approve`, `workforce.reject`, `workforce.generate_qr`, `workforce.check_in`, `workforce.adjust`, `workforce.view_statistics`, and `workforce.manage_devices`. Every API revalidates canonical session, entitlement, permission and selected-site scope. FIELD_WORKER is self-only; unrelated, cross-site and cross-contractor access is denied.

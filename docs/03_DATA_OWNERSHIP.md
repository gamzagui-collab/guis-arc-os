# Data Ownership

| Domain | Canonical owner | v0.2.2 status |
|---|---|---|
| User, company, site, membership, role, permission, entitlement, session | Integrated Core | IMPLEMENTED |
| Issue, assignment, action, media reference, status history, completion request, comment | Issue module | IMPLEMENTED |
| Workforce, construction, materials, equipment and daily reports | OS modules | PLACEHOLDER |
| Safety operations | Safety module | PLACEHOLDER |
| Quality operations | Quality module | PLACEHOLDER |

Issue references Core primary keys but never creates or mutates Core identities, credentials, memberships or roles. Core does not own Issue workflow records. Direct cross-module table mutation is forbidden; approved service contracts and read models are required.
## Today v0.3.0

Today owns no operational source records. Its Core Provider and Issue Provider are `IMPLEMENTED` read adapters over canonical Core and Issue data. Other Today providers are `PLACEHOLDER`, while Weather is `NOT_CONNECTED`. No Today preference or acknowledgement table is introduced in v0.3.0.
# Workforce v0.4.0

Workforce = IMPLEMENTED. Core owns identity, companies, sites, membership, roles, permissions, Site Contractor and canonical trade information. Workforce owns only its operational extension tables. Today owns no Workforce source records.

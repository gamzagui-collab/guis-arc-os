# Module Boundaries

- Core만 identity, membership, role, permission, session을 변경한다.
- OS는 attendance, construction, material, equipment, daily reports를 소유한다.
- Issue는 issue, assignment, action, verification, photo relation을 소유한다.
- Safety와 Quality는 아직 runtime 미구현이다.
- direct cross-module table mutation is forbidden.
- 모듈 간 조회는 명시적 service contract 또는 read model을 사용한다.
- 브라우저는 다른 Worker나 D1을 직접 호출하지 않는다.
## Today v0.3.0 boundary

Today is an aggregation consumer. Core and Issue providers read canonical Core and Issue ownership through existing policies. Today does not own identity, membership, authorization, Issue records, media, or placeholder module data. Workforce, Construction, Safety, Quality, Materials, Equipment and Weather remain separate provider boundaries and cannot be represented as implemented before their canonical sources are connected.
# Workforce v0.4.0 boundary

Workforce consumes canonical Core identity and authorization but owns profile extensions, enrollment decisions, hashed devices, dynamic QR sessions, attendance and event history. Today consumes it only through the Workforce Provider. Legacy OS QR code is reference-only and is neither modified nor copied.

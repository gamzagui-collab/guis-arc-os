# Workforce Privacy and Audit — v0.4.0

Phone and birth date are optional protected profile fields, never canonical identity keys. They must be encrypted before persistence, masked in UI, excluded from list defaults, minimized in API responses and logs, access-controlled, retained only by policy, and deleted or disabled through an audited lifecycle. This release does not expose plaintext fields or automatic phone-to-user matching.

Device identifiers are one-way hashes; QR secrets and raw tokens are never logged. Audit actions cover enrollment request/decision, QR issuance, successful and duplicate check-in, with site and work date only. Invalid QR attempts are returned with explicit reason codes; operational monitoring must not attach tokens or personal values.

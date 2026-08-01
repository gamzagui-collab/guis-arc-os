# Workforce Integration Evidence — v0.8.0

Verified on 2026-07-27 against Integration resources only.

- D1 migration `0014_workforce_core_flow.sql`: applied.
- Worker version: `11ff7b70-067a-4299-a220-ab5d5504ea52`.
- Pages canonical URL: `https://guis-arc-integrated-dev.pages.dev`.
- Production changed: no.
- A new worker joined through an actual invitation, was approved, logged in, and saw the approved company, trade, attendance, and daily-output state in Today.
- A dynamic QR was issued from the Integration secret. Token fallback check-in succeeded, and a repeated submission returned the original attendance without creating a duplicate.
- Live attendance showed one subcontractor worker and matching company, trade, and unassigned-team counts.
- Attendance company/trade/team correction completed with a required reason and visible success status.
- A daily output report loaded the actual attendance worker, saved canonical `201동 / 1호 / 거실`, submitted, received a revision request, and was resubmitted after the work description was updated.
- Attendance and report counts both remained one, with zero difference; Today displayed attendance complete and daily-output reflected.
- At 360, 390, and 412 CSS pixels, Today, QR check-in, live attendance, and daily output had no horizontal overflow.
- Logout returned to login, and direct navigation to live attendance exposed no protected worker data.

Not executed:

- Physical camera QR scanning.
- Physical Samsung Internet testing.
- Pending-approval Today screen before approval.
- Rejection followed by resubmission.
- Cross-company privacy testing with a second company user in an actual browser.
- Full existing Issue browser regression.

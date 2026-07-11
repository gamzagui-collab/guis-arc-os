# GUI's Arc OS v9.4.7 - Schedule Confirm State Hotfix

## Purpose
Simplify schedule status management for field use.

## Changes
- Removed the previous status list: 예정 / 진행 / 완료 / 연기 / 주의.
- Replaced it with a simple confirmation state: 미확정 / 확정.
- Existing legacy statuses are normalized:
  - 진행 / 완료 -> 확정
  - 예정 / 연기 / 주의 / empty -> 미확정
- Fixed the detail card display so the selected confirmation state updates immediately after saving.
- Added visual pill styles for 확정 and 미확정.

## Design Rule
Schedule cards are not workflow trackers. They are field decision records. The only required state at this stage is whether the plan is confirmed or unconfirmed.

# Issue State Machine

The canonical states are `OPEN`, `ASSIGNED`, `ACTION_IN_PROGRESS`, `COMPLETION_REQUESTED`, `COMPLETED`, `REWORK_REQUIRED`, and `CANCELLED`.

Allowed workflow:

`OPEN → ASSIGNED → ACTION_IN_PROGRESS → COMPLETION_REQUESTED → COMPLETED`

`COMPLETION_REQUESTED → REWORK_REQUIRED → ACTION_IN_PROGRESS`

Cancellation is a permission-controlled terminal transition from a non-terminal issue. Completion requests require action evidence, including an action photo. The server owns transition validation; UI visibility is not authorization. Each transition records actor, prior state, next state, revision and timestamp in status history and audit logs.

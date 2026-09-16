# Architecture Snapshot

## Core idea

LoopOS is an operating loop, not three disconnected prompt chains. Sales, Operations, and Finance read and write one durable company record. Each role has a separate action envelope and cannot impersonate another role.

```text
                           +----------------------+
Demand / scenarios ------> |  Shared company     |
                           |  session in Neon     |
                           |  JSONB + version     |
                           +----------+-----------+
                                      |
                   +------------------+------------------+
                   |                  |                  |
             +-----v-----+      +-----v-----+      +-----v------+
             |   Sales   |      |    Ops    |      |  Finance   |
             | leads     |      | backlog   |      | budgets    |
             | discounts |      | capacity  |      | invoices   |
             +-----+-----+      +-----+-----+      +-----+------+
                   |                  |                  |
                   +------------------+------------------+
                                      |
                        +-------------v--------------+
                        | Shared actions/events/KPIs |
                        +-------------+--------------+
                                      |
                        +-------------v--------------+
                        | Human Inbox when boundary  |
                        | exceeds autonomous scope   |
                        +-------------+--------------+
                                      |
                        +-------------v--------------+
                        | Day snapshot + SHA-256     |
                        | deterministic replay       |
                        +----------------------------+
```

## Authority matrix

| Role | Allowed writes |
|---|---|
| Sales | close lead, escalate discount |
| Operations | throttle Sales, request flex, activate approved flex, fulfill order, adjust churn risk, record churn |
| Finance | decide budget, invoice, collect, suspend Sales, escalate controls |
| Human | resolve Human Inbox |
| System | inject scenario leads only |

Unauthorized role/action pairs throw an authorization error and are covered by tests.

## Inter-role dependency

Operations cannot buy capacity. It writes a `budget_request`. Finance independently checks cash headroom and reserve constraints. Only an approved request can be consumed by Operations. This makes collaboration causal and stateful rather than cosmetic.

## Durable state

Neon tables:

- `company_sessions(session_id, state_json, version, timestamps)`
- `day_runs(session_id, run_id, day, scenario, before_json, result_json, after_hash, created_at)`

Every browser receives an isolated session id. The agents within a browser share the same session state.

## Atomic commit and concurrency

The server reads `(state_json, version)`, runs the day on an isolated in-memory copy, then performs a single SQL statement:

1. update `company_sessions` only if `version = expected_version`
2. insert `day_runs` only from the successful update CTE

If the version is stale, neither operation is written and the API returns 409. A unique `(session_id, day)` constraint is an additional database-level guard.

## Replay

A day stores `before_json` and `after_hash`. Replay executes the engine against `before_json` using the original run id and scenario. The resulting hash must match `after_hash`. Replay is read-only against the live session.

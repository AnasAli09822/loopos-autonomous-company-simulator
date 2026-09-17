# Architecture Snapshot

## Core idea

LoopOS is an operating loop, not three disconnected prompt chains. Sales, Operations, and Finance read and write one durable company record. Each role has a separate action envelope and cannot impersonate another role.

```text
Judge / browser
      |
      v
+-------------------------+
| Vercel Next.js UI       |
| /api same-origin proxy  |
| no database credential  |
+------------+------------+
             |
             v
+-------------------------+
| Neon Function: looposapi|
| shared operating engine |
+------------+------------+
             |
             v
+-------------------------+
| Neon Postgres           |
| company_sessions        |
| day_runs                |
| JSONB + version         |
+------------+------------+
             |
       shared state
   +---------+---------+
   |         |         |
 Sales      Ops     Finance
   |         |         |
   +---------+---------+
             |
    Actions / Events / KPIs
             |
       Human Inbox
             |
  before-state + SHA-256
       replay verifier
```

## Authority matrix

| Role | Allowed writes |
|---|---|
| Sales | close lead, escalate discount |
| Operations | throttle Sales, request flex, activate approved flex, fulfill order, adjust churn risk, record churn |
| Finance | decide budget, invoice, collect, suspend Sales, escalate controls |
| Human | resolve Human Inbox |
| System | inject scenario leads only |

Unauthorized role/action pairs throw an authorization error and are covered by automated tests.

## Causal inter-role dependency

Operations cannot buy capacity. It creates a `budget_request`. Finance independently checks cash headroom and reserve constraints. Only an approved request can be consumed by Operations. This makes collaboration causal and stateful rather than cosmetic.

## Day execution

The operating order is:

```text
Sales
  -> Operations monitor
  -> Finance controls
  -> Operations execute
  -> Finance settlement
  -> Operations recovery
```

A role can only react to records and controls produced by preceding roles. The engine therefore models a company operating loop rather than three independent responses.

## Durable shared state

Neon tables:

- `company_sessions(session_id, state_json, version, timestamps)`
- `day_runs(session_id, run_id, day, scenario, before_json, result_json, after_hash, created_at)`

Every browser receives an isolated session id. The roles within that browser share the same durable session state. Separate judges do not overwrite one another.

## Atomic commit and concurrency

The runtime reads `(state_json, version)`, executes the day on an isolated in-memory copy, then performs one data-modifying SQL CTE:

1. update `company_sessions` only if `version = expected_version`
2. insert `day_runs` only from the successful update CTE

If the version is stale, neither operation is written and the API returns `409 Conflict`. A unique `(session_id, day)` constraint provides an additional database-level guard.

## Human boundary

The Human Inbox is not advisory. If an unresolved inbox item exists, another simulated day is blocked. Human resolution mutates the same shared record and the subsequent agent run resumes from that record.

Examples:

- discount above autonomous Sales authority -> human approval/rejection
- commercial control breach -> Finance suspends Sales and escalates review

## Replay

A day stores `before_json` and `after_hash`. Replay executes the engine against `before_json` using the original run id and scenario. The resulting SHA-256 must match `after_hash`. Replay is read-only against the live session.

## Deployment boundary

Vercel never receives a database password. The public Next.js `/api/*` route is a thin proxy to the Neon Function. Neon supplies its branch database connection only to the function running beside the database.

This keeps the demo URL simple while reducing the production secret surface.

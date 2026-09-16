# LoopOS — Autonomous Company Simulator

LoopOS is a standalone submission for **Challenge 2: The Autonomous Company Simulator**.

It simulates **Northstar Cloud**, a small SaaS company operated by three accountable autonomous roles over one shared company record:

- **Sales** — converts leads into orders and escalates out-of-policy discounts.
- **Operations** — manages backlog, throttles sales pressure, requests capacity, fulfills work, and records service-driven churn.
- **Finance** — approves/rejects capacity spend, invoices and collects cash, enforces commercial controls, and can suspend Sales.

A **Human Inbox** is a hard operating boundary: unresolved judgment calls stop the operating loop.

## Architecture

```text
Scenario / demand inputs
        |
        v
+-----------------------+
| Shared Company Record |  Neon Postgres
| session + version     |
+-----------+-----------+
            |
     role-scoped actions
   +--------+--------+
   |        |        |
 Sales     Ops    Finance
   |        |        |
   +--------+--------+
            |
   Human Inbox / KPIs
            |
   Day snapshot + SHA-256
            |
       Replay verifier
```

The agent roles are separate modules with an explicit authority matrix. Sales cannot invoice, Ops cannot approve spend, Finance cannot close leads, and Human is the only role allowed to resolve inbox decisions.

## Shared state and concurrency

The deployed build uses **Neon Postgres**. Every browser receives an isolated `session_id`. All agents inside that session operate on the same JSONB company state.

Each session has an integer `version`. A day run is calculated on an isolated copy and committed with an optimistic version check. The Postgres statement updates the company state and inserts the day record in **one atomic CTE**. If two requests race, one wins and the other returns **409 Conflict**. There is no silent double-posting of a day, order, or invoice.

Database constraints reinforce the model:

- `session_id` primary key
- unique `(session_id, day)`
- day constrained to `1..5`
- SHA-256 hash constrained to 64 characters
- FK from day run to company session
- session/time index for replay history

## Run the week

Default operating plan:

| Day | Scenario |
|---|---|
| 1 | Normal demand |
| 2 | Demand surge / autonomous self-correction |
| 3 | Enterprise discount / human boundary |
| 4 | Quiet continuation after approval |
| 5 | Sales runaway / failure test |

`Run the week` stops automatically when a human decision is open. It resumes from the same shared record after resolution.

## Demonstrated behaviors

### Self-correction
Demand Surge closes four deals, pushes backlog above base capacity, and causes Ops to throttle Sales and request flex capacity. Finance independently checks the cash reserve and approves `$800`. Ops then activates `+2` capacity, fulfills the backlog, and removes the throttle.

Expected result:

- Revenue `+$11,536`
- Cost `+$800`
- Backlog `4 → 0`
- Flex `+2`
- Human intervention: **none**

### Human boundary
Nova Enterprise requests a 25% discount on a `$12,000` deal. Sales cannot approve it. The lead moves to `pending_human`, the Human Inbox opens, and another day cannot run until the decision is resolved.

On approval, the **same lead** returns to the loop and closes at `$9,000`.

### Failure test
In `sales_runaway`, Sales closes seven deals rapidly. Other roles respond through shared state:

- Ops detects backlog `7`
- Ops requests `4` flex units
- Finance approves bounded spend
- Finance detects a commercial control breach
- Finance suspends Sales
- Finance opens Human Inbox review
- Ops fulfills six orders
- Backlog falls `7 → 1`
- Actual customer churn moves `0 → 1`

The company contains most of the operational damage but does not pretend the failure was consequence-free.

## Replay

Before each day, LoopOS stores the canonical pre-day state. Replay re-runs the same scenario with the same run id against that snapshot, recomputes SHA-256, and compares it with the original `after_hash`.

Replay does **not** mutate live company state.

## Verification

```bash
npm install
npm test
node scripts/evaluate.mjs
npm run build
```

Current local verification:

- **30 / 30 automated tests**
- **16 / 16 challenge evaluation checks**

The infrastructure was also manually verified against Neon for:

- optimistic version conflict rejection
- atomic state + day-run commit
- unique day enforcement
- schema constraints and indexes
- least-privilege runtime role

## Deployment

Production architecture:

- **Vercel** — Next.js UI and API route handler
- **Neon Postgres** — durable shared state and replay records

Required environment variable:

```bash
DATABASE_URL=postgresql://...
```

The final runtime role is `loopos_runtime_min`, which has only the table privileges required by LoopOS. A new Vercel Production deployment was created with this role on 2026-09-17. Vercel deployment-read APIs are still blocked by a team-scope OAuth mismatch, so build readiness and anonymous browser access must be re-verified after re-authenticating the Vercel connector to `nathmagency-2935s-projects`.

## Scope

LoopOS is deliberately a deterministic operating simulator, not a claim that a real company should run without humans. Deterministic agents make authority boundaries, failure recovery, audit evidence, and replay testable. Real payment rails, CRM integrations, legal approvals, live model calls, and real customer data are intentionally out of scope.

See `docs/` for the architecture, scoring map, failure test, AI usage disclosure, thesis, and 90-second walkthrough script.

# LoopOS — Autonomous Company Simulator

LoopOS is a standalone submission for **Challenge 2: The Autonomous Company Simulator**.

It simulates **Northstar Cloud**, a SaaS company operated by three accountable autonomous roles over one durable shared company record:

- **Sales** — converts leads into orders and escalates out-of-policy discounts.
- **Operations** — manages backlog, throttles sales pressure, requests capacity, fulfills work, and records service-driven churn.
- **Finance** — approves/rejects capacity spend, invoices and collects cash, enforces commercial controls, and can suspend Sales.

A **Human Inbox** is a hard operating boundary: unresolved judgment calls stop the operating loop.

## Live demo

**Production:** https://loopos-autonomous-company-simulator-nathmagency-2935s-projects.vercel.app

## Production architecture

```text
Browser / judge
      |
      v
Vercel Next.js UI
      |
      | same-origin /api proxy (no DB secret)
      v
Neon Function: looposapi
      |
      | shared operating engine
      | Sales -> Ops -> Finance -> Ops -> Finance -> Ops
      v
Neon Postgres
company_sessions + day_runs
      |
      +--> Human Inbox
      +--> KPIs / actions / events
      +--> before-state + SHA-256 replay
```

The runtime engine lives with the database in a Neon Function. Vercel serves the public UI and forwards `/api/*` to that function. The frontend deployment therefore has **no database credential**.

The agent roles are separate modules with an explicit authority matrix. Sales cannot invoice, Ops cannot approve spend, Finance cannot close leads, and Human is the only role allowed to resolve inbox decisions.

## Shared state and concurrency

Every browser receives an isolated `session_id`. All agents inside that session operate on the same JSONB company state in Neon Postgres.

Each session has an integer `version`. A day is calculated on an isolated copy and committed with an optimistic version check. The SQL statement updates company state and inserts the day record in **one atomic CTE**. If two requests race, one wins and the other returns **409 Conflict**.

Database constraints reinforce the model:

- `session_id` primary key
- unique `(session_id, day)`
- day constrained to `1..5`
- SHA-256 hash constrained to 64 characters
- FK from day run to company session
- session/time index for replay history

## Run the week

| Day | Scenario |
|---|---|
| 1 | Normal demand |
| 2 | Demand surge / autonomous self-correction |
| 3 | Enterprise discount / human boundary |
| 4 | Quiet continuation after approval |
| 5 | Sales runaway / failure test |

`Run the week` stops automatically when a human decision is open. It resumes from the same shared records after resolution.

## Demonstrated behaviors

### Autonomous self-correction
Demand Surge closes four deals, pushes backlog above base capacity, and causes Ops to throttle Sales and request flex capacity. Finance independently checks the cash reserve and approves `$800`. Ops activates `+2` capacity, clears the backlog, and removes the throttle.

Expected result:

- Revenue `+$11,536`
- Cost `+$800`
- Backlog `4 -> 0`
- Flex `+2`
- Human intervention: **none**

### Human boundary
Nova Enterprise requests a 25% discount on a `$12,000` deal. Sales cannot approve it. The lead becomes `pending_human`, the Human Inbox opens, and another day cannot run until the decision is resolved.

On approval, the **same lead** returns to the operating loop and closes at `$9,000`.

### Failure test
In `sales_runaway`, Sales closes seven deals rapidly. Other roles react through shared state:

- Ops detects backlog `7`
- Ops requests `4` flex units
- Finance approves bounded spend
- Finance detects a commercial control breach and suspends Sales
- Finance opens Human Inbox review
- Ops fulfills six orders
- Backlog falls `7 -> 1`
- Actual customer churn moves `0 -> 1`

The company contains most operational damage but does not pretend the failure was consequence-free.

## Replay

Before each day, LoopOS stores the canonical pre-day state. Replay re-runs the same scenario with the same run id against that snapshot, recomputes SHA-256, and compares it with the original `after_hash`.

Replay is execution, not event playback, and it does **not** mutate live company state.

## Verification

```bash
npm install
npm test
node scripts/evaluate.mjs
npm run build
```

Current engine verification:

- **30 / 30 automated tests**
- **16 / 16 challenge evaluation checks**

The deployed Neon Function also passed a full independent external acceptance run covering:

- database health
- Demand Surge self-correction
- deterministic replay
- Human Inbox blocking + approval + resume
- Sales Runaway containment and actual churn
- run-the-week pause/resume through Day 5
- session isolation

The acceptance run ends with **`LIVE ACCEPTANCE PASSED`**.

## Deployment

- **Vercel** — public Next.js interface + same-origin API proxy
- **Neon Function (`looposapi`)** — operating API and engine runtime
- **Neon Postgres** — durable shared state and replay records

The Vercel deployment does not need `DATABASE_URL`. Neon injects its branch database connection only inside the database-side function runtime.

## Scope

LoopOS is deliberately a deterministic operating simulator, not a claim that a real company should run without humans. Deterministic agents make authority boundaries, failure recovery, audit evidence, and replay objectively testable. Real payment rails, CRM integrations, legal approvals, live probabilistic model calls, and real customer data are intentionally out of scope.

See `docs/` for the architecture snapshot, scoring map, failure test, AI usage disclosure, two-year thesis, deployment evidence, and 90-second walkthrough script.

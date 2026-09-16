# 90-Second Walkthrough

**0–10s — What this is**
“LoopOS runs a small SaaS company through three accountable roles: Sales, Operations, and Finance. They share one Neon-backed company record, but each has different write authority.”

**10–30s — Self-correction**
Reset. Select **Demand surge** and Run day.
Point to:
- backlog `4 → 0`
- flex `+2`
- cost `+$800`
- revenue `+$11,536`
Explain: Ops detected pressure and requested capacity; Finance approved bounded spend; Ops activated it and cleared backlog without a human.

**30–50s — Human boundary**
Reset. Select **Enterprise discount** and Run day.
Show the `$12,000` pipeline and Human Inbox. Explain that Sales cannot approve the 25% discount and the next operating day is blocked. Click **Approve**, then run **Quiet day**. Show the same lead becoming a `$9,000` order/invoice.

**50–65s — Replay**
Use the Replay button on a recorded day. Show `Replay verified` and explain that LoopOS re-executes from the stored pre-day snapshot and compares SHA-256; it does not merely display old events.

**65–85s — Failure test**
Reset. Select **Sales runaway** and Run day.
Show:
- Sales closed 7
- backlog `7 → 1`
- Sales `SUSPENDED`
- Human control review
- churn `+1`
Explain that other roles contain the blast radius without pretending the failure caused no damage.

**85–90s — Close**
“The core idea is one shared company state, separate authority, replayable decisions, and explicit human boundaries.”

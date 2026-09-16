# Submission Notes

## Project

**LoopOS — Autonomous Company Simulator**

A standalone build for Challenge 2.

## What judges should test

1. Reset → Demand Surge → observe self-correction without human input.
2. Replay that day → deterministic hash should match.
3. Reset → Enterprise Discount → observe Human Inbox and blocked continuation.
4. Approve → Quiet Day → same lead resumes and closes at `$9,000`.
5. Reset → Sales Runaway → observe Finance suspension, Ops compensation, Human review, and actual churn.
6. Run the week → observe automatic pause on Day 3 and continuation after human resolution.

## Verification

- 30/30 automated engine tests
- 16/16 challenge evaluation checks
- Neon optimistic-concurrency probe: stale version rejected
- Neon atomic commit probe: stale update created neither state mutation nor day run
- schema and index audit completed
- dedicated least-privilege runtime role `loopos_runtime_min` created and verified; a new Vercel Production deployment was created with this role, but deployment-read/anonymous-browser verification remains blocked until the Vercel connector is re-authenticated to the project team scope

## Out of scope

- live CRM/payment integrations
- real customer data
- legal/compliance decision automation
- probabilistic LLM calls inside operating roles
- distributed event streaming across multiple regions

These are deliberate scope boundaries, not hidden implementation claims.

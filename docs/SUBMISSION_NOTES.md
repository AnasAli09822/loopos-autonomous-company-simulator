# Submission Notes

## Project

**LoopOS — Autonomous Company Simulator**

Standalone submission for Challenge 2.

## Live demo

https://loopos-autonomous-company-simulator-nathmagency-2935s-projects.vercel.app

## What judges should test

1. Reset -> Demand Surge -> observe self-correction without human input.
2. Replay that day -> deterministic SHA-256 should match.
3. Reset -> Enterprise Discount -> observe Human Inbox and blocked continuation.
4. Approve -> Quiet Day -> the same lead resumes and closes at `$9,000`.
5. Reset -> Sales Runaway -> observe Finance suspension, Ops compensation, Human review, and actual customer churn.
6. Run the week -> observe automatic pause on Day 3 and continuation after the human decision to Day 5.

## Verified evidence

- `30 / 30` automated engine tests pass.
- `16 / 16` challenge evaluation checks pass.
- Next.js `16.3.5` production build passes.
- Neon Function `looposapi` is deployed and backed by Neon Postgres database `loopos`.
- Stable Vercel production URL passed an independent external GitHub Actions acceptance run.
- Final production verification job: `105409064619` in workflow run `35282839636`.
- Final acceptance result: **`LIVE ACCEPTANCE PASSED`**.

The public acceptance suite verified:

- homepage reachability
- database health through the deployed API
- Demand Surge autonomous self-correction
- deterministic replay
- hard Human Inbox boundary and same-record resume
- Sales Runaway containment with residual churn
- run-the-week pause/resume through Day 5
- browser/session isolation

## Architecture decision

The public Vercel deployment is the UI and same-origin API proxy. The operating engine executes in a Neon Function next to durable Neon Postgres state. Vercel therefore holds no database password.

## AI usage

AI-assisted development was used for design, implementation, review, testing, and documentation. The submitted operating roles themselves are deterministic policy-driven agents so authority, replay, and failure behavior remain objectively testable. See `AI_USAGE.md`.

## Out of scope

- live CRM/payment integrations
- real customer data
- legal/compliance decision automation
- probabilistic LLM calls inside operating roles
- distributed event streaming across multiple regions

These are deliberate scope boundaries, not hidden implementation claims.

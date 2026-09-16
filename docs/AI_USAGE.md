# AI Usage Disclosure

AI-assisted development was used to design, implement, review, test, and document LoopOS.

Key human/product decisions encoded in the implementation include:

- three accountable operating roles instead of one generic agent
- explicit role authority boundaries
- shared durable company state
- a hard Human Inbox boundary
- deterministic replay from stored pre-day state
- a failure scenario that produces residual economic damage rather than a perfect recovery
- optimistic concurrency and atomic state/run persistence

The operating agents in this submission are intentionally deterministic policy-driven agents. This makes decisions replayable, auditable, and testable. Adding an LLM to a role would not change that role's write authority; a production system should keep the same command boundary around any probabilistic model.

# Challenge Scoring Map

| Challenge requirement | LoopOS evidence |
|---|---|
| ≥3 connected agent roles | Separate Sales, Operations, Finance modules with role authority matrix |
| Common record system | One Neon-backed session state shared by all roles |
| Run-the-week loop | Five-day operating plan with automatic pause/resume at Human Inbox |
| Agents take real actions | Leads→orders, budget requests, capacity activation, fulfillment, invoices, collections, controls |
| Human inbox | Out-of-policy discount and control breach block continuation |
| Revenue moves | Normal, surge, approved enterprise deal |
| Cost moves | Finance-approved flex capacity spend |
| Backlog moves | Surge `4→0`; failure `7→1` |
| Churn moves | Failure records actual customer churn `0→1` |
| Replay a day | Stored pre-day snapshot + deterministic re-execution + SHA-256 comparison |
| Self-correction | Demand Surge recovers without human input |
| Failure thinking | Sales runaway contained by Ops + Finance, residual churn remains |
| Shared-state technical depth | Neon JSONB, optimistic version, atomic CTE commit, unique day constraint |
| Demo clarity | KPI cards, controls, role boundaries, Human Inbox, records, action/event ledgers, Replay button |
| Honest human boundary | Large discount and control breach require explicit human resolution |

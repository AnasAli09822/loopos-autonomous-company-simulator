# Deployment Status

## Final production

- Main commit: `d7d10268637f53652d0e026255f83ca817d707e5`
- Vercel deployment ID: `dpl_6w3AakkmVYgAERdSK7CB3yR5roCM`
- Deployment URL: `https://loopos-autonomous-company-simulator-o0ilulo7o.vercel.app`
- Stable production alias: `https://loopos-autonomous-company-simulator-nathmagency-2935s-projects.vercel.app`
- Neon project: `frosty-frog-10728023`
- Neon branch: `br-lucky-haze-b5pb8wxa`
- Neon database: `loopos`
- Neon Function: `looposapi`
- Function runtime database role reported by health: `loopos_app`

## Production topology

```text
Public browser
   -> Vercel Next.js UI
   -> same-origin /api proxy
   -> Neon Function: looposapi
   -> Neon Postgres: loopos
```

The Vercel deployment contains no database credential. Database access is supplied inside the Neon Function runtime.

## Independent production verification

GitHub Actions verified the stable public Vercel alias from an external runner after production propagation.

- Workflow run: `35282839636`
- Final verification job: `105409064619`
- Conclusion: **success**

The production acceptance output was:

```text
PASS public homepage reachable
PASS health uses Neon Postgres via loopos_app
PASS demand surge self-corrects
PASS replay hash matches
PASS human boundary blocks then resumes same deal
PASS sales runaway contained with residual churn
PASS run-the-week pauses day 3 and resumes to day 5
PASS browser sessions are isolated

LIVE ACCEPTANCE PASSED
```

The same job also completed:

- `30 / 30` automated tests
- `16 / 16` challenge evaluation checks
- Next.js `16.3.5` optimized production build

The connected Vercel administrative read API still lacks the project team's read scope, but that does not affect the application. The anonymous public production URL was verified externally through GitHub Actions and passed the full operating acceptance suite.

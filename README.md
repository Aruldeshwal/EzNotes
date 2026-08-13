# Note-Sharing App

A scalable, secure Next.js app for publicly shareable, password-protected, one-time-view, and collaborative notes — built to handle 1M+ concurrent readers without the read path ever touching the primary database.

## Stack
Next.js (App Router) · TypeScript · Tailwind CSS · Neon (Postgres) · Prisma · Clerk · Upstash Redis · Upstash QStash · Recharts

## Docs
| File | What's in it |
|---|---|
| `ProjectOverview.md` | Objective, stack, routing, features, non-functional requirements, scope |
| `architecture.md` | Schema, infra topology, Redis key reference, every core data flow, scaling, timezone handling |
| `UI.md` | Page/component spec, states, accessibility |
| `CodeStandards.md` | TS/Next.js conventions, testing, error handling, folder structure |
| `SECURITY.md` | Threat model and pre-launch checklist |
| `API_CONTRACTS.md` | Server Action and Route Handler signatures |
| `ENV_SETUP.md` | Required env vars and `.env.example` |
| `GIT_WORKFLOW.md` | Commit/push discipline — read this before starting Phase 1 |
| `ProgressTracker.md` | The build checklist, phase by phase |
| `DECISIONS.md` | Architecture Decision Records |
| `DIFFICULTIES.md` | Real problems hit during the build, and how they were solved |
| `LEARNINGS.md` | Takeaways worth carrying into future projects |
| `INTERVIEW_PREP.md` | Likely interview questions with model answers grounded in this design |

## Quickstart
```bash
git clone <repo-url>
cd <repo>
cp ENV_SETUP.md .env   # then fill in real values — see ENV_SETUP.md for what each one is
npm install
npx prisma migrate dev
npm run dev
```

## Contributing to this repo (solo build)
Read `GIT_WORKFLOW.md` first. The short version: one commit per `ProgressTracker.md` item, pushed immediately, with `DIFFICULTIES.md`/`DECISIONS.md`/`LEARNINGS.md` updated in the same commit whenever a task actually surfaces one of those.

# CLI Build Prompt — Note-Sharing App

## How to use this
Place this file alongside the full doc suite (`README.md`, `ProjectOverview.md`, `architecture.md`, `UI.md`, `CodeStandards.md`, `SECURITY.md`, `API_CONTRACTS.md`, `ENV_SETUP.md`, `GIT_WORKFLOW.md`, `ProgressTracker.md`, `DECISIONS.md`, `DIFFICULTIES.md`, `LEARNINGS.md`, `INTERVIEW_PREP.md`) in an empty repo, then paste this entire file as your first instruction to the agentic CLI tool (e.g. `claude` in the terminal). Everything below assumes those files exist in the repo root and are readable.

---

## Role
You are an expert full-stack engineer (Next.js / TypeScript / Postgres / Redis) building this project end-to-end, autonomously, from an empty repository to a fully working, tested application — following the specs in this repo exactly, not your own defaults where they conflict.

## Step 0 — Required reading, in this order
Before writing any code, read these files in full:
1. `README.md`
2. `ProjectOverview.md`
3. `architecture.md`
4. `UI.md`
5. `CodeStandards.md`
6. `SECURITY.md`
7. `API_CONTRACTS.md`
8. `ENV_SETUP.md`
9. `GIT_WORKFLOW.md`
10. `ProgressTracker.md`

Do not skim. Everything below assumes you've internalized: the Prisma schema (`architecture.md` §2), the Redis key reference (§4), every core data flow (§5), the ADRs already logged in `DECISIONS.md`, and the commit discipline in `GIT_WORKFLOW.md`.

## Non-negotiable rules
- **Stack is fixed** (per `ProjectOverview.md`): Next.js App Router, TypeScript strict mode, Tailwind, Prisma, Neon, Clerk, Upstash Redis, Upstash QStash, Recharts. Don't substitute a library without first adding an ADR to `DECISIONS.md` explaining why.
- **Follow `CodeStandards.md` exactly**: Server Components by default; Server Actions for dashboard mutations; Route Handlers only for `/share/[token]` mutations and external integrations (webhooks, QStash callbacks); every Server Action returns the `ActionResult<T>` discriminated union, never throws for expected failures; use the given folder structure.
- **Follow `architecture.md` exactly** for schema, Redis keys, and every data flow — especially the three places the original design was corrected: write-through cache invalidation (§5.2), atomic one-time-link consumption (§5.4), and UTC-only storage with IST conversion happening only at the UI layer (§8).
- **Follow `SECURITY.md`'s mitigations as implemented, not optional** — per-note derived JWT signing, sanitized content rendering (never raw HTML), signature verification on the webhook and QStash callback routes before any other processing.
- **Follow `GIT_WORKFLOW.md` without exception**: one commit per completed `ProgressTracker.md` item, pushed immediately, Conventional Commits format. Update `DIFFICULTIES.md` / `DECISIONS.md` / `LEARNINGS.md` in the *same commit* whenever a task actually produces one of those — don't batch them up from memory later.
- **Work `ProgressTracker.md` top to bottom, phase by phase.** Don't jump to Phase 5 UI polish before Phase 3's caching/concurrency logic is implemented and tested — the UI's state machine (revoked / consumed / expired / locked-out) depends on states that don't exist until Phases 3–4 are done.
- At the end of each phase, re-check every box in that phase's `ProgressTracker.md` section against actual passing tests, not just "code exists."

## Definition of done (whole project)
- [ ] Every item in `ProgressTracker.md` is checked off, each with its own pushed commit.
- [ ] The three critical e2e tests from `CodeStandards.md` pass: concurrent one-time-link consumption, password brute-force lockout, stale-cache-after-revoke.
- [ ] `SECURITY.md`'s pre-launch checklist is fully satisfied.
- [ ] `npm run lint && npm run typecheck && npm run test` all pass clean.
- [ ] `DECISIONS.md` contains the 6 seeded ADRs plus any new ones made during the build.
- [ ] `DIFFICULTIES.md` and `LEARNINGS.md` contain real entries, not just the template.
- [ ] `.env.example` matches `ENV_SETUP.md` and contains no real secret values.

---

## Execution order

### Phase 1 — Infrastructure & Scaffolding
1. `npx create-next-app@latest` with TypeScript, Tailwind, App Router, ESLint. Confirm `tsconfig.json` strict mode is on.
2. Add `eslint-plugin-tailwindcss`, Prettier, and a pre-commit hook (husky/lint-staged) running lint + typecheck — this backs the "tests pass before every commit" rule in `GIT_WORKFLOW.md`.
3. Provision Neon; capture both the pooled (`DATABASE_URL`) and direct (`DIRECT_URL`) connection strings per `architecture.md` §3 and `ENV_SETUP.md`.
4. `npx prisma init`; paste the exact schema from `architecture.md` §2 (enums, `@map`/`@@map`, indexes) into `prisma/schema.prisma`; run `npx prisma migrate dev --name init`.
5. Create `lib/tokens.ts` implementing `nanoid(12)` token generation in application code — **not** a Prisma `@default()`, per the fix noted in `architecture.md` §2.
6. Install Clerk; wrap `(dashboard)` routes in its auth middleware; explicitly exclude `/share/[token]` from any auth requirement, per the corrected routing table in `ProjectOverview.md` and ADR-005.
7. Create `.env.example` matching `ENV_SETUP.md` exactly; confirm `.env` is gitignored before the first commit that touches secrets.
8. Commit and push after each numbered step above individually, per `GIT_WORKFLOW.md` — not as one Phase-1 mega-commit.

### Phase 2 — Core Note Logic & Database
9. Build `lib/actions/notes.ts`: `createNote`, `updateNote`, `revokeNote` Server Actions, each returning `ActionResult<T>`, each re-verifying `clerkUserId` server-side (never trust a client-supplied owner ID).
10. Build `lib/actions/settings.ts`: `updateUserSettings`.
11. Implement bcrypt hashing (10 rounds) for password protection; regeneration must overwrite the existing hash and invalidate sessions tied to the old one.
12. Enforce the 100,000-character content limit inside the Server Action itself, not only in the client editor.
13. Write Vitest unit tests for `lib/tokens.ts` and the password hash/verify functions.

### Phase 3 — The Edge, Caching & Concurrency (highest-risk phase — take it slow)
14. Install `@upstash/redis`; build `lib/redis.ts` as typed wrappers around every key in `architecture.md` §4. Never construct raw key strings inline elsewhere.
15. Write `middleware.ts` implementing every rate limit in `CodeStandards.md` (global, note creation, settings, public share load, collaborative patches) via Upstash's REST-compatible limiter — Edge Middleware has no raw TCP access, so this must go through the REST client, not `ioredis`.
16. Implement write-through cache invalidation: every mutation from steps 9–11 must overwrite `note:{token}` in Redis in the same request as its DB write (`architecture.md` §5.2, ADR-003). Write the stale-cache-after-revoke e2e test in this same commit.
17. Implement `POST /api/share/[token]/consume-one-time`: `SETNX lock:note:{token} 1 EX 5` as the fast path, then the atomic `UPDATE notes SET revoked = true, consumed_at = now() WHERE token = $1 AND revoked = false RETURNING *` as the actual correctness guarantee (§5.4, ADR-004). Write the concurrent-consumption e2e test in this same commit.
18. Implement `lib/auth.ts`: per-note derived JWT signing (`HMAC(APP_SECRET, note.id + note.createdAt)`), ~5-minute expiry, issued as an httpOnly cookie — not returned in a JSON response body (`SECURITY.md`).
19. Implement `POST /api/share/[token]/verify-password`: check `lockout:{token}:{ip}` before calling `bcrypt.compare()`; on failure `INCR fails:{token}:{ip}` (60s TTL); 5 fails sets `lockout:{token}:{ip}` (15min). Write the lockout e2e test in this same commit.
20. Implement `PATCH /api/share/[token]/content`: 2000ms client debounce, immediate Redis write-through, QStash-queued Postgres write-behind.
21. Implement client-side polling (`GET /api/share/[token]`, every 3–5s) for collaborative viewers per the documented MVP sync approach in `architecture.md` §5.5.

### Phase 4 — Analytics & Background Jobs
22. Implement view tracking on the `/share/[token]` render: `INCR note:views:{token}` and `INCR note:daily_views:{token}:{date}`, excluding owner views, deduped via a Redis Set keyed by `clerkUserId` (if signed in) or `ip_hash`.
23. Configure a QStash schedule hitting `POST /api/jobs/flush-views`. The handler verifies the QStash signature header **first**, then reads+zeros the Redis counters and upserts `NoteViewAggregate` + increments `Note.viewCount` inside a single Postgres transaction (§5.6).
24. Configure Neon `pg_cron`: nightly Expiry Purge (UTC comparisons only — ADR-006) and nightly Reconciliation against the Clerk Backend API.
25. Implement `POST /api/webhooks/clerk`, verifying Clerk's signing secret before processing, handling `user.deleted` as the primary cleanup path (§5.7).
26. Implement the 30-day grace period before hard-deleting revoked/consumed notes (§5.7).

### Phase 5 — User Interface & Polish
27. Build the dashboard (Notes grid, Settings, Analytics) per `UI.md`, including empty states.
28. Wire Recharts to the analytics endpoint (`API_CONTRACTS.md`), including the zero-views empty state.
29. Build the editor: configuration panel, IST-display/UTC-submit expiry picker (ADR-006), password generate/reveal/copy UI holding plaintext only in component state, cleared on unmount.
30. Build the `/share/[token]` page covering every state in `UI.md`'s state machine: loading, not found, gone (distinguish revoked vs. consumed via `consumedAt`), expired, password gateway, content view.
31. Implement sanitized content rendering — plain text or sanitized Markdown, never raw HTML (`SECURITY.md`).
32. Add `loading.tsx` / `error.tsx` boundaries per route.

### Final verification
33. Run the full test suite and walk `SECURITY.md`'s pre-launch checklist line by line.
34. Do a final pass through `ProgressTracker.md` confirming every box reflects working, tested code — not just written code.
35. Confirm `DECISIONS.md`, `DIFFICULTIES.md`, and `LEARNINGS.md` are genuinely up to date. These are as much a deliverable of this project as the app itself.

---

## If you get stuck or need to deviate
If anything in this prompt conflicts with something discovered mid-build (a library limitation, a Neon/Upstash quirk, an incorrect assumption in `architecture.md`), don't silently work around it. Add an ADR to `DECISIONS.md` explaining the conflict and the resolution, log the obstacle in `DIFFICULTIES.md`, then proceed. That log is the actual point of this doc suite — an app with no visible decision trail is worth less than one with a well-documented one, even if the code is identical.

> **Before starting any item below, read `GIT_WORKFLOW.md`.** Every checked-off item gets its own commit and an immediate push — that's what turns this file into the interview-ready history described in `architecture.md`. If a task surfaces a bug, a trade-off, or a lesson, log it in `DIFFICULTIES.md` / `DECISIONS.md` / `LEARNINGS.md` respectively before you move on.

--> Completed Progress:

## Phase 1: Infrastructure & Scaffolding
- [x] Initialize Next.js project with TypeScript and Tailwind CSS.
- [x] Set up ESLint + `eslint-plugin-tailwindcss`, Prettier, and strict `tsconfig.json`.
- [x] Configure Neon PostgreSQL database (pooled + direct connection strings).
- [x] Initialize Prisma, define schema (see `architecture.md` §2), and run the initial migration.
- [x] Set up `lib/tokens.ts` for `nanoid`-based share token generation (not a Prisma default — see `architecture.md`).
- [x] Set up Clerk authentication; protect `/notes/**` routes; leave `/share/[token]` public.
- [x] Set up `.env.example` per `ENV_SETUP.md` and confirm `.env` is gitignored.

## Phase 2: Core Note Logic & Database
- [x] Build Next.js Server Actions for Note CRUD (`createNote`, `updateNote`, `revokeNote`), returning the `ActionResult` shape from `CodeStandards.md`.
- [x] Implement user settings logic (cookie-based theme, default access/expiry).
- [x] Implement bcrypt hashing/verification for password protection, including regeneration invalidating the prior hash.
- [x] Enforce the 100,000-character content limit server-side (not just in the editor UI).
- [x] Write unit tests for token generation and password hashing.

## Phase 3: The Edge, Caching & Concurrency
- [x] Integrate Upstash Redis; implement the key scheme in `architecture.md` §4 as typed helpers in `lib/redis.ts`.
- [x] Write Next.js Edge Middleware for the rate limits in `CodeStandards.md`.
- [x] Implement write-through cache invalidation on every mutation path (create, edit, revoke, password change) — this is the fix in `architecture.md` §5.2; write the e2e test for it in the same commit.
- [x] Implement one-time link consumption: `SETNX` fast-path lock + atomic `UPDATE ... RETURNING` as the correctness guarantee; write the concurrent-request e2e test in the same commit.
- [x] Implement JWT issuance for one-time-link sessions (per-note derived secret, short expiry, httpOnly cookie — see `architecture.md` §7 and `SECURITY.md`).
- [x] Implement write-behind caching for collaborative editing (2000ms debounce, Redis write-through + QStash-queued Postgres write).
- [x] Implement client-side polling for collaborative viewers (MVP sync mechanism — see `architecture.md` §5.5).

## Phase 4: Analytics & Background Jobs
- [x] Build hybrid view tracking (Clerk ID + IP hash) incrementing Redis counters, excluding owner views.
- [x] Configure Upstash QStash to periodically flush Redis counters into `NoteViewAggregate` and `Note.viewCount` in a single transaction.
- [x] Verify the QStash signature on the flush endpoint before processing.
- [x] Configure Neon `pg_cron`: Expiry Purge (UTC-only comparisons) and Reconciliation (Clerk API cross-reference).
- [x] Add the Clerk `user.deleted` webhook handler as the primary cleanup path, with the nightly reconciliation job as fallback.
- [x] Write the e2e test confirming a revoked/expired note is unreadable even with a stale cache entry present.

## Phase 5: User Interface & Polish
- [x] Build dashboard layout (Notes grid, Settings, Analytics) with empty states.
- [x] Integrate Recharts and wire to aggregate endpoints, including the zero-views empty state.
- [x] Build the editor interface with configuration toggles, IST-to-UTC conversion on the expiry picker, and password visibility logic (state-only, cleared on unmount).
- [x] Build the `/share/[token]` gateway covering every state in `UI.md` (loading, not found, gone, expired, password gateway, content view).
- [x] Add sanitized rendering for note content (plain text or sanitized Markdown — never raw HTML).
- [x] Final end-to-end pass across all three critical flows in `CodeStandards.md`, plus a manual review of `SECURITY.md`'s checklist before considering the project demo-ready.


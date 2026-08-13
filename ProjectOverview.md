## Objective
Develop a highly scalable, secure Next.js note-taking application supporting publicly shareable, encrypted, and ephemeral notes.

## Technical Stack
*   **Framework:** Next.js (App Router), React, TypeScript.
*   **Styling:** Tailwind CSS.
*   **Database:** Neon (Serverless PostgreSQL).
*   **ORM:** Prisma.
*   **Authentication:** Clerk.
*   **Caching & Rate Limiting:** Upstash Redis.
*   **Asynchronous Processing:** Upstash QStash.
*   **Charting:** Recharts.

## Core Routing
*   `/login`: Clerk authentication entry point.
*   `/register`: Clerk user registration.
*   `/notes`: Primary dashboard interface rendering Notes, Settings, and Analytics sub-components. **Requires an authenticated Clerk session.**
*   `/notes/new`: Note creation interface. Requires an authenticated Clerk session.
*   `/notes/[id]`: Note editing and configuration interface. Requires an authenticated Clerk session and ownership of the note.
*   `/share/[token]`: Viewing/editing route for shared links.

⚠️ **Fixed a contradiction:** the original doc listed `/share/[token]` as "mandatory authenticated," and `UI.md` had a mandatory `<SignedIn>` wrapper on it — but the Core Features section below promises "publicly shareable" notes, and Feature #1 explicitly lists `PUBLIC` as an access type. A public link that only works for people who already have a Clerk account on this app isn't actually public. Corrected behavior:

*   `/share/[token]` is **accessible without a Clerk session** by default. Clerk is only consulted to determine two things: (a) is the viewer the note's owner, in which case the view doesn't count toward analytics and owner-only controls (e.g. "Revoke") are shown; (b) for `COLLABORATIVE` notes, is the viewer's Clerk identity attached to their edits (if signed in) or anonymous (if not).
*   `PASSWORD` and `ONE_TIME` access types add a challenge *in addition to* being unauthenticated-by-default — they are not the same mechanism as requiring a Clerk login, and shouldn't be conflated with it. See `architecture.md` §5.3–5.4.

## Core Features
1.  **Note Access Control:** Public, password-protected, one-time view, and time-based expiration parameters. These are independent, composable settings (e.g. a note can be both password-protected *and* set to expire).
2.  **Collaborative & Read-Only Modes:** Granular per-note permissions restricting or allowing external modifications. Collaborative editing uses Last-Write-Wins conflict resolution (see `architecture.md` §5.5 and `DECISIONS.md` ADR-002) — real-time character-level merge (CRDT/OT) is explicitly out of scope for v1.
3.  **High-Concurrency Architecture:** Edge caching via Upstash Redis and asynchronous write-back queues to handle 1M+ concurrent read limits, without the read path ever touching the Postgres connection pool.
4.  **Security Mechanisms:** JWT-authorized one-time link sessions, bcrypt hashing, and multi-tier Edge rate limiting. See `SECURITY.md` for the full threat model.
5.  **Analytics:** Hybrid tracking (user + IP hash) populating aggregate tables for daily/weekly Recharts visualizations.

## Non-Functional Requirements
✅ **Added** — these weren't stated explicitly anywhere in the original docs, and are worth having on record for scope discussions and for `INTERVIEW_PREP.md`.

*   **Latency:** cache-hit share-link reads should render in well under 200ms server-side, excluding client network time.
*   **Availability of the read path:** a Neon outage should degrade gracefully — cached notes already in Redis should remain readable (within their TTL) even if Postgres is unreachable, since reads don't require Postgres on a cache hit.
*   **Data durability:** view counts are eventually consistent (flushed on a QStash cadence, not real-time), and this is an accepted trade-off, not a bug — see `architecture.md` §5.6.
*   **Content size limit:** notes are capped at 100,000 characters, enforced both client-side (editor) and server-side (Server Action validation) — never trust the client-side limit alone.

## Out of Scope (v1)
✅ **Added** — explicitly naming what isn't being built avoids scope creep during the build and gives a clean answer if an interviewer asks "what would you add next."

*   Character-level real-time collaborative merging (CRDT/OT).
*   End-to-end encryption of note content (passwords protect *access*, not the at-rest content itself — content is encrypted at rest only insofar as Neon encrypts its storage volumes).
*   Note versioning / edit history.
*   Multi-user granular permissions beyond "owner" and "has the link."

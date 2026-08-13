# Architecture Decision Records

One entry per meaningful design decision. Append new entries at the bottom as they come up during the build — a decision made mid-implementation is exactly as valid an entry as one made up front, and often more interesting in an interview.

**Template:**
```
## ADR-NNN: <title>
Status: Proposed | Accepted | Superseded by ADR-NNN
Context: what problem forced this decision
Decision: what was decided
Consequences: what this costs, what it enables, what it explicitly rules out
```

---

## ADR-001: Merge `is_collaborative` boolean into a `ShareType` enum
Status: Accepted
Context: the original schema had `share_type: String` and `is_collaborative: Boolean` as separate fields with no documented relationship between them, and no type safety on `share_type`'s allowed values.
Decision: replaced both with a single `ShareType` enum (`READ_ONLY | COLLABORATIVE`).
Consequences: one source of truth for this concern, compile-time safety anywhere it's branched on. Cost: a one-time migration if this is changed after any real data exists.

## ADR-002: Last-Write-Wins over CRDT/OT for collaborative editing
Status: Accepted
Context: true conflict-free real-time merging (Yjs or similar) needs a persistent connection/relay, which doesn't fit a serverless-first Vercel deployment without adding an always-on service.
Decision: use Last-Write-Wins with a 2000ms debounce, accepting that two edits to the same region within the same window can silently drop one.
Consequences: much simpler infra (no relay server), at the cost of a real, documented data-loss edge case. Acceptable for a notes app; would not be acceptable for, say, a code editor.

## ADR-003: Write-through Redis cache invalidation over TTL-only expiry
Status: Accepted
Context: TTL-only caching meant a note that was revoked or password-protected after being cached could keep serving its old, more-permissive state to anyone who already had it cached — a real access-control bypass, not just a staleness issue.
Decision: every mutation path overwrites `note:{token}` in Redis in the same request as the DB write.
Consequences: slightly more write complexity per mutation; closes a real security gap.

## ADR-004: DB-atomic UPDATE as the correctness guarantee for one-time links; Redis lock as an optimization only
Status: Accepted
Context: relying solely on a Redis `SETNX` lock for one-time-link correctness means a Redis outage or lock expiry mid-request could allow double consumption.
Decision: the `SETNX` lock is a fast-path pre-check to shed load under a thundering herd; the actual guarantee is Postgres' row-level locking via `UPDATE ... WHERE revoked = false RETURNING *`.
Consequences: correct even if Redis is briefly unavailable; the system degrades to "every request hits Postgres" rather than "the guarantee breaks."

## ADR-005: Public share links do not require a Clerk session
Status: Accepted
Context: an earlier draft of the UI/routing spec required `<SignedIn>` for `/share/[token]`, contradicting the stated goal of "publicly shareable" notes.
Decision: `/share/[token]` is accessible without authentication by default; Clerk session (if present) is used only to detect ownership and to attribute collaborative edits.
Consequences: matches the actual product goal; means access control for `PASSWORD`/`ONE_TIME` notes has to be built independently of Clerk (see `architecture.md` §5.3–5.4), which was true regardless.

## ADR-006: All timestamps stored and compared in UTC; IST is presentation-only
Status: Accepted
Context: "evaluated in IST" was ambiguous about where the conversion happens, risking off-by-one bugs in `pg_cron` sweeps depending on the database server's configured timezone.
Decision: Postgres columns, Redis TTLs, and `pg_cron` comparisons are UTC-only. The expiry date/time picker displays and accepts IST and converts to UTC client-side before submission.
Consequences: one clear rule to follow everywhere; no timezone-dependent behavior in scheduled jobs.

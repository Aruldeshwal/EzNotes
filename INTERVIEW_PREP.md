# Interview Prep

Questions an interviewer could reasonably ask about this project, with model answers grounded in the actual design decisions in `architecture.md` and `DECISIONS.md`. Fill in the `DIFFICULTIES.md` / `LEARNINGS.md` items as they occur — the strongest answers here will be the ones you can back with a real bug you hit, not just the design as planned.

---

**Q: Walk me through what happens when two people click the same one-time link at the exact same moment.**
Both requests race to `SETNX lock:note:{token}` in Redis — that's a fast-path pre-check, not the actual guarantee. The real correctness comes from an atomic Postgres statement: `UPDATE notes SET revoked = true WHERE token = $1 AND revoked = false RETURNING *`. Postgres' row-level locking makes exactly one of the two `UPDATE`s see `revoked = false` and win; the other gets zero rows back and returns `410 Gone`. The Redis lock exists only to let the losing request fail fast without even hitting the database, which matters under a thundering herd but isn't required for correctness — if Redis were down, the system would just fall back to "every request hits Postgres," and still be correct.

**Q: Why Redis + an async queue instead of just querying Postgres directly?**
The stated target is 1M+ concurrent readers. If every share-link view queried Postgres, the connection pool would become the bottleneck long before 1M concurrent requests — serverless functions each hold a connection, and Postgres has a hard connection ceiling even with pooling. Redis absorbs essentially all read traffic (cache hit path never touches Postgres), and view-count increments happen as `INCR` in Redis rather than row-level `UPDATE`s in Postgres, which avoids lock contention on the single hottest row in the system — a viral note's own counter. QStash then reconciles Redis's counters back into Postgres on a schedule, trading real-time accuracy for throughput, which is an acceptable trade for analytics data.

**Q: What's wrong with using one static JWT secret for one-time-link sessions, and how would you fix it?**
A single app-wide secret means anyone who obtains it — through a leaked env var, a misconfigured log, whatever — can forge a valid session JWT for *any* note in the system, not just one. The fix is to derive a per-note signing key (e.g. HMAC of the app secret with the note's ID and creation timestamp) so a compromised key only ever grants access to the one note it was derived from, combined with a short expiry (~5 minutes) and storing it as an httpOnly cookie rather than something client JavaScript can read and exfiltrate via XSS.

**Q: Why Last-Write-Wins instead of a proper CRDT for collaborative editing?**
CRDT/OT (like Yjs) gives conflict-free merging but needs a persistent connection to a relay or awareness server, which is an always-on process — awkward to run cleanly on a serverless-first stack like Vercel without adding a separate service. LWW with a debounce is much simpler operationally and good enough for a notes app where simultaneous character-level collisions on the exact same region are rare. The honest trade-off, which I documented rather than hid: two people editing the same region within the same debounce window can silently lose one edit. That's a real limitation, and I'd revisit it if this were, say, a code editor instead of a notes app.

**Q: How do you make sure a revoked note doesn't keep being served from cache?**
This was actually a gap in the first draft of the design — TTL-only caching means a note that's revoked *after* being cached would keep serving its old content to anyone with the link until the cache entry naturally expired, which is a real access-control bypass, not just a staleness bug. The fix is write-through invalidation: every mutation path (edit, revoke, password change) overwrites the Redis cache entry in the same request as the database write, so there's no window where the cache and the database disagree about access.

**Q: How would you scale this past 1M concurrent readers?**
Layer a CDN cache in front of Redis for the specific case of public, non-collaborative notes — a short `stale-while-revalidate` header lets Vercel's edge network absorb repeat requests for a viral link before they even reach Upstash. Beyond that, Upstash Redis itself scales horizontally on their end; the design deliberately keeps Postgres off the hot path entirely so it isn't the constraint to begin with.

**Q: How do you handle IST vs UTC without introducing timezone bugs?**
Everything in the database and every scheduled job comparison is UTC — full stop. IST only exists at the UI layer: the expiry picker displays and accepts IST, and converts to UTC before it's ever sent to the server. That means `pg_cron`'s `NOW()` comparisons are correct regardless of what timezone the Postgres server itself is configured with, and there's no code path anywhere that has to reason about IST offsets.

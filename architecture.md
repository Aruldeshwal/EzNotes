# Architecture

> Refined from the original draft. See the callout boxes (⚠️ / ✅) for what changed and why — these are good source material for `DECISIONS.md` and `INTERVIEW_PREP.md`.

## Table of Contents
1. [System Overview](#1-system-overview)
2. [Database Schema (Prisma / Neon)](#2-database-schema-prisma--neon)
3. [Deployment & Infrastructure Topology](#3-deployment--infrastructure-topology)
4. [Redis Key Reference](#4-redis-key-reference)
5. [Core Data Flows](#5-core-data-flows)
6. [Scaling to 1M+ Concurrent Readers](#6-scaling-to-1m-concurrent-readers)
7. [Security Model Summary](#7-security-model-summary)
8. [Timezone Handling](#8-timezone-handling)
9. [Open Decisions](#9-open-decisions)

---

## 1. System Overview

A Next.js note-sharing app where every note can be made public, password-protected, or one-time-view, optionally collaborative, and optionally time-limited. The system is designed so that **read traffic never touches Postgres directly** — Redis is the read path, Postgres is the system of record, and QStash is the glue that reconciles the two asynchronously.

```
Client → Vercel Edge Middleware (rate limit) → Server Component / Route Handler
                                                     │
                                        cache hit ───┼─── cache miss
                                             │                │
                                        Upstash Redis ──► Neon Postgres (write-through)
```

---

## 2. Database Schema (Prisma / Neon)

⚠️ **Fix:** the original schema used `@default(nanoid())`. Prisma's `@default()` attribute only accepts `cuid()`, `uuid()`, `autoincrement()`, `now()`, and `dbgenerated()` — it does not support arbitrary functions. `nanoid()` is not a real Prisma default generator, so this would fail at `prisma generate`. Token generation now happens in the service layer (`lib/tokens.ts`) using the `nanoid` npm package before the row is created.

⚠️ **Fix:** `is_collaborative: Boolean` and `share_type: String` were two separate fields describing overlapping concerns. Collapsed into a single `ShareType` enum (`READ_ONLY | COLLABORATIVE`). `access_type` is now its own enum (`PUBLIC | PASSWORD | ONE_TIME`) instead of a free-text string, giving compile-time safety anywhere it's branched on.

⚠️ **Fix:** `revoked: Boolean` was being asked to represent two different real-world events — an owner manually revoking a link, and a one-time link being auto-consumed. Added `consumedAt: DateTime?` so analytics/UI can distinguish "owner killed this" from "this was viewed and expired by design," while `revoked` still functions as the single boolean the UI checks for "is this link dead."

✅ **Added:** indexes on `clerkUserId` (dashboard queries) and `expiryDate` (pg_cron sweep), a `directUrl` datasource field (Neon's pooled connection is used at runtime; migrations need the direct, non-pooled connection), and explicit `@map`/`@@map` so the DB stays `snake_case` while Prisma Client stays idiomatic `camelCase`.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // pooled (pgbouncer) connection, used at runtime
  directUrl = env("DIRECT_URL")     // direct connection, used only for migrations
}

enum AccessType {
  PUBLIC
  PASSWORD
  ONE_TIME
}

enum ShareType {
  READ_ONLY
  COLLABORATIVE
}

enum Theme {
  SYSTEM
  LIGHT
  DARK
}

model UserSettings {
  clerkUserId        String     @id @map("clerk_user_id")
  defaultTheme       Theme      @default(SYSTEM) @map("default_theme")
  defaultAccess      AccessType @default(PUBLIC) @map("default_access")
  defaultExpiryHours Int?       @map("default_expiry_hours")
  updatedAt          DateTime   @updatedAt @map("updated_at")

  @@map("user_settings")
}

model Note {
  id           String      @id @default(cuid())
  token        String      @unique                     // generated in app code, see lib/tokens.ts
  clerkUserId  String      @map("clerk_user_id")
  title        String
  content      String      @db.Text                     // up to 100,000 chars, enforced at the app layer
  shareType    ShareType   @default(READ_ONLY) @map("share_type")
  accessType   AccessType  @default(PUBLIC) @map("access_type")
  expiryDate   DateTime?   @map("expiry_date")           // always stored UTC — see §8
  passwordHash String?     @map("password_hash")
  revoked      Boolean     @default(false)
  consumedAt   DateTime?   @map("consumed_at")           // set when a ONE_TIME note is auto-consumed
  viewCount    Int         @default(0) @map("view_count") // lifetime total, synced from Redis by QStash
  createdAt    DateTime    @default(now()) @map("created_at")
  updatedAt    DateTime    @updatedAt @map("updated_at")

  @@index([clerkUserId])
  @@index([expiryDate])
  @@map("notes")
}

model NoteViewAggregate {
  id        String   @id @default(cuid())
  noteToken String   @map("note_token")                  // not an FK — see note below
  date      DateTime @db.Date
  viewCount Int      @default(0) @map("view_count")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@unique([noteToken, date])
  @@index([noteToken])
  @@map("note_view_aggregates")
}
```

**Design note — why `noteToken` isn't a foreign key:** the Expiry Purge job hard-deletes `Note` rows, but we want daily view history to survive for the owner's lifetime analytics even after the note itself is gone. An FK with `onDelete: Cascade` would silently destroy that history; no FK (or `onDelete: SetNull` on a nullable relation) preserves it. This is called out explicitly in `DECISIONS.md` so it doesn't look like an oversight in review.

---

## 3. Deployment & Infrastructure Topology

* **Compute:** Vercel (Edge Middleware for rate limiting, Node.js serverless functions for Server Actions / Route Handlers, Server Components render on-demand).
* **Database:** Neon Postgres. Runtime traffic uses the pooled connection string (`-pooler` suffix); Prisma Migrate uses `DIRECT_URL`. This matters because serverless functions open/close connections per invocation — without pooling, 1M concurrent readers would exhaust Postgres' connection limit even though reads are mostly served from Redis.
* **Cache / rate limiting:** Upstash Redis, accessed via REST API (works from Edge Middleware, which has no raw TCP socket access).
* **Async jobs:** Upstash QStash for the view-count flush and any retryable webhook-style work.
* **Scheduled jobs:** Neon's `pg_cron` extension, running inside the database itself (no separate worker to operate).
* **Region colocation:** Vercel functions, Neon compute, and Upstash Redis should all be provisioned in the same region (or nearest pair) to keep the cache-hit path under ~20ms. Cross-region hops here are the single biggest latency risk in the whole design.

---

## 4. Redis Key Reference

✅ **Added** — the original doc referenced these keys individually across sections; consolidating them here makes the naming scheme auditable and stops key-collision bugs before they happen.

| Key | Type | Purpose | TTL |
|---|---|---|---|
| `note:{token}` | String (JSON) | Cached note payload served on `/share/[token]` | 1h, **write-through invalidated** on any mutation (see §5.2) |
| `note:views:{token}` | Integer | Lifetime view counter pending flush | none — reset to 0 by the QStash job after each flush |
| `note:daily_views:{token}:{YYYY-MM-DD}` | Integer | Daily view counter pending flush | 26h (survives past midnight so a slightly late flush still succeeds) |
| `lock:note:{token}` | String | Fast-path pre-check before the DB-atomic one-time consume | 5s |
| `fails:{token}:{ip}` | Integer | Password brute-force attempt counter | 60s rolling |
| `lockout:{token}:{ip}` | String | Set after 5 fails in 60s | 15min |
| `ratelimit:{route}:{ip_or_userId}` | Token bucket | Edge Middleware rate limiting, per route (see `CodeStandards.md`) | rolling window per route |

---

## 5. Core Data Flows

### 5.1 Note Creation & Share Link Generation
1. Owner submits the editor form → Next.js **Server Action** (per `CodeStandards.md`, mutations from forms use Server Actions, not Route Handlers).
2. Service layer generates a `nanoid(12)` token, hashes the password if one was provided (`bcrypt`, 10 rounds), and inserts the `Note` row.
3. Server Action writes the fresh note payload to `note:{token}` in Redis (write-through, not wait-for-miss) so the very first viewer is already a cache hit.
4. Redirects owner to the dashboard with the new share link.

### 5.2 Share Link View Flow & Caching
1. Client requests `/share/[token]`.
2. Edge Middleware checks `ratelimit:public_share_load:{ip}` (5/min per `CodeStandards.md`).
3. Server Component reads `note:{token}` from Redis.
   * **Hit:** payload returned instantly, no Postgres round-trip.
   * **Miss:** query Neon, write the result to `note:{token}`, return it.
4. Response is additionally sent with a short `Cache-Control: s-maxage=5, stale-while-revalidate=30` header for **unauthenticated, public, non-collaborative** notes, letting Vercel's edge network absorb repeat requests for the same viral link before they even reach Redis.

⚠️ **Fix — cache-invalidation gap:** the original flow never described what happens to the Redis cache when a note is edited, revoked, or has a password added *after* it was first cached. Without write-through invalidation, a note that was public and got cached, then revoked or password-protected by the owner, would keep being served from the stale cache to anyone who already had the link — silently bypassing the new access control. **Every mutation path (edit, revoke, password change, regenerate) must overwrite `note:{token}` in the same transaction/request as the DB write**, not rely on the 1h TTL to eventually catch up.

### 5.3 Password-Protected Access Flow
1. `access_type === PASSWORD` → viewer sees a password form.
2. Submission hits `POST /api/share/[token]/verify-password` (Route Handler, since this is a client-initiated mutation — per `CodeStandards.md`).
3. Handler checks `lockout:{token}:{ip}` first (fail fast, no DB hit if already locked out).
4. `bcrypt.compare()` against `passwordHash`.
   * Success → short-lived session cookie (httpOnly, `SameSite=Lax`) scoping access to this token.
   * Failure → `INCR fails:{token}:{ip}` (60s TTL); 5 fails sets `lockout:{token}:{ip}` for 15min; respond `401`.

### 5.4 One-Time Link Consumption & Race Handling
1. `POST /api/share/[token]/consume-one-time`.
2. **Fast path:** `SETNX lock:note:{token} 1 EX 5` — if this fails, another request is already mid-consume; respond `410` immediately without touching Postgres. This is purely a load-shedding optimization for the "N-1 losers" under a thundering herd, **not** the correctness guarantee.
3. **Correctness guarantee:** `UPDATE notes SET revoked = true, consumed_at = now() WHERE token = $1 AND revoked = false RETURNING *`. Postgres row-level locking makes this atomic regardless of whether the Redis lock was acquired, held, or expired — so the system is correct even if Redis is momentarily unavailable.
4. Winning request gets the row back and issues a short-lived JWT (see §7) authorizing `PATCH` calls for the current session only; losing requests get zero rows back → `410 Gone`.
5. Redis cache for `note:{token}` is invalidated immediately so any subsequent request (even within the TTL window) correctly reflects `revoked = true`.

### 5.5 Collaborative Editing & Sync
1. Editor debounces keystrokes 2000ms (per `CodeStandards.md`) before firing `PATCH /api/share/[token]/content`.
2. Redis `note:{token}` is overwritten immediately (read-your-writes for the editing client and anyone polling).
3. A QStash message queues the same payload for a Neon write (write-behind), decoupling collaborative typing speed from Postgres write latency.
4. **Conflict resolution: Last-Write-Wins.** This is an explicit, accepted trade-off, not an oversight — see `DECISIONS.md` ADR-002. Two collaborators editing the same region within the same debounce window can silently lose one edit. A CRDT/OT approach (e.g. Yjs) would remove this risk but adds a persistent WebSocket/relay server, which doesn't fit a serverless-first Vercel deployment without an additional always-on service.
5. **Sync for other viewers:** the original draft didn't specify how a second collaborator sees updates. MVP approach: client-side polling of `GET /api/share/[token]` every 3–5s while the collaborative editor is open, reading straight from the (already-fast) Redis cache. This is simple and serverless-compatible; documented as an explicit upgrade path to Pusher/Ably/Supabase Realtime if latency requirements tighten later.

### 5.6 View Analytics Pipeline
1. Every rendering `GET` (excluding owner views — checked against `clerkUserId` when a Clerk session exists) triggers `INCR note:views:{token}` and `INCR note:daily_views:{token}:{date}` in Redis.
2. Dedup: a Redis Set (`viewed:{token}`) keyed by `clerkUserId` if signed in, else `ip_hash`, with the same TTL as the daily counter, prevents refresh-spam from inflating counts within a day.
3. A QStash cron message runs periodically (e.g. every 5 min) hitting `POST /api/jobs/flush-views`, which reads and zeroes the Redis counters and, in a single Postgres transaction, upserts `NoteViewAggregate` **and** increments `Note.viewCount` — keeping the lifetime total and the daily breakdown consistent with each other.
4. The flush endpoint verifies the QStash signature header before processing, so it can't be invoked by anyone who finds the URL.

### 5.7 Expiry, Revocation & Cleanup
1. **Nightly `pg_cron` — Expiry Purge:** hard-deletes `notes` where `expiry_date < now()`. Runs against UTC timestamps only (see §8).
2. **Nightly `pg_cron` — Reconciliation (safety net):** cross-references `clerk_user_id`s against the Clerk Backend API and purges orphaned notes.
3. ✅ **Added — Clerk webhook (primary path):** `POST /api/webhooks/clerk` listens for `user.deleted` and purges that user's notes immediately, verified via Clerk's webhook signing secret. The nightly reconciliation job then becomes a fallback for the rare case a webhook delivery is missed, rather than the only mechanism — reduces the average "orphaned note" lifetime from ~24h to seconds.
4. ✅ **Added — revoked-note grace period:** revoked/consumed notes are not immediately hard-deleted; they're swept by the same nightly job only after a 30-day grace window, giving an owner room to notice a mistaken revoke without engineering an "undo" feature.

---

## 6. Scaling to 1M+ Concurrent Readers

* Reads never touch the Postgres connection pool on the hot path — only cache misses and writes do.
* View-count increments are `INCR` in Redis, not `UPDATE ... SET count = count + 1` in Postgres, which avoids row-lock contention entirely on the single hottest row in the system (a viral note's counter).
* The added `s-maxage`/`stale-while-revalidate` header (§5.2) lets Vercel's CDN edge absorb a large fraction of repeat requests before they even reach Upstash, which matters because Upstash REST calls, while fast, are not free at 1M concurrent scale.
* Neon's pooled connection string is mandatory at this scale — direct connections would exhaust Postgres' connection limit purely from serverless function cold starts, independent of actual query volume.

---

## 7. Security Model Summary

Full threat model lives in `SECURITY.md`; the two items worth flagging at the architecture level:

* ⚠️ **JWT secret:** the original design signs one-time-link session JWTs with a single static app-wide secret. Anyone who obtains that secret can mint a valid session for *any* note. Recommended fix: derive the signing key per-note (`HMAC(APP_SECRET, note.id + note.createdAt)`), keep the token short-lived (~5 min), and set it as an httpOnly cookie rather than returning it in a JSON body the client stores itself.
* ⚠️ **Rendering note content:** neither the original schema nor UI doc specifies how `content` is rendered. If it's ever rendered as raw HTML, this is a stored-XSS vector on a feature whose entire purpose is sharing links with strangers. Content must be rendered as plain text or sanitized Markdown (e.g. via `rehype-sanitize`), never `dangerouslySetInnerHTML` on unsanitized input.

---

## 8. Timezone Handling

⚠️ **Fix:** "Evaluated in IST" was ambiguous about where that evaluation happens. **All storage and comparison logic (Postgres columns, `pg_cron` sweeps, Redis TTLs) uses UTC exclusively.** IST is purely a presentation concern: the expiry date/time picker in the UI displays and accepts IST, and converts to UTC client-side before it's ever sent to the server. This keeps `NOW()` comparisons in `pg_cron` correct regardless of the database server's configured timezone, and avoids a whole category of "midnight IST vs midnight UTC" off-by-one bugs.

---

## 9. Open Decisions

These are tracked with full context in `DECISIONS.md` rather than buried in prose here:
* ADR-001: Merging `is_collaborative` into `ShareType`
* ADR-002: LWW over CRDT for collaborative editing
* ADR-003: Write-through cache invalidation over TTL-only
* ADR-004: DB-atomic UPDATE as the correctness guarantee for one-time links; Redis lock as an optimization only
* ADR-005: Public share links do not require a Clerk session (resolves a contradiction in `ProjectOverview.md` / `UI.md` — see those files)
* ADR-006: UTC storage, IST presentation-only

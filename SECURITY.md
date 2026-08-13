# Security Model

A consolidated threat model. `architecture.md` §7 summarizes the two most important items; this file is the full reference and the pre-launch checklist.

## Threats & Mitigations

| Threat | Mitigation |
|---|---|
| Stale cache serves a revoked/password-protected note's content after an owner changes access | Write-through Redis invalidation on every mutation path — see `architecture.md` §5.2. TTL alone is not sufficient. |
| One-time link consumed twice under concurrent requests | Atomic `UPDATE ... WHERE revoked = false RETURNING *` in Postgres as the correctness guarantee; Redis `SETNX` is a fast-path optimization only, not relied on for correctness. |
| A single static JWT secret lets anyone who obtains it mint a session for *any* note | Derive the signing key per-note (`HMAC(APP_SECRET, note.id + note.createdAt)`); short expiry (~5 min); httpOnly cookie instead of client-readable token. |
| Password brute force on a `PASSWORD`-access note | Token-bucket rate limit (5 attempts/min) + Redis-tracked lockout (5 fails/60s → 15min IP lockout), checked before the `bcrypt.compare()` call so a locked-out IP never even reaches it. |
| Stored XSS via note content, since `/share/[token]` is intentionally reachable by anyone with a URL | Render content as plain text or sanitized Markdown only. Never `dangerouslySetInnerHTML` on unsanitized input. |
| CSRF on Server Actions | Next.js Server Actions include built-in origin-checking; still validate `origin`/`referer` headers on the custom Route Handlers under `/api/share/[token]/**`, since those aren't Server Actions. |
| Forged QStash callback triggering an unauthorized view-count flush | Verify the QStash signature header on `POST /api/jobs/flush-views` before processing; reject with `401` first. |
| Forged Clerk webhook triggering unauthorized data deletion | Verify Clerk's webhook signing secret on `POST /api/webhooks/clerk` before processing. |
| Secrets committed to git | `.env` gitignored from commit #1; `.env.example` is the only committed reference — see `ENV_SETUP.md` and `GIT_WORKFLOW.md`. |
| IP addresses retained indefinitely for view dedup, raising privacy concerns | Store only a salted hash (`ip_hash`), not the raw IP; dedup keys share the same TTL as the daily view counter (~26h), so raw or hashed IPs aren't retained long-term. |
| Timing-safe password comparison | Handled by `bcrypt.compare()` internally — do not hand-roll a comparison. |
| Note content leaking via server logs | Never log plaintext passwords or full note content; log the token and route only. |

## Pre-Launch Checklist
- [ ] Every mutation path invalidates the relevant Redis key in the same request as the DB write.
- [ ] JWT secret is per-note derived, not a single static value.
- [ ] Rate limits from `CodeStandards.md` are enforced at Edge Middleware, not just in application code (defense at the edge, before a serverless function even spins up).
- [ ] Content rendering path has been manually checked for raw HTML injection.
- [ ] `.env.example` contains no real secret values.
- [ ] Webhook/callback endpoints verify signatures before doing any other work.

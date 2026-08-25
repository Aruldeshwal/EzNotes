# Difficulties Log

Append an entry every time something genuinely broke, took longer than expected, or required backtracking on a first approach. Write it like you'd narrate it to an interviewer — the diagnosis matters more than the fix. Per `GIT_WORKFLOW.md`, this gets updated in the same commit as the task that surfaced it, not batched up later from memory.

**Template:**

```
## <short title>
**When:** Phase N, "<ProgressTracker.md item>"
**What broke:** what you observed going wrong
**Why:** the actual root cause, once found (often different from the first guess)
**How diagnosed:** logs / repro steps / what you checked, in order
**Fix:** what changed
**If I were doing it again:** one sentence on what you'd do differently from the start
```

---

_(entries begin below as they happen during the build)_

## Prisma 7 removed `url`/`directUrl` from schema.prisma

**When:** Phase 1, "Initialize Prisma, define schema, and run the initial migration"
**What broke:** `npx prisma generate` failed with P1012 — `url` and `directUrl` datasource properties are no longer supported in schema files in Prisma 7.
**Why:** Prisma 7 (installed as `latest` at 7.9.1) moved connection string configuration from `schema.prisma` to a new `prisma.config.ts` file. The architecture doc assumed Prisma 5/6-era syntax.
**How diagnosed:** Error message was explicit about the new `prisma.config.ts` requirement and linked to migration docs.
**Fix:** Pinned to Prisma 6 (`prisma@6`, `@prisma/client@6`) which still supports the `url`/`directUrl` syntax in the schema file, matching the architecture doc's schema exactly.
**If I were doing it again:** Check the Prisma version's schema syntax before writing the schema file, or pin to a specific major version from the start.

## Route Handler response stalling when setting cookies in Next.js 15

**When:** Phase 3 & Phase 5, "Password and One-time access verification"
**What broke:** Correct password submissions showed "Unlocking..." indefinitely and did not return a response payload to the client.
**Why:** `setNoteSessionCookie` was attempting to mutate both the `NextResponse` cookies (`response.cookies.set()`) and the Next.js `(await cookies()).set()` store simultaneously within a Route Handler. In Next.js 15, mutating the request cookie store inside a Route Handler that returns a custom `NextResponse` locks the response stream.
**How diagnosed:** Inspected network tab pending states; observed that Route Handlers with `(await cookies()).set()` never finished streaming headers when paired with `NextResponse.json()`.
**Fix:** Refactored `setNoteSessionCookie` to conditionally branch: Route Handlers set cookies directly on the `NextResponse` object, whereas Server Actions use `await cookies()`.
**If I were doing it again:** Strictly decouple Route Handler cookie operations from Server Action cookie stores from the outset.

## Bcrypt hash verification failure due to Upstash JSON serialization

**When:** Phase 3, "Password verification"
**What broke:** Entering the correct password returned 401 Unauthorized.
**Why:** Reading note payloads from the Upstash Redis cache passed through JSON serialization/deserialization where special characters in bcrypt hashes (`$`, `/`) and serialized `Date` timestamps were slightly altered, breaking `bcrypt.compare()` and HMAC key derivation.
**How diagnosed:** Logged the raw hash from Postgres vs. the cached object from Redis; discovered subtle string discrepancies in the serialized payload.
**Fix:** Configured password verification and JWT key generation to query PostgreSQL directly rather than reading from the Redis cache.
**If I were doing it again:** Treat authentication secrets and cryptographic key derivation inputs as strictly database-bound, bypassing intermediate JSON cache layers.

## Ephemeral note gateway reverting to locked prompt on empty content

**When:** Phase 5, "One-time and password-protected note rendering"
**What broke:** When clicking "View Note Now" or entering a correct password on a note with empty/blank content, the screen remained on the locked prompt.
**Why:** The UI state machine evaluated `if (!note.content)` to decide whether the note was unlocked. For notes with empty content (`content: ""`), `!note.content` remained true after successful unlocking.
**How diagnosed:** Inspected the React state tree; `note` data was populated with 200 OK data, but the view condition fell into the gateway branch.
**Fix:** Introduced explicit boolean state flags (`isUnlocked`, `isConsumedLocally`) to govern screen transitions independently of content length.
**If I were doing it again:** Use dedicated state machine enum/boolean flags rather than overloading data attribute presence for UI routing.

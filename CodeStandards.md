## TypeScript & Safety
*   **Strict Mode:** Enforced in `tsconfig.json`.
*   **Type Definitions:** Explicit interfaces for all API payloads and Component Props. Avoid `any`.
*   **Prisma Typing:** Utilize Prisma's generated types (e.g., `import { Note } from '@prisma/client'`) instead of manual redeclaration.
*   **Enums over strings:** any field with a fixed set of values (`AccessType`, `ShareType`, `Theme`) is a Prisma enum, not a free-text string — see `architecture.md` §2.

## Next.js App Router Rules
*   **Server/Client Components:** Default to Server Components. Use `'use client'` directive explicitly at the top of files requiring interactivity (hooks, event listeners, local state).
*   **Data Fetching:** Execute database queries directly in Server Components where possible. Use Route Handlers (`app/api/...`) strictly for client-side mutations or external integrations (webhooks, QStash callbacks).
*   **Mutations:** Utilize Next.js Server Actions for form submissions and DB mutations from within the authenticated dashboard. Use Route Handlers for `/share/[token]` mutations, since those need custom auth handling (JWT/session cookie) that doesn't fit the Server Action model.
*   **Server Action return shape:** ✅ **added** — Server Actions never `throw` for expected failure cases (validation errors, ownership mismatch). They return a discriminated union so the client can handle failure without a try/catch around every call:
    ```ts
    type ActionResult<T> =
      | { success: true; data: T }
      | { success: false; error: string; code?: string };
    ```
    Reserve actual thrown exceptions for genuinely unexpected failures (DB connection loss), which Next.js's `error.tsx` boundary should catch.

## Styling (Tailwind)
*   **Utility Order:** Group utilities logically (Layout, Spacing, Typography, Colors). Consider using `eslint-plugin-tailwindcss` for auto-sorting.
*   **Dynamic Classes:** Use `clsx` and `tailwind-merge` utility functions to combine dynamic classes and prevent specificity conflicts.

## Performance & State
*   **Debouncing:** `PATCH` operations during collaborative editing must utilize a strict 2000ms debounce hook.
*   **Rate Limits:** Standard limits enforced at Edge Middleware:
    *   Global API: 100/IP/min.
    *   Note Creation: 15/user/min.
    *   Settings Update: 15/user/min.
    *   Public Share Load: 5/IP/min.
    *   Collaborative Patches: 5/user/min.

## Testing
✅ **Added** — the original doc had no testing convention at all.
*   **Unit/integration:** Vitest for service-layer logic (token generation, password hashing, cache key construction).
*   **E2E:** Playwright, covering at minimum the three flows with the highest correctness risk:
    1.  Two simultaneous requests to consume the same one-time link → exactly one succeeds.
    2.  Five failed password attempts within 60s → sixth attempt is locked out regardless of correctness.
    3.  A revoked/expired note is unreadable even when a stale Redis cache entry exists (write-through invalidation actually works).
*   Every checklist item in `ProgressTracker.md` that touches one of these flows should ship with its corresponding test in the same commit — see `GIT_WORKFLOW.md`.

## Error Handling
✅ **Added**
*   User-facing errors are actionable, not raw exception messages ("This link has expired" not "Error: expiry_date < now()").
*   Server-side, log the real error with enough context to debug (token, route, cause) but never log plaintext passwords or full note content.
*   Route Handlers that verify external signatures (Clerk webhook, QStash callback) reject with `401` *before* doing any other work if the signature check fails.

## Folder Structure
✅ **Added** — a starting layout so the CLI scaffold has an unambiguous target.
```
app/
  (dashboard)/
    notes/
      page.tsx
      new/page.tsx
      [id]/page.tsx
  share/
    [token]/
      page.tsx
      loading.tsx
      error.tsx
  api/
    share/[token]/
      verify-password/route.ts
      consume-one-time/route.ts
      content/route.ts
    webhooks/clerk/route.ts
    jobs/flush-views/route.ts
lib/
  actions/        # Server Actions (createNote, updateNote, revokeNote, ...)
  tokens.ts        # nanoid token generation
  redis.ts         # typed wrappers around the Redis key reference in architecture.md
  auth.ts          # JWT issuance/verification for one-time sessions
  rate-limit.ts
prisma/
  schema.prisma
middleware.ts       # Edge rate limiting
```

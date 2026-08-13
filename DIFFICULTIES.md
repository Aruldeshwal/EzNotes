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

*(entries begin below as they happen during the build)*

## Prisma 7 removed `url`/`directUrl` from schema.prisma
**When:** Phase 1, "Initialize Prisma, define schema, and run the initial migration"
**What broke:** `npx prisma generate` failed with P1012 — `url` and `directUrl` datasource properties are no longer supported in schema files in Prisma 7.
**Why:** Prisma 7 (installed as `latest` at 7.9.1) moved connection string configuration from `schema.prisma` to a new `prisma.config.ts` file. The architecture doc assumed Prisma 5/6-era syntax.
**How diagnosed:** Error message was explicit about the new `prisma.config.ts` requirement and linked to migration docs.
**Fix:** Pinned to Prisma 6 (`prisma@6`, `@prisma/client@6`) which still supports the `url`/`directUrl` syntax in the schema file, matching the architecture doc's schema exactly.
**If I were doing it again:** Check the Prisma version's schema syntax before writing the schema file, or pin to a specific major version from the start.

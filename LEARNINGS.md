# Learnings Log

Distinct from `DIFFICULTIES.md`: this is for things worth carrying into the _next_ project, not just this one — a pattern, a tool quirk, a mental model that clicked. Keep entries short; this file is a personal reference, not a report.

**Template:**

```
## <short title>
**Context:** what you were doing when this came up
**What I learned:** the actual takeaway, generalized past this specific project
**Where I'd apply it again:** a concrete future scenario
```

---

_(entries begin below as they happen during the build)_

## Pin ORM major versions from day one

**Context:** Prisma 7 shipped a breaking change to the schema config format while this project's architecture doc assumed Prisma 5/6 syntax.
**What I learned:** Always pin ORM/framework dependencies to a specific major version in `package.json` from the first `npm install`, especially when the project has pre-written schema or config files. `@latest` on a fast-moving tool is a trap.
**Where I'd apply it again:** Any greenfield project where the architecture was planned against a specific tool version — lock the dependency early.

## Next.js 15 App Router: Treat Route Handlers and Server Actions as distinct execution contexts

**Context:** Cookie mutation mechanisms differ fundamentally between Next.js Server Actions (`await cookies()`) and Route Handlers (`NextResponse.cookies`).
**What I learned:** In Next.js 15, helper functions that interact with headers/cookies should accept the `NextResponse` object explicitly or branch cleanly based on caller context. Mixing the async request cookie store with manual response objects produces subtle stream locking issues.
**Where I'd apply it again:** Any Next.js App Router application implementing custom authentication tokens, session cookies, or CORS-aware route handlers.

## Ephemeral state machines require dedicated lifecycle flags

**Context:** Distinguishing between an unconsumed note with empty text vs. a consumed note in a single state tree.
**What I learned:** Never overload domain data attributes (such as `content.length === 0`) to double as UI authorization state indicators. Explicit transition flags (`isUnlocked`, `isConsumedLocally`) create unbreakable one-way state transitions and eliminate race-condition flashes.
**Where I'd apply it again:** Any burn-after-reading or multi-step auth challenge UI where state must transition irreversibly.

## Hybrid read-your-writes analytics for batched architectures

**Context:** Reconciling high-throughput Redis caching with periodic QStash batching in user-facing dashboards.
**What I learned:** To achieve true write-behind scalability without sacrificing immediate user feedback, client-facing analytics endpoints should dynamically combine PostgreSQL historical records with un-flushed Redis memory counters.
**Where I'd apply it again:** High-concurrency metrics, like counters, view trackers, or voting systems.

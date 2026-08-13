# Learnings Log

Distinct from `DIFFICULTIES.md`: this is for things worth carrying into the *next* project, not just this one — a pattern, a tool quirk, a mental model that clicked. Keep entries short; this file is a personal reference, not a report.

**Template:**
```
## <short title>
**Context:** what you were doing when this came up
**What I learned:** the actual takeaway, generalized past this specific project
**Where I'd apply it again:** a concrete future scenario
```

---

*(entries begin below as they happen during the build)*

## Pin ORM major versions from day one
**Context:** Prisma 7 shipped a breaking change to the schema config format while this project's architecture doc assumed Prisma 5/6 syntax.
**What I learned:** Always pin ORM/framework dependencies to a specific major version in `package.json` from the first `npm install`, especially when the project has pre-written schema or config files. `@latest` on a fast-moving tool is a trap.
**Where I'd apply it again:** Any greenfield project where the architecture was planned against a specific tool version — lock the dependency early.

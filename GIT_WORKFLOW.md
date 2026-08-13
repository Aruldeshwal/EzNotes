# Git Workflow

This is the source of truth for commit and push discipline during the build. `ProgressTracker.md` refers back to this file rather than repeating it. The goal: a commit history that reads like a real engineering log, because that's exactly what an interviewer skimming the repo will use it as.

## The rule
**Push after every task, not after every phase.** Batching a whole phase into one commit destroys the thing that makes this history valuable — the ability to point at commit #14 and say "this is where I found the cache-invalidation bug and fixed it."

## Per-task checklist
For each checked-off item in `ProgressTracker.md`:
1.  Implement the task.
2.  Run `npm run lint && npm run typecheck` (and the relevant test suite, if the task touched one of the three critical flows in `CodeStandards.md`).
3.  If the task surfaced a real difficulty (something broke, something took longer than expected, a wrong initial approach) → append an entry to `DIFFICULTIES.md`. If it surfaced a design trade-off → append to `DECISIONS.md`. If it taught you something worth remembering for future projects → append to `LEARNINGS.md`. Not every task produces all three — most produce zero or one.
4.  Stage only the files relevant to this task.
5.  Commit with a Conventional Commit message (format below).
6.  Push immediately — `git push origin main` for solo work, or push the feature branch and open a PR for phase-level work (optional; see below).
7.  Check the item off in `ProgressTracker.md` — either amend it into the same commit or a trivial follow-up `chore(progress): ...` commit.

## Commit message format
```
<type>(<scope>): <short description>

[optional body: what changed and why, 1-3 sentences]
[optional footer: refs Phase N / ProgressTracker item]
```

**Types:** `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore`

**Examples, tied to actual tasks in `ProgressTracker.md`:**
```
feat(schema): add Note and NoteViewAggregate Prisma models

Collapsed is_collaborative + share_type into a single ShareType enum
to remove a redundant boolean/string pair. See DECISIONS.md ADR-001.

feat(share): atomic one-time link consumption

UPDATE ... WHERE revoked = false RETURNING * as the correctness
guarantee; Redis SETNX lock added as a fast-path only. See
architecture.md §5.4.

fix(cache): write-through invalidation on note mutation

Revoking or password-protecting a note now overwrites the Redis
cache in the same request, closing a gap where a stale cache could
keep serving a revoked note's content until its TTL expired.

test(share): e2e coverage for concurrent one-time consumption

chore(progress): check off Phase 3 item 4
```

## Branching (optional but recommended for portfolio value)
For solo work, committing straight to `main` is fine. If you want the repo to also demonstrate PR hygiene: one short-lived branch per phase (`phase-1-scaffolding`, `phase-2-core-logic`, ...), PR description using the template below, merge (don't squash — squashing throws away the granular history that's the whole point).

**PR description template:**
```
## What
[1-2 sentences]

## Why
[the problem this phase solves]

## Trade-offs / decisions made
[link the relevant DECISIONS.md entries]

## Testing
[what was tested and how]
```

## Hard rules
* `.env` is gitignored from commit #1. `.env.example` (see `ENV_SETUP.md`) is what's committed.
* Never commit a plaintext secret, even temporarily, even in a commit you plan to amend — assume any push is permanent.
* Don't rewrite pushed history (`git commit --amend` + `push --force`) except to fix the immediately-preceding commit before anyone else could have pulled it.

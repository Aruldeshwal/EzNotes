# Environment Setup

All secrets live in `.env` (gitignored). `.env.example` below is what's actually committed — see `GIT_WORKFLOW.md`.

| Variable | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | Prisma Client (runtime) | Neon **pooled** connection string (`-pooler` suffix) |
| `DIRECT_URL` | Prisma Migrate | Neon **direct**, non-pooled connection string |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk (client) | Safe to expose |
| `CLERK_SECRET_KEY` | Clerk (server) | Never expose to the client |
| `CLERK_WEBHOOK_SECRET` | `/api/webhooks/clerk` | Used to verify webhook signatures |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Clerk Routing | Custom sign-in route (`/login`) |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Clerk Routing | Custom sign-up route (`/register`) |
| `UPSTASH_REDIS_REST_URL` | `lib/redis.ts`, Edge Middleware | REST API, not raw TCP — required for Edge runtime compatibility |
| `UPSTASH_REDIS_REST_TOKEN` | `lib/redis.ts`, Edge Middleware | |
| `QSTASH_URL` | QStash Client | Optional base URL for regional QStash endpoints |
| `QSTASH_TOKEN` | Enqueuing QStash messages | |
| `QSTASH_CURRENT_SIGNING_KEY` | `/api/jobs/flush-views` | Verifies inbound QStash callback signatures |
| `QSTASH_NEXT_SIGNING_KEY` | `/api/jobs/flush-views` | Used during QStash key rotation |
| `APP_SECRET` | `lib/auth.ts` | Base secret for deriving per-note JWT signing keys — see `architecture.md` §7 and `SECURITY.md` |
| `NEXT_PUBLIC_APP_URL` | Absolute URL construction (share links, webhook callback URLs) | |

## `.env.example`
```bash
DATABASE_URL="postgresql://user:password@ep-example-pooler.region.aws.neon.tech/dbname?sslmode=require"
DIRECT_URL="postgresql://user:password@ep-example.region.aws.neon.tech/dbname?sslmode=require"

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
CLERK_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/login"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/register"

UPSTASH_REDIS_REST_URL="https://example.upstash.io"
UPSTASH_REDIS_REST_TOKEN="..."

QSTASH_URL="https://qstash.upstash.io"
QSTASH_TOKEN="..."
QSTASH_CURRENT_SIGNING_KEY="..."
QSTASH_NEXT_SIGNING_KEY="..."

APP_SECRET="generate-a-long-random-value-do-not-reuse-across-envs"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

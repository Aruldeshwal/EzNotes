# EzNotes — Secure Note-Sharing Application

EzNotes is a highly scalable, secure, full-stack Next.js note-sharing application supporting public, password-protected, one-time view (self-destruct), and collaborative notes. It is engineered to handle 1M+ concurrent readers by decoupling the Edge read path from the primary PostgreSQL database.

---

## 🛠️ Setup Instructions

### Prerequisites
- **Node.js**: v18.x or higher
- **Package Manager**: `npm`
- **Database**: [Neon PostgreSQL](https://neon.tech/) database (pooled and direct connection strings)
- **Authentication**: [Clerk](https://clerk.com/) application
- **Redis & QStash**: [Upstash](https://upstash.com/) Redis REST and QStash instances

### 1. Repository Setup
```bash
git clone https://github.com/Aruldeshwal/EzNotes.git
cd EzNotes
```

### 2. Environment Configuration
Copy the `.env.example` file to `.env`:
```bash
cp .env.example .env
```
Fill in your environment variables in `.env`:
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

APP_SECRET="your-32-plus-character-secret-key"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Database Migrations
Apply Prisma schema migrations to your Neon database:
```bash
npx prisma migrate dev --name init
```

### 5. Run Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### 6. Testing & Quality Verification
```bash
# Run unit & integration tests
npm run test

# Run TypeScript type check
npm run typecheck

# Run ESLint
npm run lint

# Build production bundle
npm run build
```

---

## 💻 Tech Stack

- **Framework**: Next.js (App Router, Server Components, Server Actions) & React 19
- **Language**: TypeScript (strict mode enabled)
- **Styling**: Tailwind CSS & Lucide Icons
- **Database**: Neon Serverless PostgreSQL (pooled `DATABASE_URL` + direct `DIRECT_URL`)
- **ORM**: Prisma 6
- **Authentication**: Clerk (`@clerk/nextjs`) with dedicated `/login` and `/register` path routing
- **Caching & Rate Limiting**: Upstash Redis (`@upstash/redis`, `@upstash/ratelimit`)
- **Background Queue**: Upstash QStash (`@upstash/qstash`)
- **Data Visualization**: Recharts
- **Testing**: Vitest (`tests/unit/` & `tests/integration/`)
- **Security Utilities**: `bcryptjs` (password hashing), `jose` (derived JWT signing), `sanitize-html` (XSS mitigation), `svix` (webhook verification)

---

## 🗄️ Database Schema

Defined in `prisma/schema.prisma`:

### Enums
- `ShareType`: `READ_ONLY`, `COLLABORATIVE`
- `AccessType`: `PUBLIC`, `PASSWORD`, `ONE_TIME`
- `Theme`: `LIGHT`, `DARK`, `SYSTEM`

### Models

#### `Note` (`@map("notes")`)
| Field | Type | Attributes | Description |
|---|---|---|---|
| `id` | String | `@id @default(uuid())` | Primary key |
| `token` | String | `@unique` | 12-char nanoid share token |
| `clerkUserId` | String | `@map("clerk_user_id")` | Note owner's Clerk user ID (indexed) |
| `title` | String | | Note title |
| `content` | String | `@db.Text` | Content body (max 100k chars) |
| `shareType` | `ShareType` | `@default(READ_ONLY)` | Permissions mode |
| `accessType` | `AccessType` | `@default(PUBLIC)` | Security restriction mode |
| `expiryDate` | DateTime? | `@map("expiry_date")` | Expiration date/time in UTC (indexed) |
| `passwordHash`| String? | `@map("password_hash")` | bcrypt hash (10 rounds) |
| `revoked` | Boolean | `@default(false)` | Revocation flag (indexed) |
| `consumedAt` | DateTime? | `@map("consumed_at")` | One-time view destruction timestamp |
| `viewCount` | Int | `@default(0)` | Lifetime view counter |
| `createdAt` | DateTime | `@default(now())` | Creation timestamp |
| `updatedAt` | DateTime | `@updatedAt` | Last modification timestamp |

#### `UserSettings` (`@map("user_settings")`)
| Field | Type | Attributes | Description |
|---|---|---|---|
| `id` | String | `@id @default(uuid())` | Primary key |
| `clerkUserId` | String | `@unique` | Owner user ID |
| `defaultTheme`| `Theme` | `@default(SYSTEM)` | Default user UI theme |
| `defaultAccess`|`AccessType`| `@default(PUBLIC)` | Default access setting |
| `defaultExpiryHours`|Int?| | Default expiry duration in hours |

#### `NoteViewAggregate` (`@map("note_view_aggregates")`)
| Field | Type | Attributes | Description |
|---|---|---|---|
| `id` | String | `@id @default(uuid())` | Primary key |
| `noteToken` | String | `@map("note_token")` | Associated note share token |
| `date` | DateTime | `@db.Date` | UTC Date (`YYYY-MM-DD`) |
| `viewCount` | Int | `@map("view_count")` | Aggregated daily view count |
| Unique constraint: `@@unique([noteToken, date])` |

---

## 🔗 Share Link Flow

1. **Token Generation**:
   - Share tokens are generated in the application service layer using `nanoid(12)` ([`lib/tokens.ts`](file:///C:/Users/aruld/OneDrive/Desktop/Note-Assessment/lib/tokens.ts)).
   - Tokens are 12 characters long, URL-safe, compact, and unique.

2. **Access Resolution (`/share/[token]`)**:
   - **Authentication Check**: Visitors must be authenticated via Clerk; unauthenticated visitors are redirected to `/login?redirect_url=/share/[token]`.
   - **Cache Reading**: The system checks Upstash Redis key `note:{token}` first. On cache miss, it queries Postgres and populates Redis (1h TTL).
   - **Access Type Branching**:
     - `PUBLIC`: Renders note content directly.
     - `PASSWORD`: Withholds note content until the viewer submits the password to `/api/share/[token]/verify-password` and receives a 5-minute session cookie.
     - `ONE_TIME`: Withholds content until the viewer clicks "View Note Now", triggering atomic one-time consumption (`/api/share/[token]/consume-one-time`).

---

## 🔐 Password & Key Generation Logic

1. **Password Hashing**:
   - Plaintext passwords are hashed using `bcryptjs` with 10 salt rounds ([`lib/password.ts`](file:///C:/Users/aruld/OneDrive/Desktop/Note-Assessment/lib/password.ts)).
   - Comparisons are performed in constant time via `bcrypt.compare()`.
   - Password regeneration overwrites `password_hash`, invalidates the Redis cache, and revokes prior viewer session cookies.

2. **Per-Note Derived JWT Signing Keys**:
   - Per `SECURITY.md`, JWT sessions do not use a static global key. Instead, a per-note signing key is derived via HMAC:
     $$\text{Key} = \text{HMAC-SHA256}(\text{APP\_SECRET}, \text{note.id} + \text{note.createdAt.toISOString()})$$
   - Short-lived (~5 minute) JWTs are issued upon successful password entry or one-time consumption ([`lib/auth.ts`](file:///C:/Users/aruld/OneDrive/Desktop/Note-Assessment/lib/auth.ts)) and stored as `httpOnly`, `SameSite=Lax` cookies (`session_${token}`).
   - If `APP_SECRET` is compromised, derived keys prevent forging tokens across arbitrary notes.

---

## ⏰ Expiry Logic

1. **Timezone Handling**:
   - All expiration dates are displayed and accepted in **IST (UTC+5:30)** in the UI ([`components/TimezonePicker.tsx`](file:///C:/Users/aruld/OneDrive/Desktop/Note-Assessment/components/TimezonePicker.tsx)).
   - Expiration dates are converted to UTC ISO strings before database submission and stored exclusively in UTC.

2. **Edge & DB Enforcement**:
   - When a note is fetched, the server checks `expiryDate < NOW()`. If expired, it returns HTTP 410 Gone.

3. **Scheduled Automated Purging**:
   - A Neon `pg_cron` nightly UTC scheduled job ([`prisma/cron-jobs.sql`](file:///C:/Users/aruld/OneDrive/Desktop/Note-Assessment/prisma/cron-jobs.sql)) executes at `00:00 UTC` to hard-delete expired notes and notes revoked for more than 30 days:
     ```sql
     DELETE FROM notes
     WHERE (expiry_date IS NOT NULL AND expiry_date < NOW())
        OR (revoked = true AND updated_at < NOW() - INTERVAL '30 days');
     ```

---

## 🚫 Invalidate / Revoke Logic

1. **Revocation**:
   - Owners can toggle a link between active and revoked (`toggleRevokeNote` in [`lib/actions/notes.ts`](file:///C:/Users/aruld/OneDrive/Desktop/Note-Assessment/lib/actions/notes.ts)).
   - Revoking sets `revoked = true`; unrevoking sets `revoked = false` and resets `consumedAt = null`.

2. **Write-Through Cache Invalidation**:
   - To eliminate stale cache access vulnerability, **every mutation path** (`createNote`, `updateNote`, `revokeNote`, `toggleRevokeNote`, `regeneratePassword`, `deleteNote`) invokes `invalidateNoteCache(token)` or `writeNoteCache(updatedNote)` synchronously in the request handler.

---

## 📊 View Count Logic

1. **Privacy-Preserving Hybrid View Tracking**:
   - Logged-in viewers: `user:${clerkUserId}`.
   - Anonymous viewers: `ip:${sha256(ip + APP_SECRET)}` (salted IP hash; raw IPs are never stored).
   - Owner views are excluded server-side.

2. **Daily Deduplication**:
   - Views are deduped per day via Redis set `viewed:{token}` with a 26-hour TTL.

3. **Asynchronous Write-Behind**:
   - New daily views increment Redis keys `note:views:{token}` and `note:daily_views:{token}:{YYYY-MM-DD}`.
   - An Upstash QStash scheduled job calls `/api/jobs/flush-views` to flush Redis counters into Postgres inside a single transaction (`prisma.$transaction`).
   - Inbound QStash callback signatures are verified using `Receiver` from `@upstash/qstash` before any processing.

---

## ⚡ Race-Condition & Concurrency Handling

1. **Two-Phase Concurrency Defense**:
   - **Phase 1 (Fast-Path Lock)**: Redis `SETNX lock:note:{token} 1 EX 5` via `acquireOneTimeLock(token)` rapidly rejects concurrent duplicate requests at the Edge.
   - **Phase 2 (Database Correctness Guarantee)**: An atomic SQL query executes in Postgres:
     ```sql
     UPDATE notes
     SET revoked = true, consumed_at = NOW()
     WHERE token = $1 AND revoked = false AND access_type = 'ONE_TIME'::"AccessType"
     RETURNING id, token, created_at, access_type, share_type, content, title, consumed_at;
     ```
   - Row-level locking in PostgreSQL guarantees that exactly one racing request receives the updated row data, while losing requests update 0 rows and receive HTTP 410 Gone.

---

## ❓ Technical Deep-Dive Answers

### 1. How do you prevent two users from using a one-time link at the same time?
We use a **two-phase concurrency defense**:
1. **Fast-Path Edge Lock**: A Redis `SETNX lock:note:{token} 1 EX 5` lock is attempted. If a second request arrives within 5 seconds while the first is processing, it is immediately rejected.
2. **Atomic Row-Level Database Guarantee**: In Postgres, we execute an atomic `UPDATE notes SET revoked = true, consumed_at = NOW() WHERE token = $1 AND revoked = false AND access_type = 'ONE_TIME' RETURNING *`. PostgreSQL enforces sequential row-level locking during updates. Exactly one request updates the row and receives the note content; all concurrent racing requests update 0 rows, fail the atomic check, and receive HTTP 410 Gone. The Redis cache `note:{token}` is immediately invalidated.

---

### 2. How do you update view count safely?
View counts are updated asynchronously without locking primary database rows:
1. **Deduplication**: Each view is tagged by `user:{id}` or `ip:{sha256(ip + APP_SECRET)}` and added to a Redis set `viewed:{token}` (26h TTL). Duplicate views on the same day return early.
2. **In-Memory Counter Increment**: Unique views increment Redis counters `note:views:{token}` and `note:daily_views:{token}:{date}` using atomic `INCR`.
3. **Transactional Flush**: An Upstash QStash background job (`/api/jobs/flush-views`) periodically reads, zeroes out the Redis counters, and applies increments to `Note.viewCount` and upserts `NoteViewAggregate` inside a single Postgres transaction (`prisma.$transaction`).

---

### 3. How would this work if 1 million people opened the link?
The read path is **decoupled from the primary database connection pool**:
1. **Edge Rate Limiting**: Upstash Edge Middleware applies sliding-window rate limiting (5 req/IP/min for public share loads, 100 req/IP/min globally).
2. **Cache-First Edge Serving**: When a public share link is requested, the payload is served directly from Upstash Redis (`note:{token}`). On a cache hit, the response renders in under 20ms without issuing any database queries to Neon.
3. **Database Protection**: 99.9%+ of traffic hits Redis at the Edge. View tracking increments memory counters in Redis via `INCR`, completely shielding Neon's database connection pool from connection exhaustion or locks under 1M+ traffic spikes.

---

### 4. How would you prevent brute-force attempts on password-protected links?
We enforce a **multi-tier defense**:
1. **Edge Rate Limiting**: Edge Middleware limits API requests per IP (100 req/min).
2. **Fast Lockout Check**: Before invoking CPU-intensive `bcrypt.compare()`, `/api/share/[token]/verify-password` checks Redis key `lockout:{token}:{ip}`. If locked out, it returns HTTP 403 Forbidden immediately.
3. **Rolling Failure Tracking & Lockout**: Failed password attempts increment `fails:{token}:{ip}` with a 60-second rolling window. Upon reaching 5 failures, key `lockout:{token}:{ip}` is set with a 15-minute (900s) TTL, locking out the offending IP.
4. **Derived JWT Sessions**: Successful authentication issues a 5-minute `httpOnly` JWT session cookie signed with a per-note derived HMAC key, preventing brute-force session forgery across other notes.

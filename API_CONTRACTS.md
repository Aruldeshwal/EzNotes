# API Contracts

Per `CodeStandards.md`: Server Actions for authenticated-dashboard mutations, Route Handlers for `/share/[token]` mutations and external integrations.

## Server Actions (`lib/actions/`)

| Action               | Input                                                                       | Returns                                                                                                                                                        |
| -------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createNote`         | `{ title, content, shareType, accessType, expiryDate?, password? }`         | `ActionResult<Note>`                                                                                                                                           |
| `updateNote`         | `{ id, title?, content?, shareType?, accessType?, expiryDate?, password? }` | `ActionResult<Note>` — must verify `clerkUserId` ownership before writing, and must invalidate `note:{token}` in Redis (see `architecture.md` §5.2)            |
| `revokeNote`         | `{ id }`                                                                    | `ActionResult<Note>` — sets `revoked = true`, invalidates cache                                                                                                |
| `toggleRevokeNote`   | `{ id }`                                                                    | `ActionResult<Note>` — toggles `revoked` boolean state and resets `consumedAt` if unrevoking                                                                   |
| `deleteNote`         | `{ id }`                                                                    | `ActionResult<{ id: string }>` — permanently deletes note and associated analytics, invalidates Redis cache                                                    |
| `regeneratePassword` | `{ id }`                                                                    | `ActionResult<{ plaintext: string }>` — plaintext returned once, never persisted; invalidates cache and any existing password-verified sessions for this token |
| `getUserNotes`       | none                                                                        | `ActionResult<Note[]>` — retrieves user's notes with real-time pending Redis views merged                                                                      |
| `updateUserSettings` | `{ defaultTheme?, defaultAccess?, defaultExpiryHours? }`                    | `ActionResult<UserSettings>`                                                                                                                                   |
| `getUserSettings`    | none                                                                        | `ActionResult<UserSettings \| null>`                                                                                                                           |

All Server Actions re-check the Clerk session server-side — never trust a client-supplied `clerkUserId`.

## Route Handlers (`app/api/`)

### `POST /api/share/[token]/verify-password`

- **Body:** `{ password: string }`
- **Checks:** `lockout:{token}:{ip}` first, then `bcrypt.compare()`.
- **Response:** `200` + sets an httpOnly session cookie on success; `401` on wrong password; `403` if locked out.

### `POST /api/share/[token]/consume-one-time`

- **Body:** none.
- **Response:** `200` + issues the one-time JWT (httpOnly cookie) on the winning request; `410` for every subsequent request against the same token.

### `PATCH /api/share/[token]/content`

- **Body:** `{ content: string }`
- **Auth:** valid password-session cookie, one-time JWT, or (for public collaborative notes) no auth required — access-type-dependent, see `architecture.md` §5.5.
- **Response:** `200` on success; writes through to Redis immediately, queues a QStash message for the Postgres write.

### `GET /api/share/[token]`

- Used by the collaborative-editing poll (§5.5). Returns the current cached payload — same read path as the page itself, just as JSON instead of a rendered page.

### `POST /api/webhooks/clerk`

- Verifies Clerk's signing secret. Handles `user.deleted` → purges/anonymizes that user's notes.

### `POST /api/jobs/flush-views`

- Verifies the QStash signature header. Reads and zeroes the pending Redis view counters, upserts `NoteViewAggregate` and increments `Note.viewCount` in a single Postgres transaction.

### `GET /api/notes/[id]/analytics`

- **Auth:** Server Action-equivalent ownership check (Clerk session + `clerkUserId` match).
- **Response:** daily/weekly aggregate series for the Recharts components in `UI.md`.

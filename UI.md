## Global Interface
*   **Theme:** Tailwind-based configuration supporting system, light, and dark modes. State persisted via cookie to prevent hydration mismatch.
*   **Layout:** Sidebar/Top-nav shell for authenticated `/notes` dashboard.
*   **Loading:** Route-level `loading.tsx` skeletons for `/notes`, `/notes/[id]`, and `/share/[token]` — never a blank white screen while a Server Component awaits data.
*   **Errors:** Route-level `error.tsx` boundaries per section so an analytics-chart failure, for example, doesn't take down the whole dashboard.

## Pages & Components

### Dashboard (`/notes`)
*   **Notes Sub-component:** Data table/grid displaying owned notes. Columns: Title, Share Type, Access Type, Expiry (IST), Status (Active/Revoked), Total Views.
    *   **Empty state:** first-run illustration + "Create your first note" CTA when the owner has zero notes.
    *   **Keyboard/accessibility:** rows are focusable and actionable via keyboard (Enter to open, Delete key triggers a confirm dialog, not an immediate delete).
*   **Settings Sub-component:** Global form mapping to `UserSettings` table. Controls default access type, theme, and default expiry.
*   **Analytics Sub-component:** Recharts integration.
    *   Bar chart: Daily views over the past 7 days.
    *   Line chart: Weekly view trends.
    *   Aggregated metrics cards: Total lifetime views, highest performing note.
    *   **Empty state:** if a note has zero views, show "No views yet" rather than an empty/broken chart.

### Editor (`/notes/new` & `/notes/[id]`)
*   **Content Area:** Textarea or rich-text boundary supporting up to 100,000 characters, with a live character counter that turns warning-color past 95,000.
*   **Configuration Panel:**
    *   Access Type dropdown (`Public` / `Password` / `One-Time`).
    *   Share Type dropdown (`Read-Only` / `Collaborative`) — reflects the merged `ShareType` enum, see `architecture.md`.
    *   Expiration date/time picker. Displays and accepts **IST**; converted to UTC before being sent to the server (see `architecture.md` §8).
*   **Password UI:** "Generate Password" button. Renders plaintext conditionally with a "Copy" button.
    *   Plaintext is held only in local component state — never written to `localStorage`/`sessionStorage` — and is cleared from state on unmount or on navigating away, not just "dropped from the DOM" as a side effect of unmount.
    *   Regenerating a password immediately invalidates the previous one (old `passwordHash` is overwritten; a confirm dialog warns the owner that anyone with the old password loses access).
*   **Autosave:** editing an existing note debounces 2000ms before firing the update — same debounce contract as collaborative share-view edits, for consistency (see `CodeStandards.md`).

### Share Viewer (`/share/[token]`)
⚠️ **Fixed:** the original spec had `<SignedIn>` as a mandatory wrapper around this entire route, which would make every share link require the *viewer* to have a Clerk account — contradicting "publicly shareable" in `ProjectOverview.md`. Corrected spec below.

*   **Auth Boundary:** the page renders for anyone with the link, signed in or not. Clerk's session (if present) is read only to detect the owner and to attribute collaborative edits to a name instead of "Anonymous."
*   **State machine** (✅ added — the original doc only described the password gateway; here are the rest of the states the page actually needs to handle):
    *   **Loading:** skeleton while the Server Component resolves the cache/DB read.
    *   **Not found (`404`):** invalid or malformed token.
    *   **Gone (`410`):** `revoked = true` — distinct messaging for "this one-time note has already been viewed" vs. "the owner revoked this link," using `consumedAt` to tell them apart.
    *   **Expired:** `expiry_date` in the past — distinct from "revoked," with its own copy ("This note expired on [date]").
    *   **Password Gateway:** if `access_type === PASSWORD` and no valid session cookie yet, render the password input form. `401` on a wrong password; `403` with a countdown if the IP is locked out (see `SECURITY.md`).
    *   **Content view:** if `is_collaborative`-equivalent (`shareType === COLLABORATIVE`) and the viewer holds a valid session (password-verified, or a one-time JWT, or is a returning collaborator), render the editable UI. Otherwise render read-only prose.
*   **Rendering safety:** note content is rendered as plain text or sanitized Markdown only — never raw HTML — since this route is, by design, reachable by anyone with a URL (see `SECURITY.md`).

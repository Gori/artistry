# Artistry Codebase Review

A comprehensive code review of the Artistry codebase -- a songwriting and music production workspace application built with Next.js, Convex, and React.

**Date:** March 2026

---

## P0 -- Security

### 1. No auth on any API route

`/api/upload`, `/api/upload/audio`, `/api/upload/logic-blob`, `/api/ai/lyrics`, `/api/ai/rhyme` all accept anonymous requests. Any unauthenticated user can upload files or burn Anthropic API credits.

**Fix:** Validate Convex auth token or session cookie in each route handler.

### 2. Missing workspace membership checks

Several Convex mutations/queries (`references.update`, `references.remove`, `lyricsSnapshots.get`, `logicDiffs.getByVersions`) let any authenticated user access any record by ID without verifying they belong to the same workspace.

**Fix:** Add workspace membership verification to every mutation/query that operates on workspace-scoped data.

### 3. Share tokens use `Math.random()`

`convex/shareLinks.ts` line ~8 generates share tokens with `Math.random()`, which is not cryptographically secure and can be predicted.

**Fix:** Use `crypto.getRandomValues()` or a server-side CSPRNG.

### 4. XSS via `innerHTML`

The AI widget injects `marked.parse()` output unsanitized via `innerHTML` (`lib/codemirror/ai-widget.ts` lines ~120-122 and ~192-194). If the AI model returns malicious HTML, it could execute in the user's browser.

**Fix:** Use DOMPurify or a safe markdown renderer.

### 5. Client-trusted SHA-256

Logic blob upload (`app/api/upload/logic-blob/route.ts`) accepts the content hash from the client without server-side verification. A malicious client could submit an incorrect hash to cause collision attacks on content-addressed storage.

**Fix:** Compute SHA-256 server-side from the uploaded bytes.

### 6. Electron stores auth tokens in plaintext

`apps/electron/src/main/services/convex-client.ts` lines ~9 and ~26 store auth tokens without encryption.

**Fix:** Use Electron's `safeStorage` API or the OS keychain.

### 7. Hardcoded Convex production URL in source

`apps/electron/src/main/services/convex-client.ts` line ~7 has a hardcoded production URL.

**Fix:** Use environment variables or build-time configuration.

### 8. No input validation / file size limits

No MIME type checking, no file size limits on any upload route. An attacker could upload arbitrarily large files.

**Fix:** Add Content-Length limits, MIME type allowlists, and file extension validation.

### 9. No rate limiting on the AI lyrics route

Burns Anthropic credits without any throttling.

**Fix:** Add rate limiting per user/IP.

---

## P1 -- Bugs

### 1. Incomplete cascade delete

`songs.remove` deletes the song record but orphans related records: lyrics, notes, songVersions, audioNotes, shareLinks, references, lyricsSnapshots, versionMarkers.

**Fix:** Delete all related records in the same mutation, or use a scheduled cleanup job.

### 2. Electron `users:viewer` query doesn't exist

`convex-client.ts` line ~136 queries `users:viewer` but the actual query name is `users:current`. This means the Electron app's auth check always fails.

**Fix:** Update to `users:current`.

### 3. Image paste placeholder collision

Two rapid image pastes in the editor can replace the wrong placeholder because the placeholder text uses a simple counter (`lib/codemirror/image-paste.ts` lines ~80-83).

**Fix:** Use UUIDs for placeholder identifiers.

### 4. Arrangement diff `scrollRef` shared across lanes

In `components/logic/arrangement-diff.tsx` line ~235 and ~384, only the last lane gets a working scroll ref because the same ref is reassigned in a loop.

**Fix:** Use a ref map keyed by lane index.

### 5. `try/finally` without `catch`

In `board.tsx`, `workspaces/page.tsx`, `comments-panel.tsx`, and `review-panel.tsx`, `try/finally` blocks silently swallow errors. The user sees optimistic UI revert but gets no error feedback.

**Fix:** Add `catch` blocks with toast notifications.

### 6. Non-null assertion on optional `workspace.slug`

`workspace/[workspace]/page.tsx` line ~48 uses `!` on a potentially undefined value.

**Fix:** Add a null check or default value.

---

## P2 -- Performance

### 1. N+1 user lookups

`songVersions.ts`, `logicProjectVersions.ts`, `logicComments.ts`, `logicReviews.ts`, and `workspaces.ts` each fetch the user record individually inside a loop.

**Fix:** Batch user lookups or use Convex's `Promise.all` pattern.

### 2. Full table scan

`workspaces.addMember` does `ctx.db.query("users").collect()` to find a user by email, loading every user into memory.

**Fix:** Add an index on the `email` field and use `.withIndex()`.

### 3. No-op middleware

`middleware.ts` runs on every request but does nothing (just calls `next()`).

**Fix:** Remove it or add actual logic (e.g., auth checks, redirects).

### 4. Unbounded in-memory caches

Waveform peaks and rhyme results are cached in module-level Maps with no size limit or LRU eviction. In a long session, memory grows without bound.

**Fix:** Use an LRU cache with a max size.

### 5. Unbounded `.collect()`

Multiple queries load entire tables without `.take()` limits.

**Fix:** Add reasonable limits or pagination.

### 6. Missing `next.config.ts` remote patterns

No `images.remotePatterns` configured for Vercel Blob or R2 domains, which means `next/image` optimization won't work for uploaded images.

**Fix:** Add remote patterns for both domains.

### 7. Chord overlay + syllable counter rebuild on every change

CodeMirror decorations are rebuilt for the entire document on every keystroke.

**Fix:** Use incremental decoration updates or debounce.

---

## P3 -- Code Quality

### 1. `formatBytes` duplicated in 6 files

The function is already exported from `@artistry/ui` but re-implemented in multiple components.

**Fix:** Import from the shared package.

### 2. `timeAgo` duplicated

`formatTimeAgo` exists in `lib/format-time.ts` but is re-implemented elsewhere.

**Fix:** Consolidate to one implementation.

### 3. `SECTION_COLORS` duplicated in 3 files

The section color mapping is copied across `lyrics-editor.tsx`, `structure-outline.tsx`, and `writing-analytics.tsx`.

**Fix:** Extract to a shared constant.

### 4. Dead code

Empty workspace layout (`workspace/[workspace]/layout.tsx`), re-export-only `use-lyrics-ai.ts`, re-export-only `lib/utils.ts`.

**Fix:** Remove dead files or add meaningful content.

### 5. `window.prompt()` used for adding references

`notes-panel.tsx` uses `window.prompt()` for URL input, which is ugly and blocks the UI thread.

**Fix:** Use a proper dialog component.

### 6. No test infrastructure

Zero tests, no test framework configured.

**Fix:** Set up Vitest for unit/integration tests and Playwright for E2E.

### 7. Stale root files

`next-env.d.ts`, `tsconfig.tsbuildinfo`, and an empty `convex/` directory remain at root from the pre-monorepo structure.

**Fix:** Clean up or add to `.gitignore`.

### 8. `puppeteer` in devDeps

Appears unused (no test or script references it).

**Fix:** Remove it.

---

## P4 -- Schema/Data

### 1. Missing indexes

`logicReviews` needs a `by_reviewer` index; `songs` would benefit from a `by_group` index.

**Fix:** Add indexes to `schema.ts`.

### 2. `lyricsSnapshots` grow unbounded

Every auto-save creates a snapshot with no cleanup or TTL.

**Fix:** Add a retention policy (e.g., keep last N per song, or older than X days).

### 3. `logicProcessingJobs` never cleaned up

Completed or failed jobs remain in the table forever.

**Fix:** Add a scheduled cleanup or archive mechanism.

### 4. No unique constraint on workspace slug

Two workspaces could race to create the same slug.

**Fix:** Add a unique index and handle conflicts.

### 5. Incomplete timestamp fields

`tags`, `references`, and `logicBlobs` tables lack `updatedAt` fields, making change tracking difficult.

**Fix:** Add `updatedAt` with auto-update on mutation.

---

## P5 -- Accessibility

1. Context menus lack ARIA roles and keyboard navigation.
2. Teleprompter has no focus management or focus trap.
3. Icon-only buttons throughout the app are missing `aria-label` attributes.
4. Tag color picker has no accessible labels for color options.
5. Structure outline drag-and-drop is not keyboard accessible.
6. Writing analytics toggle is missing `aria-expanded` attribute.

---

## Feature Suggestions

### High Value / Low Effort

- **Song export** -- Export lyrics as PDF or plain text.
- **Replace `window.prompt()`** -- Use proper Shadcn dialog components for all user input.
- **Full-text search** -- Add Convex search indexes and integrate with the existing command palette.

### Medium Value / Medium Effort

- **Error boundaries** -- Add React error boundaries at root and per-panel level.
- **Loading skeletons** -- Add skeleton UI for kanban board and song detail views.
- **Offline connection indicator** -- Show a banner when the Convex connection drops.
- **Lyrics diff** -- Show a diff between a version snapshot and the current lyrics.

### Longer-Term

- **Real-time collaboration cursors** -- Show other users' cursor positions in the lyrics editor.
- **Mobile-responsive layout** -- Currently desktop-only; add responsive breakpoints.
- **Song templates** -- Pre-built song structures (verse/chorus/bridge).
- **Lyrics version branching** -- Branch lyrics from any snapshot to explore alternatives.

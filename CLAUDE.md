# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Dev server:** `pnpm dev` (Next.js) + `npx convex dev` (Convex backend, run from `apps/web/`)
- **Dev server port:** Next.js runs on port 3003 (configured in `package.json`)
- **Deploy Convex once:** `cd apps/web && npx convex dev --once`
- **Build:** `pnpm build`
- **Lint:** `pnpm lint`
- **Electron dev:** `cd apps/electron && pnpm dev`

Package manager is **pnpm**. This is a monorepo with pnpm workspaces.

Note: Convex env vars (JWT_PRIVATE_KEY, JWKS, SITE_URL, OPENAI_API_KEY) are set in the Convex dashboard, not in `.env.local`.

## Monorepo Structure

- `apps/web/` — Next.js web application (`@artistry/web`)
- `apps/electron/` — Electron native app (`@artistry/electron`, Phase 3)
- `packages/shared/` — Shared types and utilities (`@artistry/shared`)

Root `pnpm-workspace.yaml` defines workspace packages. Root scripts proxy to `@artistry/web`.

## Architecture

Next.js 16 app using the App Router (`apps/web/app/` directory), React 19, TypeScript, Tailwind CSS v4, Convex (database, auth, real-time, file storage), and Shadcn/ui components.

### Route Structure

- `apps/web/app/layout.tsx` — Root layout with Geist fonts, wrapped in `<Providers>`
- `apps/web/app/(auth)/login/page.tsx` — Email/password sign-in/sign-up
- `apps/web/app/(app)/layout.tsx` — Authenticated shell (redirects to /login if not authed)
- `apps/web/app/(app)/page.tsx` — Redirects to first workspace or /workspaces
- `apps/web/app/(app)/workspaces/page.tsx` — Workspace picker + create dialog
- `apps/web/app/(app)/workspace/[workspace]/layout.tsx` — Workspace layout (currently a passthrough)
- `apps/web/app/(app)/workspace/[workspace]/page.tsx` — Kanban board
- `apps/web/app/(app)/workspace/[workspace]/[song]/page.tsx` — Song detail view (4 tabs: Lyrics, Notes, Versions, Audio Notes)
- `apps/web/app/(app)/workspace/[workspace]/logic/page.tsx` — Logic Pro projects list
- `apps/web/app/(app)/workspace/[workspace]/logic/[project]/page.tsx` — Logic Pro project detail
- `apps/web/app/share/[token]/page.tsx` — Public read-only shared song

### Backend (Convex)

- `apps/web/convex/schema.ts` — Database schema (authTables + workspaces, songs, lyrics, notes, songVersions, audioNotes, shareLinks, logicProjects, logicProjectVersions, logicBlobs, logicDiffs, logicComments, logicReviews, logicProcessingJobs)
- `apps/web/convex/auth.ts` — Password auth via @convex-dev/auth with custom profile (name + email)
- `apps/web/convex/auth.config.ts` — Auth provider config (CONVEX_SITE_URL domain)
- `apps/web/convex/http.ts` — HTTP router with auth routes
- `apps/web/convex/users.ts`, `workspaces.ts`, `songs.ts`, `lyrics.ts`, `notes.ts` — CRUD functions
- `apps/web/convex/songVersions.ts`, `audioNotes.ts` — Audio file management (stores Cloudflare R2 URLs)
- `apps/web/convex/logicProjects.ts`, `logicBlobs.ts`, `logicProjectVersions.ts` — Logic Pro versioning CRUD
- `apps/web/convex/logicProcessing.ts` — Diff computation pipeline
- `apps/web/convex/transcription.ts` — OpenAI Whisper transcription (`"use node"` action)
- `apps/web/convex/shareLinks.ts` — Public share link management (32-char random token, no auth for reading)

### Frontend Components

- `apps/web/components/providers.tsx` — ConvexAuthProvider + ThemeProvider + Toaster
- `apps/web/components/kanban/` — board.tsx, column.tsx, card.tsx (DnD Kit with fractional positioning)
- `apps/web/components/song/` — detail-view, song-header, lyrics-editor, notes-panel, versions-panel, audio-notes-panel, share-dialog, shared-view
- `apps/web/components/audio/` — upload.tsx (Vercel Blob upload), player.tsx (custom audio player)
- `apps/web/components/logic/` — project-list, project-card, create-project-dialog, project-detail, version-timeline, diff-panel
- `apps/web/components/workspace/` — settings.tsx (members, invite, sign out)
- `apps/web/components/ui/` — Shadcn/ui components (button has extra sizes: icon-xs, xs)

Path alias `@/*` maps to `apps/web/` root for imports.

## Shared Packages

- `@artistry/shared` (`packages/shared/`) — Logic Pro manifest types, diff computation types
- `@artistry/ui` (`packages/ui/`) — `cn()` utility, `formatBytes()`, shared Shadcn component primitives
- `@artistry/navigation` (`packages/navigation/`) — Cross-platform routing abstraction (wraps Next.js router for web, custom nav for Electron)
- `@artistry/platform` (`packages/platform/`) — Cross-platform file upload abstraction

## Import Patterns

- Import `cn` from `@artistry/ui` (not from `@/lib/utils`)
- Import `formatBytes` from `@artistry/ui` (do not re-implement)
- Import `formatTimeAgo` from `@/lib/format-time` (do not duplicate)
- `SECTION_COLORS` should be defined once and imported (currently duplicated in lyrics-editor, structure-outline, writing-analytics)

## Styling

Tailwind CSS v4 via `@tailwindcss/postcss`. Dark mode uses `.dark` class (configured via next-themes). Shadcn/ui zinc theme with oklch colors in `globals.css`.

## Auth

Email/password auth via `@convex-dev/auth` Password provider. Login form sends `FormData` with fields: `email`, `password`, `name` (sign-up only), `flow` (hidden: "signIn" or "signUp"). Convex env vars required: `JWT_PRIVATE_KEY`, `JWKS` (matched RSA256 pair), `SITE_URL`.

## Environment Variables

### `.env.local` (apps/web)
- `BLUB_READ_WRITE_TOKEN` — Vercel Blob storage token (intentional naming, not a typo)
- `R2_ACCESS_KEY_ID` — Cloudflare R2 access key
- `R2_SECRET_ACCESS_KEY` — Cloudflare R2 secret key
- `R2_BUCKET_NAME` — R2 bucket name
- `R2_ACCOUNT_ID` — Cloudflare account ID
- `ANTHROPIC_API_KEY` — For AI lyrics generation
- `CONVEX_DEPLOYMENT` — Convex deployment identifier
- `NEXT_PUBLIC_CONVEX_URL` — Convex public URL (used client-side)

### Convex Dashboard
- `JWT_PRIVATE_KEY` / `JWKS` — RSA256 key pair for auth
- `SITE_URL` — Must match `CONVEX_SITE_URL` domain
- `OPENAI_API_KEY` — For Whisper transcription (used in Node.js action)

## Key Patterns

- All data pages are client components using Convex `useQuery` for real-time subscriptions
- Lyrics/notes use debounced auto-save (500ms) with upsert pattern
- Kanban uses fractional position indexing for drag-and-drop
- Image uploads go to `/api/upload` (Vercel Blob), which returns a permanent public URL stored directly in the database
- Audio files and Logic Pro blobs are stored in **Cloudflare R2** (via `/api/upload/audio` and `/api/upload/logic-blob`)
- Logic Pro blob uploads use SHA-256 content-addressed dedup
- Share links use 32-char random tokens for public read-only access
- Auth guard in `(app)/layout.tsx` redirects to /login via useEffect + useRouter

## Testing

No test framework is configured yet. Recommended setup:
- **Unit/integration:** Vitest
- **E2E:** Playwright
- **Convex functions:** Convex test framework (`convex-test`)

## Known Issues & Pitfalls

- **API routes are unauthenticated** — `/api/upload`, `/api/upload/audio`, `/api/upload/logic-blob`, `/api/ai/lyrics`, `/api/ai/rhyme` accept anonymous requests
- **Incomplete cascade delete** — `songs.remove` orphans lyrics, notes, songVersions, audioNotes, shareLinks, references, lyricsSnapshots, versionMarkers
- **Electron `users:viewer` bug** — Should be `users:current`; auth check always fails
- **Share tokens use `Math.random()`** — Not cryptographically secure
- **Missing workspace membership checks** — Several mutations let any authed user access any record by ID
- **No test framework** — Zero tests exist; recommend Vitest + Playwright

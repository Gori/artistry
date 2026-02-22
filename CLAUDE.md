# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Dev server:** `pnpm dev` (Next.js) + `npx convex dev` (Convex backend)
- **Deploy Convex once:** `npx convex dev --once`
- **Build:** `pnpm build`
- **Lint:** `pnpm lint`

Package manager is **pnpm**.

## Architecture

Next.js 16 app using the App Router (`/app` directory), React 19, TypeScript, Tailwind CSS v4, Convex (database, auth, real-time, file storage), and Shadcn/ui components.

### Route Structure

- `/app/layout.tsx` — Root layout with Geist fonts, wrapped in `<Providers>`
- `/app/(auth)/login/page.tsx` — Email/password sign-in/sign-up
- `/app/(app)/layout.tsx` — Authenticated shell (redirects to /login if not authed)
- `/app/(app)/page.tsx` — Redirects to first workspace or /workspaces
- `/app/(app)/workspaces/page.tsx` — Workspace picker + create dialog
- `/app/(app)/[workspaceId]/page.tsx` — Kanban board
- `/app/(app)/[workspaceId]/songs/[songId]/page.tsx` — Song detail view (4 tabs: Lyrics, Notes, Versions, Audio Notes)
- `/app/share/[token]/page.tsx` — Public read-only shared song

### Backend (Convex)

- `/convex/schema.ts` — Database schema (authTables + workspaces, songs, lyrics, notes, songVersions, audioNotes, shareLinks)
- `/convex/auth.ts` — Password auth via @convex-dev/auth with custom profile (name + email)
- `/convex/auth.config.ts` — Auth provider config (CONVEX_SITE_URL domain)
- `/convex/http.ts` — HTTP router with auth routes
- `/convex/users.ts`, `workspaces.ts`, `songs.ts`, `lyrics.ts`, `notes.ts` — CRUD functions
- `/convex/songVersions.ts`, `audioNotes.ts` — Audio file management (stores Vercel Blob URLs)
- `/convex/transcription.ts` — OpenAI Whisper transcription (`"use node"` action)
- `/convex/shareLinks.ts` — Public share link management (32-char random token, no auth for reading)

### Frontend Components

- `/components/providers.tsx` — ConvexAuthProvider + ThemeProvider + Toaster
- `/components/kanban/` — board.tsx, column.tsx, card.tsx (DnD Kit with fractional positioning)
- `/components/song/` — detail-view, song-header, lyrics-editor, notes-panel, versions-panel, audio-notes-panel, share-dialog, shared-view
- `/components/audio/` — upload.tsx (Vercel Blob upload), player.tsx (custom audio player)
- `/components/workspace/` — settings.tsx (members, invite, sign out)
- `/components/ui/` — Shadcn/ui components (button has extra sizes: icon-xs, xs)

Path alias `@/*` maps to the project root for imports.

## Styling

Tailwind CSS v4 via `@tailwindcss/postcss`. Dark mode uses `.dark` class (configured via next-themes). Shadcn/ui zinc theme with oklch colors in `globals.css`.

## Auth

Email/password auth via `@convex-dev/auth` Password provider. Login form sends `FormData` with fields: `email`, `password`, `name` (sign-up only), `flow` (hidden: "signIn" or "signUp"). Convex env vars required: `JWT_PRIVATE_KEY`, `JWKS` (matched RSA256 pair), `SITE_URL`.

## Key Patterns

- All data pages are client components using Convex `useQuery` for real-time subscriptions
- Lyrics/notes use debounced auto-save (500ms) with upsert pattern
- Kanban uses fractional position indexing for drag-and-drop
- File uploads go to `/api/upload` (Vercel Blob), which returns a permanent public URL stored directly in the database
- Share links use 32-char random tokens for public read-only access
- Auth guard in `(app)/layout.tsx` redirects to /login via useEffect + useRouter

# Artistry

Song management for creative teams. Organize songs through stages, collaborate with workspace members, and keep lyrics, notes, audio versions, and voice memos in one place.

## Features

- **Kanban board** — Drag-and-drop songs through stages (Idea, Writing, Producing, Mixing, Done)
- **Lyrics editor** — Markdown-based with debounced auto-save
- **Notes** — Rich text notes with image support (paste or drag images)
- **Song versions** — Upload and play back audio versions of a song
- **Audio notes** — Record or upload voice memos with automatic transcription (OpenAI Whisper)
- **Workspaces** — Invite collaborators and manage access
- **Share links** — Generate public read-only links to share songs externally
- **Apple Notes import** — Pull in notes, images, and audio from Apple Notes
- **Dark mode** — System-aware theme switching

## Tech Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Backend:** Convex (database, auth, real-time subscriptions)
- **Styling:** Tailwind CSS v4, Shadcn/ui
- **File storage:** Vercel Blob
- **Auth:** Email/password via @convex-dev/auth
- **AI:** OpenAI Whisper (transcription), Anthropic Claude (lyrics assistance)
- **Drag & drop:** DnD Kit

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- A [Convex](https://convex.dev) project
- A [Vercel](https://vercel.com) project with Blob storage connected

### Environment Variables

Create a `.env.local` file:

```env
# Convex
CONVEX_DEPLOYMENT=<your-convex-deployment>
NEXT_PUBLIC_CONVEX_URL=<your-convex-url>

# Convex Auth (set in Convex dashboard)
# JWT_PRIVATE_KEY, JWKS, SITE_URL

# Vercel Blob
BLOB_READ_WRITE_TOKEN=<your-blob-token>

# OpenAI (set in Convex dashboard for transcription)
# OPENAI_API_KEY
```

### Install & Run

```bash
pnpm install

# Start both the Next.js dev server and Convex backend
pnpm dev
npx convex dev
```

### Build

```bash
pnpm build
```

## Project Structure

```
app/
  (auth)/login/       — Sign in / sign up
  (app)/              — Authenticated routes
    workspaces/       — Workspace picker
    workspace/[id]/   — Kanban board
    workspace/[id]/[song]/ — Song detail (Lyrics, Notes, Versions, Audio Notes)
  share/[token]/      — Public shared song view
  api/upload/         — Vercel Blob file upload endpoint
convex/               — Backend functions & schema
components/
  kanban/             — Board, column, card
  song/               — Song detail panels
  audio/              — Upload & playback
  import/             — Apple Notes import
  ui/                 — Shadcn/ui primitives
```

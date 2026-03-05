# Artistry

A songwriting and music production workspace for capturing ideas, writing lyrics, managing audio recordings, and tracking Logic Pro project versions — all in one place.

## Features

- **Lyrics Editor** — Rich text editor built on CodeMirror 6 with chord notation overlay, syllable counting, rhyme detection, and section highlighting
- **AI Lyrics Assistant** — Inline AI-powered writing assistance using Anthropic Claude — rewrite, extend, or generate lyrics with context-aware prompts
- **Rhyme Suggestions** — Real-time rhyme lookup integrated into the editor with a popup interface
- **Song Structure Outline** — Visual overview of song sections (verse, chorus, bridge, etc.) with drag-and-drop reordering
- **Writing Analytics** — Word count, section breakdown, rhyme density, and syllable statistics
- **Kanban Board** — Organize songs by status (Idea, Writing, Recording, Mixing, Done) with drag-and-drop, fractional position indexing, and tag filtering
- **Audio Versions** — Upload and manage multiple audio recordings per song with a custom waveform player, A/B comparison playback, and version notes
- **Audio Notes** — Record voice memos with microphone, auto-transcribed via OpenAI Whisper, timestamped to specific moments
- **Persistent Audio Player** — Global audio player that persists across page navigation
- **Logic Pro Integration** — Upload, version, and diff Logic Pro project files with arrangement lane visualization, track comparison, and plugin change tracking
- **Teleprompter Mode** — Full-screen auto-scrolling lyrics display for performance or recording sessions
- **Focus Mode** — Distraction-free writing environment
- **Sharing** — Generate public read-only links for songs with a single click
- **Command Palette** — Quick access to all actions via `Cmd+K`
- **Workspaces** — Multi-workspace support with member management
- **Keyboard Shortcuts** — Comprehensive shortcuts for all common actions

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| UI | React 19, Tailwind CSS v4, Shadcn/ui |
| Editor | CodeMirror 6 |
| Database & Auth | Convex (real-time, serverless) |
| Image Storage | Vercel Blob |
| Audio & File Storage | Cloudflare R2 |
| AI | Anthropic Claude (lyrics), OpenAI Whisper (transcription) |
| Desktop | Electron |
| Package Manager | pnpm (workspaces) |

## Monorepo Structure

```
artistry/
├── apps/
│   ├── web/              # Next.js web application (@artistry/web)
│   │   ├── app/          # App Router pages and API routes
│   │   ├── components/   # React components
│   │   ├── convex/       # Convex backend (schema, mutations, queries)
│   │   ├── hooks/        # Custom React hooks
│   │   └── lib/          # Shared utilities and helpers
│   └── electron/         # Electron desktop app (@artistry/electron)
│       ├── src/main/     # Main process
│       └── src/renderer/ # Renderer (loads web app)
├── packages/
│   ├── shared/           # Shared types (@artistry/shared)
│   ├── ui/               # Shared UI utilities (@artistry/ui)
│   ├── navigation/       # Cross-platform routing (@artistry/navigation)
│   └── platform/         # Cross-platform abstractions (@artistry/platform)
└── docs/                 # Documentation
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- A Convex account ([convex.dev](https://convex.dev))

### Environment Variables

Create `apps/web/.env.local`:

```env
# Convex
CONVEX_DEPLOYMENT=your-deployment-id
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud

# Vercel Blob (image uploads)
BLUB_READ_WRITE_TOKEN=your-vercel-blob-token

# Cloudflare R2 (audio + Logic Pro files)
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET_NAME=your-bucket-name
R2_ACCOUNT_ID=your-account-id

# Anthropic (AI lyrics)
ANTHROPIC_API_KEY=your-anthropic-key
```

Set these in the **Convex dashboard** (not in `.env.local`):

```
JWT_PRIVATE_KEY=...
JWKS=...
SITE_URL=...
OPENAI_API_KEY=...   # For Whisper transcription
```

### Installation

```bash
pnpm install
```

### Development

```bash
# Start the Next.js dev server (runs on port 3003)
pnpm dev

# In a separate terminal, start Convex
cd apps/web && npx convex dev
```

### Build

```bash
pnpm build
```

### Electron

```bash
cd apps/electron && pnpm dev
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+K` | Open command palette |
| `Cmd+S` | Save current document |
| `Cmd+B` | Toggle bold text |
| `Cmd+I` | Toggle italic text |
| `Cmd+Shift+F` | Toggle focus mode |
| `Cmd+Shift+T` | Open teleprompter |
| `Cmd+Enter` | Accept AI suggestion |
| `Escape` | Close dialogs / exit modes |
| `Cmd+/` | Show keyboard shortcuts |

## Architecture

### Data Flow

All data is stored in Convex with real-time subscriptions. Client components use `useQuery` hooks for live data that updates automatically across all connected clients.

### File Storage

- **Images** are uploaded to Vercel Blob via `/api/upload`, returning a permanent public URL stored in the database
- **Audio files** and **Logic Pro blobs** are uploaded to Cloudflare R2 via `/api/upload/audio` and `/api/upload/logic-blob` respectively
- Logic Pro blobs use SHA-256 content-addressed deduplication

### Authentication

Email/password authentication via `@convex-dev/auth`. The login form supports both sign-in and sign-up flows with automatic workspace creation for new users.

### Lyrics Editor

Built on CodeMirror 6 with custom extensions:
- Chord notation overlay (detects `[Am]`, `[G7]`, etc.)
- Syllable counter per line
- Rhyme detection and highlighting
- AI writing widget (inline Anthropic Claude integration)
- Image paste support (uploads to Vercel Blob)

## License

Private — All rights reserved.

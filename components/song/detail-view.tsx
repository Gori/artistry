"use client";

import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { PenLine, StickyNote, Disc3, Mic } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { type KanbanSong } from "@/lib/kanban/types";
import { SongHeader } from "./song-header";
import { SongDetailsSheet } from "./song-details-sheet";
import { LyricsEditor } from "./lyrics-editor";
import { NotesPanel } from "./notes-panel";
import { VersionsPanel } from "./versions-panel";
import { AudioNotesPanel } from "./audio-notes-panel";

const SECTIONS = [
  { id: "lyrics", label: "Lyrics", icon: PenLine },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "versions", label: "Versions", icon: Disc3 },
  { id: "audio-notes", label: "Audio Notes", icon: Mic },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export function SongDetailView({
  song,
  workspaceId,
  workspaceSlug,
}: {
  song: KanbanSong;
  workspaceId: Id<"workspaces">;
  workspaceSlug: string;
}) {
  const [activeSection, setActiveSection] = useState<SectionId>("lyrics");
  const [detailsOpen, setDetailsOpen] = useState(false);

  const appendToNotes = useMutation(api.notes.append);
  const appendToLyrics = useMutation(api.lyrics.append);

  const handleMoveToNotes = useCallback(
    (text: string) => {
      void appendToNotes({ songId: song._id, content: text });
    },
    [appendToNotes, song._id]
  );

  const handleMoveToLyrics = useCallback(
    (text: string) => {
      void appendToLyrics({ songId: song._id, content: text });
    },
    [appendToLyrics, song._id]
  );

  return (
    <div className="flex h-screen flex-col">
      <SongHeader
        song={song}
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug}
        workspaceName={(song as KanbanSong & { workspaceName?: string }).workspaceName}
        onOpenDetails={() => setDetailsOpen(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav className="flex w-44 shrink-0 flex-col border-r bg-muted/30 py-1">
          {SECTIONS.map((section) => {
            const active = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  "flex items-center gap-3 border-l-2 px-4 py-2.5 text-left text-sm transition-colors",
                  active
                    ? "border-primary bg-background font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-background/50 hover:text-foreground"
                )}
              >
                <section.icon className="size-4 shrink-0" />
                {section.label}
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {activeSection === "lyrics" && (
            <LyricsEditor songId={song._id} onMoveText={handleMoveToNotes} />
          )}
          {activeSection === "notes" && (
            <NotesPanel songId={song._id} onMoveText={handleMoveToLyrics} />
          )}
          {activeSection === "versions" && (
            <div className="flex-1 overflow-auto p-6">
              <VersionsPanel songId={song._id} />
            </div>
          )}
          {activeSection === "audio-notes" && (
            <div className="flex-1 overflow-auto p-6">
              <AudioNotesPanel songId={song._id} />
            </div>
          )}
        </main>
      </div>

      <SongDetailsSheet
        song={song}
        workspaceSlug={workspaceSlug}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </div>
  );
}

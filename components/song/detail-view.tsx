"use client";

import { useState, useCallback, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
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
import { PersistentPlayer, type ActiveAudio } from "@/components/audio/persistent-player";
import { InlineTagRow } from "./tag-manager";
import { Teleprompter } from "./teleprompter";

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
  const [focusMode, setFocusMode] = useState(false);
  const [activeAudio, setActiveAudio] = useState<ActiveAudio | null>(null);
  const [teleprompterOpen, setTeleprompterOpen] = useState(false);

  const appendToNotes = useMutation(api.notes.append);
  const appendToLyrics = useMutation(api.lyrics.append);

  // Fetch counts for versions and audio notes
  const versions = useQuery(api.songVersions.listBySong, { songId: song._id });
  const audioNotes = useQuery(api.audioNotes.listBySong, { songId: song._id });

  // Fetch lyrics for teleprompter
  const lyrics = useQuery(api.lyrics.getBySong, { songId: song._id });

  const sectionCounts: Partial<Record<SectionId, number>> = {
    versions: versions?.length,
    "audio-notes": audioNotes?.length,
  };

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

  const handlePlay = useCallback((audio: ActiveAudio) => {
    setActiveAudio(audio);
  }, []);

  // --- Keyboard shortcuts ---
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Escape to exit focus mode — must work even when typing
      if (e.key === "Escape") {
        if (focusMode) {
          e.preventDefault();
          setFocusMode(false);
          return;
        }
      }

      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        target.closest(".cm-editor");

      if (isTyping) return;

      switch (e.key) {
        case "1":
          e.preventDefault();
          setActiveSection("lyrics");
          break;
        case "2":
          e.preventDefault();
          setActiveSection("notes");
          break;
        case "3":
          e.preventDefault();
          setActiveSection("versions");
          break;
        case "4":
          e.preventDefault();
          setActiveSection("audio-notes");
          break;
        case "v":
        case "V":
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            setActiveSection("versions");
          }
          break;
        case "f":
        case "F":
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            setFocusMode((prev) => !prev);
          }
          break;
        case "t":
        case "T":
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            setTeleprompterOpen((prev) => !prev);
          }
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusMode]);

  // --- Custom event listeners for command palette ---
  useEffect(() => {
    const handlers: Record<string, () => void> = {
      "artistry:toggle-focus": () => setFocusMode((p) => !p),
      "artistry:toggle-teleprompter": () => setTeleprompterOpen((p) => !p),
      "artistry:open-details": () => setDetailsOpen(true),
    };

    for (const [event, handler] of Object.entries(handlers)) {
      window.addEventListener(event, handler);
    }
    return () => {
      for (const [event, handler] of Object.entries(handlers)) {
        window.removeEventListener(event, handler);
      }
    };
  }, []);

  return (
    <div className={cn("flex h-screen flex-col", focusMode && "focus-mode")}>
      {/* Focus mode — centered song title */}
      {focusMode && (
        <div className="fixed top-4 left-0 right-0 z-50 flex justify-center pointer-events-none">
          <span
            className="text-xs font-medium text-muted-foreground/60"
            style={{ fontFamily: '"Dreaming Outloud", cursive' }}
          >
            {song.title}
          </span>
        </div>
      )}

      {!focusMode && (
        <SongHeader
          song={song}
          workspaceId={workspaceId}
          workspaceSlug={workspaceSlug}
          workspaceName={(song as KanbanSong & { workspaceName?: string }).workspaceName}
          onOpenDetails={() => setDetailsOpen(true)}
          onToggleFocus={() => setFocusMode(true)}
          onToggleTeleprompter={() => setTeleprompterOpen(true)}
        />
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {!focusMode && (
          <nav className="flex w-44 shrink-0 flex-col border-r bg-muted/30 py-1">
            {SECTIONS.map((section) => {
              const active = activeSection === section.id;
              const count = sectionCounts[section.id];
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
                  {count != null && count > 0 && (
                    <span className={cn(
                      "ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none",
                      active
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Tags */}
            <div className="mt-auto border-t px-3 py-3">
              <InlineTagRow
                songId={song._id}
                workspaceId={workspaceId}
                songTagIds={song.tagIds ?? []}
                tags={song.tags ?? []}
              />
            </div>
          </nav>
        )}

        {/* Content */}
        <main className={cn("flex flex-1 flex-col overflow-hidden", activeAudio && "pb-14")}>
          {activeSection === "lyrics" && (
            <LyricsEditor
              songId={song._id}
              songKey={song.key}
              onMoveText={handleMoveToNotes}
            />
          )}
          {activeSection === "notes" && (
            <NotesPanel
              songId={song._id}
              onMoveText={handleMoveToLyrics}
            />
          )}
          {activeSection === "versions" && (
            <div className="flex-1 overflow-auto p-6">
              <VersionsPanel songId={song._id} onPlay={handlePlay} />
            </div>
          )}
          {activeSection === "audio-notes" && (
            <div className="flex-1 overflow-auto p-6">
              <AudioNotesPanel songId={song._id} onPlay={handlePlay} />
            </div>
          )}
        </main>
      </div>

      {/* Persistent audio player */}
      {activeAudio && (
        <PersistentPlayer
          audio={activeAudio}
          onClose={() => setActiveAudio(null)}
        />
      )}

      {/* Teleprompter */}
      {teleprompterOpen && lyrics?.content && (
        <Teleprompter
          content={lyrics.content}
          onClose={() => setTeleprompterOpen(false)}
        />
      )}

      <SongDetailsSheet
        song={song}
        workspaceSlug={workspaceSlug}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </div>
  );
}

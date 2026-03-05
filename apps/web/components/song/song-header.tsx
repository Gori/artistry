"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { Layers, Info, Share2, Maximize2, Monitor } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ShareDialog } from "./share-dialog";
import { cn } from "@/lib/utils";
import { formatTimeAgo } from "@/lib/format-time";
import {
  type Stage,
  type KanbanSong,
  STAGES,
  STAGE_LABELS,
  STAGE_DOT_CLASSES,
  STAGE_TEXT_CLASSES,
} from "@/lib/kanban/types";

export function SongHeader({
  song,
  workspaceId,
  workspaceSlug,
  workspaceName,
  onOpenDetails,
  onToggleFocus,
  onToggleTeleprompter,
}: {
  song: KanbanSong;
  workspaceId: Id<"workspaces">;
  workspaceSlug: string;
  workspaceName?: string;
  onOpenDetails: () => void;
  onToggleFocus?: () => void;
  onToggleTeleprompter?: () => void;
}) {
  const [shareOpen, setShareOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(song.title);
  const titleRef = useRef<HTMLInputElement>(null);

  const updateSong = useMutation(api.songs.update);
  const moveSong = useMutation(api.songs.move);

  // Fetch lyrics for "edited X ago"
  const lyrics = useQuery(api.lyrics.getBySong, { songId: song._id });

  // Focus input when editing
  useEffect(() => {
    if (editingTitle) titleRef.current?.focus();
  }, [editingTitle]);

  const saveTitle = useCallback(() => {
    setEditingTitle(false);
    if (titleValue.trim() && titleValue !== song.title) {
      void updateSong({ id: song._id, title: titleValue.trim() });
    } else {
      setTitleValue(song.title);
    }
  }, [titleValue, song.title, song._id, updateSong]);

  const handleStageChange = useCallback(
    (stage: Stage) => {
      void moveSong({ id: song._id, stage, position: song.position });
    },
    [moveSong, song._id, song.position]
  );

  // Format "edited X ago" — use updatedAt if available, fall back to creation time
  const editedAt = lyrics?.updatedAt ?? lyrics?._creationTime;
  const editedAgo = editedAt ? formatTimeAgo(editedAt) : null;

  return (
    <>
      <header className="border-b px-6 py-4">
        {/* Row 1: title + actions */}
        <div className="flex items-start justify-between mb-1 gap-4">
          {editingTitle ? (
            <input
              ref={titleRef}
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveTitle();
                if (e.key === "Escape") {
                  setTitleValue(song.title);
                  setEditingTitle(false);
                }
              }}
              className="text-6xl tracking-tight bg-transparent border-none outline-none w-full"
              style={{ fontFamily: '"Dreaming Outloud", cursive' }}
            />
          ) : (
            <h1
              className="text-6xl tracking-tight cursor-text"
              style={{ fontFamily: '"Dreaming Outloud", cursive' }}
              onClick={() => {
                setTitleValue(song.title);
                setEditingTitle(true);
              }}
            >
              {song.title}
            </h1>
          )}

          <div className="flex items-center gap-1.5 shrink-0 mt-2">
            {onToggleFocus && (
              <Button variant="ghost" size="icon-xs" onClick={onToggleFocus} title="Focus Mode (F)">
                <Maximize2 className="size-3.5" />
              </Button>
            )}
            {onToggleTeleprompter && (
              <Button variant="ghost" size="icon-xs" onClick={onToggleTeleprompter} title="Teleprompter (T)">
                <Monitor className="size-3.5" />
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onOpenDetails}>
              <Info className="size-3.5" />
              Details
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
              <Share2 className="size-3.5" />
              Share
            </Button>
          </div>
        </div>

        {/* Row 2: phase · workspace · last edit */}
        <div className="flex items-center gap-2 text-xs">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-muted transition-colors cursor-pointer">
                <span className={cn("size-2 rounded-full shrink-0", STAGE_DOT_CLASSES[song.stage])} />
                <span className={cn("font-medium", STAGE_TEXT_CLASSES[song.stage])}>
                  {STAGE_LABELS[song.stage as Stage] ?? song.stage}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {STAGES.map((stage) => (
                <DropdownMenuItem
                  key={stage}
                  onClick={() => handleStageChange(stage)}
                  className="gap-2"
                >
                  <span className={cn("size-2 rounded-full", STAGE_DOT_CLASSES[stage])} />
                  {STAGE_LABELS[stage]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <span className="text-muted-foreground/40">&middot;</span>

          <Link
            href={`/workspace/${workspaceSlug}`}
            className="text-muted-foreground/60 hover:text-muted-foreground hover:underline transition-colors"
          >
            {workspaceName ?? workspaceSlug}
          </Link>

          {editedAgo && (
            <>
              <span className="text-muted-foreground/40">&middot;</span>
              <span className="text-muted-foreground/50">
                Edited {editedAgo}
              </span>
            </>
          )}
        </div>

        {/* Row 3: group chip + tempo + key (only if set) */}
        {(song.groupName || song.tempo || song.key) && (
          <div className="mt-1.5 flex items-center gap-2 text-xs flex-wrap">
            {song.groupName && (
              <span className="inline-flex items-center gap-1 rounded-full border border-muted-foreground/20 px-2 py-0.5 font-medium text-muted-foreground">
                <Layers className="size-3" />
                {song.groupName}
              </span>
            )}
            {song.tempo && (
              <span className="text-muted-foreground">
                {song.tempo} BPM
              </span>
            )}
            {song.tempo && song.key && (
              <span className="text-muted-foreground/40">&middot;</span>
            )}
            {song.key && (
              <span className="text-muted-foreground">
                {song.key}
              </span>
            )}
          </div>
        )}
      </header>

      <ShareDialog
        songId={song._id}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />
    </>
  );
}

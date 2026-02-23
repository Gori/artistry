"use client";

import { useState } from "react";
import Link from "next/link";
import { Layers, Info, Share2 } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ShareDialog } from "./share-dialog";
import { InlineTagRow } from "./tag-manager";
import {
  type Stage,
  type KanbanSong,
  STAGE_LABELS,
  STAGE_BADGE_CLASSES,
} from "@/lib/kanban/types";

export function SongHeader({
  song,
  workspaceId,
  workspaceSlug,
  workspaceName,
  onOpenDetails,
}: {
  song: KanbanSong;
  workspaceId: Id<"workspaces">;
  workspaceSlug: string;
  workspaceName?: string;
  onOpenDetails: () => void;
}) {
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <>
      <header className="border-b px-6 py-4">
        {/* Row 1: title + actions */}
        <div className="flex items-start justify-between mb-1 gap-4">
          <div className="flex items-center gap-3">
            <h1
              className="text-6xl tracking-tight"
              style={{ fontFamily: '"Dreaming Outloud", cursive' }}
            >
              {song.title}
            </h1>
            <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${STAGE_BADGE_CLASSES[song.stage] ?? "bg-secondary text-secondary-foreground"}`}>
              {STAGE_LABELS[song.stage as Stage] ?? song.stage}
            </span>
            {song.groupName && (
              <span className="flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                <Layers className="size-3" />
                {song.groupName}
              </span>
            )}
            <InlineTagRow
              songId={song._id}
              workspaceId={workspaceId}
              songTagIds={song.tagIds ?? []}
              tags={song.tags ?? []}
            />
          </div>

          <div className="flex items-center gap-2 shrink-0 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenDetails}
            >
              <Info className="size-3.5" />
              Details
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShareOpen(true)}
            >
              <Share2 className="size-3.5" />
              Share
            </Button>
          </div>
        </div>

        {/* Row 3: Back link + meta */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <Link
            href={`/workspace/${workspaceSlug}`}
            className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            &larr; {workspaceName ?? workspaceSlug}
          </Link>

          {song.tempo && (
            <>
              <span className="text-muted-foreground/40">&middot;</span>
              <span>{song.tempo} BPM</span>
            </>
          )}

          {song.key && (
            <>
              <span className="text-muted-foreground/40">&middot;</span>
              <span>{song.key}</span>
            </>
          )}
        </div>
      </header>

      <ShareDialog
        songId={song._id}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />
    </>
  );
}

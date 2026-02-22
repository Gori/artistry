"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Info, Share2 } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ShareDialog } from "./share-dialog";
import { TagPills } from "./tag-manager";

const STAGES = ["idea", "writing", "producing", "mixing", "done"] as const;
type Stage = (typeof STAGES)[number];

const STAGE_LABELS: Record<Stage, string> = {
  idea: "Idea",
  writing: "Writing",
  producing: "Producing",
  mixing: "Mixing",
  done: "Done",
};

const STAGE_BADGE_CLASSES: Record<string, string> = {
  idea: "bg-stage-idea/10 text-stage-idea",
  writing: "bg-stage-writing/10 text-stage-writing",
  producing: "bg-stage-producing/10 text-stage-producing",
  mixing: "bg-stage-mixing/10 text-stage-mixing",
  done: "bg-stage-done/10 text-stage-done",
};

interface SongTag {
  _id: Id<"tags">;
  name: string;
  color: string;
}

interface Song {
  _id: Id<"songs">;
  title: string;
  stage: string;
  position: number;
  description?: string;
  tempo?: string;
  key?: string;
  workspaceId: Id<"workspaces">;
  createdBy: Id<"users">;
  tagIds?: Id<"tags">[];
  tags?: SongTag[];
}

export function SongHeader({
  song,
  workspaceSlug,
  workspaceName,
  onOpenDetails,
}: {
  song: Song;
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
          <h1
            className="text-6xl tracking-tight"
            style={{ fontFamily: '"Dreaming Outloud", cursive' }}
          >
            {song.title}
          </h1>

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

        {/* Row 2: Back link + meta */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <Link
            href={`/workspace/${workspaceSlug}`}
            className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            &larr; {workspaceName ?? workspaceSlug}
          </Link>
          <span className="text-muted-foreground/40">&middot;</span>
          <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${STAGE_BADGE_CLASSES[song.stage] ?? "bg-secondary text-secondary-foreground"}`}>
            {STAGE_LABELS[song.stage as Stage] ?? song.stage}
          </span>

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

          {song.tags && song.tags.length > 0 && (
            <>
              <span className="text-muted-foreground/40">&middot;</span>
              <TagPills tags={song.tags} />
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

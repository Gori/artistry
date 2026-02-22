"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SongTag {
  _id: Id<"tags">;
  name: string;
  color: string;
}

interface Song {
  _id: Id<"songs">;
  title: string;
  slug?: string;
  stage: string;
  position: number;
  description?: string;
  workspaceId: Id<"workspaces">;
  createdBy: Id<"users">;
  tempo?: string;
  key?: string;
  tags?: SongTag[];
}

const STAGE_LABELS: Record<string, string> = {
  idea: "Idea",
  writing: "Writing",
  producing: "Producing",
  mixing: "Mixing",
  done: "Done",
};

const STAGE_BADGE_CLASSES: Record<string, string> = {
  idea: "border-stage-idea/25 bg-stage-idea/10 text-stage-idea",
  writing: "border-stage-writing/25 bg-stage-writing/10 text-stage-writing",
  producing: "border-stage-producing/25 bg-stage-producing/10 text-stage-producing",
  mixing: "border-stage-mixing/25 bg-stage-mixing/10 text-stage-mixing",
  done: "border-stage-done/25 bg-stage-done/10 text-stage-done",
};

export function KanbanCard({
  song,
  workspaceSlug,
  overlay = false,
}: {
  song: Song;
  workspaceSlug: string;
  overlay?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: song._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const card = (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md",
        isDragging && "opacity-50",
        overlay && "shadow-lg ring-2 ring-primary/20"
      )}
    >
      <p className="text-sm font-medium">{song.title}</p>
      {song.description && (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {song.description}
        </p>
      )}
      <div className="mt-2 flex items-center gap-1.5">
        <Badge variant="outline" className={cn("text-[10px]", STAGE_BADGE_CLASSES[song.stage])}>
          {STAGE_LABELS[song.stage] ?? song.stage}
        </Badge>
        {song.tempo && (
          <span className="text-[10px] text-muted-foreground">
            {song.tempo} BPM
          </span>
        )}
        {song.key && (
          <span className="text-[10px] text-muted-foreground">{song.key}</span>
        )}
      </div>
      {song.tags && song.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {song.tags.map((tag) => (
            <span
              key={tag._id}
              className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: `${tag.color}20`,
                color: tag.color,
              }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );

  if (overlay) return card;

  return (
    <Link href={`/workspace/${workspaceSlug}/${song.slug}`}>
      {card}
    </Link>
  );
}

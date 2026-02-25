"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type KanbanSong,
  STAGE_LABELS,
  STAGE_DOT_CLASSES,
  STAGE_TEXT_CLASSES,
} from "@/lib/kanban/types";

type ViewMode = "stages" | "groups";

export function KanbanCard({
  song,
  workspaceSlug,
  overlay = false,
  viewMode = "stages",
}: {
  song: KanbanSong;
  workspaceSlug: string;
  overlay?: boolean;
  viewMode?: ViewMode;
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
      {/* Title row + subtle tempo/key */}
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium min-w-0 truncate">{song.title}</p>
        {(song.tempo || song.key) && (
          <span className="shrink-0 text-[10px] text-muted-foreground/60">
            {[song.tempo && `${song.tempo}`, song.key].filter(Boolean).join(" · ")}
          </span>
        )}
      </div>

      {/* Description — 1-line clamp */}
      {song.description && (
        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
          {song.description}
        </p>
      )}

      {/* Bottom row: stage dot (groups view) + group chip (stages view) + tags */}
      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
        {/* Stage dot — only in groups view */}
        {viewMode === "groups" && (
          <span className="inline-flex items-center gap-1">
            <span className={cn("size-2 rounded-full shrink-0", STAGE_DOT_CLASSES[song.stage])} />
            <span className={cn("text-[10px] font-medium", STAGE_TEXT_CLASSES[song.stage])}>
              {STAGE_LABELS[song.stage as keyof typeof STAGE_LABELS] ?? song.stage}
            </span>
          </span>
        )}

        {/* Group chip — only in stages view when song has a group */}
        {viewMode === "stages" && song.groupName && (
          <span className="inline-flex items-center gap-1 rounded-full border border-muted-foreground/20 px-1.5 py-0.5 text-[10px] text-muted-foreground">
            <Layers className="size-2.5" />
            {song.groupName}
          </span>
        )}

        {/* Tag pills */}
        {song.tags && song.tags.length > 0 && (
          <>
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
          </>
        )}
      </div>
    </div>
  );

  if (overlay) return card;

  return (
    <Link href={`/workspace/${workspaceSlug}/${song.slug}`}>
      {card}
    </Link>
  );
}

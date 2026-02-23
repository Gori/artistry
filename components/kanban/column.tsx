"use client";

import { useState, useRef, useEffect } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useMutation } from "convex/react";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { KanbanCard } from "./card";
import {
  type Stage,
  type KanbanSong,
  STAGE_LABELS,
  STAGE_BADGE_CLASSES,
  STAGE_COLUMN_CLASSES,
  GROUP_COLUMN_CLASSES,
  GROUP_BADGE_CLASSES,
} from "@/lib/kanban/types";

export type ColumnVariant =
  | { kind: "stage"; stage: Stage }
  | { kind: "group"; groupId: string; groupName: string; isUngrouped?: boolean; colorIndex?: number };

export function KanbanColumn({
  variant,
  songs,
  workspaceId,
  workspaceSlug,
}: {
  variant: ColumnVariant;
  songs: KanbanSong[];
  workspaceId: Id<"workspaces">;
  workspaceSlug: string;
}) {
  const droppableId =
    variant.kind === "stage" ? variant.stage : variant.groupId;
  const { setNodeRef, isOver } = useDroppable({ id: droppableId });
  const createSong = useMutation(api.songs.create);
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  async function handleQuickAdd() {
    if (!newTitle.trim()) {
      setIsAdding(false);
      return;
    }
    await createSong({ title: newTitle.trim(), workspaceId });
    setNewTitle("");
    setIsAdding(false);
  }

  const songIds = songs.map((s) => s._id);

  const bgClass =
    variant.kind === "stage"
      ? STAGE_COLUMN_CLASSES[variant.stage]
      : variant.isUngrouped
        ? "bg-muted/50"
        : GROUP_COLUMN_CLASSES[(variant.colorIndex ?? 0) % GROUP_COLUMN_CLASSES.length];

  return (
    <div
      className={`flex w-72 shrink-0 flex-col rounded-lg ${bgClass} ${
        isOver ? "ring-2 ring-primary/20" : ""
      }`}
    >
      <div className="flex items-center justify-between px-3 py-2">
        {variant.kind === "stage" ? (
          <StageHeader stage={variant.stage} count={songs.length} />
        ) : (
          <GroupHeader
            groupId={variant.groupId}
            groupName={variant.groupName}
            count={songs.length}
            isUngrouped={variant.isUngrouped}
            colorIndex={variant.colorIndex}
          />
        )}
        <div className="flex items-center gap-0.5">
          {variant.kind === "group" && !variant.isUngrouped && (
            <DeleteGroupButton groupId={variant.groupId} />
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setIsAdding(true)}
          >
            <Plus />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 px-2 pb-2">
        <div ref={setNodeRef} className="flex min-h-[40px] flex-col gap-2">
          <SortableContext
            items={songIds}
            strategy={verticalListSortingStrategy}
          >
            {songs.map((song) => (
              <KanbanCard
                key={song._id}
                song={song}
                workspaceSlug={workspaceSlug}
              />
            ))}
          </SortableContext>

          {isAdding && (
            <div className="rounded-lg border bg-card p-2">
              <Input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Song title..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleQuickAdd();
                  if (e.key === "Escape") {
                    setIsAdding(false);
                    setNewTitle("");
                  }
                }}
                onBlur={() => void handleQuickAdd()}
              />
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Private sub-components                                             */
/* ------------------------------------------------------------------ */

function StageHeader({ stage, count }: { stage: Stage; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <h3 className="text-sm font-semibold">{STAGE_LABELS[stage]}</h3>
      <Badge
        variant="outline"
        className={`text-xs ${STAGE_BADGE_CLASSES[stage]}`}
      >
        {count}
      </Badge>
    </div>
  );
}

function GroupHeader({
  groupId,
  groupName,
  count,
  isUngrouped,
  colorIndex,
}: {
  groupId: string;
  groupName: string;
  count: number;
  isUngrouped?: boolean;
  colorIndex?: number;
}) {
  const renameGroup = useMutation(api.songGroups.rename);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(groupName);
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [isEditing]);

  async function handleRename() {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === groupName) {
      setEditName(groupName);
      setIsEditing(false);
      return;
    }
    await renameGroup({ id: groupId as Id<"songGroups">, name: trimmed });
    setIsEditing(false);
  }

  return (
    <div className="flex items-center gap-2 min-w-0">
      {isEditing && !isUngrouped ? (
        <Input
          ref={editRef}
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleRename();
            if (e.key === "Escape") {
              setEditName(groupName);
              setIsEditing(false);
            }
          }}
          onBlur={() => void handleRename()}
          className="h-6 text-sm font-semibold px-1"
        />
      ) : (
        <h3
          className={`text-sm font-semibold truncate ${
            !isUngrouped ? "cursor-pointer hover:text-primary" : ""
          }`}
          onClick={() => {
            if (!isUngrouped) {
              setEditName(groupName);
              setIsEditing(true);
            }
          }}
        >
          {groupName}
        </h3>
      )}
      <Badge
        variant="outline"
        className={`text-xs shrink-0 ${
          !isUngrouped && colorIndex != null
            ? GROUP_BADGE_CLASSES[colorIndex % GROUP_BADGE_CLASSES.length]
            : ""
        }`}
      >
        {count}
      </Badge>
    </div>
  );
}

function DeleteGroupButton({ groupId }: { groupId: string }) {
  const removeGroup = useMutation(api.songGroups.remove);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await removeGroup({ id: groupId as Id<"songGroups"> });
    setConfirmDelete(false);
  }

  if (confirmDelete) {
    return (
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-destructive"
          onClick={() => void handleDelete()}
        >
          <Trash2 className="size-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setConfirmDelete(false)}
          className="text-xs px-1"
        >
          ✕
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      onClick={() => setConfirmDelete(true)}
      className="text-muted-foreground hover:text-destructive"
    >
      <Trash2 className="size-3" />
    </Button>
  );
}

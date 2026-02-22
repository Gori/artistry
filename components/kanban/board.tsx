"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import Link from "next/link";
import { ChevronLeft, Import, Info, Plus } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KanbanColumn } from "./column";
import { KanbanCard } from "./card";
import { TagFilterBar } from "./tag-filter-bar";
import { WorkspaceSettings } from "@/components/workspace/settings";
import { ImportSheet } from "@/components/import/import-sheet";

const STAGES = ["idea", "writing", "producing", "mixing", "done"] as const;
type Stage = (typeof STAGES)[number];

interface PendingMove {
  toStage: Stage;
  toPosition: number;
}

export function KanbanBoard({
  workspaceId,
  workspaceName,
  workspaceSlug,
}: {
  workspaceId: Id<"workspaces">;
  workspaceName: string;
  workspaceSlug: string;
}) {
  const songs = useQuery(api.songs.listByWorkspace, { workspaceId });
  const tags = useQuery(api.tags.list, { workspaceId });
  const createSong = useMutation(api.songs.create);
  const moveSong = useMutation(api.songs.move);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [newSongTitle, setNewSongTitle] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [pendingMoves, setPendingMoves] = useState<Map<string, PendingMove>>(
    () => new Map()
  );
  const [activeTagIds, setActiveTagIds] = useState<Set<string>>(
    () => new Set()
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Clear pending moves when server data catches up
  useEffect(() => {
    if (!songs || pendingMoves.size === 0) return;
    const songMap = new Map(songs.map((s) => [s._id, s]));
    let changed = false;
    const next = new Map(pendingMoves);
    for (const [id, pending] of pendingMoves) {
      const song = songMap.get(id as Id<"songs">);
      if (song && song.stage === pending.toStage && song.position === pending.toPosition) {
        next.delete(id);
        changed = true;
      }
    }
    if (changed) setPendingMoves(next);
  }, [songs, pendingMoves]);

  // Safety timeout: clear stale pending moves after 5s
  useEffect(() => {
    if (pendingMoves.size === 0) return;
    const timer = setTimeout(() => {
      setPendingMoves(new Map());
    }, 5000);
    return () => clearTimeout(timer);
  }, [pendingMoves]);

  const songsByStage = useMemo(() => {
    const grouped: Record<Stage, NonNullable<typeof songs>> = {
      idea: [],
      writing: [],
      producing: [],
      mixing: [],
      done: [],
    };
    if (!songs) return grouped;

    for (const song of songs) {
      const pending = pendingMoves.get(song._id);
      const effectiveStage = (pending?.toStage ?? song.stage) as Stage;
      const effectivePosition = pending?.toPosition ?? song.position;

      // Tag filtering
      if (activeTagIds.size > 0) {
        const songTagSet = new Set((song.tagIds ?? []) as string[]);
        let matches = false;
        for (const tagId of activeTagIds) {
          if (songTagSet.has(tagId)) {
            matches = true;
            break;
          }
        }
        if (!matches) continue;
      }

      const entry = { ...song, stage: effectiveStage, position: effectivePosition };
      grouped[effectiveStage]?.push(entry);
    }

    // Sort each column by position
    for (const stage of STAGES) {
      grouped[stage].sort((a, b) => a.position - b.position);
    }

    return grouped;
  }, [songs, pendingMoves, activeTagIds]);

  const activeSong = useMemo(
    () => songs?.find((s) => s._id === activeId) ?? null,
    [songs, activeId]
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || !songs) return;

    const songId = active.id as string;
    const overId = over.id as string;

    // Determine the target stage
    let targetStage: Stage;
    if (STAGES.includes(overId as Stage)) {
      targetStage = overId as Stage;
    } else {
      const overSong = songs.find((s) => s._id === overId);
      if (!overSong) return;
      targetStage = overSong.stage as Stage;
    }

    const currentSong = songs.find((s) => s._id === songId);
    if (!currentSong) return;

    // Get songs in the target stage, excluding the dragged song
    const stageSongs = songsByStage[targetStage].filter(
      (s) => s._id !== songId
    );

    let newPosition: number;
    if (STAGES.includes(overId as Stage)) {
      // Dropped on the column itself - place at end
      newPosition =
        stageSongs.length > 0
          ? stageSongs[stageSongs.length - 1]!.position + 1
          : 1;
    } else {
      // Dropped on a specific song
      const overIndex = stageSongs.findIndex((s) => s._id === overId);
      if (overIndex === -1) {
        newPosition =
          stageSongs.length > 0
            ? stageSongs[stageSongs.length - 1]!.position + 1
            : 1;
      } else if (overIndex === 0) {
        newPosition = stageSongs[0]!.position / 2;
      } else {
        newPosition =
          (stageSongs[overIndex - 1]!.position +
            stageSongs[overIndex]!.position) /
          2;
      }
    }

    // Only move if something changed
    if (
      currentSong.stage !== targetStage ||
      currentSong.position !== newPosition
    ) {
      // Record optimistic move before firing mutation
      setPendingMoves((prev) => {
        const next = new Map(prev);
        next.set(songId, { toStage: targetStage, toPosition: newPosition });
        return next;
      });

      void moveSong({
        id: songId as Id<"songs">,
        stage: targetStage,
        position: newPosition,
      });
    }
  }

  const toggleTagFilter = useCallback((tagId: string) => {
    setActiveTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  }, []);

  const clearTagFilters = useCallback(() => {
    setActiveTagIds(new Set());
  }, []);

  async function handleCreateSong() {
    if (!newSongTitle.trim()) return;
    setCreating(true);
    try {
      await createSong({ title: newSongTitle.trim(), workspaceId });
      setNewSongTitle("");
      setDialogOpen(false);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="border-b px-6 py-4">
        <div className="flex items-start justify-between mb-1 gap-4">
          <h1
            className="text-6xl tracking-tight"
            style={{ fontFamily: '"Dreaming Outloud", cursive' }}
          >
            {workspaceName}
          </h1>
        <div className="flex items-center gap-2 shrink-0 mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSettingsOpen(true)}
          >
            <Info className="size-3.5" />
            Details
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportOpen(true)}
          >
            <Import className="size-3.5" />
            Import Ideas
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus />
                New Song
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Song</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="song-title">Title</Label>
                  <Input
                    id="song-title"
                    value={newSongTitle}
                    onChange={(e) => setNewSongTitle(e.target.value)}
                    placeholder="Untitled Song"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleCreateSong();
                    }}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => void handleCreateSong()}
                  disabled={creating || !newSongTitle.trim()}
                >
                  {creating ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        </div>
        <Link
          href="/workspaces"
          className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        >
          &larr; Workspaces
        </Link>
      </header>

      <TagFilterBar
        tags={tags ?? []}
        activeTagIds={activeTagIds}
        onToggle={toggleTagFilter}
        onClear={clearTagFilters}
      />

      <div className="flex flex-1 gap-4 overflow-x-auto p-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {STAGES.map((stage) => (
            <KanbanColumn
              key={stage}
              stage={stage}
              songs={songsByStage[stage]}
              workspaceId={workspaceId}
              workspaceSlug={workspaceSlug}
            />
          ))}
          <DragOverlay>
            {activeSong ? (
              <KanbanCard song={activeSong} workspaceSlug={workspaceSlug} overlay />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <WorkspaceSettings
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />

      <ImportSheet
        open={importOpen}
        onOpenChange={setImportOpen}
        workspaceId={workspaceId}
        songs={songs ?? []}
      />
    </div>
  );
}

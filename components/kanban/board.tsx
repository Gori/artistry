"use client";

import { useState, useMemo, useCallback } from "react";
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
import { Import, Info, Plus } from "lucide-react";
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
import { STAGES, type Stage } from "@/lib/kanban/types";
import { calculateInsertPosition } from "@/lib/kanban/position";
import { usePendingMoves } from "@/lib/kanban/use-pending-moves";

type ViewMode = "stages" | "groups";

const UNGROUPED_ID = "ungrouped";

interface PendingMove {
  toStage: Stage;
  toPosition: number;
}

interface PendingGroupMove {
  toGroupId: string;
  toGroupPosition: number;
}

function isStageMoveResolved(
  song: { stage: string; position: number },
  pending: PendingMove
): boolean {
  return song.stage === pending.toStage && song.position === pending.toPosition;
}

function isGroupMoveResolved(
  song: { groupId?: string; groupPosition?: number },
  pending: PendingGroupMove
): boolean {
  const effectiveGroupId = song.groupId ?? UNGROUPED_ID;
  return (
    effectiveGroupId === pending.toGroupId &&
    song.groupPosition === pending.toGroupPosition
  );
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
  const groups = useQuery(api.songGroups.list, { workspaceId });
  const createSong = useMutation(api.songs.create);
  const moveSong = useMutation(api.songs.move);
  const moveToGroup = useMutation(api.songs.moveToGroup);
  const createGroup = useMutation(api.songGroups.create);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [newSongTitle, setNewSongTitle] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [activeTagIds, setActiveTagIds] = useState<Set<string>>(
    () => new Set()
  );
  const [showIdeas, setShowIdeas] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("artistry-show-ideas") === "true";
  });
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "stages";
    return (localStorage.getItem("artistry-view-mode") as ViewMode) || "stages";
  });
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  const [pendingMoves, addPendingMove] = usePendingMoves(
    songs,
    isStageMoveResolved
  );
  const [pendingGroupMoves, addPendingGroupMove] = usePendingMoves(
    songs,
    isGroupMoveResolved
  );

  const toggleShowIdeas = useCallback(() => {
    setShowIdeas((prev) => {
      const next = !prev;
      localStorage.setItem("artistry-show-ideas", String(next));
      return next;
    });
  }, []);

  const handleSetViewMode = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("artistry-view-mode", mode);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const filteredSongs = useMemo(() => {
    if (!songs) return [];
    if (activeTagIds.size === 0) return songs;
    return songs.filter((song) => {
      const songTagSet = new Set((song.tagIds ?? []) as string[]);
      for (const tagId of activeTagIds) {
        if (songTagSet.has(tagId)) return true;
      }
      return false;
    });
  }, [songs, activeTagIds]);

  const songsByStage = useMemo(() => {
    const grouped: Record<Stage, NonNullable<typeof songs>> = {
      idea: [],
      writing: [],
      producing: [],
      mixing: [],
      done: [],
    };

    for (const song of filteredSongs) {
      const pending = pendingMoves.get(song._id);
      const effectiveStage = (pending?.toStage ?? song.stage) as Stage;
      const effectivePosition = pending?.toPosition ?? song.position;

      const entry = { ...song, stage: effectiveStage, position: effectivePosition };
      grouped[effectiveStage]?.push(entry);
    }

    for (const stage of STAGES) {
      grouped[stage].sort((a, b) => a.position - b.position);
    }

    return grouped;
  }, [filteredSongs, pendingMoves]);

  const songsByGroup = useMemo(() => {
    const grouped: Record<string, NonNullable<typeof songs>> = {
      [UNGROUPED_ID]: [],
    };

    if (groups) {
      for (const g of groups) {
        grouped[g._id] = [];
      }
    }

    for (const song of filteredSongs) {
      const pendingGroup = pendingGroupMoves.get(song._id);
      const effectiveGroupId = pendingGroup?.toGroupId ?? (song.groupId ?? UNGROUPED_ID);
      const effectiveGroupPosition = pendingGroup?.toGroupPosition ?? (song.groupPosition ?? 0);

      if (!grouped[effectiveGroupId]) {
        grouped[effectiveGroupId] = [];
      }

      grouped[effectiveGroupId].push({
        ...song,
        groupPosition: effectiveGroupPosition,
      } as typeof song);
    }

    for (const key of Object.keys(grouped)) {
      grouped[key].sort((a, b) => (a.groupPosition ?? 0) - (b.groupPosition ?? 0));
    }

    return grouped;
  }, [filteredSongs, groups, pendingGroupMoves]);

  const activeSong = useMemo(
    () => songs?.find((s) => s._id === activeId) ?? null,
    [songs, activeId]
  );

  // All group column IDs for identifying drop targets
  const groupColumnIds = useMemo(() => {
    const ids = new Set<string>([UNGROUPED_ID]);
    if (groups) {
      for (const g of groups) {
        ids.add(g._id);
      }
    }
    return ids;
  }, [groups]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || !songs) return;

    const songId = active.id as string;
    const overId = over.id as string;

    if (viewMode === "stages") {
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

      const stageSongs = songsByStage[targetStage].filter(
        (s) => s._id !== songId
      );
      const positions = stageSongs.map((s) => s.position);
      const overIndex = STAGES.includes(overId as Stage)
        ? -1
        : stageSongs.findIndex((s) => s._id === overId);
      const newPosition = calculateInsertPosition(positions, overIndex);

      if (
        currentSong.stage !== targetStage ||
        currentSong.position !== newPosition
      ) {
        addPendingMove(songId, { toStage: targetStage, toPosition: newPosition });

        void moveSong({
          id: songId as Id<"songs">,
          stage: targetStage,
          position: newPosition,
        });
      }
    } else {
      let targetGroupId: string;
      if (groupColumnIds.has(overId)) {
        targetGroupId = overId;
      } else {
        const overSong = songs.find((s) => s._id === overId);
        if (!overSong) return;
        const pendingGroup = pendingGroupMoves.get(overId);
        targetGroupId = pendingGroup?.toGroupId ?? (overSong.groupId ?? UNGROUPED_ID);
      }

      const currentSong = songs.find((s) => s._id === songId);
      if (!currentSong) return;

      const columnSongs = (songsByGroup[targetGroupId] ?? []).filter(
        (s) => s._id !== songId
      );
      const positions = columnSongs.map((s) => s.groupPosition ?? 0);
      const overIndex = groupColumnIds.has(overId)
        ? -1
        : columnSongs.findIndex((s) => s._id === overId);
      const newPosition = calculateInsertPosition(positions, overIndex);

      const currentGroupId = currentSong.groupId ?? UNGROUPED_ID;
      if (
        currentGroupId !== targetGroupId ||
        (currentSong.groupPosition ?? 0) !== newPosition
      ) {
        addPendingGroupMove(songId, {
          toGroupId: targetGroupId,
          toGroupPosition: newPosition,
        });

        void moveToGroup({
          id: songId as Id<"songs">,
          groupId: targetGroupId === UNGROUPED_ID ? undefined : targetGroupId as Id<"songGroups">,
          groupPosition: newPosition,
        });
      }
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

  async function handleCreateGroup() {
    if (!newGroupName.trim()) {
      setAddingGroup(false);
      return;
    }
    await createGroup({ name: newGroupName.trim(), workspaceId });
    setNewGroupName("");
    setAddingGroup(false);
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

        <div className="flex items-center justify-between mt-1">
          <Link
            href="/workspaces"
            className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            &larr; Workspaces
          </Link>

          <div className="flex items-center gap-3">
            <TagFilterBar
              tags={tags ?? []}
              activeTagIds={activeTagIds}
              onToggle={toggleTagFilter}
              onClear={clearTagFilters}
            />

            {viewMode === "stages" && (
              <button
                role="switch"
                aria-checked={showIdeas}
                aria-label="Show ideas"
                onClick={toggleShowIdeas}
                className="group/toggle flex items-center gap-2"
              >
                <span
                  className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
                    showIdeas ? "bg-stage-idea" : "bg-muted-foreground/25"
                  }`}
                >
                  <span
                    className={`inline-block size-3 rounded-full bg-white shadow-sm transition-transform ${
                      showIdeas ? "translate-x-3.5" : "translate-x-0.5"
                    }`}
                  />
                </span>
                <span
                  className={`text-xs font-medium transition-colors ${
                    showIdeas
                      ? "text-stage-idea"
                      : "text-muted-foreground group-hover/toggle:text-foreground"
                  }`}
                >
                  Ideas
                  {songs && !showIdeas && (
                    <span className="ml-1 opacity-50">
                      ({songs.filter((s) => s.stage === "idea").length})
                    </span>
                  )}
                </span>
              </button>
            )}

            <div className="flex items-center rounded-md bg-muted p-0.5">
              <button
                onClick={() => handleSetViewMode("stages")}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  viewMode === "stages"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Stages
              </button>
              <button
                onClick={() => handleSetViewMode("groups")}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  viewMode === "groups"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Groups
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 gap-4 overflow-x-auto p-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {viewMode === "stages" ? (
            <>
              {STAGES.filter((s) => s !== "idea" || showIdeas).map((stage) => (
                <KanbanColumn
                  key={stage}
                  variant={{ kind: "stage", stage }}
                  songs={songsByStage[stage]}
                  workspaceId={workspaceId}
                  workspaceSlug={workspaceSlug}
                />
              ))}
            </>
          ) : (
            <>
              <KanbanColumn
                key={UNGROUPED_ID}
                variant={{ kind: "group", groupId: UNGROUPED_ID, groupName: "Ungrouped", isUngrouped: true }}
                songs={songsByGroup[UNGROUPED_ID] ?? []}
                workspaceId={workspaceId}
                workspaceSlug={workspaceSlug}
              />
              {(groups ?? []).map((group, index) => (
                <KanbanColumn
                  key={group._id}
                  variant={{ kind: "group", groupId: group._id, groupName: group.name, colorIndex: index }}
                  songs={songsByGroup[group._id] ?? []}
                  workspaceId={workspaceId}
                  workspaceSlug={workspaceSlug}
                />
              ))}
              {addingGroup ? (
                <div className="flex w-72 shrink-0 flex-col rounded-lg bg-muted/50 p-3">
                  <Input
                    autoFocus
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Group name..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleCreateGroup();
                      if (e.key === "Escape") {
                        setAddingGroup(false);
                        setNewGroupName("");
                      }
                    }}
                    onBlur={() => void handleCreateGroup()}
                  />
                </div>
              ) : (
                <button
                  onClick={() => setAddingGroup(true)}
                  className="flex w-72 shrink-0 items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/20 p-4 text-sm text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground transition-colors"
                >
                  <Plus className="size-4" />
                  Add Group
                </button>
              )}
            </>
          )}
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

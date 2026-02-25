"use client";

import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import {
  Loader2,
  Play,
  MoreHorizontal,
  Pencil,
  Star,
  Trash2,
  Upload,
  Filter,
  GitCompare,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { formatTimeAgo, formatDuration } from "@/lib/format-time";
import {
  VERSION_CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  type VersionCategory,
} from "@/lib/version-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AudioPlayer, type AudioMarker } from "@/components/audio/player";
import { AudioUpload } from "@/components/audio/upload";
import { ComparePlayer } from "@/components/audio/compare-player";
import type { ActiveAudio } from "@/components/audio/persistent-player";

type Version = {
  _id: Id<"songVersions">;
  _creationTime: number;
  songId: Id<"songs">;
  title: string;
  audioUrl: string | null;
  notes?: string;
  category?: VersionCategory;
  isCurrent?: boolean;
  duration?: number;
  creatorName: string;
  createdBy: Id<"users">;
};

export function VersionsPanel({
  songId,
  onPlay,
}: {
  songId: Id<"songs">;
  onPlay?: (audio: ActiveAudio) => void;
}) {
  const versions = useQuery(api.songVersions.listBySong, { songId });
  const updateVersion = useMutation(api.songVersions.update);
  const removeVersion = useMutation(api.songVersions.remove);
  const setCurrentVersion = useMutation(api.songVersions.setCurrent);

  const [uploading, setUploading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<VersionCategory | "all">(
    "all"
  );
  const [editingVersion, setEditingVersion] = useState<Version | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editCategory, setEditCategory] = useState<VersionCategory | "">("");
  const [deletingVersion, setDeletingVersion] = useState<Version | null>(null);

  // Compare mode
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelection, setCompareSelection] = useState<Id<"songVersions">[]>([]);

  // Drag & drop
  const [dragOver, setDragOver] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // -- Handlers --

  const handleEdit = useCallback((version: Version) => {
    setEditingVersion(version);
    setEditTitle(version.title);
    setEditNotes(version.notes ?? "");
    setEditCategory(version.category ?? "");
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingVersion || !editTitle.trim()) return;
    await updateVersion({
      id: editingVersion._id,
      title: editTitle.trim(),
      notes: editNotes.trim() || undefined,
      category: (editCategory as VersionCategory) || undefined,
    });
    toast.success("Version updated");
    setEditingVersion(null);
  }, [editingVersion, editTitle, editNotes, editCategory, updateVersion]);

  const handleDelete = useCallback(async () => {
    if (!deletingVersion) return;
    await removeVersion({ id: deletingVersion._id });
    toast.success("Version deleted");
    setDeletingVersion(null);
  }, [deletingVersion, removeVersion]);

  const handleSetCurrent = useCallback(
    async (id: Id<"songVersions">) => {
      await setCurrentVersion({ id });
      toast.success("Set as current version");
    },
    [setCurrentVersion]
  );

  const handleCompareToggle = useCallback(
    (id: Id<"songVersions">) => {
      setCompareSelection((prev) => {
        if (prev.includes(id)) return prev.filter((v) => v !== id);
        if (prev.length >= 2) return [prev[1], id];
        return [...prev, id];
      });
    },
    []
  );

  // Drag & drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("audio/")) {
      setDroppedFile(file);
    } else {
      toast.error("Please drop an audio file");
    }
  }, []);

  // -- Filtered versions --

  const filtered = versions?.filter(
    (v) => categoryFilter === "all" || v.category === categoryFilter
  ) as Version[] | undefined;

  const currentVersion = filtered?.find((v) => v.isCurrent);
  const otherVersions = filtered?.filter((v) => !v.isCurrent);

  // Compare mode versions
  const compareA =
    compareMode && compareSelection[0]
      ? versions?.find((v) => v._id === compareSelection[0])
      : null;
  const compareB =
    compareMode && compareSelection[1]
      ? versions?.find((v) => v._id === compareSelection[1])
      : null;

  // -- Loading --

  if (versions === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Versions</h3>
        <div className="flex items-center gap-2">
          {/* Category filter */}
          {versions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-xs">
                  <Filter
                    className={cn(
                      "size-3.5",
                      categoryFilter !== "all" && "text-primary"
                    )}
                  />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setCategoryFilter("all")}>
                  All categories
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {VERSION_CATEGORIES.map((cat) => (
                  <DropdownMenuItem
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                  >
                    <span
                      className={cn(
                        "size-2 rounded-full mr-2",
                        CATEGORY_COLORS[cat].dot
                      )}
                    />
                    {CATEGORY_LABELS[cat]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Compare toggle */}
          {versions.length >= 2 && (
            <Button
              variant={compareMode ? "secondary" : "ghost"}
              size="icon-xs"
              onClick={() => {
                setCompareMode((p) => !p);
                setCompareSelection([]);
              }}
              title="Compare versions"
            >
              <GitCompare className="size-3.5" />
            </Button>
          )}

          <AudioUpload
            songId={songId}
            type="version"
            uploading={uploading}
            onUploadingChange={setUploading}
          />
        </div>
      </div>

      {/* Compare mode view */}
      {compareMode && (
        <div className="flex flex-col gap-3">
          {compareA && compareB ? (
            <ComparePlayer
              versionA={compareA as Version}
              versionB={compareB as Version}
              onExit={() => {
                setCompareMode(false);
                setCompareSelection([]);
              }}
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              Select 2 versions below to compare. ({compareSelection.length}/2
              selected)
            </p>
          )}
        </div>
      )}

      {versions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No versions uploaded yet.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Current version - expanded card */}
          {currentVersion && !compareMode && (
            <CurrentVersionCard
              version={currentVersion}
              songId={songId}
              onPlay={onPlay}
              onEdit={handleEdit}
              onDelete={setDeletingVersion}
              onSetCurrent={handleSetCurrent}
            />
          )}

          {/* Other versions - compact rows */}
          {(compareMode ? (filtered as Version[]) : otherVersions)?.map(
            (version) => (
              <CompactVersionRow
                key={version._id}
                version={version}
                onPlay={onPlay}
                onEdit={handleEdit}
                onDelete={setDeletingVersion}
                onSetCurrent={handleSetCurrent}
                compareMode={compareMode}
                compareSelected={compareSelection.includes(version._id)}
                onCompareToggle={handleCompareToggle}
              />
            )
          )}
        </div>
      )}

      {/* Drop zone */}
      <div
        ref={dropZoneRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "flex items-center justify-center rounded-lg border-2 border-dashed py-6 transition-colors cursor-pointer",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/20 hover:border-muted-foreground/40"
        )}
        onClick={() => {
          // Click the hidden file input in the AudioUpload component
          const fileInput = document.querySelector(
            'input[type="file"][accept="audio/*"]'
          ) as HTMLInputElement | null;
          fileInput?.click();
        }}
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Upload className="size-3.5" />
          Drop audio files here
        </div>
      </div>

      {/* Dropped file upload dialog */}
      {droppedFile && (
        <AudioUpload
          songId={songId}
          type="version"
          uploading={uploading}
          onUploadingChange={setUploading}
          preselectedFile={droppedFile}
          onComplete={() => setDroppedFile(null)}
        />
      )}

      {/* Edit dialog */}
      <Dialog
        open={!!editingVersion}
        onOpenChange={(open) => !open && setEditingVersion(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Version</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-category">Category</Label>
              <select
                id="edit-category"
                value={editCategory}
                onChange={(e) =>
                  setEditCategory(e.target.value as VersionCategory | "")
                }
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">No category</option>
                {VERSION_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Input
                id="edit-notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Add notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingVersion(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleSaveEdit()}
              disabled={!editTitle.trim()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deletingVersion}
        onOpenChange={(open) => !open && setDeletingVersion(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Version</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deletingVersion?.title}
              &rdquo;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingVersion(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDelete()}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// -- Current Version Card (expanded) --

function CurrentVersionCard({
  version,
  songId,
  onPlay,
  onEdit,
  onDelete,
  onSetCurrent,
}: {
  version: Version;
  songId: Id<"songs">;
  onPlay?: (audio: ActiveAudio) => void;
  onEdit: (version: Version) => void;
  onDelete: (version: Version) => void;
  onSetCurrent: (id: Id<"songVersions">) => void;
}) {
  const markers = useQuery(api.versionMarkers.listByVersion, {
    versionId: version._id,
  });
  const createMarker = useMutation(api.versionMarkers.create);

  const audioMarkers: AudioMarker[] = (markers ?? []).map((m) => ({
    timestamp: m.timestamp,
    text: m.text,
  }));

  const [addingMarker, setAddingMarker] = useState(false);
  const [markerTimestamp, setMarkerTimestamp] = useState(0);
  const [markerText, setMarkerText] = useState("");

  const handleMarkerAdd = useCallback((timestamp: number) => {
    setMarkerTimestamp(timestamp);
    setMarkerText("");
    setAddingMarker(true);
  }, []);

  const handleSaveMarker = useCallback(async () => {
    if (!markerText.trim()) return;
    await createMarker({
      versionId: version._id,
      songId,
      timestamp: markerTimestamp,
      text: markerText.trim(),
    });
    setAddingMarker(false);
    setMarkerText("");
  }, [createMarker, version._id, songId, markerTimestamp, markerText]);

  return (
    <div className="rounded-lg border-2 border-primary/20 bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="size-3.5 fill-primary text-primary" />
          <h4 className="text-sm font-medium">{version.title}</h4>
          {version.category && <CategoryBadge category={version.category} />}
        </div>
        <VersionMenu
          version={version}
          onPlay={onPlay}
          onEdit={onEdit}
          onDelete={onDelete}
          onSetCurrent={onSetCurrent}
        />
      </div>

      <p className="mb-3 text-xs text-muted-foreground">
        by {version.creatorName} &middot;{" "}
        {formatTimeAgo(version._creationTime)}
        {version.duration != null && (
          <> &middot; {formatDuration(version.duration)}</>
        )}
      </p>

      {version.audioUrl && (
        <AudioPlayer
          src={version.audioUrl}
          size="large"
          markers={audioMarkers}
          onMarkerAdd={handleMarkerAdd}
        />
      )}

      {version.notes && (
        <p className="mt-3 text-xs text-muted-foreground italic">
          {version.notes}
        </p>
      )}

      {/* Marker add popover */}
      {addingMarker && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatDuration(markerTimestamp)}
          </span>
          <Input
            value={markerText}
            onChange={(e) => setMarkerText(e.target.value)}
            placeholder="Add a note..."
            className="h-7 text-xs flex-1"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSaveMarker();
              if (e.key === "Escape") setAddingMarker(false);
            }}
          />
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={() => void handleSaveMarker()}
            disabled={!markerText.trim()}
          >
            Add
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => setAddingMarker(false)}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

// -- Compact Version Row --

function CompactVersionRow({
  version,
  onPlay,
  onEdit,
  onDelete,
  onSetCurrent,
  compareMode,
  compareSelected,
  onCompareToggle,
}: {
  version: Version;
  onPlay?: (audio: ActiveAudio) => void;
  onEdit: (version: Version) => void;
  onDelete: (version: Version) => void;
  onSetCurrent: (id: Id<"songVersions">) => void;
  compareMode: boolean;
  compareSelected: boolean;
  onCompareToggle: (id: Id<"songVersions">) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-card px-4 py-3 transition-colors",
        compareMode && "cursor-pointer hover:bg-muted/50",
        compareSelected && "border-primary/40 bg-primary/5"
      )}
      onClick={compareMode ? () => onCompareToggle(version._id) : undefined}
    >
      {/* Compare checkbox */}
      {compareMode && (
        <div
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded border",
            compareSelected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground/30"
          )}
        >
          {compareSelected && (
            <svg
              className="size-3"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M2 6l3 3 5-5" />
            </svg>
          )}
        </div>
      )}

      {/* Play button */}
      {!compareMode && version.audioUrl && onPlay && (
        <Button
          variant="ghost"
          size="icon-xs"
          className="shrink-0"
          onClick={() =>
            onPlay({
              src: version.audioUrl!,
              title: version.title,
              type: "version",
            })
          }
        >
          <Play className="size-3" />
        </Button>
      )}

      {/* Info */}
      <div className="flex flex-1 items-center gap-2 min-w-0">
        <span className="text-sm font-medium truncate">{version.title}</span>
        {version.category && <CategoryBadge category={version.category} />}
      </div>

      {/* Meta */}
      <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
        {version.duration != null && (
          <span className="tabular-nums">{formatDuration(version.duration)}</span>
        )}
        <span>{formatTimeAgo(version._creationTime)}</span>
      </div>

      {/* Menu */}
      {!compareMode && (
        <VersionMenu
          version={version}
          onPlay={onPlay}
          onEdit={onEdit}
          onDelete={onDelete}
          onSetCurrent={onSetCurrent}
        />
      )}
    </div>
  );
}

// -- Category Badge --

function CategoryBadge({ category }: { category: VersionCategory }) {
  const colors = CATEGORY_COLORS[category];
  return (
    <Badge
      variant="secondary"
      className={cn("text-[10px] px-1.5 py-0", colors.bg, colors.text)}
    >
      {CATEGORY_LABELS[category]}
    </Badge>
  );
}

// -- Version Menu --

function VersionMenu({
  version,
  onPlay,
  onEdit,
  onDelete,
  onSetCurrent,
}: {
  version: Version;
  onPlay?: (audio: ActiveAudio) => void;
  onEdit: (version: Version) => void;
  onDelete: (version: Version) => void;
  onSetCurrent: (id: Id<"songVersions">) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-xs">
          <MoreHorizontal className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {version.audioUrl && onPlay && (
          <DropdownMenuItem
            onClick={() =>
              onPlay({
                src: version.audioUrl!,
                title: version.title,
                type: "version",
              })
            }
          >
            <Play className="size-3.5 mr-2" />
            Play
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => onEdit(version)}>
          <Pencil className="size-3.5 mr-2" />
          Edit
        </DropdownMenuItem>
        {!version.isCurrent && (
          <DropdownMenuItem onClick={() => onSetCurrent(version._id)}>
            <Star className="size-3.5 mr-2" />
            Set as Current
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onDelete(version)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="size-3.5 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

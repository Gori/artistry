"use client";

import { useMemo, useRef, useState } from "react";
import { useQuery } from "convex/react";
import {
  Loader2,
  Layers,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RegionStatus = "added" | "removed" | "modified" | "unchanged";

interface TrackRegion {
  path: string;
  /** Normalized position (0-1) along the track lane. */
  position: number;
  /** Normalized width (0-1). */
  width: number;
  status: RegionStatus;
  fileName: string;
  size: number;
}

interface TrackLane {
  name: string;
  directoryPath: string;
  regionsA: TrackRegion[];
  regionsB: TrackRegion[];
  status: RegionStatus;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRACK_HEIGHT = 36;
const HEADER_WIDTH = 180;

const statusColors: Record<RegionStatus, string> = {
  added: "bg-green-500/70 dark:bg-green-500/50",
  removed: "bg-red-500/70 dark:bg-red-500/50",
  modified: "bg-yellow-500/70 dark:bg-yellow-500/50",
  unchanged: "bg-zinc-400/40 dark:bg-zinc-600/40",
};

const statusBorderColors: Record<RegionStatus, string> = {
  added: "border-green-600 dark:border-green-400",
  removed: "border-red-600 dark:border-red-400",
  modified: "border-yellow-600 dark:border-yellow-400",
  unchanged: "border-zinc-400 dark:border-zinc-600",
};

const statusTextColors: Record<RegionStatus, string> = {
  added: "text-green-700 dark:text-green-300",
  removed: "text-red-700 dark:text-red-300",
  modified: "text-yellow-700 dark:text-yellow-300",
  unchanged: "text-muted-foreground",
};

const statusLabels: Record<RegionStatus, string> = {
  added: "Added",
  removed: "Removed",
  modified: "Modified",
  unchanged: "Unchanged",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTrackDirectory(filePath: string): string {
  const parts = filePath.split("/");
  // Keep the first two meaningful directory segments
  // e.g. "Media/Track 1/audio.wav" -> "Media/Track 1"
  if (parts.length >= 2) return parts.slice(0, 2).join("/");
  if (parts.length === 1) return parts[0];
  return filePath;
}

function getFileName(path: string): string {
  return path.split("/").pop() ?? path;
}

/**
 * Group manifest entries by track directory and compute diff status for
 * each region and track. Since we cannot parse actual arrangement data in
 * the browser, we use the file manifest as a proxy: each file inside a
 * track directory is treated as a "region" in the arrangement view.
 */
function buildTrackLanes(
  manifestA: Array<{ path: string; sha256: string; size: number }>,
  manifestB: Array<{ path: string; sha256: string; size: number }>
): TrackLane[] {
  // Build maps keyed by track directory -> files
  const groupByDir = (
    entries: Array<{ path: string; sha256: string; size: number }>
  ) => {
    const map = new Map<
      string,
      Array<{ path: string; sha256: string; size: number }>
    >();
    for (const entry of entries) {
      const dir = getTrackDirectory(entry.path);
      if (!map.has(dir)) map.set(dir, []);
      map.get(dir)!.push(entry);
    }
    return map;
  };

  const dirsA = groupByDir(manifestA);
  const dirsB = groupByDir(manifestB);
  const allDirs = new Set([...dirsA.keys(), ...dirsB.keys()]);

  const lanes: TrackLane[] = [];

  for (const dir of allDirs) {
    const filesA = dirsA.get(dir) ?? [];
    const filesB = dirsB.get(dir) ?? [];

    const mapA = new Map(filesA.map((f) => [f.path, f]));
    const mapB = new Map(filesB.map((f) => [f.path, f]));
    const allPaths = new Set([...mapA.keys(), ...mapB.keys()]);

    const maxFiles = Math.max(allPaths.size, 1);

    // Determine per-file status
    const regionsA: TrackRegion[] = [];
    const regionsB: TrackRegion[] = [];
    let idx = 0;
    let hasChanges = false;

    for (const path of allPaths) {
      const entryA = mapA.get(path);
      const entryB = mapB.get(path);
      const position = idx / maxFiles;
      const width = 1 / maxFiles;
      const fileName = getFileName(path);

      let status: RegionStatus;
      if (entryA && !entryB) {
        status = "removed";
        hasChanges = true;
      } else if (!entryA && entryB) {
        status = "added";
        hasChanges = true;
      } else if (entryA && entryB && entryA.sha256 !== entryB.sha256) {
        status = "modified";
        hasChanges = true;
      } else {
        status = "unchanged";
      }

      if (entryA) {
        regionsA.push({
          path,
          position,
          width,
          status: status === "added" ? "unchanged" : status,
          fileName,
          size: entryA.size,
        });
      }

      if (entryB) {
        regionsB.push({
          path,
          position,
          width,
          status: status === "removed" ? "unchanged" : status,
          fileName,
          size: entryB.size,
        });
      }

      idx++;
    }

    // Determine overall track status
    let trackStatus: RegionStatus = "unchanged";
    if (filesA.length === 0 && filesB.length > 0) trackStatus = "added";
    else if (filesA.length > 0 && filesB.length === 0) trackStatus = "removed";
    else if (hasChanges) trackStatus = "modified";

    lanes.push({
      name: dir,
      directoryPath: dir,
      regionsA,
      regionsB,
      status: trackStatus,
    });
  }

  // Sort: changed tracks first, then alphabetically
  const sortOrder: Record<RegionStatus, number> = {
    added: 0,
    modified: 1,
    removed: 2,
    unchanged: 3,
  };
  lanes.sort(
    (a, b) =>
      (sortOrder[a.status] ?? 4) - (sortOrder[b.status] ?? 4) ||
      a.name.localeCompare(b.name)
  );

  return lanes;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ArrangementDiffProps {
  versionAId: Id<"logicProjectVersions">;
  versionBId: Id<"logicProjectVersions">;
}

export function ArrangementDiff({
  versionAId,
  versionBId,
}: ArrangementDiffProps) {
  const versionA = useQuery(api.logicProjectVersions.get, { id: versionAId });
  const versionB = useQuery(api.logicProjectVersions.get, { id: versionBId });

  const scrollRefs = useRef(new Map<number, HTMLDivElement>());
  const [zoom, setZoom] = useState(1);

  const lanes = useMemo(() => {
    if (!versionA || !versionB) return null;
    return buildTrackLanes(versionA.manifest, versionB.manifest);
  }, [versionA, versionB]);

  // Loading state
  if (versionA === undefined || versionB === undefined) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (versionA === null || versionB === null) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        One or both versions could not be found.
      </div>
    );
  }

  if (!lanes || lanes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <Layers className="mx-auto mb-2 size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No track data found in either version.
        </p>
      </div>
    );
  }

  const summary = {
    added: lanes.filter((l) => l.status === "added").length,
    removed: lanes.filter((l) => l.status === "removed").length,
    modified: lanes.filter((l) => l.status === "modified").length,
    unchanged: lanes.filter((l) => l.status === "unchanged").length,
  };

  const contentWidth = 600 * zoom;

  const handleScroll = (direction: "left" | "right") => {
    const amount = direction === "left" ? -200 : 200;
    for (const el of scrollRefs.current.values()) {
      el.scrollBy({ left: amount, behavior: "smooth" });
    }
  };

  return (
    <div className="rounded-lg border">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Layers className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Arrangement Comparison</h3>
        </div>
        <div className="flex items-center gap-2">
          {/* Summary badges */}
          {summary.added > 0 && (
            <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/40 dark:text-green-300">
              +{summary.added} tracks
            </span>
          )}
          {summary.modified > 0 && (
            <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300">
              ~{summary.modified} tracks
            </span>
          )}
          {summary.removed > 0 && (
            <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-900/40 dark:text-red-300">
              -{summary.removed} tracks
            </span>
          )}

          {/* Zoom controls */}
          <div className="ml-2 flex items-center gap-1 border-l pl-2">
            <button
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
              title="Zoom out"
            >
              <ZoomOut className="size-3.5" />
            </button>
            <span className="min-w-[3ch] text-center text-xs text-muted-foreground">
              {Math.round(zoom * 100)}%
            </span>
            <button
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
              title="Zoom in"
            >
              <ZoomIn className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Version labels row */}
      <div className="grid grid-cols-2 border-b bg-muted/30">
        <div className="flex items-center gap-2 border-r px-4 py-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Version A &mdash; v{versionA.versionNumber}
          </span>
        </div>
        <div className="flex items-center gap-2 px-4 py-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Version B &mdash; v{versionB.versionNumber}
          </span>
        </div>
      </div>

      {/* Arrangement lanes */}
      <div className="relative">
        {/* Scroll buttons */}
        <button
          onClick={() => handleScroll("left")}
          className="absolute left-0 top-0 z-10 flex h-full w-6 items-center justify-center bg-gradient-to-r from-background to-transparent opacity-0 transition-opacity hover:opacity-100"
        >
          <ChevronLeft className="size-4 text-muted-foreground" />
        </button>
        <button
          onClick={() => handleScroll("right")}
          className="absolute right-0 top-0 z-10 flex h-full w-6 items-center justify-center bg-gradient-to-l from-background to-transparent opacity-0 transition-opacity hover:opacity-100"
        >
          <ChevronRight className="size-4 text-muted-foreground" />
        </button>

        <div className="divide-y">
          {lanes.map((lane, laneIndex) => (
            <div key={lane.directoryPath} className="flex">
              {/* Track name header */}
              <div
                className={cn(
                  "flex shrink-0 items-center border-r px-3 text-xs font-mono",
                  statusTextColors[lane.status]
                )}
                style={{ width: HEADER_WIDTH, height: TRACK_HEIGHT * 2 + 1 }}
              >
                <span className="truncate" title={lane.name}>
                  {lane.name}
                </span>
              </div>

              {/* Region lanes (two rows: A on top, B on bottom) */}
              <div
                ref={(el) => {
                  if (el) scrollRefs.current.set(laneIndex, el);
                  else scrollRefs.current.delete(laneIndex);
                }}
                className="flex-1 overflow-x-auto"
              >
                <div style={{ width: contentWidth }}>
                  {/* Version A row */}
                  <div
                    className="relative border-b border-dashed border-border/50"
                    style={{ height: TRACK_HEIGHT }}
                  >
                    {lane.regionsA.map((region) => (
                      <div
                        key={region.path}
                        className={cn(
                          "absolute top-1 bottom-1 rounded-sm border",
                          statusColors[region.status],
                          statusBorderColors[region.status]
                        )}
                        style={{
                          left: `${region.position * 100}%`,
                          width: `${Math.max(region.width * 100, 1)}%`,
                        }}
                        title={`${region.fileName} (${statusLabels[region.status]})`}
                      >
                        <span className="block truncate px-1 text-[10px] leading-tight text-white mix-blend-difference">
                          {region.fileName}
                        </span>
                      </div>
                    ))}
                    {lane.regionsA.length === 0 && (
                      <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground italic">
                        &mdash;
                      </div>
                    )}
                  </div>
                  {/* Version B row */}
                  <div
                    className="relative"
                    style={{ height: TRACK_HEIGHT }}
                  >
                    {lane.regionsB.map((region) => (
                      <div
                        key={region.path}
                        className={cn(
                          "absolute top-1 bottom-1 rounded-sm border",
                          statusColors[region.status],
                          statusBorderColors[region.status]
                        )}
                        style={{
                          left: `${region.position * 100}%`,
                          width: `${Math.max(region.width * 100, 1)}%`,
                        }}
                        title={`${region.fileName} (${statusLabels[region.status]})`}
                      >
                        <span className="block truncate px-1 text-[10px] leading-tight text-white mix-blend-difference">
                          {region.fileName}
                        </span>
                      </div>
                    ))}
                    {lane.regionsB.length === 0 && (
                      <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground italic">
                        &mdash;
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 border-t px-4 py-2">
        {(["added", "modified", "removed", "unchanged"] as const).map(
          (status) => (
            <span
              key={status}
              className="flex items-center gap-1.5 text-xs"
            >
              <span
                className={cn(
                  "inline-block size-2.5 rounded-sm border",
                  statusColors[status],
                  statusBorderColors[status]
                )}
              />
              <span className={statusTextColors[status]}>
                {statusLabels[status]}
              </span>
            </span>
          )
        )}
      </div>
    </div>
  );
}

"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import { useQuery } from "convex/react";
import {
  Loader2,
  GitCompareArrows,
  FileSymlink,
  FilePlus,
  FileMinus,
  FileCheck,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { formatBytes } from "@artistry/ui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MatchStatus = "matched" | "renamed" | "added" | "removed";

interface TrackEntry {
  directory: string;
  fileCount: number;
  totalSize: number;
  contentHash: string;
}

interface TrackMatch {
  trackA: TrackEntry | null;
  trackB: TrackEntry | null;
  status: MatchStatus;
  similarity: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_COLORS = {
  matched: {
    text: "text-muted-foreground",
    bg: "",
    line: "#a1a1aa", // zinc-400
    badge: "bg-muted text-muted-foreground",
  },
  renamed: {
    text: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    line: "#60a5fa", // blue-400
    badge:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  added: {
    text: "text-green-600 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-950/30",
    line: "#4ade80", // green-400
    badge:
      "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  },
  removed: {
    text: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/30",
    line: "#f87171", // red-400
    badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
} as const;

const ROW_HEIGHT = 40;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTrackDirectory(filePath: string): string {
  const parts = filePath.split("/");
  if (parts.length >= 2) return parts.slice(0, 2).join("/");
  return parts[0] ?? filePath;
}

/**
 * Compute a content hash for a track directory by combining the sorted
 * SHA-256 hashes of all files in it. Two directories with identical file
 * contents (regardless of directory name) will produce the same hash.
 */
function computeContentHash(
  hashes: string[]
): string {
  return hashes.slice().sort().join(",");
}

/**
 * Compute Jaccard similarity between two sets of file hashes.
 */
function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 1;
  let intersection = 0;
  for (const h of setA) {
    if (setB.has(h)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Build track entries from a manifest by grouping files by track directory.
 */
function buildTrackEntries(
  manifest: Array<{ path: string; sha256: string; size: number }>
): TrackEntry[] {
  const dirMap = new Map<
    string,
    { hashes: string[]; sizes: number[]; count: number }
  >();

  for (const entry of manifest) {
    const dir = getTrackDirectory(entry.path);
    if (!dirMap.has(dir)) {
      dirMap.set(dir, { hashes: [], sizes: [], count: 0 });
    }
    const group = dirMap.get(dir)!;
    group.hashes.push(entry.sha256);
    group.sizes.push(entry.size);
    group.count++;
  }

  const entries: TrackEntry[] = [];
  for (const [dir, data] of dirMap) {
    entries.push({
      directory: dir,
      fileCount: data.count,
      totalSize: data.sizes.reduce((a, b) => a + b, 0),
      contentHash: computeContentHash(data.hashes),
    });
  }

  entries.sort((a, b) => a.directory.localeCompare(b.directory));
  return entries;
}

/**
 * Match tracks between two versions using content-hash identity and
 * Jaccard similarity for rename detection.
 */
function matchTracks(
  tracksA: TrackEntry[],
  tracksB: TrackEntry[],
  manifestA: Array<{ path: string; sha256: string; size: number }>,
  manifestB: Array<{ path: string; sha256: string; size: number }>
): TrackMatch[] {
  const matches: TrackMatch[] = [];
  const matchedA = new Set<string>();
  const matchedB = new Set<string>();

  // Build hash-set-per-directory lookup for similarity computation
  const hashSetsA = new Map<string, Set<string>>();
  const hashSetsB = new Map<string, Set<string>>();

  for (const entry of manifestA) {
    const dir = getTrackDirectory(entry.path);
    if (!hashSetsA.has(dir)) hashSetsA.set(dir, new Set());
    hashSetsA.get(dir)!.add(entry.sha256);
  }
  for (const entry of manifestB) {
    const dir = getTrackDirectory(entry.path);
    if (!hashSetsB.has(dir)) hashSetsB.set(dir, new Set());
    hashSetsB.get(dir)!.add(entry.sha256);
  }

  // Pass 1: Exact directory name match
  for (const a of tracksA) {
    const b = tracksB.find((t) => t.directory === a.directory);
    if (b) {
      matchedA.add(a.directory);
      matchedB.add(b.directory);
      matches.push({
        trackA: a,
        trackB: b,
        status: "matched",
        similarity: jaccardSimilarity(
          hashSetsA.get(a.directory) ?? new Set(),
          hashSetsB.get(b.directory) ?? new Set()
        ),
      });
    }
  }

  // Pass 2: Content-hash rename detection on unmatched tracks
  const unmatchedA = tracksA.filter((t) => !matchedA.has(t.directory));
  const unmatchedB = tracksB.filter((t) => !matchedB.has(t.directory));

  // Build a map of contentHash -> track for B
  const contentMapB = new Map<string, TrackEntry>();
  for (const b of unmatchedB) {
    contentMapB.set(b.contentHash, b);
  }

  for (const a of unmatchedA) {
    const b = contentMapB.get(a.contentHash);
    if (b && !matchedB.has(b.directory)) {
      matchedA.add(a.directory);
      matchedB.add(b.directory);
      matches.push({
        trackA: a,
        trackB: b,
        status: "renamed",
        similarity: 1,
      });
    }
  }

  // Pass 3: High-similarity matches (>= 0.7 Jaccard)
  const stillUnmatchedA = tracksA.filter((t) => !matchedA.has(t.directory));
  const stillUnmatchedB = tracksB.filter((t) => !matchedB.has(t.directory));

  for (const a of stillUnmatchedA) {
    let bestMatch: TrackEntry | null = null;
    let bestSim = 0;

    const setA = hashSetsA.get(a.directory) ?? new Set();

    for (const b of stillUnmatchedB) {
      if (matchedB.has(b.directory)) continue;
      const setB = hashSetsB.get(b.directory) ?? new Set();
      const sim = jaccardSimilarity(setA, setB);
      if (sim > bestSim && sim >= 0.7) {
        bestSim = sim;
        bestMatch = b;
      }
    }

    if (bestMatch) {
      matchedA.add(a.directory);
      matchedB.add(bestMatch.directory);
      matches.push({
        trackA: a,
        trackB: bestMatch,
        status: "renamed",
        similarity: bestSim,
      });
    }
  }

  // Pass 4: Remaining unmatched = added / removed
  for (const a of tracksA) {
    if (!matchedA.has(a.directory)) {
      matches.push({
        trackA: a,
        trackB: null,
        status: "removed",
        similarity: 0,
      });
    }
  }
  for (const b of tracksB) {
    if (!matchedB.has(b.directory)) {
      matches.push({
        trackA: null,
        trackB: b,
        status: "added",
        similarity: 0,
      });
    }
  }

  // Sort: renamed first, then matched, added, removed
  const sortOrder: Record<MatchStatus, number> = {
    renamed: 0,
    matched: 1,
    added: 2,
    removed: 3,
  };
  matches.sort(
    (a, b) =>
      (sortOrder[a.status] ?? 4) - (sortOrder[b.status] ?? 4) ||
      (a.trackA?.directory ?? "").localeCompare(b.trackA?.directory ?? "")
  );

  return matches;
}

// ---------------------------------------------------------------------------
// SVG connection lines
// ---------------------------------------------------------------------------

function ConnectionLines({
  matches,
  containerRef,
}: {
  matches: TrackMatch[];
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [containerRef]);

  if (dimensions.width === 0 || dimensions.height === 0) return null;

  // Build index maps for left (A) and right (B) columns
  const leftItems: Array<{ directory: string; rowIndex: number }> = [];
  const rightItems: Array<{ directory: string; rowIndex: number }> = [];

  let leftIdx = 0;
  let rightIdx = 0;

  for (const m of matches) {
    if (m.trackA) {
      leftItems.push({ directory: m.trackA.directory, rowIndex: leftIdx });
      leftIdx++;
    }
    if (m.trackB) {
      rightItems.push({ directory: m.trackB.directory, rowIndex: rightIdx });
      rightIdx++;
    }
  }

  // Map directory -> row index
  const leftMap = new Map(leftItems.map((item) => [item.directory, item.rowIndex]));
  const rightMap = new Map(rightItems.map((item) => [item.directory, item.rowIndex]));

  const gapWidth = 80;
  const columnWidth = (dimensions.width - gapWidth) / 2;
  const xLeft = columnWidth;
  const xRight = columnWidth + gapWidth;

  const lines: Array<{
    y1: number;
    y2: number;
    color: string;
    status: MatchStatus;
  }> = [];

  for (const m of matches) {
    if (m.trackA && m.trackB) {
      const leftRow = leftMap.get(m.trackA.directory);
      const rightRow = rightMap.get(m.trackB.directory);
      if (leftRow !== undefined && rightRow !== undefined) {
        lines.push({
          y1: leftRow * ROW_HEIGHT + ROW_HEIGHT / 2,
          y2: rightRow * ROW_HEIGHT + ROW_HEIGHT / 2,
          color: STATUS_COLORS[m.status].line,
          status: m.status,
        });
      }
    }
  }

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={dimensions.width}
      height={dimensions.height}
    >
      {lines.map((line, i) => (
        <path
          key={i}
          d={`M ${xLeft} ${line.y1} C ${xLeft + gapWidth / 2} ${line.y1}, ${xRight - gapWidth / 2} ${line.y2}, ${xRight} ${line.y2}`}
          fill="none"
          stroke={line.color}
          strokeWidth={line.status === "renamed" ? 2 : 1}
          strokeDasharray={
            line.status === "renamed" ? "4 2" : undefined
          }
          opacity={0.6}
        />
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TrackMapProps {
  versionAId: Id<"logicProjectVersions">;
  versionBId: Id<"logicProjectVersions">;
}

export function TrackMap({ versionAId, versionBId }: TrackMapProps) {
  const versionA = useQuery(api.logicProjectVersions.get, { id: versionAId });
  const versionB = useQuery(api.logicProjectVersions.get, { id: versionBId });

  const containerRef = useRef<HTMLDivElement>(null);
  const [showUnchanged, setShowUnchanged] = useState(true);

  const { matches, summary } = useMemo(() => {
    if (!versionA || !versionB) {
      return { matches: [], summary: { matched: 0, renamed: 0, added: 0, removed: 0 } };
    }

    const tracksA = buildTrackEntries(versionA.manifest);
    const tracksB = buildTrackEntries(versionB.manifest);
    const m = matchTracks(tracksA, tracksB, versionA.manifest, versionB.manifest);

    return {
      matches: m,
      summary: {
        matched: m.filter((x) => x.status === "matched").length,
        renamed: m.filter((x) => x.status === "renamed").length,
        added: m.filter((x) => x.status === "added").length,
        removed: m.filter((x) => x.status === "removed").length,
      },
    };
  }, [versionA, versionB]);

  // Loading
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

  if (matches.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <GitCompareArrows className="mx-auto mb-2 size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No track directories found in either version.
        </p>
      </div>
    );
  }

  const visibleMatches = showUnchanged
    ? matches
    : matches.filter((m) => m.status !== "matched");

  // Separate left and right entries for the two-column layout
  const leftEntries = visibleMatches
    .filter((m) => m.trackA)
    .map((m) => ({ track: m.trackA!, match: m }));
  const rightEntries = visibleMatches
    .filter((m) => m.trackB)
    .map((m) => ({ track: m.trackB!, match: m }));

  return (
    <div className="rounded-lg border">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <GitCompareArrows className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Track Identity Map</h3>
        </div>
        <div className="flex items-center gap-2">
          {summary.renamed > 0 && (
            <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              {summary.renamed} renamed
            </span>
          )}
          {summary.added > 0 && (
            <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/40 dark:text-green-300">
              +{summary.added} new
            </span>
          )}
          {summary.removed > 0 && (
            <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-900/40 dark:text-red-300">
              -{summary.removed} removed
            </span>
          )}
          {summary.matched > 0 && (
            <button
              className={cn(
                "rounded px-2 py-0.5 text-xs transition-colors",
                showUnchanged
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setShowUnchanged(!showUnchanged)}
            >
              {summary.matched} unchanged
            </button>
          )}
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_80px_1fr] border-b bg-muted/30">
        <div className="flex items-center gap-2 px-4 py-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Version A &mdash; v{versionA.versionNumber}
          </span>
        </div>
        <div />
        <div className="flex items-center gap-2 px-4 py-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Version B &mdash; v{versionB.versionNumber}
          </span>
        </div>
      </div>

      {/* Two-column track map with SVG connections */}
      <div className="relative" ref={containerRef}>
        <ConnectionLines matches={visibleMatches} containerRef={containerRef} />

        <div className="grid grid-cols-[1fr_80px_1fr]">
          {/* Left column (Version A) */}
          <div className="divide-y">
            {leftEntries.map(({ track, match }) => {
              const StatusIcon =
                match.status === "renamed"
                  ? FileSymlink
                  : match.status === "removed"
                    ? FileMinus
                    : FileCheck;

              return (
                <div
                  key={track.directory}
                  className={cn(
                    "flex items-center gap-2 px-4 text-sm",
                    STATUS_COLORS[match.status].bg
                  )}
                  style={{ height: ROW_HEIGHT }}
                >
                  <StatusIcon
                    className={cn(
                      "size-3.5 shrink-0",
                      STATUS_COLORS[match.status].text
                    )}
                  />
                  <span
                    className="min-w-0 flex-1 truncate font-mono text-xs"
                    title={track.directory}
                  >
                    {track.directory}
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {track.fileCount}f / {formatBytes(track.totalSize)}
                  </span>
                </div>
              );
            })}
            {leftEntries.length === 0 && (
              <div
                className="flex items-center justify-center text-xs text-muted-foreground italic"
                style={{ height: ROW_HEIGHT }}
              >
                No tracks
              </div>
            )}
          </div>

          {/* Center gap (lines are drawn via SVG overlay) */}
          <div className="border-x" />

          {/* Right column (Version B) */}
          <div className="divide-y">
            {rightEntries.map(({ track, match }) => {
              const StatusIcon =
                match.status === "renamed"
                  ? FileSymlink
                  : match.status === "added"
                    ? FilePlus
                    : FileCheck;

              return (
                <div
                  key={track.directory}
                  className={cn(
                    "flex items-center gap-2 px-4 text-sm",
                    STATUS_COLORS[match.status].bg
                  )}
                  style={{ height: ROW_HEIGHT }}
                >
                  <StatusIcon
                    className={cn(
                      "size-3.5 shrink-0",
                      STATUS_COLORS[match.status].text
                    )}
                  />
                  <span
                    className="min-w-0 flex-1 truncate font-mono text-xs"
                    title={track.directory}
                  >
                    {track.directory}
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {track.fileCount}f / {formatBytes(track.totalSize)}
                  </span>
                </div>
              );
            })}
            {rightEntries.length === 0 && (
              <div
                className="flex items-center justify-center text-xs text-muted-foreground italic"
                style={{ height: ROW_HEIGHT }}
              >
                No tracks
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 border-t px-4 py-2">
        {(["matched", "renamed", "added", "removed"] as const).map(
          (status) => {
            const count = summary[status];
            if (count === 0) return null;
            const Icon =
              status === "renamed"
                ? FileSymlink
                : status === "added"
                  ? FilePlus
                  : status === "removed"
                    ? FileMinus
                    : FileCheck;

            return (
              <span
                key={status}
                className={cn(
                  "flex items-center gap-1 text-xs",
                  STATUS_COLORS[status].text
                )}
              >
                <Icon className="size-3" />
                {count}{" "}
                {status === "matched"
                  ? "unchanged"
                  : status}
              </span>
            );
          }
        )}
      </div>
    </div>
  );
}

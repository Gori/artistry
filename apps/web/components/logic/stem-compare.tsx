"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import {
  FileAudio,
  FilePlus,
  FileMinus,
  FileCheck,
  Loader2,
  Music,
  HardDrive,
  ArrowLeftRight,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { formatBytes } from "@artistry/ui";

const AUDIO_EXTENSIONS = [".wav", ".aif", ".aiff"];

function isAudioFile(path: string): boolean {
  const lower = path.toLowerCase();
  return AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function getFileName(path: string): string {
  return path.split("/").pop() ?? path;
}

type StemStatus = "new" | "removed" | "unchanged" | "modified";

interface StemEntry {
  path: string;
  fileName: string;
  status: StemStatus;
  sizeA?: number;
  sizeB?: number;
  sha256A?: string;
  sha256B?: string;
}

const statusIcons = {
  new: FilePlus,
  removed: FileMinus,
  unchanged: FileCheck,
  modified: FileAudio,
} as const;

const statusColors = {
  new: "text-green-600 dark:text-green-400",
  removed: "text-red-600 dark:text-red-400",
  unchanged: "text-muted-foreground",
  modified: "text-yellow-600 dark:text-yellow-400",
} as const;

const statusBgColors = {
  new: "bg-green-50 dark:bg-green-950/30",
  removed: "bg-red-50 dark:bg-red-950/30",
  unchanged: "",
  modified: "bg-yellow-50 dark:bg-yellow-950/30",
} as const;

const statusLabels = {
  new: "New",
  removed: "Removed",
  unchanged: "Unchanged",
  modified: "Modified",
} as const;

interface StemCompareProps {
  versionAId: Id<"logicProjectVersions">;
  versionBId: Id<"logicProjectVersions">;
  versionANumber: number;
  versionBNumber: number;
}

export function StemCompare({
  versionAId,
  versionBId,
  versionANumber,
  versionBNumber,
}: StemCompareProps) {
  const versionA = useQuery(api.logicProjectVersions.get, { id: versionAId });
  const versionB = useQuery(api.logicProjectVersions.get, { id: versionBId });

  const comparison = useMemo(() => {
    if (!versionA || !versionB) return null;

    const audioA = versionA.manifest.filter((e) => isAudioFile(e.path));
    const audioB = versionB.manifest.filter((e) => isAudioFile(e.path));

    const mapA = new Map(audioA.map((e) => [e.path, e]));
    const mapB = new Map(audioB.map((e) => [e.path, e]));

    const allPaths = new Set([...mapA.keys(), ...mapB.keys()]);

    const entries: StemEntry[] = [];

    for (const path of allPaths) {
      const entryA = mapA.get(path);
      const entryB = mapB.get(path);

      let status: StemStatus;
      if (entryA && !entryB) {
        status = "removed";
      } else if (!entryA && entryB) {
        status = "new";
      } else if (entryA && entryB && entryA.sha256 !== entryB.sha256) {
        status = "modified";
      } else {
        status = "unchanged";
      }

      entries.push({
        path,
        fileName: getFileName(path),
        status,
        sizeA: entryA?.size,
        sizeB: entryB?.size,
        sha256A: entryA?.sha256,
        sha256B: entryB?.sha256,
      });
    }

    // Sort: new first, then modified, unchanged, removed
    const sortOrder = { new: 0, modified: 1, unchanged: 2, removed: 3 };
    entries.sort(
      (a, b) =>
        (sortOrder[a.status] ?? 4) - (sortOrder[b.status] ?? 4) ||
        a.path.localeCompare(b.path)
    );

    const summary = {
      new: entries.filter((e) => e.status === "new").length,
      removed: entries.filter((e) => e.status === "removed").length,
      modified: entries.filter((e) => e.status === "modified").length,
      unchanged: entries.filter((e) => e.status === "unchanged").length,
    };

    return { entries, summary };
  }, [versionA, versionB]);

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

  if (!comparison || comparison.entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <Music className="mx-auto mb-2 size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No audio stems found in either version.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">
            Stem Comparison
          </h3>
        </div>
        <div className="flex items-center gap-1">
          {comparison.summary.new > 0 && (
            <span className="rounded px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
              +{comparison.summary.new} new
            </span>
          )}
          {comparison.summary.modified > 0 && (
            <span className="rounded px-2 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300">
              ~{comparison.summary.modified} modified
            </span>
          )}
          {comparison.summary.removed > 0 && (
            <span className="rounded px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
              -{comparison.summary.removed} removed
            </span>
          )}
          {comparison.summary.unchanged > 0 && (
            <span className="rounded px-2 py-0.5 text-xs text-muted-foreground">
              {comparison.summary.unchanged} unchanged
            </span>
          )}
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-2 border-b bg-muted/30">
        <div className="flex items-center gap-2 border-r px-4 py-2">
          <span className="text-xs font-medium text-muted-foreground">
            Version A &mdash; v{versionANumber}
          </span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2">
          <span className="text-xs font-medium text-muted-foreground">
            Version B &mdash; v{versionBNumber}
          </span>
        </div>
      </div>

      {/* Comparison rows */}
      <div className="divide-y">
        {comparison.entries.map((entry, i) => {
          const Icon = statusIcons[entry.status];
          return (
            <div
              key={`${entry.path}-${i}`}
              className={cn("grid grid-cols-2", statusBgColors[entry.status])}
            >
              {/* Version A column */}
              <div className="flex items-center gap-3 border-r px-4 py-2.5 text-sm">
                {entry.status === "new" ? (
                  <span className="flex-1 text-center text-xs text-muted-foreground italic">
                    &mdash;
                  </span>
                ) : (
                  <>
                    <Icon
                      className={cn("size-3.5 shrink-0", statusColors[entry.status])}
                    />
                    <span className="min-w-0 flex-1 truncate font-mono text-xs">
                      {entry.fileName}
                    </span>
                    {entry.sizeA !== undefined && (
                      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        <HardDrive className="size-3" />
                        {formatBytes(entry.sizeA)}
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* Version B column */}
              <div className="flex items-center gap-3 px-4 py-2.5 text-sm">
                {entry.status === "removed" ? (
                  <span className="flex-1 text-center text-xs text-muted-foreground italic">
                    &mdash;
                  </span>
                ) : (
                  <>
                    <Icon
                      className={cn("size-3.5 shrink-0", statusColors[entry.status])}
                    />
                    <span className="min-w-0 flex-1 truncate font-mono text-xs">
                      {entry.fileName}
                    </span>
                    {entry.sizeB !== undefined && (
                      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        <HardDrive className="size-3" />
                        {formatBytes(entry.sizeB)}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer with status legend */}
      <div className="flex items-center gap-4 border-t px-4 py-2">
        {(
          ["new", "modified", "unchanged", "removed"] as const
        ).map((status) => {
          const Icon = statusIcons[status];
          const count = comparison.summary[status];
          if (count === 0) return null;
          return (
            <span
              key={status}
              className={cn(
                "flex items-center gap-1 text-xs",
                statusColors[status]
              )}
            >
              <Icon className="size-3" />
              {count} {statusLabels[status].toLowerCase()}
            </span>
          );
        })}
      </div>
    </div>
  );
}

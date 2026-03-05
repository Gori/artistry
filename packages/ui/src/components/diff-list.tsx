import { useState } from "react";
import {
  FilePlus,
  FileMinus,
  FileEdit,
  FileSymlink,
  ChevronRight,
} from "lucide-react";
import type { DiffEntry } from "@artistry/shared";
import { cn, formatBytes } from "../utils";

type DiffType = DiffEntry["type"];

const typeIcons: Record<DiffType, typeof FilePlus> = {
  added: FilePlus,
  removed: FileMinus,
  modified: FileEdit,
  renamed: FileSymlink,
};

const typeColors: Record<DiffType, string> = {
  added: "text-green-600 dark:text-green-400",
  removed: "text-red-600 dark:text-red-400",
  modified: "text-yellow-600 dark:text-yellow-400",
  renamed: "text-blue-600 dark:text-blue-400",
};

const typeBgColors: Record<DiffType, string> = {
  added: "bg-green-50 dark:bg-green-950/30",
  removed: "bg-red-50 dark:bg-red-950/30",
  modified: "bg-yellow-50 dark:bg-yellow-950/30",
  renamed: "bg-blue-50 dark:bg-blue-950/30",
};

export interface DiffListProps {
  entries: DiffEntry[];
  summary: {
    added: number;
    removed: number;
    modified: number;
    renamed: number;
  };
  title?: string;
  maxHeight?: number | string;
  className?: string;
}

export function DiffList({
  entries,
  summary,
  title,
  maxHeight,
  className,
}: DiffListProps) {
  const [filter, setFilter] = useState<string | null>(null);

  const filteredEntries = filter
    ? entries.filter((e) => e.type === filter)
    : entries;

  const sortOrder: Record<DiffType, number> = { added: 0, modified: 1, renamed: 2, removed: 3 };
  const sortedEntries = [...filteredEntries].sort(
    (a, b) =>
      sortOrder[a.type] - sortOrder[b.type] ||
      a.path.localeCompare(b.path)
  );

  return (
    <div className={cn("rounded-lg border", className)}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-medium">
          {title ?? `${entries.length} changed files`}
        </h3>
        <div className="flex items-center gap-1">
          <button
            className={cn(
              "rounded px-2 py-0.5 text-xs transition-colors",
              filter === null
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setFilter(null)}
          >
            All ({entries.length})
          </button>
          {summary.added > 0 && (
            <button
              className={cn(
                "rounded px-2 py-0.5 text-xs transition-colors",
                filter === "added"
                  ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setFilter(filter === "added" ? null : "added")}
            >
              +{summary.added}
            </button>
          )}
          {summary.modified > 0 && (
            <button
              className={cn(
                "rounded px-2 py-0.5 text-xs transition-colors",
                filter === "modified"
                  ? "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() =>
                setFilter(filter === "modified" ? null : "modified")
              }
            >
              ~{summary.modified}
            </button>
          )}
          {summary.removed > 0 && (
            <button
              className={cn(
                "rounded px-2 py-0.5 text-xs transition-colors",
                filter === "removed"
                  ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() =>
                setFilter(filter === "removed" ? null : "removed")
              }
            >
              -{summary.removed}
            </button>
          )}
          {summary.renamed > 0 && (
            <button
              className={cn(
                "rounded px-2 py-0.5 text-xs transition-colors",
                filter === "renamed"
                  ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() =>
                setFilter(filter === "renamed" ? null : "renamed")
              }
            >
              ↗{summary.renamed}
            </button>
          )}
        </div>
      </div>

      <div
        className="divide-y"
        style={maxHeight ? { maxHeight, overflow: "auto" } : undefined}
      >
        {sortedEntries.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            No changes matching filter
          </div>
        ) : (
          sortedEntries.map((entry, i) => {
            const Icon = typeIcons[entry.type];
            return (
              <div
                key={`${entry.path}-${i}`}
                className={cn(
                  "flex items-center gap-3 px-4 py-2 text-sm",
                  typeBgColors[entry.type]
                )}
              >
                <Icon
                  className={cn(
                    "size-3.5 shrink-0",
                    typeColors[entry.type]
                  )}
                />
                <span className="min-w-0 truncate font-mono text-xs">
                  {entry.type === "renamed" && entry.oldPath ? (
                    <>
                      <span className="text-muted-foreground">
                        {entry.oldPath}
                      </span>
                      <ChevronRight className="mx-1 inline size-3" />
                      {entry.path}
                    </>
                  ) : (
                    entry.path
                  )}
                </span>
                {entry.newSize !== undefined && (
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {formatBytes(entry.newSize)}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

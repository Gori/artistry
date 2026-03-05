"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import {
  Loader2,
  Music2,
  FilePlus,
  FileMinus,
  FileEdit,
  FileCheck,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { formatBytes } from "@artistry/ui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MidiFileStatus = "added" | "removed" | "modified" | "unchanged";

interface MidiFileEntry {
  path: string;
  fileName: string;
  status: MidiFileStatus;
  sizeA?: number;
  sizeB?: number;
  sha256A?: string;
  sha256B?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIDI_EXTENSIONS = [".mid", ".midi"];

const PIANO_ROLL_ROWS = 12; // One octave of note rows for the visual
const PIANO_ROLL_COLS = 16; // Grid columns

const statusIcons = {
  added: FilePlus,
  removed: FileMinus,
  modified: FileEdit,
  unchanged: FileCheck,
} as const;

const statusColors = {
  added: "text-green-600 dark:text-green-400",
  removed: "text-red-600 dark:text-red-400",
  modified: "text-yellow-600 dark:text-yellow-400",
  unchanged: "text-muted-foreground",
} as const;

const statusBgColors = {
  added: "bg-green-50 dark:bg-green-950/30",
  removed: "bg-red-50 dark:bg-red-950/30",
  modified: "bg-yellow-50 dark:bg-yellow-950/30",
  unchanged: "",
} as const;

const statusLabels = {
  added: "Added",
  removed: "Removed",
  modified: "Modified",
  unchanged: "Unchanged",
} as const;

const noteBgColors = {
  added: "bg-green-500/60",
  removed: "bg-red-500/60",
  modified: "bg-yellow-500/60",
  unchanged: "bg-zinc-500/30 dark:bg-zinc-600/30",
} as const;

const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isMidiFile(path: string): boolean {
  const lower = path.toLowerCase();
  return MIDI_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function getFileName(path: string): string {
  return path.split("/").pop() ?? path;
}

/**
 * Generate a deterministic pseudo-random pattern from a SHA-256 hash.
 * Used to create a visual representation of MIDI file content without
 * actually parsing the MIDI data.
 */
function hashToNotePattern(sha256: string): boolean[][] {
  const grid: boolean[][] = [];
  for (let row = 0; row < PIANO_ROLL_ROWS; row++) {
    grid[row] = [];
    for (let col = 0; col < PIANO_ROLL_COLS; col++) {
      // Use characters from the hash to decide if a "note" is on
      const charIndex = (row * PIANO_ROLL_COLS + col) % sha256.length;
      const charVal = parseInt(sha256[charIndex], 16);
      // ~37.5% chance of a note being "on" for a moderate density
      grid[row][col] = charVal >= 10;
    }
  }
  return grid;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PianoRollGrid({
  pattern,
  status,
}: {
  pattern: boolean[][];
  status: MidiFileStatus;
}) {
  return (
    <div className="flex gap-px">
      {/* Note labels */}
      <div className="flex flex-col gap-px">
        {NOTE_NAMES.slice()
          .reverse()
          .map((note) => (
            <div
              key={note}
              className="flex h-2.5 w-5 items-center justify-end pr-0.5 text-[7px] text-muted-foreground"
            >
              {note}
            </div>
          ))}
      </div>
      {/* Grid */}
      <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${PIANO_ROLL_COLS}, 1fr)` }}>
        {pattern
          .slice()
          .reverse()
          .flatMap((row, rowIdx) =>
            row.map((isOn, colIdx) => (
              <div
                key={`${rowIdx}-${colIdx}`}
                className={cn(
                  "h-2.5 w-3 rounded-[1px]",
                  isOn
                    ? noteBgColors[status]
                    : "bg-zinc-100 dark:bg-zinc-800/50"
                )}
              />
            ))
          )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface MidiDiffProps {
  versionAId: Id<"logicProjectVersions">;
  versionBId: Id<"logicProjectVersions">;
}

export function MidiDiff({ versionAId, versionBId }: MidiDiffProps) {
  const versionA = useQuery(api.logicProjectVersions.get, { id: versionAId });
  const versionB = useQuery(api.logicProjectVersions.get, { id: versionBId });

  const [showUnchanged, setShowUnchanged] = useState(false);

  const comparison = useMemo(() => {
    if (!versionA || !versionB) return null;

    const midiA = versionA.manifest.filter((e) => isMidiFile(e.path));
    const midiB = versionB.manifest.filter((e) => isMidiFile(e.path));

    const mapA = new Map(midiA.map((e) => [e.path, e]));
    const mapB = new Map(midiB.map((e) => [e.path, e]));
    const allPaths = new Set([...mapA.keys(), ...mapB.keys()]);

    const entries: MidiFileEntry[] = [];

    for (const path of allPaths) {
      const entryA = mapA.get(path);
      const entryB = mapB.get(path);

      let status: MidiFileStatus;
      if (entryA && !entryB) {
        status = "removed";
      } else if (!entryA && entryB) {
        status = "added";
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

    // Sort: changed first, then alphabetically
    const sortOrder = { added: 0, modified: 1, removed: 2, unchanged: 3 };
    entries.sort(
      (a, b) =>
        (sortOrder[a.status] ?? 4) - (sortOrder[b.status] ?? 4) ||
        a.path.localeCompare(b.path)
    );

    const summary = {
      added: entries.filter((e) => e.status === "added").length,
      removed: entries.filter((e) => e.status === "removed").length,
      modified: entries.filter((e) => e.status === "modified").length,
      unchanged: entries.filter((e) => e.status === "unchanged").length,
    };

    return { entries, summary };
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

  if (!comparison || comparison.entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <Music2 className="mx-auto mb-2 size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No MIDI files found in either version.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          MIDI files (.mid, .midi) will appear here when included in the
          project.
        </p>
      </div>
    );
  }

  const visibleEntries = showUnchanged
    ? comparison.entries
    : comparison.entries.filter((e) => e.status !== "unchanged");

  return (
    <div className="rounded-lg border">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Music2 className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">MIDI Comparison</h3>
        </div>
        <div className="flex items-center gap-2">
          {comparison.summary.added > 0 && (
            <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/40 dark:text-green-300">
              +{comparison.summary.added}
            </span>
          )}
          {comparison.summary.modified > 0 && (
            <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300">
              ~{comparison.summary.modified}
            </span>
          )}
          {comparison.summary.removed > 0 && (
            <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-900/40 dark:text-red-300">
              -{comparison.summary.removed}
            </span>
          )}
          {comparison.summary.unchanged > 0 && (
            <button
              className={cn(
                "rounded px-2 py-0.5 text-xs transition-colors",
                showUnchanged
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setShowUnchanged(!showUnchanged)}
            >
              {comparison.summary.unchanged} unchanged
            </button>
          )}
        </div>
      </div>

      {/* MIDI file rows */}
      <div className="divide-y">
        {visibleEntries.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No MIDI changes detected. Click &quot;unchanged&quot; above to show
            all MIDI files.
          </div>
        ) : (
          visibleEntries.map((entry) => {
            const Icon = statusIcons[entry.status];
            const patternA = entry.sha256A
              ? hashToNotePattern(entry.sha256A)
              : null;
            const patternB = entry.sha256B
              ? hashToNotePattern(entry.sha256B)
              : null;

            return (
              <div
                key={entry.path}
                className={cn("px-4 py-3", statusBgColors[entry.status])}
              >
                {/* File info row */}
                <div className="mb-2 flex items-center gap-2">
                  <Icon
                    className={cn("size-3.5 shrink-0", statusColors[entry.status])}
                  />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">
                    {entry.path}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
                      statusBgColors[entry.status] || "bg-muted",
                      statusColors[entry.status]
                    )}
                  >
                    {statusLabels[entry.status]}
                  </span>
                </div>

                {/* Piano roll visualization */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Version A */}
                  <div className="rounded border bg-background p-2">
                    <div className="mb-1 text-[10px] font-medium text-muted-foreground">
                      Version A
                      {entry.sizeA !== undefined && (
                        <span className="ml-2 font-normal">
                          ({formatBytes(entry.sizeA)})
                        </span>
                      )}
                    </div>
                    {patternA ? (
                      <PianoRollGrid
                        pattern={patternA}
                        status={
                          entry.status === "added" ? "unchanged" : entry.status
                        }
                      />
                    ) : (
                      <div className="flex h-[42px] items-center justify-center text-[10px] text-muted-foreground italic">
                        Not present
                      </div>
                    )}
                  </div>

                  {/* Version B */}
                  <div className="rounded border bg-background p-2">
                    <div className="mb-1 text-[10px] font-medium text-muted-foreground">
                      Version B
                      {entry.sizeB !== undefined && (
                        <span className="ml-2 font-normal">
                          ({formatBytes(entry.sizeB)})
                        </span>
                      )}
                    </div>
                    {patternB ? (
                      <PianoRollGrid
                        pattern={patternB}
                        status={
                          entry.status === "removed"
                            ? "unchanged"
                            : entry.status
                        }
                      />
                    ) : (
                      <div className="flex h-[42px] items-center justify-center text-[10px] text-muted-foreground italic">
                        Not present
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer legend */}
      <div className="flex items-center gap-4 border-t px-4 py-2">
        <span className="text-[10px] text-muted-foreground">
          Note patterns are visual representations derived from file hashes,
          not actual MIDI content.
        </span>
      </div>
    </div>
  );
}

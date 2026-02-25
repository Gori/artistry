"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { History, RotateCcw, Eye, Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

/** Simple line-by-line diff */
function diffLines(
  a: string,
  b: string
): Array<{ type: "same" | "added" | "removed"; text: string }> {
  const linesA = a.split("\n");
  const linesB = b.split("\n");
  const result: Array<{ type: "same" | "added" | "removed"; text: string }> = [];

  const maxLen = Math.max(linesA.length, linesB.length);
  for (let i = 0; i < maxLen; i++) {
    const lineA = linesA[i];
    const lineB = linesB[i];
    if (lineA === lineB) {
      result.push({ type: "same", text: lineA ?? "" });
    } else {
      if (lineA !== undefined) result.push({ type: "removed", text: lineA });
      if (lineB !== undefined) result.push({ type: "added", text: lineB });
    }
  }

  return result;
}

export function LyricsHistory({
  songId,
  currentContent,
  open,
  onOpenChange,
  onRestore,
}: {
  songId: Id<"songs">;
  currentContent: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestore: (content: string) => void;
}) {
  const snapshots = useQuery(api.lyricsSnapshots.listBySong, { songId });
  const createSnapshot = useMutation(api.lyricsSnapshots.create);
  const [selectedId, setSelectedId] = useState<Id<"lyricsSnapshots"> | null>(null);
  const [viewMode, setViewMode] = useState<"preview" | "diff">("preview");

  const selectedSnapshot = snapshots?.find((s) => s._id === selectedId);

  const handleSaveCheckpoint = async () => {
    await createSnapshot({
      songId,
      content: currentContent,
      label: "Manual checkpoint",
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[420px] sm:w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="size-4" />
            Lyrics History
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveCheckpoint}
            className="w-full"
          >
            Save checkpoint
          </Button>

          {snapshots === undefined ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : snapshots.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No history yet. Snapshots are created automatically as you write.
            </p>
          ) : (
            <div className="space-y-2">
              {snapshots.map((snapshot) => (
                <div
                  key={snapshot._id}
                  className={cn(
                    "rounded-lg border p-3 cursor-pointer transition-colors",
                    selectedId === snapshot._id
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  )}
                  onClick={() => setSelectedId(snapshot._id)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">
                      {snapshot.label ?? "Auto-save"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatTimeAgo(snapshot._creationTime)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {snapshot.content.slice(0, 100)}
                    {snapshot.content.length > 100 ? "..." : ""}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Selected snapshot detail */}
          {selectedSnapshot && (
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === "preview" ? "secondary" : "ghost"}
                  size="xs"
                  onClick={() => setViewMode("preview")}
                >
                  <Eye className="size-3 mr-1" />
                  Preview
                </Button>
                <Button
                  variant={viewMode === "diff" ? "secondary" : "ghost"}
                  size="xs"
                  onClick={() => setViewMode("diff")}
                >
                  Diff
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  className="ml-auto"
                  onClick={() => {
                    onRestore(selectedSnapshot.content);
                    onOpenChange(false);
                  }}
                >
                  <RotateCcw className="size-3 mr-1" />
                  Restore
                </Button>
              </div>

              <div className="max-h-[400px] overflow-y-auto rounded-md border bg-muted/30 p-3 text-xs font-mono leading-relaxed">
                {viewMode === "preview" ? (
                  <pre className="whitespace-pre-wrap">
                    {selectedSnapshot.content}
                  </pre>
                ) : (
                  <div>
                    {diffLines(selectedSnapshot.content, currentContent).map(
                      (line, i) => (
                        <div
                          key={i}
                          className={cn(
                            "px-1",
                            line.type === "added" &&
                              "bg-success/10 text-success",
                            line.type === "removed" &&
                              "bg-destructive/10 text-destructive-foreground line-through"
                          )}
                        >
                          {line.type === "added" && "+ "}
                          {line.type === "removed" && "- "}
                          {line.text || "\u00A0"}
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

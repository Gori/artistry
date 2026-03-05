"use client";

import { useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { DiffList } from "@artistry/ui";

interface DiffPanelProps {
  fromVersionId: Id<"logicProjectVersions">;
  toVersionId: Id<"logicProjectVersions">;
  fromVersionNumber: number;
  toVersionNumber: number;
}

export function DiffPanel({
  fromVersionId,
  toVersionId,
  fromVersionNumber,
  toVersionNumber,
}: DiffPanelProps) {
  const diff = useQuery(api.logicDiffs.getByVersions, {
    fromVersionId,
    toVersionId,
  });

  if (diff === undefined) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (diff === null) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Diff not available yet. It may still be processing.
      </div>
    );
  }

  return (
    <DiffList
      entries={diff.entries}
      summary={diff.summary}
      title={`Changes from v${fromVersionNumber} to v${toVersionNumber}`}
    />
  );
}

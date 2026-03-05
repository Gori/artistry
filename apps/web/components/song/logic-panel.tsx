"use client";

import { useQuery } from "convex/react";
import { Cpu, Loader2, Monitor } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { VersionTimeline } from "@/components/logic/version-timeline";

interface LogicPanelProps {
  songId: Id<"songs">;
}

export function LogicPanel({ songId }: LogicPanelProps) {
  const versions = useQuery(api.logicProjectVersions.listBySong, { songId });

  if (versions === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-medium">Logic Pro Versions</h2>
          {versions.length > 0 && (
            <span className="text-xs text-muted-foreground">
              ({versions.length})
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Monitor className="size-3.5" />
          Push from desktop app
        </div>
      </div>

      {versions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
          <Cpu className="mb-3 size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No Logic Pro versions yet. Push from the desktop app.
          </p>
        </div>
      ) : (
        <VersionTimeline versions={versions} songId={songId} />
      )}
    </div>
  );
}

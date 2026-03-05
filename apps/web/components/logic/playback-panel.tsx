"use client";

import { useQuery } from "convex/react";
import {
  FileAudio,
  Play,
  Loader2,
  Music,
  HardDrive,
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

interface PlaybackPanelProps {
  versionId: Id<"logicProjectVersions">;
}

export function PlaybackPanel({ versionId }: PlaybackPanelProps) {
  const version = useQuery(api.logicProjectVersions.get, { id: versionId });

  if (version === undefined) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (version === null) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Version not found.
      </div>
    );
  }

  const audioFiles = version.manifest.filter((entry) =>
    isAudioFile(entry.path)
  );

  if (audioFiles.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <Music className="mx-auto mb-2 size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No audio stems found in this version.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Audio files (.wav, .aif, .aiff) will appear here when included in the
          project.
        </p>
      </div>
    );
  }

  const totalSize = audioFiles.reduce((sum, f) => sum + f.size, 0);

  return (
    <div className="rounded-lg border">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <FileAudio className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">
            Audio Stems ({audioFiles.length})
          </h3>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <HardDrive className="size-3" />
          {formatBytes(totalSize)} total
        </div>
      </div>

      <div className="divide-y">
        {audioFiles.map((entry, i) => (
          <div
            key={`${entry.path}-${i}`}
            className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-accent/30"
          >
            <button
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full",
                "border bg-background text-muted-foreground",
                "cursor-not-allowed opacity-50"
              )}
              disabled
              title="Playback not available yet — audio proxy generation is pending"
            >
              <Play className="size-3 ml-0.5" />
            </button>

            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-xs">
                {getFileName(entry.path)}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {entry.path}
              </p>
            </div>

            <span className="shrink-0 text-xs text-muted-foreground">
              {formatBytes(entry.size)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

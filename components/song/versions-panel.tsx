"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { AudioPlayer } from "@/components/audio/player";
import { AudioUpload } from "@/components/audio/upload";

export function VersionsPanel({ songId }: { songId: Id<"songs"> }) {
  const versions = useQuery(api.songVersions.listBySong, { songId });
  const [uploading, setUploading] = useState(false);

  if (versions === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Versions</h3>
        <AudioUpload
          songId={songId}
          type="version"
          uploading={uploading}
          onUploadingChange={setUploading}
        />
      </div>

      {versions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No versions uploaded yet.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {versions.map((version) => (
            <div
              key={version._id}
              className="rounded-lg border bg-card p-4"
            >
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-medium">{version.title}</h4>
                <span className="text-xs text-muted-foreground">
                  {new Date(version._creationTime).toLocaleDateString()}
                </span>
              </div>
              {version.notes && (
                <p className="mb-2 text-xs text-muted-foreground">
                  {version.notes}
                </p>
              )}
              {version.audioUrl && (
                <AudioPlayer src={version.audioUrl} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

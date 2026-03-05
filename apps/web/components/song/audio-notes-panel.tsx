"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { Loader2, Play } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AudioPlayer } from "@/components/audio/player";
import { AudioUpload } from "@/components/audio/upload";
import type { ActiveAudio } from "@/components/audio/persistent-player";

const STATUS_STYLES: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending: { label: "Pending", variant: "secondary" },
  transcribing: { label: "Transcribing", variant: "default" },
  transcribed: { label: "Transcribed", variant: "outline" },
  failed: { label: "Failed", variant: "destructive" },
};

export function AudioNotesPanel({
  songId,
  onPlay,
}: {
  songId: Id<"songs">;
  onPlay?: (audio: ActiveAudio) => void;
}) {
  const audioNotes = useQuery(api.audioNotes.listBySong, { songId });
  const [uploading, setUploading] = useState(false);

  if (audioNotes === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Audio Notes</h3>
        <AudioUpload
          songId={songId}
          type="audioNote"
          uploading={uploading}
          onUploadingChange={setUploading}
        />
      </div>

      {audioNotes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No audio notes yet.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {audioNotes.map((note) => {
            const status = STATUS_STYLES[note.transcriptionStatus ?? "pending"];
            return (
              <div
                key={note._id}
                className="rounded-lg border bg-card p-4"
              >
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-medium">
                    {note.title ?? "Untitled"}
                  </h4>
                  <div className="flex items-center gap-2">
                    {note.audioUrl && onPlay && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() =>
                          onPlay({
                            src: note.audioUrl!,
                            title: note.title ?? "Audio Note",
                            type: "audioNote",
                          })
                        }
                        title="Play in persistent player"
                      >
                        <Play className="size-3" />
                      </Button>
                    )}
                    {status && (
                      <Badge variant={status.variant} className="text-xs">
                        {status.label}
                      </Badge>
                    )}
                  </div>
                </div>
                {note.audioUrl && (
                  <div className="mb-2">
                    <AudioPlayer src={note.audioUrl} />
                  </div>
                )}
                {note.transcription && (
                  <div className="rounded-md bg-muted p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Transcription
                    </p>
                    <p className="text-sm whitespace-pre-wrap">
                      {note.transcription}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

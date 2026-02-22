"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Music } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AudioPlayer } from "@/components/audio/player";

interface SharedData {
  song: {
    title: string;
    stage: string;
    tempo?: string;
    key?: string;
    description?: string;
    tags?: Array<{ _id: string; name: string; color: string }>;
  };
  lyrics: { content: string } | null;
  versions: Array<{
    _id: string;
    title: string;
    audioUrl: string | null;
    notes?: string;
    _creationTime: number;
  }>;
  audioNotes: Array<{
    _id: string;
    title?: string;
    audioUrl: string | null;
    transcription?: string;
    transcriptionStatus?: string;
  }>;
}

const STAGE_LABELS: Record<string, string> = {
  idea: "Idea",
  writing: "Writing",
  producing: "Producing",
  mixing: "Mixing",
  done: "Done",
};

const STAGE_BADGE_CLASSES: Record<string, string> = {
  idea: "border-stage-idea/25 bg-stage-idea/10 text-stage-idea",
  writing: "border-stage-writing/25 bg-stage-writing/10 text-stage-writing",
  producing: "border-stage-producing/25 bg-stage-producing/10 text-stage-producing",
  mixing: "border-stage-mixing/25 bg-stage-mixing/10 text-stage-mixing",
  done: "border-stage-done/25 bg-stage-done/10 text-stage-done",
};

export function SharedSongView({ data }: { data: SharedData }) {
  const { song, lyrics, versions, audioNotes } = data;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">{song.title}</h1>
        <div className="mt-2 flex items-center gap-2">
          <Badge variant="outline" className={STAGE_BADGE_CLASSES[song.stage]}>
            {STAGE_LABELS[song.stage] ?? song.stage}
          </Badge>
          {song.tempo && (
            <span className="text-sm text-muted-foreground">
              {song.tempo} BPM
            </span>
          )}
          {song.key && (
            <span className="text-sm text-muted-foreground">
              Key: {song.key}
            </span>
          )}
        </div>
        {song.tags && song.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {song.tags.map((tag) => (
              <span
                key={tag._id}
                className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor: `${tag.color}20`,
                  color: tag.color,
                }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
        {song.description && (
          <p className="mt-2 text-muted-foreground">{song.description}</p>
        )}
      </header>

      {lyrics?.content && (
        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold">Lyrics</h2>
          <div className="prose prose-sm dark:prose-invert max-w-none rounded-lg border p-6">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{lyrics.content}</ReactMarkdown>
          </div>
        </section>
      )}

      {versions.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold">Versions</h2>
          <div className="flex flex-col gap-3">
            {versions.map((version) => (
              <div key={version._id} className="rounded-lg border p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-medium">{version.title}</h3>
                  <span className="text-xs text-muted-foreground">
                    {new Date(version._creationTime).toLocaleDateString()}
                  </span>
                </div>
                {version.notes && (
                  <p className="mb-2 text-xs text-muted-foreground">
                    {version.notes}
                  </p>
                )}
                {version.audioUrl && <AudioPlayer src={version.audioUrl} />}
              </div>
            ))}
          </div>
        </section>
      )}

      {audioNotes.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold">Audio Notes</h2>
          <div className="flex flex-col gap-3">
            {audioNotes.map((note) => (
              <div key={note._id} className="rounded-lg border p-4">
                <h3 className="mb-2 text-sm font-medium">
                  {note.title ?? "Untitled"}
                </h3>
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
            ))}
          </div>
        </section>
      )}

      <footer className="flex items-center justify-center gap-2 border-t pt-6 text-sm text-muted-foreground">
        <Music className="size-4" />
        Shared via Artistry
      </footer>
    </div>
  );
}

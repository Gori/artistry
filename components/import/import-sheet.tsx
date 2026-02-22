"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useMutation } from "convex/react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  FileText,
  Folder,
  Image,
  Import,
  Loader2,
  Mic,
  Search,
  StickyNote,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

type Step = "folders" | "browse";

interface AppleFolder {
  name: string;
  path: string;
  count: number;
}

interface AppleNoteHeader {
  id: string;
  title: string;
  modifiedAt: string;
}

interface NoteImage {
  data: string; // base64
  mimeType: string;
}

interface NoteAudio {
  name: string;
  data: string; // base64
  mimeType: string;
}

interface ExpandedContent {
  title: string;
  body: string;
  images: NoteImage[];
  audio: NoteAudio[];
}

interface Song {
  _id: Id<"songs">;
  title: string;
  stage: string;
}

const STAGE_LABELS: Record<string, string> = {
  idea: "Idea",
  writing: "Writing",
  producing: "Producing",
  mixing: "Mixing",
  done: "Done",
};

// Convert base64 string to File object for upload
function base64ToFile(
  base64: string,
  filename: string,
  mimeType: string
): File {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    arr[i] = bytes.charCodeAt(i);
  }
  return new File([arr], filename, { type: mimeType });
}

export function ImportSheet({
  open,
  onOpenChange,
  workspaceId,
  songs,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: Id<"workspaces">;
  songs: Song[];
}) {
  const [step, setStep] = useState<Step>("folders");
  const [folders, setFolders] = useState<AppleFolder[]>([]);
  const [folderLoading, setFolderLoading] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [noteHeaders, setNoteHeaders] = useState<AppleNoteHeader[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Browse step state
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [expandedContent, setExpandedContent] = useState<ExpandedContent | null>(
    null
  );
  const [contentLoading, setContentLoading] = useState(false);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const [editTitle, setEditTitle] = useState("");
  const [target, setTarget] = useState<"lyrics" | "notes">("notes");
  const [acting, setActing] = useState(false);
  const [actingLabel, setActingLabel] = useState("");

  const importNew = useMutation(api.songs.importNew);
  const appendNotes = useMutation(api.notes.append);
  const appendLyrics = useMutation(api.lyrics.append);
  const createAudioNote = useMutation(api.audioNotes.create);

  // Upload a file to Vercel Blob and return the public URL
  async function uploadFile(file: File): Promise<{ url: string }> {
    const formData = new FormData();
    formData.append("file", file);
    const result = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });
    if (!result.ok) throw new Error("Upload failed");
    const { url } = await result.json();
    return { url };
  }

  // Upload images and replace {{IMG_N}} placeholders with markdown image links
  async function processContentWithImages(
    body: string,
    images: NoteImage[]
  ): Promise<string> {
    if (images.length === 0) return body;

    let processed = body;
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const ext = img.mimeType.split("/")[1] ?? "png";
      const file = base64ToFile(img.data, `image-${i}.${ext}`, img.mimeType);
      const { url } = await uploadFile(file);
      processed = processed.replace(`{{IMG_${i}}}`, `![](${url})`);
    }
    return processed;
  }

  // Upload audio files and create audio notes for a song
  async function createAudioNotes(
    songId: Id<"songs">,
    audioFiles: NoteAudio[]
  ): Promise<void> {
    for (const audio of audioFiles) {
      const file = base64ToFile(audio.data, audio.name, audio.mimeType);
      const { url } = await uploadFile(file);
      const title = audio.name.replace(/\.[^.]+$/, "");
      await createAudioNote({ songId, title, audioUrl: url });
    }
  }

  const fetchFolders = useCallback(async () => {
    setFolderLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/apple-notes");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to fetch folders");
        return;
      }
      setFolders(data);
    } catch {
      setError(
        "Could not connect to Apple Notes. Make sure the dev server is running locally."
      );
    } finally {
      setFolderLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && folders.length === 0 && !folderLoading && !error) {
      void fetchFolders();
    }
  }, [open, folders.length, folderLoading, error, fetchFolders]);

  async function handlePickFolder(folderPath: string) {
    setSelectedFolder(folderPath);
    setNotesLoading(true);
    setError(null);
    setStep("browse");
    try {
      const res = await fetch(
        `/api/apple-notes?folder=${encodeURIComponent(folderPath)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to fetch notes");
        return;
      }
      setNoteHeaders(data);
    } catch {
      setError("Failed to load notes from this folder.");
    } finally {
      setNotesLoading(false);
    }
  }

  async function handleExpandNote(noteId: string) {
    if (expandedNoteId === noteId) {
      setExpandedNoteId(null);
      setExpandedContent(null);
      return;
    }

    setExpandedNoteId(noteId);
    setExpandedContent(null);
    setContentLoading(true);

    try {
      const res = await fetch("/api/apple-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [noteId] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to fetch note content");
        setExpandedNoteId(null);
        return;
      }

      const note = data[0];
      if (note) {
        setExpandedContent({
          title: note.title,
          body: note.body,
          images: note.images ?? [],
          audio: note.audio ?? [],
        });
        const clean = (note.title || "")
          .replace(/[\r\n\u2028\u2029]+/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 80);
        setEditTitle(clean || "Untitled");
        setTarget("notes");
      }
    } catch {
      setError("Failed to load note content.");
      setExpandedNoteId(null);
    } finally {
      setContentLoading(false);
    }
  }

  async function handleCreateSong() {
    if (!expandedContent || !expandedNoteId) return;
    setActing(true);

    try {
      const hasImages = expandedContent.images.length > 0;
      const hasAudio = expandedContent.audio.length > 0;

      // Upload images and embed in content
      if (hasImages) setActingLabel("Uploading images...");
      const content = await processContentWithImages(
        expandedContent.body,
        expandedContent.images
      );

      // Create the song
      setActingLabel(hasAudio ? "Creating song..." : "");
      const { id: songId } = await importNew({
        title: editTitle,
        workspaceId,
        content,
        target,
      });

      // Create audio notes
      if (hasAudio) {
        setActingLabel("Uploading audio...");
        await createAudioNotes(songId, expandedContent.audio);
      }

      setImportedIds((prev) => new Set([...prev, expandedNoteId]));
      setExpandedNoteId(null);
      setExpandedContent(null);
    } finally {
      setActing(false);
      setActingLabel("");
    }
  }

  async function handleAddToSong(songId: Id<"songs">) {
    if (!expandedContent || !expandedNoteId) return;
    setActing(true);

    try {
      const hasImages = expandedContent.images.length > 0;
      const hasAudio = expandedContent.audio.length > 0;

      // Upload images and embed in content
      if (hasImages) setActingLabel("Uploading images...");
      const content = await processContentWithImages(
        expandedContent.body,
        expandedContent.images
      );

      // Append content
      setActingLabel(hasAudio ? "Saving content..." : "");
      if (target === "notes") {
        await appendNotes({ songId, content });
      } else {
        await appendLyrics({ songId, content });
      }

      // Create audio notes
      if (hasAudio) {
        setActingLabel("Uploading audio...");
        await createAudioNotes(songId, expandedContent.audio);
      }

      setImportedIds((prev) => new Set([...prev, expandedNoteId]));
      setExpandedNoteId(null);
      setExpandedContent(null);
    } finally {
      setActing(false);
      setActingLabel("");
    }
  }

  function reset() {
    setStep("folders");
    setFolders([]);
    setSelectedFolder(null);
    setNoteHeaders([]);
    setExpandedNoteId(null);
    setExpandedContent(null);
    setContentLoading(false);
    setImportedIds(new Set());
    setEditTitle("");
    setTarget("notes");
    setActing(false);
    setActingLabel("");
    setError(null);
    setFolderLoading(false);
    setNotesLoading(false);
  }

  function handleOpenChange(open: boolean) {
    if (!open) reset();
    onOpenChange(open);
  }

  const stepDescription: Record<Step, string> = {
    folders: "Pick a folder from Apple Notes.",
    browse: selectedFolder
      ? `Browse notes in "${selectedFolder}".`
      : "Browse notes.",
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg w-full flex flex-col overflow-hidden">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Import className="size-5" />
            Import from Apple Notes
          </SheetTitle>
          <SheetDescription>{stepDescription[step]}</SheetDescription>
        </SheetHeader>

        {step === "folders" && (
          <FolderStep
            folders={folders}
            loading={folderLoading}
            error={error}
            onPickFolder={handlePickFolder}
            onRetry={fetchFolders}
          />
        )}

        {step === "browse" && (
          <BrowseStep
            notes={noteHeaders}
            loading={notesLoading}
            error={error}
            expandedNoteId={expandedNoteId}
            expandedContent={expandedContent}
            contentLoading={contentLoading}
            importedIds={importedIds}
            editTitle={editTitle}
            target={target}
            acting={acting}
            actingLabel={actingLabel}
            songs={songs}
            onExpandNote={handleExpandNote}
            onEditTitleChange={setEditTitle}
            onTargetChange={setTarget}
            onCreateSong={handleCreateSong}
            onAddToSong={handleAddToSong}
            onBack={() => {
              setStep("folders");
              setNoteHeaders([]);
              setSelectedFolder(null);
              setExpandedNoteId(null);
              setExpandedContent(null);
              setImportedIds(new Set());
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function FolderStep({
  folders,
  loading,
  error,
  onPickFolder,
  onRetry,
}: {
  folders: AppleFolder[];
  loading: boolean;
  error: string | null;
  onPickFolder: (path: string) => void;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 pb-4">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Reading Apple Notes...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 pb-4">
        <p className="text-sm text-destructive text-center">{error}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-3 px-4 pb-4 overflow-hidden">
      <ScrollArea className="flex-1">
        <div className="space-y-1">
          {folders.map((folder) => (
            <button
              key={folder.path}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left hover:bg-accent transition-colors"
              onClick={() => onPickFolder(folder.path)}
            >
              <Folder className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate text-sm font-medium">
                {folder.path}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {folder.count}
              </span>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function BrowseStep({
  notes,
  loading,
  error,
  expandedNoteId,
  expandedContent,
  contentLoading,
  importedIds,
  editTitle,
  target,
  acting,
  actingLabel,
  songs,
  onExpandNote,
  onEditTitleChange,
  onTargetChange,
  onCreateSong,
  onAddToSong,
  onBack,
}: {
  notes: AppleNoteHeader[];
  loading: boolean;
  error: string | null;
  expandedNoteId: string | null;
  expandedContent: ExpandedContent | null;
  contentLoading: boolean;
  importedIds: Set<string>;
  editTitle: string;
  target: "lyrics" | "notes";
  acting: boolean;
  actingLabel: string;
  songs: Song[];
  onExpandNote: (noteId: string) => void;
  onEditTitleChange: (title: string) => void;
  onTargetChange: (target: "lyrics" | "notes") => void;
  onCreateSong: () => void;
  onAddToSong: (songId: Id<"songs">) => void;
  onBack: () => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return notes;
    const q = search.toLowerCase();
    return notes.filter((n) => n.title.toLowerCase().includes(q));
  }, [notes, search]);

  if (loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 pb-4">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading notes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 pb-4">
        <p className="text-sm text-destructive text-center">{error}</p>
        <Button variant="outline" size="sm" onClick={onBack}>
          Back to Folders
        </Button>
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 pb-4">
        <p className="text-sm text-muted-foreground">
          No notes in this folder.
        </p>
        <Button variant="outline" size="sm" onClick={onBack}>
          Back to Folders
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-3 px-4 pb-4 overflow-hidden">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="space-y-1">
          {filtered.map((note) => {
            const isExpanded = expandedNoteId === note.id;
            const isImported = importedIds.has(note.id);

            return (
              <div key={note.id}>
                <button
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors ${
                    isExpanded ? "bg-accent" : "hover:bg-accent"
                  }`}
                  onClick={() => onExpandNote(note.id)}
                  disabled={acting && isExpanded}
                >
                  <ChevronRight
                    className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${
                      isExpanded ? "rotate-90" : ""
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <span className="truncate text-sm font-medium block">
                      {note.title}
                    </span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(note.modifiedAt).toLocaleDateString()}
                    </p>
                  </div>
                  {isImported && (
                    <Badge
                      variant="secondary"
                      className="shrink-0 text-[10px] gap-1"
                    >
                      <Check className="size-3" />
                      Imported
                    </Badge>
                  )}
                </button>

                {isExpanded && (
                  <div className="ml-6 mr-1 mb-2 mt-1 rounded-md border bg-card p-3 space-y-3 overflow-hidden">
                    {contentLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="size-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : expandedContent ? (
                      <>
                        <p className="text-sm text-muted-foreground line-clamp-6 whitespace-pre-wrap break-words">
                          {expandedContent.body}
                        </p>

                        {(expandedContent.images.length > 0 ||
                          expandedContent.audio.length > 0) && (
                          <div className="flex flex-wrap gap-2">
                            {expandedContent.images.length > 0 && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Image className="size-3.5" />
                                <span>
                                  {expandedContent.images.length} image
                                  {expandedContent.images.length !== 1
                                    ? "s"
                                    : ""}
                                </span>
                              </div>
                            )}
                            {expandedContent.audio.length > 0 && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Mic className="size-3.5" />
                                <span>
                                  {expandedContent.audio.length} audio note
                                  {expandedContent.audio.length !== 1
                                    ? "s"
                                    : ""}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">
                            Title
                          </label>
                          <Input
                            value={editTitle}
                            onChange={(e) => onEditTitleChange(e.target.value)}
                            placeholder="Song title"
                            className="h-8 text-sm"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">
                            Save as
                          </label>
                          <div className="flex gap-1">
                            <Button
                              variant={
                                target === "notes" ? "default" : "outline"
                              }
                              size="sm"
                              onClick={() => onTargetChange("notes")}
                            >
                              <StickyNote className="size-3.5" />
                              Notes
                            </Button>
                            <Button
                              variant={
                                target === "lyrics" ? "default" : "outline"
                              }
                              size="sm"
                              onClick={() => onTargetChange("lyrics")}
                            >
                              <FileText className="size-3.5" />
                              Lyrics
                            </Button>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            size="sm"
                            onClick={onCreateSong}
                            disabled={acting || !editTitle.trim()}
                          >
                            {acting ? (
                              <>
                                <Loader2 className="size-3.5 animate-spin" />
                                {actingLabel || "Importing..."}
                              </>
                            ) : (
                              "Create Song"
                            )}
                          </Button>
                          <AddToSongPopover
                            songs={songs}
                            disabled={acting}
                            onSelect={onAddToSong}
                          />
                        </div>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AddToSongPopover({
  songs,
  disabled,
  onSelect,
}: {
  songs: Song[];
  disabled: boolean;
  onSelect: (songId: Id<"songs">) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return songs;
    const q = search.toLowerCase();
    return songs.filter((s) => s.title.toLowerCase().includes(q));
  }, [songs, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          Add to Song
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search songs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>
        <ScrollArea className="max-h-56">
          {filtered.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground text-center">
              No songs found
            </p>
          ) : (
            <div className="p-1">
              {filtered.map((song) => (
                <button
                  key={song._id}
                  className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent text-left"
                  onClick={() => {
                    setOpen(false);
                    setSearch("");
                    onSelect(song._id);
                  }}
                >
                  <span className="truncate">{song.title}</span>
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {STAGE_LABELS[song.stage] ?? song.stage}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

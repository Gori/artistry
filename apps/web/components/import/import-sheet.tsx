"use client";

import {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useMutation } from "convex/react";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Folder,
  Image,
  Import,
  Loader2,
  Mic,
  Plus,
  ListPlus,
  Search,
} from "lucide-react";
import { toast } from "sonner";
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
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { STAGE_LABELS } from "@/lib/kanban/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = "folders" | "carousel";

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
  data: string;
  mimeType: string;
}

interface NoteAudio {
  name: string;
  data: string;
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

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

  // Carousel state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [noteContents, setNoteContents] = useState<
    Map<string, ExpandedContent>
  >(new Map());
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState(false);
  const [actingLabel, setActingLabel] = useState("");
  const [songPickerOpen, setSongPickerOpen] = useState(false);

  const importNew = useMutation(api.songs.importNew);
  const appendNotes = useMutation(api.notes.append);
  const createAudioNote = useMutation(api.audioNotes.create);

  // Current note helpers
  const currentNote = noteHeaders[currentIndex] ?? null;
  const currentContent = currentNote
    ? noteContents.get(currentNote.id) ?? null
    : null;
  const isCurrentLoading = currentNote
    ? loadingIds.has(currentNote.id) && !noteContents.has(currentNote.id)
    : false;
  const isCurrentImported = currentNote
    ? importedIds.has(currentNote.id)
    : false;
  const total = noteHeaders.length;

  // -------------------------------------------------------------------------
  // File upload
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Prefetch engine
  // -------------------------------------------------------------------------

  const prefetchAround = useCallback(
    async (index: number) => {
      const WINDOW = 3;
      const idsToFetch: string[] = [];

      for (let i = Math.max(0, index - 1); i <= index + WINDOW; i++) {
        if (i < noteHeaders.length) {
          const id = noteHeaders[i].id;
          if (!noteContents.has(id) && !loadingIds.has(id)) {
            idsToFetch.push(id);
          }
        }
      }

      if (idsToFetch.length === 0) return;

      setLoadingIds((prev) => {
        const next = new Set(prev);
        for (const id of idsToFetch) next.add(id);
        return next;
      });

      try {
        const res = await fetch("/api/apple-notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: idsToFetch }),
        });
        const data = await res.json();

        if (Array.isArray(data)) {
          setNoteContents((prev) => {
            const next = new Map(prev);
            for (const note of data) {
              const cleanTitle = (note.title || "")
                .replace(/[\r\n\u2028\u2029]+/g, " ")
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 80);
              next.set(note.id, {
                title: cleanTitle || "Untitled",
                body: note.body,
                images: note.images ?? [],
                audio: note.audio ?? [],
              });
            }
            return next;
          });
        }
      } catch {
        // Silently fail - user can still navigate, content will try again
      } finally {
        setLoadingIds((prev) => {
          const next = new Set(prev);
          for (const id of idsToFetch) next.delete(id);
          return next;
        });
      }
    },
    [noteHeaders, noteContents, loadingIds]
  );

  useEffect(() => {
    if (step === "carousel" && noteHeaders.length > 0) {
      void prefetchAround(currentIndex);
    }
  }, [currentIndex, step, noteHeaders.length, prefetchAround]);

  // -------------------------------------------------------------------------
  // Folder loading
  // -------------------------------------------------------------------------

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
    setStep("carousel");
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
      setCurrentIndex(0);
    } catch {
      setError("Failed to load notes from this folder.");
    } finally {
      setNotesLoading(false);
    }
  }

  // -------------------------------------------------------------------------
  // Navigation
  // -------------------------------------------------------------------------

  function goNext() {
    if (currentIndex < total - 1) {
      setCurrentIndex((i) => i + 1);
    }
  }

  function goPrev() {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  }

  function jumpTo(n: number) {
    const clamped = Math.max(0, Math.min(n, total - 1));
    setCurrentIndex(clamped);
  }

  // -------------------------------------------------------------------------
  // Import actions
  // -------------------------------------------------------------------------

  async function handleCreateSong() {
    if (!currentContent || !currentNote || acting) return;
    setActing(true);

    try {
      const hasImages = currentContent.images.length > 0;
      const hasAudio = currentContent.audio.length > 0;

      if (hasImages) setActingLabel("Uploading images...");
      const content = await processContentWithImages(
        currentContent.body,
        currentContent.images
      );

      setActingLabel(hasAudio ? "Creating song..." : "");
      const { id: songId } = await importNew({
        title: currentContent.title,
        workspaceId,
        content,
        target: "notes",
      });

      if (hasAudio) {
        setActingLabel("Uploading audio...");
        await createAudioNotes(songId, currentContent.audio);
      }

      setImportedIds((prev) => new Set([...prev, currentNote.id]));
      toast.success(`Created "${currentContent.title}"`);

      // Auto-advance
      if (currentIndex < total - 1) {
        setCurrentIndex((i) => i + 1);
      }
    } catch {
      toast.error("Failed to create song");
    } finally {
      setActing(false);
      setActingLabel("");
    }
  }

  async function handleAddToSong(songId: Id<"songs">) {
    if (!currentContent || !currentNote || acting) return;
    setActing(true);
    setSongPickerOpen(false);

    try {
      const hasImages = currentContent.images.length > 0;
      const hasAudio = currentContent.audio.length > 0;

      if (hasImages) setActingLabel("Uploading images...");
      const content = await processContentWithImages(
        currentContent.body,
        currentContent.images
      );

      setActingLabel(hasAudio ? "Saving content..." : "");
      await appendNotes({ songId, content });

      if (hasAudio) {
        setActingLabel("Uploading audio...");
        await createAudioNotes(songId, currentContent.audio);
      }

      const songTitle =
        songs.find((s) => s._id === songId)?.title ?? "song";
      setImportedIds((prev) => new Set([...prev, currentNote.id]));
      toast.success(`Added to "${songTitle}"`);

      // Auto-advance
      if (currentIndex < total - 1) {
        setCurrentIndex((i) => i + 1);
      }
    } catch {
      toast.error("Failed to add to song");
    } finally {
      setActing(false);
      setActingLabel("");
    }
  }

  // -------------------------------------------------------------------------
  // Reset
  // -------------------------------------------------------------------------

  function reset() {
    setStep("folders");
    setFolders([]);
    setSelectedFolder(null);
    setNoteHeaders([]);
    setCurrentIndex(0);
    setNoteContents(new Map());
    setLoadingIds(new Set());
    setImportedIds(new Set());
    setActing(false);
    setActingLabel("");
    setSongPickerOpen(false);
    setError(null);
    setFolderLoading(false);
    setNotesLoading(false);
  }

  function handleOpenChange(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  function goBackToFolders() {
    setStep("folders");
    setNoteHeaders([]);
    setSelectedFolder(null);
    setCurrentIndex(0);
    setNoteContents(new Map());
    setLoadingIds(new Set());
    setImportedIds(new Set());
    setError(null);
  }

  // -------------------------------------------------------------------------
  // Keyboard shortcuts
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!open || step !== "carousel") return;

    function handleKeyDown(e: KeyboardEvent) {
      // Don't intercept when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") {
        if (e.key === "Escape") {
          (e.target as HTMLElement).blur();
          e.preventDefault();
        }
        return;
      }

      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          goNext();
          break;
        case "ArrowLeft":
          e.preventDefault();
          goPrev();
          break;
        case "ArrowUp":
          e.preventDefault();
          void handleCreateSong();
          break;
        case "ArrowDown":
          e.preventDefault();
          setSongPickerOpen(true);
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step, currentIndex, total, acting, currentContent, currentNote]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-none w-[calc(100vw-4rem)] h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] flex flex-col p-0 gap-0 overflow-hidden"
      >
        <DialogTitle className="sr-only">Import from Apple Notes</DialogTitle>
        {step === "folders" ? (
          <FolderPicker
            folders={folders}
            loading={folderLoading}
            error={error}
            onPickFolder={handlePickFolder}
            onRetry={fetchFolders}
            onClose={() => handleOpenChange(false)}
          />
        ) : (
          <NoteCarousel
            noteHeaders={noteHeaders}
            notesLoading={notesLoading}
            error={error}
            currentIndex={currentIndex}
            currentNote={currentNote}
            currentContent={currentContent}
            isCurrentLoading={isCurrentLoading}
            isCurrentImported={isCurrentImported}
            total={total}
            acting={acting}
            actingLabel={actingLabel}
            songPickerOpen={songPickerOpen}
            songs={songs}
            importedIds={importedIds}
            selectedFolder={selectedFolder}
            onNext={goNext}
            onPrev={goPrev}
            onJumpTo={jumpTo}
            onCreateSong={handleCreateSong}
            onAddToSong={handleAddToSong}
            onSongPickerOpenChange={setSongPickerOpen}
            onBack={goBackToFolders}
            onClose={() => handleOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// FolderPicker
// ---------------------------------------------------------------------------

function FolderPicker({
  folders,
  loading,
  error,
  onPickFolder,
  onRetry,
  onClose,
}: {
  folders: AppleFolder[];
  loading: boolean;
  error: string | null;
  onPickFolder: (path: string) => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-8 rounded-md bg-muted">
            <Import className="size-4 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-sm font-semibold leading-none">
              Import from Apple Notes
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Pick a folder to start
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          className="text-muted-foreground"
        >
          <span className="sr-only">Close</span>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path
              d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z"
              fill="currentColor"
              fillRule="evenodd"
              clipRule="evenodd"
            />
          </svg>
        </Button>
      </div>

      {/* Content */}
      <div className="flex flex-1 items-center justify-center">
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Reading Apple Notes...
            </p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 max-w-sm text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={onRetry}>
              Try Again
            </Button>
          </div>
        ) : (
          <div className="w-full max-w-sm">
            <ScrollArea className="max-h-[60vh]">
              <div className="px-6 py-2 space-y-0.5">
                {folders.map((folder) => (
                  <button
                    key={folder.path}
                    className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-accent transition-colors"
                    onClick={() => onPickFolder(folder.path)}
                  >
                    <Folder className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
                    <span className="flex-1 truncate text-sm">
                      {folder.path}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {folder.count}
                    </span>
                    <ChevronRight className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NoteCarousel
// ---------------------------------------------------------------------------

function NoteCarousel({
  noteHeaders,
  notesLoading,
  error,
  currentIndex,
  currentNote,
  currentContent,
  isCurrentLoading,
  isCurrentImported,
  total,
  acting,
  actingLabel,
  songPickerOpen,
  songs,
  importedIds,
  selectedFolder,
  onNext,
  onPrev,
  onJumpTo,
  onCreateSong,
  onAddToSong,
  onSongPickerOpenChange,
  onBack,
  onClose,
}: {
  noteHeaders: AppleNoteHeader[];
  notesLoading: boolean;
  error: string | null;
  currentIndex: number;
  currentNote: AppleNoteHeader | null;
  currentContent: ExpandedContent | null;
  isCurrentLoading: boolean;
  isCurrentImported: boolean;
  total: number;
  acting: boolean;
  actingLabel: string;
  songPickerOpen: boolean;
  songs: Song[];
  importedIds: Set<string>;
  selectedFolder: string | null;
  onNext: () => void;
  onPrev: () => void;
  onJumpTo: (n: number) => void;
  onCreateSong: () => void;
  onAddToSong: (songId: Id<"songs">) => void;
  onSongPickerOpenChange: (open: boolean) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const counterRef = useRef<HTMLInputElement>(null);
  const [counterValue, setCounterValue] = useState(String(currentIndex + 1));

  // Keep counter in sync with currentIndex
  useEffect(() => {
    setCounterValue(String(currentIndex + 1));
  }, [currentIndex]);

  const importedCount = useMemo(() => {
    return noteHeaders.filter((n) => importedIds.has(n.id)).length;
  }, [noteHeaders, importedIds]);

  if (notesLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading notes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3 max-w-sm text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={onBack}>
            Back to Folders
          </Button>
        </div>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-muted-foreground">
            No notes in this folder.
          </p>
          <Button variant="outline" size="sm" onClick={onBack}>
            Back to Folders
          </Button>
        </div>
      </div>
    );
  }

  function handleCounterSubmit() {
    const n = parseInt(counterValue, 10);
    if (!isNaN(n) && n >= 1 && n <= total) {
      onJumpTo(n - 1);
    } else {
      setCounterValue(String(currentIndex + 1));
    }
    counterRef.current?.blur();
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span className="hidden sm:inline">{selectedFolder}</span>
        </button>

        {/* Counter */}
        <div className="flex items-center gap-1.5 text-sm tabular-nums">
          <input
            ref={counterRef}
            type="text"
            inputMode="numeric"
            value={counterValue}
            onChange={(e) => setCounterValue(e.target.value)}
            onBlur={handleCounterSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCounterSubmit();
            }}
            className="w-8 text-center bg-transparent border-b border-transparent hover:border-border focus:border-foreground outline-none text-foreground font-medium transition-colors"
          />
          <span className="text-muted-foreground">/</span>
          <span className="text-muted-foreground">{total}</span>
          {importedCount > 0 && (
            <span className="ml-2 text-xs text-emerald-500">
              {importedCount} imported
            </span>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          className="text-muted-foreground"
        >
          <span className="sr-only">Close</span>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path
              d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z"
              fill="currentColor"
              fillRule="evenodd"
              clipRule="evenodd"
            />
          </svg>
        </Button>
      </div>

      {/* Main area with nav arrows */}
      <div className="flex flex-1 min-h-0 items-stretch">
        {/* Left arrow */}
        <button
          onClick={onPrev}
          disabled={currentIndex === 0}
          className="shrink-0 w-12 sm:w-16 flex items-center justify-center text-muted-foreground/40 hover:text-foreground disabled:opacity-0 transition-all hover:bg-accent/50"
        >
          <ChevronLeft className="size-6" />
        </button>

        {/* Note card */}
        <div className="flex-1 min-w-0 flex items-center justify-center py-6 px-2">
          <div className="w-full max-w-2xl h-full flex flex-col relative">
            {/* Imported badge */}
            {isCurrentImported && (
              <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1">
                <Check className="size-3 text-emerald-500" />
                <span className="text-[11px] font-medium text-emerald-500">
                  Imported
                </span>
              </div>
            )}

            {isCurrentLoading ? (
              <div className="flex flex-1 items-center justify-center">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : currentContent ? (
              <>
                {/* Title */}
                <h2 className="text-xl sm:text-2xl font-semibold leading-tight pr-28 mb-3 shrink-0">
                  {currentContent.title}
                </h2>

                {/* Attachment badges */}
                {(currentContent.images.length > 0 ||
                  currentContent.audio.length > 0) && (
                  <div className="flex items-center gap-2 mb-4 shrink-0">
                    {currentContent.images.length > 0 && (
                      <Badge
                        variant="secondary"
                        className="gap-1.5 text-xs font-normal"
                      >
                        <Image className="size-3" />
                        {currentContent.images.length} image
                        {currentContent.images.length !== 1 ? "s" : ""}
                      </Badge>
                    )}
                    {currentContent.audio.length > 0 && (
                      <Badge
                        variant="secondary"
                        className="gap-1.5 text-xs font-normal"
                      >
                        <Mic className="size-3" />
                        {currentContent.audio.length} audio
                      </Badge>
                    )}
                  </div>
                )}

                {/* Body */}
                <ScrollArea className="flex-1 min-h-0">
                  <div className="pr-4">
                    <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap break-words">
                      {currentContent.body || (
                        <span className="italic">No text content</span>
                      )}
                    </p>
                  </div>
                </ScrollArea>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  {currentNote?.title ?? "No note selected"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right arrow */}
        <button
          onClick={onNext}
          disabled={currentIndex >= total - 1}
          className="shrink-0 w-12 sm:w-16 flex items-center justify-center text-muted-foreground/40 hover:text-foreground disabled:opacity-0 transition-all hover:bg-accent/50"
        >
          <ChevronRight className="size-6" />
        </button>
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-t shrink-0 bg-muted/30">
        {/* Keyboard hints */}
        <div className="hidden sm:flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="inline-flex items-center justify-center rounded border bg-muted px-1 py-0.5 font-mono text-[10px] min-w-[20px]">
              &larr;
            </kbd>
            <kbd className="inline-flex items-center justify-center rounded border bg-muted px-1 py-0.5 font-mono text-[10px] min-w-[20px]">
              &rarr;
            </kbd>
            <span className="ml-0.5">navigate</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="inline-flex items-center justify-center rounded border bg-muted px-1 py-0.5 font-mono text-[10px] min-w-[20px]">
              &uarr;
            </kbd>
            <span className="ml-0.5">new</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="inline-flex items-center justify-center rounded border bg-muted px-1 py-0.5 font-mono text-[10px] min-w-[20px]">
              &darr;
            </kbd>
            <span className="ml-0.5">existing</span>
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 ml-auto">
          {acting ? (
            <Button size="sm" disabled>
              <Loader2 className="size-3.5 animate-spin" />
              {actingLabel || "Importing..."}
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                onClick={onCreateSong}
                disabled={!currentContent || acting}
              >
                <Plus className="size-3.5" />
                Create New
              </Button>

              <SongPickerPopover
                songs={songs}
                disabled={!currentContent || acting}
                open={songPickerOpen}
                onOpenChange={onSongPickerOpenChange}
                onSelect={onAddToSong}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SongPickerPopover
// ---------------------------------------------------------------------------

function SongPickerPopover({
  songs,
  disabled,
  open,
  onOpenChange,
  onSelect,
}: {
  songs: Song[];
  disabled: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (songId: Id<"songs">) => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return songs;
    const q = search.toLowerCase();
    return songs.filter((s) => s.title.toLowerCase().includes(q));
  }, [songs, search]);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <ListPlus className="size-3.5" />
          Add to Existing
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end" side="top">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search songs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
              autoFocus
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

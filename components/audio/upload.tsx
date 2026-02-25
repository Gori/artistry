"use client";

import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { compressForTranscription } from "@/lib/audio-compress";
import {
  VERSION_CATEGORIES,
  CATEGORY_LABELS,
  type VersionCategory,
} from "@/lib/version-types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function getAudioDuration(file: File): Promise<number | undefined> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const ctx = new AudioContext();
    const decoded = await ctx.decodeAudioData(arrayBuffer);
    const duration = decoded.duration;
    await ctx.close();
    return duration;
  } catch {
    return undefined;
  }
}

export function AudioUpload({
  songId,
  type,
  uploading,
  onUploadingChange,
  defaultCategory,
  preselectedFile,
  onComplete,
}: {
  songId: Id<"songs">;
  type: "version" | "audioNote";
  uploading: boolean;
  onUploadingChange: (uploading: boolean) => void;
  defaultCategory?: VersionCategory;
  preselectedFile?: File;
  onComplete?: () => void;
}) {
  const createVersion = useMutation(api.songVersions.create);
  const createAudioNote = useMutation(api.audioNotes.create);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(!!preselectedFile);
  const [selectedFile, setSelectedFile] = useState<File | null>(
    preselectedFile ?? null
  );
  const [title, setTitle] = useState(
    preselectedFile ? preselectedFile.name.replace(/\.[^.]+$/, "") : ""
  );
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState<VersionCategory | "">(
    defaultCategory ?? ""
  );

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setTitle(file.name.replace(/\.[^.]+$/, ""));
    setDialogOpen(true);
  }

  async function handleUpload() {
    if (!selectedFile || !title.trim()) return;
    onUploadingChange(true);

    try {
      // Compress oversized audio notes so Whisper transcription stays under 25 MB
      let fileToUpload: File = selectedFile;
      if (type === "audioNote" && selectedFile.size > 24 * 1024 * 1024) {
        toast.info("Compressing audio for transcription...");
        fileToUpload = await compressForTranscription(selectedFile);
      }

      // Extract duration for versions
      let duration: number | undefined;
      if (type === "version") {
        duration = await getAudioDuration(selectedFile);
      }

      // Upload file to Vercel Blob
      const formData = new FormData();
      formData.append("file", fileToUpload);
      const result = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!result.ok) {
        throw new Error("Upload failed");
      }

      const { url } = await result.json();

      // Create record
      if (type === "version") {
        await createVersion({
          songId,
          title: title.trim(),
          audioUrl: url,
          notes: notes.trim() || undefined,
          category: category || undefined,
          duration,
        });
      } else {
        await createAudioNote({
          songId,
          title: title.trim(),
          audioUrl: url,
        });
      }

      toast.success(
        type === "version" ? "Version uploaded" : "Audio note uploaded"
      );
      resetState();
      onComplete?.();
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      onUploadingChange(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function resetState() {
    setDialogOpen(false);
    setSelectedFile(null);
    setTitle("");
    setNotes("");
    setCategory(defaultCategory ?? "");
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleFileSelect}
      />
      {!preselectedFile && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload />
          {uploading ? "Uploading..." : "Upload"}
        </Button>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) resetState();
          else setDialogOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {type === "version" ? "Upload Version" : "Upload Audio Note"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="upload-title">Title</Label>
              <Input
                id="upload-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a title..."
              />
            </div>
            {type === "version" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="upload-category">Category</Label>
                  <select
                    id="upload-category"
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as VersionCategory | "")
                    }
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">No category</option>
                    {VERSION_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {CATEGORY_LABELS[cat]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="upload-notes">Notes (optional)</Label>
                  <Input
                    id="upload-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes about this version..."
                  />
                </div>
              </>
            )}
            {selectedFile && (
              <p className="text-xs text-muted-foreground">
                File: {selectedFile.name} (
                {(selectedFile.size / 1024 / 1024).toFixed(1)} MB)
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={() => void handleUpload()}
              disabled={uploading || !title.trim()}
            >
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

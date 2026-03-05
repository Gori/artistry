"use client";

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  STAGES,
  type Stage,
  type KanbanSong,
  STAGE_LABELS,
} from "@/lib/kanban/types";

export function SongDetailsSheet({
  song,
  workspaceSlug,
  open,
  onOpenChange,
}: {
  song: KanbanSong;
  workspaceSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const updateSong = useMutation(api.songs.update);
  const moveSong = useMutation(api.songs.move);
  const removeSong = useMutation(api.songs.remove);
  const router = useRouter();

  const [title, setTitle] = useState(song.title);
  const [description, setDescription] = useState(song.description ?? "");
  const [tempo, setTempo] = useState(song.tempo ?? "");
  const [key, setKey] = useState(song.key ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setTitle(song.title);
    setDescription(song.description ?? "");
    setTempo(song.tempo ?? "");
    setKey(song.key ?? "");
  }, [song.title, song.description, song.tempo, song.key]);

  // Reset delete confirmation when sheet closes
  useEffect(() => {
    if (!open) setConfirmDelete(false);
  }, [open]);

  function saveField(field: string, value: string) {
    void updateSong({ id: song._id, [field]: value || undefined });
  }

  function handleStageChange(stage: Stage) {
    void moveSong({ id: song._id, stage, position: song.position });
  }

  async function handleDelete() {
    try {
      await removeSong({ id: song._id });
      onOpenChange(false);
      router.push(`/workspace/${workspaceSlug}`);
    } catch {
      toast.error("Failed to delete song");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Song Details</SheetTitle>
          <SheetDescription>Edit song information.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 p-4">
          <div className="grid gap-2">
            <Label htmlFor="song-title">Title</Label>
            <Input
              id="song-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                if (title.trim() && title !== song.title) {
                  saveField("title", title.trim());
                }
              }}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="song-description">Description</Label>
            <Textarea
              id="song-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => {
                if (description !== (song.description ?? "")) {
                  saveField("description", description);
                }
              }}
              placeholder="Add a description..."
              rows={3}
            />
          </div>

          <div className="grid gap-2">
            <Label>Stage</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  {STAGE_LABELS[song.stage as Stage] ?? song.stage}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                {STAGES.map((stage) => (
                  <DropdownMenuItem
                    key={stage}
                    onClick={() => handleStageChange(stage)}
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: `var(--stage-${stage})` }}
                    />
                    {STAGE_LABELS[stage]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="song-tempo">Tempo (BPM)</Label>
              <Input
                id="song-tempo"
                value={tempo}
                onChange={(e) => setTempo(e.target.value)}
                onBlur={() => {
                  if (tempo !== (song.tempo ?? "")) {
                    saveField("tempo", tempo);
                  }
                }}
                placeholder="120"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="song-key">Key</Label>
              <Input
                id="song-key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                onBlur={() => {
                  if (key !== (song.key ?? "")) {
                    saveField("key", key);
                  }
                }}
                placeholder="C major"
              />
            </div>
          </div>

          <Separator />

          {confirmDelete ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-destructive">
                Are you sure? This cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => void handleDelete()}
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full text-destructive hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-3.5" />
              Delete Song
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

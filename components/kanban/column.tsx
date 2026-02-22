"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useMutation } from "convex/react";
import { Plus } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { KanbanCard } from "./card";

type Stage = "idea" | "writing" | "producing" | "mixing" | "done";

const STAGE_LABELS: Record<Stage, string> = {
  idea: "Idea",
  writing: "Writing",
  producing: "Producing",
  mixing: "Mixing",
  done: "Done",
};

const STAGE_STYLES: Record<Stage, { column: string; badge: string }> = {
  idea: { column: "bg-stage-idea-muted", badge: "bg-stage-idea/15 text-stage-idea border-stage-idea/25" },
  writing: { column: "bg-stage-writing-muted", badge: "bg-stage-writing/15 text-stage-writing border-stage-writing/25" },
  producing: { column: "bg-stage-producing-muted", badge: "bg-stage-producing/15 text-stage-producing border-stage-producing/25" },
  mixing: { column: "bg-stage-mixing-muted", badge: "bg-stage-mixing/15 text-stage-mixing border-stage-mixing/25" },
  done: { column: "bg-stage-done-muted", badge: "bg-stage-done/15 text-stage-done border-stage-done/25" },
};

interface Song {
  _id: Id<"songs">;
  title: string;
  slug?: string;
  stage: string;
  position: number;
  description?: string;
  workspaceId: Id<"workspaces">;
  createdBy: Id<"users">;
  tempo?: string;
  key?: string;
  tags?: Array<{ _id: Id<"tags">; name: string; color: string }>;
}

export function KanbanColumn({
  stage,
  songs,
  workspaceId,
  workspaceSlug,
}: {
  stage: Stage;
  songs: Song[];
  workspaceId: Id<"workspaces">;
  workspaceSlug: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const createSong = useMutation(api.songs.create);
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  async function handleQuickAdd() {
    if (!newTitle.trim()) {
      setIsAdding(false);
      return;
    }
    await createSong({ title: newTitle.trim(), workspaceId });
    setNewTitle("");
    setIsAdding(false);
  }

  const songIds = songs.map((s) => s._id);

  return (
    <div
      className={`flex w-72 shrink-0 flex-col rounded-lg ${STAGE_STYLES[stage].column} ${
        isOver ? "ring-2 ring-primary/20" : ""
      }`}
    >
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{STAGE_LABELS[stage]}</h3>
          <Badge variant="outline" className={`text-xs ${STAGE_STYLES[stage].badge}`}>
            {songs.length}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setIsAdding(true)}
        >
          <Plus />
        </Button>
      </div>

      <ScrollArea className="flex-1 px-2 pb-2">
        <div ref={setNodeRef} className="flex min-h-[40px] flex-col gap-2">
          <SortableContext
            items={songIds}
            strategy={verticalListSortingStrategy}
          >
            {songs.map((song) => (
              <KanbanCard
                key={song._id}
                song={song}
                workspaceSlug={workspaceSlug}
              />
            ))}
          </SortableContext>

          {isAdding && (
            <div className="rounded-lg border bg-card p-2">
              <Input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Song title..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleQuickAdd();
                  if (e.key === "Escape") {
                    setIsAdding(false);
                    setNewTitle("");
                  }
                }}
                onBlur={() => void handleQuickAdd()}
              />
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

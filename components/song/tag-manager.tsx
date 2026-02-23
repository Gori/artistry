"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { Plus, Tag, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TAG_COLORS } from "@/lib/tag-colors";

interface SongTag {
  _id: Id<"tags">;
  name: string;
  color: string;
}

function TagManagerContent({
  songId,
  workspaceId,
  songTagIds,
}: {
  songId: Id<"songs">;
  workspaceId: Id<"workspaces">;
  songTagIds: Id<"tags">[];
}) {
  const tags = useQuery(api.tags.list, { workspaceId });
  const updateSong = useMutation(api.songs.update);
  const createTag = useMutation(api.tags.create);

  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState<string>(TAG_COLORS[0].value);
  const [isCreating, setIsCreating] = useState(false);

  const activeIds = new Set(songTagIds);

  function toggleTag(tagId: Id<"tags">) {
    const newTagIds = activeIds.has(tagId)
      ? songTagIds.filter((id) => id !== tagId)
      : [...songTagIds, tagId];
    void updateSong({ id: songId, tagIds: newTagIds });
  }

  async function handleCreate() {
    if (!newTagName.trim()) return;
    const id = await createTag({
      name: newTagName.trim(),
      color: newTagColor,
      workspaceId,
    });
    setNewTagName("");
    setIsCreating(false);
    void updateSong({ id: songId, tagIds: [...songTagIds, id] });
  }

  return (
    <div className="flex flex-col gap-1 p-2">
      {tags?.map((tag) => (
        <button
          key={tag._id}
          onClick={() => toggleTag(tag._id)}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors text-left"
        >
          <span
            className="size-3 shrink-0 rounded-full"
            style={{ backgroundColor: tag.color }}
          />
          <span className="flex-1 truncate">{tag.name}</span>
          {activeIds.has(tag._id) && (
            <span className="text-xs text-primary">✓</span>
          )}
        </button>
      ))}

      {isCreating ? (
        <div className="mt-1 flex flex-col gap-2 border-t pt-2">
          <Input
            autoFocus
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="Tag name"
            className="h-8 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreate();
              if (e.key === "Escape") setIsCreating(false);
            }}
          />
          <div className="flex gap-1.5">
            {TAG_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => setNewTagColor(c.value)}
                className="size-5 rounded-full transition-transform"
                style={{
                  backgroundColor: c.value,
                  outline:
                    newTagColor === c.value
                      ? `2px solid ${c.value}`
                      : "none",
                  outlineOffset: "2px",
                }}
              />
            ))}
          </div>
          <div className="flex gap-1">
            <Button
              size="xs"
              onClick={() => void handleCreate()}
              disabled={!newTagName.trim()}
            >
              Add
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => setIsCreating(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsCreating(true)}
          className="mt-1 flex items-center gap-2 rounded-md border-t px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          + Create tag
        </button>
      )}
    </div>
  );
}

export function TagManager({
  songId,
  workspaceId,
  songTagIds,
}: {
  songId: Id<"songs">;
  workspaceId: Id<"workspaces">;
  songTagIds: Id<"tags">[];
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Tag className="size-3.5" />
          Tags
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <TagManagerContent
          songId={songId}
          workspaceId={workspaceId}
          songTagIds={songTagIds}
        />
      </PopoverContent>
    </Popover>
  );
}

export function TagPills({
  tags,
  onRemove,
}: {
  tags: SongTag[];
  onRemove?: (tagId: Id<"tags">) => void;
}) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag._id}
          className="group/pill inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: `${tag.color}20`,
            color: tag.color,
          }}
        >
          {tag.name}
          {onRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(tag._id);
              }}
              className="opacity-0 group-hover/pill:opacity-100 transition-opacity -mr-1 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
            >
              <X className="size-3" />
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

export function InlineTagRow({
  songId,
  workspaceId,
  songTagIds,
  tags,
}: {
  songId: Id<"songs">;
  workspaceId: Id<"workspaces">;
  songTagIds: Id<"tags">[];
  tags: SongTag[];
}) {
  const updateSong = useMutation(api.songs.update);

  function handleRemove(tagId: Id<"tags">) {
    void updateSong({
      id: songId,
      tagIds: songTagIds.filter((id) => id !== tagId),
    });
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <TagPills tags={tags} onRemove={handleRemove} />
      <Popover>
        <PopoverTrigger asChild>
          <button className="inline-flex items-center gap-1 rounded-full border border-dashed border-muted-foreground/30 px-2.5 py-0.5 text-xs text-muted-foreground hover:border-muted-foreground/60 hover:text-foreground transition-colors">
            <Plus className="size-3" />
            {tags.length === 0 ? "Add tags" : "Add"}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <TagManagerContent
            songId={songId}
            workspaceId={workspaceId}
            songTagIds={songTagIds}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

"use client";

import { X } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";

interface Tag {
  _id: Id<"tags">;
  name: string;
  color: string;
}

export function TagFilterBar({
  tags,
  activeTagIds,
  onToggle,
  onClear,
}: {
  tags: Tag[];
  activeTagIds: Set<string>;
  onToggle: (tagId: string) => void;
  onClear: () => void;
}) {
  if (tags.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      {tags.map((tag) => {
        const active = activeTagIds.has(tag._id);
        return (
          <button
            key={tag._id}
            onClick={() => onToggle(tag._id)}
            className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-all"
            style={{
              backgroundColor: active ? `${tag.color}30` : `${tag.color}15`,
              color: tag.color,
              outline: active ? `2px solid ${tag.color}` : "none",
              outlineOffset: "-1px",
            }}
          >
            {tag.name}
          </button>
        );
      })}
      {activeTagIds.size > 0 && (
        <Button
          variant="ghost"
          size="xs"
          onClick={onClear}
          className="text-muted-foreground"
        >
          <X className="size-3" />
          Clear
        </Button>
      )}
    </div>
  );
}

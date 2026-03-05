"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import { GripVertical, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  parseSections,
  rebuildFromSections,
  type LyricsSection,
} from "@/lib/lyrics/parse-sections";
import { cn } from "@/lib/utils";

const SECTION_COLORS: Record<string, string> = {
  verse: "bg-section-verse/20 text-section-verse border-section-verse/30",
  chorus: "bg-section-chorus/20 text-section-chorus border-section-chorus/30",
  bridge: "bg-section-bridge/20 text-section-bridge border-section-bridge/30",
  "pre-chorus":
    "bg-section-pre-chorus/20 text-section-pre-chorus border-section-pre-chorus/30",
  "pre chorus":
    "bg-section-pre-chorus/20 text-section-pre-chorus border-section-pre-chorus/30",
  intro: "bg-section-intro/20 text-section-intro border-section-intro/30",
  outro: "bg-section-outro/20 text-section-outro border-section-outro/30",
  hook: "bg-section-hook/20 text-section-hook border-section-hook/30",
  instrumental:
    "bg-section-instrumental/20 text-section-instrumental border-section-instrumental/30",
  interlude:
    "bg-section-interlude/20 text-section-interlude border-section-interlude/30",
};

function getSectionClasses(name: string): string {
  const normalized = name
    .toLowerCase()
    .replace(/\s*\d+\s*$/, "")
    .trim();
  return (
    SECTION_COLORS[normalized] ??
    "bg-muted text-muted-foreground border-border"
  );
}

const QUICK_INSERT_SECTIONS = [
  "Verse",
  "Chorus",
  "Bridge",
  "Pre-Chorus",
  "Intro",
  "Outro",
];

export function StructureOutline({
  content,
  onScrollToLine,
  onInsertSection,
  onReorder,
}: {
  content: string;
  onScrollToLine?: (line: number) => void;
  onInsertSection?: (sectionName: string) => void;
  onReorder?: (newContent: string) => void;
}) {
  const sections = useMemo(() => parseSections(content), [content]);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const dragCounterRef = useRef(0);

  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      setDragIndex(index);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
      // Make the drag image slightly transparent
      if (e.currentTarget instanceof HTMLElement) {
        e.currentTarget.style.opacity = "0.5";
      }
    },
    []
  );

  const handleDragEnd = useCallback(
    (e: React.DragEvent) => {
      if (e.currentTarget instanceof HTMLElement) {
        e.currentTarget.style.opacity = "1";
      }
      setDragIndex(null);
      setDropIndex(null);
      dragCounterRef.current = 0;
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dragIndex !== null && index !== dragIndex) {
        setDropIndex(index);
      }
    },
    [dragIndex]
  );

  const handleDragEnter = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      dragCounterRef.current++;
      if (dragIndex !== null && index !== dragIndex) {
        setDropIndex(index);
      }
    },
    [dragIndex]
  );

  const handleDragLeave = useCallback(() => {
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setDropIndex(null);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      dragCounterRef.current = 0;

      if (dragIndex === null || dragIndex === targetIndex || !onReorder) {
        setDragIndex(null);
        setDropIndex(null);
        return;
      }

      // Reorder sections
      const reordered = [...sections];
      const [moved] = reordered.splice(dragIndex, 1);
      reordered.splice(targetIndex, 0, moved);

      const newContent = rebuildFromSections(reordered);
      onReorder(newContent);

      setDragIndex(null);
      setDropIndex(null);
    },
    [dragIndex, sections, onReorder]
  );

  if (sections.length === 0) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        No sections found. Use [Verse], [Chorus], etc. to mark sections.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-2">
      <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Structure
      </div>

      {sections.map((section, index) => (
        <div
          key={`${section.name}-${section.startLine}`}
          className="relative"
        >
          {/* Drop indicator line — above this item */}
          {dropIndex === index && dragIndex !== null && dragIndex > index && (
            <div className="absolute -top-0.5 left-0 right-0 h-0.5 rounded-full bg-primary z-10" />
          )}

          <button
            draggable={!!onReorder}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnter={(e) => handleDragEnter(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onClick={() => onScrollToLine?.(section.startLine)}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-xs transition-colors hover:opacity-80 w-full group",
              getSectionClasses(section.name),
              dragIndex === index && "opacity-50",
              dropIndex === index &&
                dragIndex !== null &&
                "ring-1 ring-primary/50"
            )}
          >
            {onReorder && (
              <GripVertical className="size-3 shrink-0 opacity-0 group-hover:opacity-60 transition-opacity cursor-grab active:cursor-grabbing" />
            )}
            <span className="font-medium truncate flex-1">
              {section.name}
            </span>
            <span className="shrink-0 opacity-60 text-[10px]">
              {section.lineCount}L
            </span>
          </button>

          {/* Drop indicator line — below this item */}
          {dropIndex === index && dragIndex !== null && dragIndex < index && (
            <div className="absolute -bottom-0.5 left-0 right-0 h-0.5 rounded-full bg-primary z-10" />
          )}
        </div>
      ))}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="xs"
            className="mt-1 w-full gap-1 text-xs"
          >
            <Plus className="size-3" />
            Add Section
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[140px]">
          {QUICK_INSERT_SECTIONS.map((name) => (
            <DropdownMenuItem
              key={name}
              onClick={() => onInsertSection?.(name)}
              className="text-xs"
            >
              {name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

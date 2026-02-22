"use client";

import { useEffect, useRef } from "react";
import { AI_ACTIONS, type EditorAIAction } from "@/lib/ai";
import { Sparkles, ArrowRightLeft } from "lucide-react";

interface EditorContextMenuProps {
  x: number;
  y: number;
  mode: "lyrics" | "notes";
  hasSelection: boolean;
  onSelectAI: (action: EditorAIAction) => void;
  onMove: () => void;
  onClose: () => void;
}

export function EditorContextMenu({
  x,
  y,
  mode,
  hasSelection,
  onSelectAI,
  onMove,
  onClose,
}: EditorContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Clamp to viewport so the menu doesn't overflow
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      el.style.left = `${window.innerWidth - rect.width - 8}px`;
    }
    if (rect.bottom > window.innerHeight) {
      el.style.top = `${window.innerHeight - rect.height - 8}px`;
    }
  }, [x, y]);

  // Close on outside click or Escape
  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const moveLabel =
    mode === "lyrics" ? "Move to Notes" : "Move to Lyrics";

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[240px] rounded-lg border bg-popover p-1 shadow-lg animate-in fade-in-0 zoom-in-95"
      style={{ left: x, top: y }}
    >
      <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-primary">
        <Sparkles className="size-3" />
        AI Assistant
      </div>
      <div className="my-1 h-px bg-border" />
      {AI_ACTIONS.map((action) => (
        <button
          key={action.id}
          className="flex w-full items-center rounded-md px-2 py-1.5 text-sm text-left transition-colors hover:bg-accent hover:text-accent-foreground"
          onClick={() => {
            onSelectAI(action.id);
            onClose();
          }}
        >
          {action.label}
        </button>
      ))}

      {hasSelection && (
        <>
          <div className="my-1 h-px bg-border" />
          <button
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left transition-colors hover:bg-accent hover:text-accent-foreground"
            onClick={() => {
              onMove();
              onClose();
            }}
          >
            <ArrowRightLeft className="size-3.5" />
            {moveLabel}
          </button>
        </>
      )}
    </div>
  );
}

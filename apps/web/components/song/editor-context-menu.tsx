"use client";

import { useEffect, useRef, useState } from "react";
import { AI_ACTIONS, EMOTIONS, type EditorAIAction } from "@/lib/ai";
import { Sparkles, ArrowRightLeft, ChevronRight, Send } from "lucide-react";

interface EditorContextMenuProps {
  x: number;
  y: number;
  mode: "lyrics" | "notes";
  hasSelection: boolean;
  onSelectAI: (action: EditorAIAction, extra?: { userInstruction?: string; emotion?: string }) => void;
  onMove: () => void;
  onClose: () => void;
}

const GROUP_LABELS: Record<string, string> = {
  generate: "Generate",
  rewrite: "Rewrite",
  analyze: "Analyze",
};

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
  const [emotionOpen, setEmotionOpen] = useState(false);
  const [freeFormText, setFreeFormText] = useState("");

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

  const groups = ["generate", "rewrite", "analyze"] as const;

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[260px] rounded-lg border bg-popover p-1 shadow-lg animate-in fade-in-0 zoom-in-95"
      style={{ left: x, top: y }}
    >
      <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-primary">
        <Sparkles className="size-3" />
        AI Assistant
      </div>

      {groups.map((group) => {
        const actions = AI_ACTIONS.filter((a) => a.group === group);
        if (actions.length === 0) return null;
        return (
          <div key={group}>
            <div className="my-1 h-px bg-border" />
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {GROUP_LABELS[group]}
            </div>
            {actions.map((action) => (
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

            {/* Free-form input in generate group */}
            {group === "generate" && (
              <div className="flex items-center gap-1 px-2 py-1">
                <input
                  type="text"
                  value={freeFormText}
                  onChange={(e) => setFreeFormText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && freeFormText.trim()) {
                      onSelectAI("free-form", { userInstruction: freeFormText.trim() });
                      onClose();
                    }
                    e.stopPropagation();
                  }}
                  placeholder="Or type any instruction..."
                  className="flex-1 rounded-md border bg-transparent px-2 py-1 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30"
                  disabled={!freeFormText.trim()}
                  onClick={() => {
                    if (freeFormText.trim()) {
                      onSelectAI("free-form", { userInstruction: freeFormText.trim() });
                      onClose();
                    }
                  }}
                >
                  <Send className="size-3" />
                </button>
              </div>
            )}

            {/* Emotion submenu in rewrite group */}
            {group === "rewrite" && (
              <div className="relative">
                <button
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm text-left transition-colors hover:bg-accent hover:text-accent-foreground"
                  onMouseEnter={() => setEmotionOpen(true)}
                  onMouseLeave={() => setEmotionOpen(false)}
                  onClick={() => setEmotionOpen(!emotionOpen)}
                >
                  Rewrite for emotion
                  <ChevronRight className="size-3 text-muted-foreground" />
                </button>
                {emotionOpen && (
                  <div
                    className="absolute left-full top-0 ml-1 min-w-[140px] rounded-lg border bg-popover p-1 shadow-lg"
                    onMouseEnter={() => setEmotionOpen(true)}
                    onMouseLeave={() => setEmotionOpen(false)}
                  >
                    {EMOTIONS.map((emotion) => (
                      <button
                        key={emotion}
                        className="flex w-full items-center rounded-md px-2 py-1.5 text-sm text-left transition-colors hover:bg-accent hover:text-accent-foreground"
                        onClick={() => {
                          onSelectAI("rewrite-emotion", { emotion });
                          onClose();
                        }}
                      >
                        {emotion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

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

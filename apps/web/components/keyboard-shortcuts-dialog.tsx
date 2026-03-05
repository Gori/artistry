"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const BOARD_SHORTCUTS = [
  { key: "⌘ K", description: "Open command palette" },
  { key: "N", description: "New song" },
  { key: "S", description: "Switch to Stages view" },
  { key: "G", description: "Switch to Groups view" },
  { key: "I", description: "Toggle Ideas column" },
  { key: "?", description: "Show keyboard shortcuts" },
] as const;

const SONG_SHORTCUTS = [
  { key: "1", description: "Switch to Lyrics" },
  { key: "2", description: "Switch to Notes" },
  { key: "3", description: "Switch to Versions" },
  { key: "4", description: "Switch to Audio Notes" },
  { key: "V", description: "Go to Versions tab" },
  { key: "F", description: "Toggle Focus Mode" },
  { key: "T", description: "Toggle Teleprompter" },
  { key: "⌘ R", description: "Rhyme helper (in editor)" },
  { key: "Esc", description: "Exit Focus Mode" },
] as const;

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>

        {/* Board shortcuts */}
        <div className="space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground pb-1">
            Board
          </div>
          {BOARD_SHORTCUTS.map((shortcut) => (
            <div
              key={shortcut.key}
              className="flex items-center justify-between py-1.5"
            >
              <span className="text-sm text-muted-foreground">
                {shortcut.description}
              </span>
              <kbd className="rounded border bg-muted px-2 py-0.5 text-xs font-medium">
                {shortcut.key}
              </kbd>
            </div>
          ))}
        </div>

        {/* Song shortcuts */}
        <div className="space-y-1 border-t pt-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground pb-1">
            Song Page
          </div>
          {SONG_SHORTCUTS.map((shortcut) => (
            <div
              key={shortcut.key}
              className="flex items-center justify-between py-1.5"
            >
              <span className="text-sm text-muted-foreground">
                {shortcut.description}
              </span>
              <kbd className="rounded border bg-muted px-2 py-0.5 text-xs font-medium">
                {shortcut.key}
              </kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

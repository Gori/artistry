"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AudioPlayer } from "./player";

export interface ActiveAudio {
  src: string;
  title: string;
  type: "version" | "audioNote";
}

export function PersistentPlayer({
  audio,
  onClose,
}: {
  audio: ActiveAudio;
  onClose: () => void;
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 h-14 border-t bg-background/95 backdrop-blur-sm">
      <div className="flex h-full items-center gap-3 px-4">
        <span className="shrink-0 text-xs font-medium text-muted-foreground truncate max-w-[160px]">
          {audio.title}
        </span>
        <div className="flex-1 min-w-0">
          <AudioPlayer src={audio.src} autoPlay />
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          aria-label="Close player"
          className="shrink-0"
        >
          <X className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { X, Play, Pause, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SECTION_COLORS: Record<string, string> = {
  verse: "text-section-verse",
  chorus: "text-section-chorus",
  bridge: "text-section-bridge",
  "pre-chorus": "text-section-pre-chorus",
  "pre chorus": "text-section-pre-chorus",
  intro: "text-section-intro",
  outro: "text-section-outro",
  hook: "text-section-hook",
  instrumental: "text-section-instrumental",
  interlude: "text-section-interlude",
};

function getSectionColor(name: string): string {
  const normalized = name.toLowerCase().replace(/\s*\d+\s*$/, "").trim();
  return SECTION_COLORS[normalized] ?? "text-muted-foreground";
}

const SECTION_RE = /^\[([^\]]+)\]\s*$/;

export function Teleprompter({
  content,
  onClose,
}: {
  content: string;
  onClose: () => void;
}) {
  const [speed, setSpeed] = useState(30);
  const [playing, setPlaying] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const lines = content.split("\n");

  // Auto-scroll
  useEffect(() => {
    if (!playing) return;

    const el = scrollRef.current;
    if (!el) return;

    lastTimeRef.current = performance.now();

    function tick(now: number) {
      const delta = now - lastTimeRef.current;
      lastTimeRef.current = now;

      if (el) {
        const pixelsPerMs = (speed / 100) * 0.05;
        el.scrollTop += delta * pixelsPerMs;

        // Stop at bottom
        if (el.scrollTop >= el.scrollHeight - el.clientHeight) {
          setPlaying(false);
          return;
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, speed]);

  // Keyboard controls
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case " ":
          e.preventDefault();
          setPlaying((p) => !p);
          break;
        case "ArrowUp":
          e.preventDefault();
          setSpeed((s) => Math.min(100, s + 5));
          break;
        case "ArrowDown":
          e.preventDefault();
          setSpeed((s) => Math.max(0, s - 5));
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col">
      {/* Scrollable content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-8 py-[40vh]"
        style={{ scrollBehavior: "auto" }}
      >
        <div className="mx-auto max-w-3xl">
          {lines.map((line, i) => {
            const sectionMatch = line.match(SECTION_RE);
            if (sectionMatch) {
              return (
                <div
                  key={i}
                  className={cn(
                    "mt-8 mb-4 text-2xl font-bold uppercase tracking-wider",
                    getSectionColor(sectionMatch[1])
                  )}
                >
                  {sectionMatch[1]}
                </div>
              );
            }

            if (!line.trim()) {
              return <div key={i} className="h-8" />;
            }

            return (
              <div
                key={i}
                className="text-[42px] leading-[1.4] font-light"
                style={{ fontFamily: '"Iosevka Aile", sans-serif' }}
              >
                {line}
              </div>
            );
          })}
          {/* Extra padding at bottom for scroll */}
          <div className="h-[60vh]" />
        </div>
      </div>

      {/* Controls bar */}
      <div className="flex items-center justify-center gap-4 border-t border-white/10 bg-black/90 px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-white/10"
          onClick={() => setSpeed((s) => Math.max(0, s - 5))}
        >
          <Minus className="size-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-white/10"
          onClick={() => setPlaying((p) => !p)}
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>

        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={100}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="w-32 accent-white"
          />
          <span className="text-xs tabular-nums text-white/60 w-8">
            {speed}
          </span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-white/10"
          onClick={() => setSpeed((s) => Math.min(100, s + 5))}
        >
          <Plus className="size-4" />
        </Button>

        <div className="ml-4 border-l border-white/10 pl-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-white/60 hover:bg-white/10 hover:text-white"
            onClick={onClose}
          >
            <X className="size-4 mr-1" />
            Exit
          </Button>
        </div>

        <span className="ml-auto text-[10px] text-white/30">
          Space: play/pause | Arrows: speed | Esc: exit
        </span>
      </div>
    </div>
  );
}

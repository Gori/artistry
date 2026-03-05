"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Play, Pause, ArrowLeftRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Waveform } from "./waveform";
import { formatDuration } from "@/lib/format-time";
import { cn } from "@/lib/utils";
import { Id } from "@/convex/_generated/dataModel";
import type { VersionCategory } from "@/lib/version-types";

interface CompareVersion {
  _id: Id<"songVersions">;
  title: string;
  audioUrl: string | null;
  duration?: number;
  category?: VersionCategory;
}

export function ComparePlayer({
  versionA,
  versionB,
  onExit,
}: {
  versionA: CompareVersion;
  versionB: CompareVersion;
  onExit: () => void;
}) {
  const audioARef = useRef<HTMLAudioElement>(null);
  const audioBRef = useRef<HTMLAudioElement>(null);
  const rafRef = useRef<number>(0);

  const [playing, setPlaying] = useState(false);
  const [activeTrack, setActiveTrack] = useState<"A" | "B">("A");
  const [currentTime, setCurrentTime] = useState(0);
  const [durationA, setDurationA] = useState(versionA.duration ?? 0);
  const [durationB, setDurationB] = useState(versionB.duration ?? 0);

  const maxDuration = Math.max(durationA, durationB);

  // -- Audio setup --

  useEffect(() => {
    const a = audioARef.current;
    const b = audioBRef.current;
    if (!a || !b) return;

    const onMetaA = () => setDurationA(a.duration);
    const onMetaB = () => setDurationB(b.duration);
    const onEndA = () => {
      setPlaying(false);
      setCurrentTime(0);
    };
    const onEndB = () => {
      setPlaying(false);
      setCurrentTime(0);
    };

    a.addEventListener("loadedmetadata", onMetaA);
    b.addEventListener("loadedmetadata", onMetaB);
    a.addEventListener("ended", onEndA);
    b.addEventListener("ended", onEndB);

    return () => {
      a.removeEventListener("loadedmetadata", onMetaA);
      b.removeEventListener("loadedmetadata", onMetaB);
      a.removeEventListener("ended", onEndA);
      b.removeEventListener("ended", onEndB);
    };
  }, [versionA.audioUrl, versionB.audioUrl]);

  // -- Mute/unmute based on active track --

  useEffect(() => {
    const a = audioARef.current;
    const b = audioBRef.current;
    if (!a || !b) return;
    a.muted = activeTrack !== "A";
    b.muted = activeTrack !== "B";
  }, [activeTrack]);

  // -- rAF loop --

  useEffect(() => {
    if (!playing) return;
    function tick() {
      const active =
        activeTrack === "A" ? audioARef.current : audioBRef.current;
      if (active) setCurrentTime(active.currentTime);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, activeTrack]);

  // -- Controls --

  const togglePlay = useCallback(() => {
    const a = audioARef.current;
    const b = audioBRef.current;
    if (!a || !b) return;

    if (playing) {
      a.pause();
      b.pause();
      setPlaying(false);
    } else {
      void a.play();
      void b.play();
      setPlaying(true);
    }
  }, [playing]);

  const toggleTrack = useCallback(() => {
    setActiveTrack((p) => (p === "A" ? "B" : "A"));
  }, []);

  const seekTo = useCallback((fraction: number) => {
    const a = audioARef.current;
    const b = audioBRef.current;
    if (!a || !b) return;
    const timeA = fraction * a.duration;
    const timeB = fraction * b.duration;
    a.currentTime = Math.min(timeA, a.duration);
    b.currentTime = Math.min(timeB, b.duration);
    setCurrentTime(fraction * Math.max(a.duration, b.duration));
  }, []);

  // -- Keyboard --

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.key === "Tab" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        toggleTrack();
      }
      if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleTrack, togglePlay]);

  const progressA = durationA > 0 ? currentTime / durationA : 0;
  const progressB = durationB > 0 ? currentTime / durationB : 0;

  return (
    <div className="rounded-lg border bg-card p-4">
      {/* Hidden audio elements */}
      {versionA.audioUrl && (
        <audio ref={audioARef} src={versionA.audioUrl} preload="metadata" />
      )}
      {versionB.audioUrl && (
        <audio ref={audioBRef} src={versionB.audioUrl} preload="metadata" />
      )}

      {/* Waveform A */}
      <div className="mb-1">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={cn(
              "inline-flex items-center justify-center size-5 rounded text-[10px] font-bold",
              activeTrack === "A"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}
          >
            A
          </span>
          <span className="text-xs font-medium truncate">
            {versionA.title}
          </span>
        </div>
        {versionA.audioUrl && (
          <Waveform
            src={versionA.audioUrl}
            progress={Math.min(progressA, 1)}
            duration={durationA}
            height={60}
            onSeek={seekTo}
            className={cn(
              "rounded-md overflow-hidden transition-opacity",
              activeTrack !== "A" && "opacity-50"
            )}
          />
        )}
      </div>

      {/* Waveform B */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={cn(
              "inline-flex items-center justify-center size-5 rounded text-[10px] font-bold",
              activeTrack === "B"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}
          >
            B
          </span>
          <span className="text-xs font-medium truncate">
            {versionB.title}
          </span>
        </div>
        {versionB.audioUrl && (
          <Waveform
            src={versionB.audioUrl}
            progress={Math.min(progressB, 1)}
            duration={durationB}
            height={60}
            onSeek={seekTo}
            className={cn(
              "rounded-md overflow-hidden transition-opacity",
              activeTrack !== "B" && "opacity-50"
            )}
          />
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={togglePlay}
            className="gap-1.5"
          >
            {playing ? (
              <Pause className="size-3.5" />
            ) : (
              <Play className="size-3.5" />
            )}
            {playing ? "Pause" : "Play"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={toggleTrack}
            className="gap-1.5"
          >
            <ArrowLeftRight className="size-3.5" />
            A / B
          </Button>

          <span className="text-xs text-muted-foreground tabular-nums ml-2">
            {formatDuration(currentTime)}
            <span className="mx-0.5 opacity-40">/</span>
            {formatDuration(maxDuration)}
          </span>
        </div>

        <Button variant="ghost" size="sm" onClick={onExit} className="gap-1.5">
          <X className="size-3.5" />
          Exit Compare
        </Button>
      </div>
    </div>
  );
}

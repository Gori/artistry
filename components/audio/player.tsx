"use client";

import { useRef, useState, useEffect } from "react";
import { Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    function handleTimeUpdate() {
      setCurrentTime(audio!.currentTime);
    }
    function handleLoadedMetadata() {
      setDuration(audio!.duration);
    }
    function handleEnded() {
      setPlaying(false);
      setCurrentTime(0);
    }

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      void audio.play();
    }
    setPlaying(!playing);
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current;
    if (!audio) return;
    const time = Number(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-3">
      <audio ref={audioRef} src={src} preload="metadata" />
      <Button variant="ghost" size="icon-xs" onClick={togglePlay}>
        {playing ? <Pause className="size-3" /> : <Play className="size-3" />}
      </Button>
      <div className="flex flex-1 items-center gap-2">
        <input
          type="range"
          min={0}
          max={duration || 0}
          value={currentTime}
          onChange={handleSeek}
          step={0.1}
          className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
        />
      </div>
      <span className="min-w-[70px] text-right text-xs tabular-nums text-muted-foreground">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
    </div>
  );
}

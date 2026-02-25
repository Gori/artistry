"use client";

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Play, Pause, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generatePeaks } from "@/lib/waveform";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/format-time";

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export interface AudioMarker {
  timestamp: number;
  text: string;
}

export function AudioPlayer({
  src,
  className,
  size = "compact",
  markers,
  onMarkerAdd,
}: {
  src: string;
  className?: string;
  size?: "compact" | "large";
  markers?: AudioMarker[];
  onMarkerAdd?: (timestamp: number) => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveformRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [hoveredMarker, setHoveredMarker] = useState<AudioMarker | null>(null);

  const H = size === "large" ? 80 : 40;
  const BAR_W = size === "large" ? 3 : 2;
  const GAP = 1;

  // -- Audio element ---------------------------------------------------------

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setLoading(true);
    setPeaks(null);
    audio.playbackRate = rate;

    const onMeta = () => {
      setDuration(audio.duration);
      setLoading(false);
    };
    const onEnd = () => {
      setPlaying(false);
      setCurrentTime(0);
    };
    const onWait = () => setLoading(true);
    const onCan = () => setLoading(false);

    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("waiting", onWait);
    audio.addEventListener("canplay", onCan);
    return () => {
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("waiting", onWait);
      audio.removeEventListener("canplay", onCan);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // -- Peaks -----------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;
    const count =
      canvasWidth > 0 ? Math.floor(canvasWidth / (BAR_W + GAP)) : 200;
    generatePeaks(src, count)
      .then((d) => {
        if (cancelled) return;
        setPeaks(d.peaks);
        if (d.duration > 0) setDuration(d.duration);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [src, canvasWidth, BAR_W]);

  // -- Resize ----------------------------------------------------------------

  useEffect(() => {
    const el = waveformRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        if (w > 0) setCanvasWidth(w);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // -- Draw ------------------------------------------------------------------

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !peaks || canvasWidth === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${H}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvasWidth, H);

    // Theme-aware colors via CSS vars
    const style = getComputedStyle(canvas);
    const prim = style.getPropertyValue("--primary").trim();
    const mut = style.getPropertyValue("--muted").trim();
    const playedColor = prim ? `oklch(${prim})` : "#7c3aed";
    const unplayedColor = mut ? `oklch(${mut})` : "#e5e7eb";

    const progress = duration > 0 ? currentTime / duration : 0;
    const splitBar = Math.floor(progress * peaks.length);
    const centerY = H / 2;
    const halfH = H / 2 - 2; // 2px padding
    const minH = 2;

    for (let i = 0; i < peaks.length; i++) {
      const barH = Math.max(minH, peaks[i] * halfH * 2);
      const x = i * (BAR_W + GAP);
      const y = centerY - barH / 2;

      ctx.fillStyle = i <= splitBar ? playedColor : unplayedColor;
      ctx.beginPath();
      ctx.roundRect(x, y, BAR_W, barH, 1);
      ctx.fill();
    }

    // Playhead
    if (duration > 0) {
      const px = progress * canvasWidth;
      ctx.fillStyle = playedColor;
      ctx.globalAlpha = 0.8;
      ctx.fillRect(px - 0.5, 0, 1, H);
      ctx.globalAlpha = 1;
    }

    // Hover line
    if (hoverX !== null && !scrubbing) {
      ctx.fillStyle = playedColor;
      ctx.globalAlpha = 0.3;
      ctx.fillRect(hoverX - 0.5, 0, 1, H);
      ctx.globalAlpha = 1;
    }

    // Markers
    if (markers && markers.length > 0 && duration > 0) {
      for (const marker of markers) {
        const mx = (marker.timestamp / duration) * canvasWidth;
        const triSize = size === "large" ? 6 : 4;

        ctx.fillStyle = playedColor;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.moveTo(mx, H);
        ctx.lineTo(mx - triSize, H - triSize * 1.5);
        ctx.lineTo(mx + triSize, H - triSize * 1.5);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }, [peaks, canvasWidth, currentTime, duration, hoverX, scrubbing, markers, H, BAR_W, size]);

  // -- rAF loop --------------------------------------------------------------

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !playing) return;
    function tick() {
      setCurrentTime(audio!.currentTime);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing]);

  useEffect(() => {
    draw();
  }, [draw]);

  // -- Controls --------------------------------------------------------------

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      void audio.play();
      setPlaying(true);
    }
  }, [playing]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const t = Math.max(0, Math.min(time, audio.duration || 0));
    audio.currentTime = t;
    setCurrentTime(t);
  }, []);

  const cycleRate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const i = RATES.indexOf(rate as (typeof RATES)[number]);
    const next = RATES[(i + 1) % RATES.length];
    audio.playbackRate = next;
    setRate(next);
  }, [rate]);

  // -- Pointer events --------------------------------------------------------

  const getFraction = useCallback(
    (e: ReactPointerEvent<HTMLDivElement> | globalThis.PointerEvent) => {
      const rect = waveformRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return 0;
      return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    },
    []
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (duration === 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      setScrubbing(true);
      seek(getFraction(e) * duration);
    },
    [duration, getFraction, seek]
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const rect = waveformRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = Math.max(0, Math.min(canvasWidth, e.clientX - rect.left));
      setHoverX(x);
      if (scrubbing && duration > 0) seek(getFraction(e) * duration);

      // Check marker hover
      if (markers && markers.length > 0 && duration > 0) {
        const threshold = size === "large" ? 8 : 6;
        const found = markers.find((m) => {
          const mx = (m.timestamp / duration) * canvasWidth;
          return Math.abs(x - mx) < threshold;
        });
        setHoveredMarker(found ?? null);
      }
    },
    [scrubbing, duration, getFraction, seek, canvasWidth, markers, size]
  );

  const onPointerUp = useCallback(() => setScrubbing(false), []);
  const onPointerLeave = useCallback(() => {
    setHoverX(null);
    setScrubbing(false);
    setHoveredMarker(null);
  }, []);

  const onDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!onMarkerAdd || duration === 0) return;
      const rect = waveformRef.current?.getBoundingClientRect();
      if (!rect) return;
      const fraction = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / rect.width)
      );
      onMarkerAdd(fraction * duration);
    },
    [onMarkerAdd, duration]
  );

  // -- Keyboard --------------------------------------------------------------

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          seek(currentTime - 5);
          break;
        case "ArrowRight":
          e.preventDefault();
          seek(currentTime + 5);
          break;
      }
    },
    [togglePlay, seek, currentTime]
  );

  // -- Render ----------------------------------------------------------------

  return (
    <div
      className={cn(
        "group/player flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md",
        className
      )}
      tabIndex={0}
      role="region"
      aria-label="Audio player"
      onKeyDown={onKeyDown}
    >
      <audio ref={audioRef} src={src} preload="metadata" />

      <Button
        variant="ghost"
        size="icon-xs"
        onClick={togglePlay}
        aria-label={playing ? "Pause" : "Play"}
        className="shrink-0"
      >
        {loading && !peaks ? (
          <Loader2 className="size-3 animate-spin" />
        ) : playing ? (
          <Pause className="size-3" />
        ) : (
          <Play className="size-3" />
        )}
      </Button>

      {/* Waveform — the seek control */}
      <div
        ref={waveformRef}
        className="relative min-w-0 flex-1 cursor-pointer"
        style={{ height: H, touchAction: "none" }}
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.floor(duration)}
        aria-valuenow={Math.floor(currentTime)}
        aria-valuetext={`${formatDuration(currentTime)} of ${formatDuration(duration)}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onDoubleClick={onDoubleClick}
      >
        {!peaks && (
          <div className="absolute inset-0 flex items-center justify-center gap-[1px]">
            {Array.from({
              length: Math.max(
                1,
                Math.floor((canvasWidth || 120) / (BAR_W + GAP))
              ),
            }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-sm bg-muted"
                style={{
                  width: BAR_W,
                  height: `${4 + Math.abs(Math.sin(i * 0.25)) * (size === "large" ? 40 : 20)}px`,
                }}
              />
            ))}
          </div>
        )}
        <canvas
          ref={canvasRef}
          className={cn("block", !peaks && "opacity-0")}
          style={{ width: canvasWidth || "100%", height: H }}
        />
        {/* Marker tooltip */}
        {hoveredMarker && hoverX !== null && (
          <div
            className="absolute bottom-full mb-1 -translate-x-1/2 rounded bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md border whitespace-nowrap pointer-events-none z-10"
            style={{
              left:
                duration > 0
                  ? (hoveredMarker.timestamp / duration) * canvasWidth
                  : 0,
            }}
          >
            <span className="text-muted-foreground mr-1">
              {formatDuration(hoveredMarker.timestamp)}
            </span>
            {hoveredMarker.text}
          </div>
        )}
      </div>

      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {formatDuration(currentTime)}
        <span className="mx-0.5 opacity-40">/</span>
        {formatDuration(duration)}
      </span>

      <button
        onClick={cycleRate}
        className={cn(
          "shrink-0 rounded px-1 py-0.5 text-xs font-medium tabular-nums transition-colors",
          rate !== 1
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-label={`Playback speed ${rate}x`}
      >
        {rate}x
      </button>
    </div>
  );
}

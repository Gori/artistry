"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { generatePeaks } from "@/lib/waveform";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/format-time";

export interface WaveformMarker {
  timestamp: number;
  text: string;
}

export function Waveform({
  src,
  progress,
  duration,
  height = 60,
  markers,
  onSeek,
  hoverEnabled = true,
  className,
  label,
}: {
  src: string;
  progress: number; // 0-1
  duration: number;
  height?: number;
  markers?: WaveformMarker[];
  onSeek?: (fraction: number) => void;
  hoverEnabled?: boolean;
  className?: string;
  label?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [hoveredMarker, setHoveredMarker] = useState<WaveformMarker | null>(
    null
  );

  const BAR_W = 3;
  const GAP = 1;

  // -- Peaks --

  useEffect(() => {
    let cancelled = false;
    const count =
      canvasWidth > 0 ? Math.floor(canvasWidth / (BAR_W + GAP)) : 200;
    generatePeaks(src, count)
      .then((d) => {
        if (!cancelled) setPeaks(d.peaks);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [src, canvasWidth]);

  // -- Resize --

  useEffect(() => {
    const el = containerRef.current;
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

  // -- Draw --

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !peaks || canvasWidth === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvasWidth, height);

    const style = getComputedStyle(canvas);
    const prim = style.getPropertyValue("--primary").trim();
    const mut = style.getPropertyValue("--muted").trim();
    const playedColor = prim ? `oklch(${prim})` : "#7c3aed";
    const unplayedColor = mut ? `oklch(${mut})` : "#e5e7eb";

    const splitBar = Math.floor(progress * peaks.length);
    const centerY = height / 2;
    const halfH = height / 2 - 2;
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
    if (progress > 0) {
      const px = progress * canvasWidth;
      ctx.fillStyle = playedColor;
      ctx.globalAlpha = 0.8;
      ctx.fillRect(px - 0.5, 0, 1, height);
      ctx.globalAlpha = 1;
    }

    // Hover line
    if (hoverX !== null && !scrubbing && hoverEnabled) {
      ctx.fillStyle = playedColor;
      ctx.globalAlpha = 0.3;
      ctx.fillRect(hoverX - 0.5, 0, 1, height);
      ctx.globalAlpha = 1;
    }

    // Markers
    if (markers && markers.length > 0 && duration > 0) {
      for (const marker of markers) {
        const mx = (marker.timestamp / duration) * canvasWidth;
        ctx.fillStyle = playedColor;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.moveTo(mx, height);
        ctx.lineTo(mx - 5, height - 8);
        ctx.lineTo(mx + 5, height - 8);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }, [peaks, canvasWidth, progress, height, hoverX, scrubbing, hoverEnabled, markers, duration]);

  useEffect(() => {
    draw();
  }, [draw]);

  // -- Pointer events --

  const getFraction = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return 0;
      return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    },
    []
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!onSeek) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      setScrubbing(true);
      onSeek(getFraction(e));
    },
    [onSeek, getFraction]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = Math.max(0, Math.min(canvasWidth, e.clientX - rect.left));
      setHoverX(x);
      if (scrubbing && onSeek) onSeek(getFraction(e));

      if (markers && markers.length > 0 && duration > 0) {
        const found = markers.find((m) => {
          const mx = (m.timestamp / duration) * canvasWidth;
          return Math.abs(x - mx) < 8;
        });
        setHoveredMarker(found ?? null);
      }
    },
    [scrubbing, onSeek, getFraction, canvasWidth, markers, duration]
  );

  const onPointerUp = useCallback(() => setScrubbing(false), []);
  const onPointerLeave = useCallback(() => {
    setHoverX(null);
    setScrubbing(false);
    setHoveredMarker(null);
  }, []);

  return (
    <div className={cn("relative", className)}>
      {label && (
        <div className="absolute top-1 left-2 z-10 text-[10px] font-medium text-muted-foreground">
          {label}
        </div>
      )}
      <div
        ref={containerRef}
        className="relative cursor-pointer"
        style={{ height, touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
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
                  height: `${4 + Math.abs(Math.sin(i * 0.25)) * 30}px`,
                }}
              />
            ))}
          </div>
        )}
        <canvas
          ref={canvasRef}
          className={cn("block", !peaks && "opacity-0")}
          style={{ width: canvasWidth || "100%", height }}
        />
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
    </div>
  );
}

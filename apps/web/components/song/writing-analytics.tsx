"use client";

import { useMemo, useState } from "react";
import { BarChart3, ChevronDown, ChevronUp } from "lucide-react";
import { analyzeLyrics } from "@/lib/lyrics/analytics";

function StatItem({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-lg font-semibold tabular-nums">{value}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
      {sub && (
        <span className="text-[10px] text-muted-foreground/60">{sub}</span>
      )}
    </div>
  );
}

function HorizontalBar({
  label,
  value,
  maxValue,
}: {
  label: string;
  value: number;
  maxValue: number;
}) {
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-20 truncate shrink-0">
        {label}
      </span>
      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary/40 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground w-6 text-right">
        {value}
      </span>
    </div>
  );
}

export function WritingAnalytics({
  content,
}: {
  content: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const analytics = useMemo(
    () => analyzeLyrics(content),
    [content]
  );

  if (!content.trim()) return null;

  const maxSectionWords = Math.max(
    ...analytics.sections.map((s) => s.wordCount),
    1
  );

  return (
    <div className="border-t">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <BarChart3 className="size-3.5" />
        <span className="font-medium">Writing Analytics</span>
        {!expanded && (
          <span className="ml-1 opacity-60">
            {analytics.totalWords} words | {analytics.totalSections} sections
          </span>
        )}
        {expanded ? (
          <ChevronUp className="size-3 ml-auto" />
        ) : (
          <ChevronDown className="size-3 ml-auto" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Top-level stats */}
          <div className="grid grid-cols-4 gap-3">
            <StatItem label="Words" value={analytics.totalWords} />
            <StatItem label="Lines" value={analytics.totalLines} />
            <StatItem label="Sections" value={analytics.totalSections} />
            <StatItem label="Unique Words" value={analytics.uniqueWords} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatItem
              label="Avg Syllables/Line"
              value={analytics.avgSyllablesPerLine}
              sub={`${analytics.syllableRange[0]}-${analytics.syllableRange[1]}`}
            />
            <StatItem
              label="Rhyme Density"
              value={`${analytics.rhymeDensity}%`}
            />
          </div>

          {/* Words per section */}
          {analytics.sections.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Words per Section
              </span>
              {analytics.sections.map((s, i) => (
                <HorizontalBar
                  key={i}
                  label={s.name}
                  value={s.wordCount}
                  maxValue={maxSectionWords}
                />
              ))}
            </div>
          )}

          {/* Top words */}
          {analytics.topWords.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Most Used Words
              </span>
              <div className="flex flex-wrap gap-1">
                {analytics.topWords.map(({ word, count }) => (
                  <span
                    key={word}
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]"
                  >
                    <span>{word}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

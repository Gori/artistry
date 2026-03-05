"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import {
  Loader2,
  Puzzle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileCode,
  Folder,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { formatBytes } from "@artistry/ui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PluginEntry {
  name: string;
  track: string;
  category: "instrument" | "effect" | "unknown";
  presetPath?: string;
  fileCount: number;
  totalSize: number;
}

interface PluginGrouped {
  name: string;
  instances: PluginEntry[];
  totalSize: number;
}

// ---------------------------------------------------------------------------
// Detection patterns
// ---------------------------------------------------------------------------

/**
 * Logic Pro stores plugin settings in specific file paths within the .logicx
 * bundle. We look for these patterns to detect plugins:
 *
 * - Alternatives/<name>/PluginSettings/<plugin>.pst
 * - Resources/PluginSettings/<plugin>.pst
 * - <track>/PluginSettings/*.pst
 * - Patterns with AU, VST, or known plugin names
 */

const PLUGIN_FILE_PATTERNS = [
  /PluginSettings\/(.+?)\.pst$/i,
  /PluginData\/(.+?)\.pdata$/i,
  /Patches\/(.+?)\.patch$/i,
];

const KNOWN_PLUGIN_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /Alchemy/i, name: "Alchemy" },
  { pattern: /EXS24/i, name: "EXS24" },
  { pattern: /Retro\s*Synth/i, name: "Retro Synth" },
  { pattern: /Drum\s*Kit\s*Designer/i, name: "Drum Kit Designer" },
  { pattern: /Drummer/i, name: "Drummer" },
  { pattern: /Channel\s*EQ/i, name: "Channel EQ" },
  { pattern: /Compressor/i, name: "Compressor" },
  { pattern: /Space\s*Designer/i, name: "Space Designer" },
  { pattern: /ChromaVerb/i, name: "ChromaVerb" },
  { pattern: /Limiter/i, name: "Limiter" },
  { pattern: /AutoFilter/i, name: "AutoFilter" },
  { pattern: /Delay\s*Designer/i, name: "Delay Designer" },
  { pattern: /Tape\s*Delay/i, name: "Tape Delay" },
  { pattern: /Stereo\s*Delay/i, name: "Stereo Delay" },
  { pattern: /Overdrive/i, name: "Overdrive" },
  { pattern: /Distortion/i, name: "Distortion" },
  { pattern: /BitCrusher/i, name: "BitCrusher" },
  { pattern: /PhatFX/i, name: "PhatFX" },
  { pattern: /StepFX/i, name: "Step FX" },
  { pattern: /VintageEQ/i, name: "Vintage EQ" },
  { pattern: /VintageVCA/i, name: "Vintage VCA" },
  { pattern: /Sampler/i, name: "Sampler" },
  { pattern: /Quick\s*Sampler/i, name: "Quick Sampler" },
  { pattern: /ES[12MP]/i, name: "ES Synth" },
  { pattern: /Sculpture/i, name: "Sculpture" },
  { pattern: /Ultrabeat/i, name: "Ultrabeat" },
];

function inferCategory(
  name: string
): "instrument" | "effect" | "unknown" {
  const instrumentKeywords = [
    "synth",
    "sampler",
    "alchemy",
    "exs24",
    "retro",
    "drum",
    "instrument",
    "piano",
    "organ",
    "es1",
    "es2",
    "esp",
    "esm",
    "sculpture",
    "ultrabeat",
  ];
  const effectKeywords = [
    "eq",
    "compressor",
    "reverb",
    "delay",
    "limiter",
    "distortion",
    "overdrive",
    "filter",
    "crusher",
    "fx",
    "vintage",
    "tape",
    "space",
    "chroma",
    "auto",
  ];

  const lower = name.toLowerCase();
  if (instrumentKeywords.some((kw) => lower.includes(kw))) return "instrument";
  if (effectKeywords.some((kw) => lower.includes(kw))) return "effect";
  return "unknown";
}

function getTrackFromPath(path: string): string {
  const parts = path.split("/");
  // Try to find a recognizable track-like directory segment
  for (let i = 0; i < parts.length; i++) {
    if (
      parts[i].match(/^Track\s+\d+$/i) ||
      parts[i].match(/^Alternatives$/i) ||
      parts[i].match(/^Resources$/i)
    ) {
      return parts.slice(0, i + 2).join("/");
    }
  }
  return parts.length >= 2 ? parts.slice(0, 2).join("/") : parts[0] ?? "Unknown";
}

function extractPluginName(path: string): string | null {
  // First try structured patterns
  for (const pattern of PLUGIN_FILE_PATTERNS) {
    const match = path.match(pattern);
    if (match) return match[1];
  }

  // Then try known plugin name matching
  for (const { pattern, name } of KNOWN_PLUGIN_PATTERNS) {
    if (pattern.test(path)) return name;
  }

  // Check for .pst or plugin-related files
  if (path.toLowerCase().endsWith(".pst")) {
    const fileName = path.split("/").pop() ?? path;
    return fileName.replace(/\.pst$/i, "");
  }

  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface PluginInventoryProps {
  versionId: Id<"logicProjectVersions">;
  compareVersionId?: Id<"logicProjectVersions">;
}

export function PluginInventory({
  versionId,
  compareVersionId,
}: PluginInventoryProps) {
  const version = useQuery(api.logicProjectVersions.get, { id: versionId });
  const compareVersion = useQuery(
    api.logicProjectVersions.get,
    compareVersionId ? { id: compareVersionId } : "skip"
  );

  const [expandedPlugin, setExpandedPlugin] = useState<string | null>(null);
  const [showCategory, setShowCategory] = useState<string | null>(null);

  const { plugins, grouped, thirdPartyWarnings } = useMemo(() => {
    if (!version) {
      return { plugins: [], grouped: [], thirdPartyWarnings: [] };
    }

    const detected: PluginEntry[] = [];
    const pluginFileMap = new Map<
      string,
      Array<{ path: string; size: number; sha256: string }>
    >();

    for (const entry of version.manifest) {
      const pluginName = extractPluginName(entry.path);
      if (!pluginName) continue;

      if (!pluginFileMap.has(pluginName)) {
        pluginFileMap.set(pluginName, []);
      }
      pluginFileMap.get(pluginName)!.push(entry);
    }

    for (const [name, files] of pluginFileMap) {
      const track = getTrackFromPath(files[0].path);
      const totalSize = files.reduce((sum, f) => sum + f.size, 0);

      detected.push({
        name,
        track,
        category: inferCategory(name),
        presetPath: files[0].path,
        fileCount: files.length,
        totalSize,
      });
    }

    // Group by plugin name
    const groupMap = new Map<string, PluginEntry[]>();
    for (const plugin of detected) {
      if (!groupMap.has(plugin.name)) {
        groupMap.set(plugin.name, []);
      }
      groupMap.get(plugin.name)!.push(plugin);
    }

    const groupedArr: PluginGrouped[] = [];
    for (const [name, instances] of groupMap) {
      groupedArr.push({
        name,
        instances,
        totalSize: instances.reduce((sum, i) => sum + i.totalSize, 0),
      });
    }

    groupedArr.sort((a, b) => a.name.localeCompare(b.name));

    // Check for third-party plugins (not in known list = potentially third-party)
    const knownNames = new Set(KNOWN_PLUGIN_PATTERNS.map((p) => p.name));
    const warnings = groupedArr
      .filter((g) => !knownNames.has(g.name))
      .map((g) => g.name);

    return {
      plugins: detected,
      grouped: groupedArr,
      thirdPartyWarnings: warnings,
    };
  }, [version]);

  // Build a change map if we are comparing
  const changeMap = useMemo(() => {
    if (!version || !compareVersion) return null;

    const map = new Map<string, "added" | "removed" | "modified" | "unchanged">();

    const pluginHashesA = new Map<string, Set<string>>();
    const pluginHashesB = new Map<string, Set<string>>();

    for (const entry of version.manifest) {
      const name = extractPluginName(entry.path);
      if (!name) continue;
      if (!pluginHashesA.has(name)) pluginHashesA.set(name, new Set());
      pluginHashesA.get(name)!.add(entry.sha256);
    }

    for (const entry of compareVersion.manifest) {
      const name = extractPluginName(entry.path);
      if (!name) continue;
      if (!pluginHashesB.has(name)) pluginHashesB.set(name, new Set());
      pluginHashesB.get(name)!.add(entry.sha256);
    }

    const allNames = new Set([...pluginHashesA.keys(), ...pluginHashesB.keys()]);

    for (const name of allNames) {
      const hashesA = pluginHashesA.get(name);
      const hashesB = pluginHashesB.get(name);

      if (!hashesA) {
        map.set(name, "removed");
      } else if (!hashesB) {
        map.set(name, "added");
      } else {
        // Compare hash sets
        const same =
          hashesA.size === hashesB.size &&
          [...hashesA].every((h) => hashesB.has(h));
        map.set(name, same ? "unchanged" : "modified");
      }
    }

    return map;
  }, [version, compareVersion]);

  // Loading state
  if (version === undefined) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (version === null) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Version not found.
      </div>
    );
  }

  if (grouped.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <Puzzle className="mx-auto mb-2 size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No plugin data detected in this version.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Plugin settings files (.pst, plugin presets) will be detected
          when present in the project bundle.
        </p>
      </div>
    );
  }

  const categoryCount = {
    instrument: plugins.filter((p) => p.category === "instrument").length,
    effect: plugins.filter((p) => p.category === "effect").length,
    unknown: plugins.filter((p) => p.category === "unknown").length,
  };

  const filteredPlugins = showCategory
    ? grouped.filter((g) =>
        g.instances.some((i) => i.category === showCategory)
      )
    : grouped;

  return (
    <div className="rounded-lg border">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Puzzle className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">
            Plugin Inventory ({grouped.length})
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            className={cn(
              "rounded px-2 py-0.5 text-xs transition-colors",
              showCategory === null
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setShowCategory(null)}
          >
            All
          </button>
          {categoryCount.instrument > 0 && (
            <button
              className={cn(
                "rounded px-2 py-0.5 text-xs transition-colors",
                showCategory === "instrument"
                  ? "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() =>
                setShowCategory(
                  showCategory === "instrument" ? null : "instrument"
                )
              }
            >
              Instruments ({categoryCount.instrument})
            </button>
          )}
          {categoryCount.effect > 0 && (
            <button
              className={cn(
                "rounded px-2 py-0.5 text-xs transition-colors",
                showCategory === "effect"
                  ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() =>
                setShowCategory(showCategory === "effect" ? null : "effect")
              }
            >
              Effects ({categoryCount.effect})
            </button>
          )}
        </div>
      </div>

      {/* Third-party warning */}
      {thirdPartyWarnings.length > 0 && (
        <div className="border-b bg-yellow-50 px-4 py-2.5 dark:bg-yellow-950/20">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-yellow-600 dark:text-yellow-400" />
            <div>
              <p className="text-xs font-medium text-yellow-700 dark:text-yellow-300">
                Possible third-party plugins detected
              </p>
              <p className="mt-0.5 text-[11px] text-yellow-600 dark:text-yellow-400">
                The following plugins may not be installed on all machines:{" "}
                {thirdPartyWarnings.join(", ")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Plugin list */}
      <div className="divide-y">
        {filteredPlugins.map((group) => {
          const isExpanded = expandedPlugin === group.name;
          const change = changeMap?.get(group.name);
          const primaryCategory = group.instances[0]?.category ?? "unknown";

          return (
            <div key={group.name}>
              <button
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-accent/30"
                onClick={() =>
                  setExpandedPlugin(isExpanded ? null : group.name)
                }
              >
                <Puzzle
                  className={cn(
                    "size-3.5 shrink-0",
                    primaryCategory === "instrument"
                      ? "text-purple-500"
                      : primaryCategory === "effect"
                        ? "text-blue-500"
                        : "text-muted-foreground"
                  )}
                />
                <span className="min-w-0 flex-1 font-medium">
                  {group.name}
                </span>

                {/* Instance count */}
                {group.instances.length > 1 && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {group.instances.length} instances
                  </span>
                )}

                {/* Change badge (when comparing) */}
                {change && change !== "unchanged" && (
                  <span
                    className={cn(
                      "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
                      change === "added" &&
                        "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
                      change === "removed" &&
                        "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
                      change === "modified" &&
                        "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300"
                    )}
                  >
                    {change === "added"
                      ? "New"
                      : change === "removed"
                        ? "Removed"
                        : "Modified"}
                  </span>
                )}

                {/* Category badge */}
                <span
                  className={cn(
                    "shrink-0 rounded px-1.5 py-0.5 text-[10px]",
                    primaryCategory === "instrument"
                      ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                      : primaryCategory === "effect"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {primaryCategory === "instrument"
                    ? "Instrument"
                    : primaryCategory === "effect"
                      ? "Effect"
                      : "Plugin"}
                </span>

                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatBytes(group.totalSize)}
                </span>

                {isExpanded ? (
                  <ChevronUp className="size-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                )}
              </button>

              {isExpanded && (
                <div className="border-t bg-muted/20 px-4 py-2">
                  <div className="space-y-2">
                    {group.instances.map((instance, i) => (
                      <div
                        key={`${instance.track}-${i}`}
                        className="flex items-center gap-2 text-xs"
                      >
                        <Folder className="size-3 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {instance.track}
                        </span>
                        <span className="mx-1 text-muted-foreground">/</span>
                        <FileCode className="size-3 text-muted-foreground" />
                        <span className="font-mono text-muted-foreground">
                          {instance.fileCount} file
                          {instance.fileCount !== 1 ? "s" : ""}
                        </span>
                        <span className="ml-auto text-muted-foreground">
                          {formatBytes(instance.totalSize)}
                        </span>
                      </div>
                    ))}
                    {group.instances[0]?.presetPath && (
                      <div className="mt-1 truncate rounded bg-muted/50 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                        {group.instances[0].presetPath}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-4 border-t px-4 py-2">
        <span className="flex items-center gap-1.5 text-xs">
          <span className="inline-block size-2.5 rounded-sm bg-purple-500/60" />
          <span className="text-muted-foreground">Instruments</span>
        </span>
        <span className="flex items-center gap-1.5 text-xs">
          <span className="inline-block size-2.5 rounded-sm bg-blue-500/60" />
          <span className="text-muted-foreground">Effects</span>
        </span>
        <span className="flex items-center gap-1.5 text-xs">
          <span className="inline-block size-2.5 rounded-sm bg-zinc-400/60" />
          <span className="text-muted-foreground">Other</span>
        </span>
      </div>
    </div>
  );
}

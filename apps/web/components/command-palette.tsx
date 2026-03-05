"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { Command } from "cmdk";
import {
  Search,
  Music,
  LayoutGrid,
  Keyboard,
  ArrowLeft,
  Layers,
  Maximize2,
  Monitor,
  Info,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import {
  type KanbanSong,
  STAGE_LABELS,
  STAGE_DOT_CLASSES,
  STAGE_TEXT_CLASSES,
  type Stage,
} from "@/lib/kanban/types";

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

interface CommandPaletteContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue>({
  open: false,
  setOpen: () => {},
});

export function useCommandPalette() {
  return useContext(CommandPaletteContext);
}

/* ------------------------------------------------------------------ */
/*  Provider (mount in app layout)                                     */
/* ------------------------------------------------------------------ */

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  // Global Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const value = useMemo(() => ({ open, setOpen }), [open]);

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <CommandPaletteDialog open={open} onOpenChange={setOpen} />
    </CommandPaletteContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers: parse workspace context from pathname                     */
/* ------------------------------------------------------------------ */

function useWorkspaceContext() {
  const pathname = usePathname();

  return useMemo(() => {
    // /workspace/[slug] or /workspace/[slug]/[song]
    const match = pathname.match(/^\/workspace\/([^/]+)(?:\/(.+))?$/);
    if (!match) return { workspaceSlug: null, songSlug: null };
    return {
      workspaceSlug: match[1],
      songSlug: match[2] ?? null,
    };
  }, [pathname]);
}

/* ------------------------------------------------------------------ */
/*  Dialog                                                             */
/* ------------------------------------------------------------------ */

const GROUP_HEADING_CLASSES =
  "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground";
const ITEM_CLASSES =
  "flex items-center gap-3 rounded-lg px-2 py-2 text-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground";

function CommandPaletteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const { workspaceSlug, songSlug } = useWorkspaceContext();

  // Always fetch workspaces
  const workspaces = useQuery(api.workspaces.list);

  // Resolve current workspace (only when inside one)
  const workspace = useQuery(
    api.workspaces.getBySlug,
    workspaceSlug ? { slug: workspaceSlug } : "skip"
  );

  // Fetch songs for current workspace
  const rawSongs = useQuery(
    api.songs.listByWorkspace,
    workspace ? { workspaceId: workspace._id } : "skip"
  );

  // Fetch groups for enrichment
  const groups = useQuery(
    api.songGroups.list,
    workspace ? { workspaceId: workspace._id } : "skip"
  );

  // Enrich songs with group names
  const songs: KanbanSong[] = useMemo(() => {
    if (!rawSongs) return [];
    const groupMap = new Map<string, string>();
    if (groups) {
      for (const g of groups) {
        groupMap.set(g._id, g.name);
      }
    }
    return rawSongs.map((song) => ({
      ...song,
      groupName: song.groupId ? groupMap.get(song.groupId) : undefined,
    }));
  }, [rawSongs, groups]);

  const go = useCallback(
    (path: string) => {
      onOpenChange(false);
      router.push(path);
    },
    [router, onOpenChange]
  );

  if (!open) return null;

  const onSongPage = !!songSlug;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onClick={() => onOpenChange(false)}
    >
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        className="relative z-50 w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <Command
          className="rounded-xl border bg-popover shadow-2xl overflow-hidden"
          shouldFilter={true}
        >
          <div className="flex items-center border-b px-3">
            <Search className="size-4 text-muted-foreground shrink-0" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder={
                workspaceSlug
                  ? "Search songs, navigate..."
                  : "Search workspaces..."
              }
              className="flex h-11 w-full rounded-md bg-transparent py-3 px-2 text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-1">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            {/* Songs — only when inside a workspace */}
            {workspaceSlug && songs.length > 0 && (
              <Command.Group heading="Songs" className={GROUP_HEADING_CLASSES}>
                {songs.map((song) => (
                  <Command.Item
                    key={song._id}
                    value={`song: ${song.title}`}
                    onSelect={() =>
                      go(`/workspace/${workspaceSlug}/${song.slug}`)
                    }
                    className={ITEM_CLASSES}
                  >
                    <Music className="size-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">{song.title}</span>
                    <span className="inline-flex items-center gap-1 shrink-0">
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          STAGE_DOT_CLASSES[song.stage]
                        )}
                      />
                      <span
                        className={cn(
                          "text-[10px]",
                          STAGE_TEXT_CLASSES[song.stage]
                        )}
                      >
                        {STAGE_LABELS[song.stage as Stage] ?? song.stage}
                      </span>
                    </span>
                    {song.groupName && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                        <Layers className="size-2.5" />
                        {song.groupName}
                      </span>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Workspaces — always available */}
            {workspaces && workspaces.length > 0 && (
              <Command.Group
                heading="Workspaces"
                className={GROUP_HEADING_CLASSES}
              >
                {workspaces.map(
                  (ws) =>
                    ws && (
                      <Command.Item
                        key={ws._id}
                        value={`workspace: ${ws.name}`}
                        onSelect={() => go(`/workspace/${ws.slug}`)}
                        className={ITEM_CLASSES}
                      >
                        <LayoutGrid className="size-4 text-muted-foreground shrink-0" />
                        <span className="flex-1 truncate">{ws.name}</span>
                        {ws.slug === workspaceSlug && (
                          <span className="text-[10px] text-muted-foreground">
                            current
                          </span>
                        )}
                      </Command.Item>
                    )
                )}
              </Command.Group>
            )}

            {/* Song Actions — only visible on song page */}
            {onSongPage && (
              <Command.Group heading="Song Actions" className={GROUP_HEADING_CLASSES}>
                <Command.Item
                  value="Toggle focus mode"
                  onSelect={() => {
                    onOpenChange(false);
                    window.dispatchEvent(new CustomEvent("artistry:toggle-focus"));
                  }}
                  className={ITEM_CLASSES}
                >
                  <Maximize2 className="size-4 text-muted-foreground" />
                  Toggle Focus Mode
                  <kbd className="ml-auto rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">F</kbd>
                </Command.Item>
                <Command.Item
                  value="Toggle teleprompter"
                  onSelect={() => {
                    onOpenChange(false);
                    window.dispatchEvent(new CustomEvent("artistry:toggle-teleprompter"));
                  }}
                  className={ITEM_CLASSES}
                >
                  <Monitor className="size-4 text-muted-foreground" />
                  Toggle Teleprompter
                  <kbd className="ml-auto rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">T</kbd>
                </Command.Item>
                <Command.Item
                  value="Open song details"
                  onSelect={() => {
                    onOpenChange(false);
                    window.dispatchEvent(new CustomEvent("artistry:open-details"));
                  }}
                  className={ITEM_CLASSES}
                >
                  <Info className="size-4 text-muted-foreground" />
                  Open Song Details
                </Command.Item>
              </Command.Group>
            )}

            {/* Navigation actions */}
            <Command.Group heading="Navigation" className={GROUP_HEADING_CLASSES}>
              {/* Back to board — only on song page */}
              {onSongPage && workspaceSlug && (
                <Command.Item
                  value="Back to board"
                  onSelect={() => go(`/workspace/${workspaceSlug}`)}
                  className={ITEM_CLASSES}
                >
                  <ArrowLeft className="size-4 text-muted-foreground" />
                  Back to board
                </Command.Item>
              )}
              <Command.Item
                value="Go to workspaces"
                onSelect={() => go("/workspaces")}
                className={ITEM_CLASSES}
              >
                <LayoutGrid className="size-4 text-muted-foreground" />
                All workspaces
              </Command.Item>
              <Command.Item
                value="Keyboard shortcuts help"
                onSelect={() => {
                  onOpenChange(false);
                  // Dispatch a custom event the board can listen for
                  window.dispatchEvent(
                    new CustomEvent("artistry:show-shortcuts")
                  );
                }}
                className={ITEM_CLASSES}
              >
                <Keyboard className="size-4 text-muted-foreground" />
                Keyboard shortcuts
                <kbd className="ml-auto rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  ?
                </kbd>
              </Command.Item>
            </Command.Group>
          </Command.List>

          <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
            <span>Type to search</span>
            <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium">
              Esc
            </kbd>
          </div>
        </Command>
      </div>
    </div>
  );
}

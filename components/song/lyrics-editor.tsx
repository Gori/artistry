"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { Loader2, Hash, Guitar, History, LayoutList } from "lucide-react";
import type { EditorView } from "@codemirror/view";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import type { EditorAIAction } from "@/lib/ai";
import { useEditorAIWidget } from "@/hooks/use-editor-ai-widget";
import { MarkdownEditor, type EditorContextMenuInfo } from "./markdown-editor";
import { EditorContextMenu } from "./editor-context-menu";
import { StructureOutline } from "./structure-outline";
import { LyricsHistory } from "./lyrics-history";
import { WritingAnalytics } from "./writing-analytics";
import { createRhymeKeybinding } from "@/lib/codemirror/rhyme-popup";
import { findRhymes, type RhymeResult } from "@/lib/rhyme";
import { Button } from "@/components/ui/button";

export function LyricsEditor({
  songId,
  songKey,
  onMoveText,
}: {
  songId: Id<"songs">;
  songKey?: string;
  onMoveText?: (text: string) => void;
}) {
  const lyrics = useQuery(api.lyrics.getBySong, { songId });
  const saveLyrics = useMutation(api.lyrics.save);

  const [content, setContent] = useState("");
  const [initialized, setInitialized] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Feature toggles ---
  const [showSyllables, setShowSyllables] = useState(false);
  const [showChords, setShowChords] = useState(false);
  const [showStructure, setShowStructure] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // --- AI state ---
  const { runAction, dismiss, aiExtension, viewRef } = useEditorAIWidget();
  const [contextMenu, setContextMenu] = useState<EditorContextMenuInfo | null>(
    null
  );

  // --- Rhyme popup state ---
  const [rhymePopup, setRhymePopup] = useState<{
    result: RhymeResult | null; // null = loading
    word: string;
    x: number;
    y: number;
  } | null>(null);

  // --- Lyrics init + autosave ---
  useEffect(() => {
    if (lyrics !== undefined && !initialized) {
      setContent(lyrics?.content ?? "");
      setInitialized(true);
    }
  }, [lyrics, initialized]);

  useEffect(() => {
    if (!initialized) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void saveLyrics({ songId, content });
    }, 500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [content, songId, saveLyrics, initialized]);

  // --- Rhyme keybinding extension ---
  const rhymeExtension = useMemo(
    () =>
      createRhymeKeybinding((word, x, y) => {
        // Show popup immediately in loading state
        setRhymePopup({ result: null, word, x, y });

        // Fetch rhymes async
        void findRhymes(word).then((result) => {
          setRhymePopup((prev) => {
            // Only update if still showing the same word
            if (prev && prev.word === word) {
              return { ...prev, result };
            }
            return prev;
          });
        });
      }),
    []
  );

  const additionalExtensions = useMemo(
    () => [aiExtension, rhymeExtension],
    [aiExtension, rhymeExtension]
  );

  // --- Context menu handlers ---
  const handleContextMenu = useCallback((info: EditorContextMenuInfo) => {
    setContextMenu(info);
  }, []);

  const handleActionSelect = useCallback(
    (action: EditorAIAction, extra?: { userInstruction?: string; emotion?: string }) => {
      if (!contextMenu) return;

      const hasSelection = contextMenu.selectedText.length > 0;
      const targetText = hasSelection ? contextMenu.selectedText : content;

      const selFrom = hasSelection ? contextMenu.selectionFrom : 0;
      const selTo = hasSelection
        ? contextMenu.selectionTo
        : viewRef.current?.state.doc.length ?? content.length;

      const widgetPos = hasSelection
        ? contextMenu.selectionTo
        : contextMenu.lineTo;

      void runAction(
        action,
        targetText,
        content,
        contextMenu.lineNumber,
        selFrom,
        selTo,
        widgetPos,
        hasSelection,
        extra
      );
    },
    [contextMenu, content, runAction, viewRef]
  );

  const handleMove = useCallback(() => {
    if (!contextMenu || !contextMenu.selectedText || !onMoveText) return;
    const { selectedText, selectionFrom, selectionTo } = contextMenu;

    // Append to notes via parent callback
    onMoveText(selectedText);

    // Remove selected text from this editor
    viewRef.current?.dispatch({
      changes: { from: selectionFrom, to: selectionTo, insert: "" },
    });
  }, [contextMenu, onMoveText, viewRef]);

  const handleView = useCallback(
    (view: EditorView | null) => {
      viewRef.current = view;
    },
    [viewRef]
  );

  const handleScrollToLine = useCallback(
    (line: number) => {
      const view = viewRef.current;
      if (!view) return;
      const lineInfo = view.state.doc.line(Math.min(line + 1, view.state.doc.lines));
      view.dispatch({
        selection: { anchor: lineInfo.from },
        scrollIntoView: true,
      });
      view.focus();
    },
    [viewRef]
  );

  const handleInsertSection = useCallback(
    (sectionName: string) => {
      const view = viewRef.current;
      if (!view) return;
      const docLen = view.state.doc.length;
      const insert = `\n\n[${sectionName}]\n`;
      view.dispatch({
        changes: { from: docLen, insert },
        selection: { anchor: docLen + insert.length },
      });
      view.focus();
    },
    [viewRef]
  );

  const handleReorder = useCallback(
    (newContent: string) => {
      setContent(newContent);
      // Also update the editor view directly so CodeMirror stays in sync
      const view = viewRef.current;
      if (view) {
        view.dispatch({
          changes: {
            from: 0,
            to: view.state.doc.length,
            insert: newContent,
          },
        });
      }
    },
    [viewRef]
  );

  const handleRestore = useCallback(
    (restoredContent: string) => {
      setContent(restoredContent);
    },
    []
  );

  const handleInsertRhyme = useCallback(
    (word: string) => {
      const view = viewRef.current;
      if (!view) return;
      const cursor = view.state.selection.main.head;
      view.dispatch({
        changes: { from: cursor, insert: " " + word },
        selection: { anchor: cursor + word.length + 1 },
      });
      setRhymePopup(null);
      view.focus();
    },
    [viewRef]
  );

  // Close rhyme popup on click outside or Escape
  useEffect(() => {
    if (!rhymePopup) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setRhymePopup(null);
    }
    function handleClick() {
      setRhymePopup(null);
    }
    window.addEventListener("keydown", handleKey);
    window.addEventListener("pointerdown", handleClick);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("pointerdown", handleClick);
    };
  }, [rhymePopup]);

  // --- Render ---
  if (lyrics === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b px-3 py-1.5">
        <Button
          variant={showSyllables ? "secondary" : "ghost"}
          size="icon-xs"
          onClick={() => setShowSyllables(!showSyllables)}
          title="Toggle syllable counter"
        >
          <Hash className="size-3.5" />
        </Button>
        <Button
          variant={showChords ? "secondary" : "ghost"}
          size="icon-xs"
          onClick={() => setShowChords(!showChords)}
          title="Toggle chord overlay"
        >
          <Guitar className="size-3.5" />
        </Button>
        <Button
          variant={showStructure ? "secondary" : "ghost"}
          size="icon-xs"
          onClick={() => setShowStructure(!showStructure)}
          title="Toggle structure outline"
        >
          <LayoutList className="size-3.5" />
        </Button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setHistoryOpen(true)}
          title="Lyrics history"
        >
          <History className="size-3.5" />
        </Button>
        <span className="text-[10px] text-muted-foreground/40 ml-2">
          Cmd+R: rhymes
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Structure outline panel */}
        {showStructure && (
          <div className="w-44 shrink-0 border-r overflow-y-auto">
            <StructureOutline
              content={content}
              onScrollToLine={handleScrollToLine}
              onInsertSection={handleInsertSection}
              onReorder={handleReorder}
            />
          </div>
        )}

        {/* Editor */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <MarkdownEditor
            value={content}
            onChange={setContent}
            placeholder={`Write your lyrics here...

[Verse 1]
Your first verse

[Chorus]
The chorus goes here`}
            additionalExtensions={additionalExtensions}
            onEditorContextMenu={handleContextMenu}
            onView={handleView}
            showSyllables={showSyllables}
            showChords={showChords}
            songKey={songKey}
          />

          {/* Writing analytics */}
          <WritingAnalytics content={content} tempo={undefined} />
        </div>
      </div>

      {/* Rhyme popup */}
      {rhymePopup && (
        <div
          className="fixed z-50 min-w-[240px] max-w-[320px] rounded-lg border bg-popover p-3 shadow-lg animate-in fade-in-0 zoom-in-95"
          style={{ left: rhymePopup.x, top: rhymePopup.y }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="text-xs font-semibold text-primary mb-2">
            Rhymes for &ldquo;{rhymePopup.word}&rdquo;
          </div>

          {/* Loading state */}
          {rhymePopup.result === null && (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="size-3 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Finding rhymes...</span>
            </div>
          )}

          {/* Results */}
          {rhymePopup.result && (
            <>
              {rhymePopup.result.perfect.length > 0 && (
                <div className="mb-2">
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">
                    Perfect
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {rhymePopup.result.perfect.map((w) => (
                      <button
                        key={w}
                        onClick={() => handleInsertRhyme(w)}
                        className="rounded-md border px-1.5 py-0.5 text-xs hover:bg-accent transition-colors"
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {rhymePopup.result.slant.length > 0 && (
                <div className="mb-2">
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">
                    Near
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {rhymePopup.result.slant.map((w) => (
                      <button
                        key={w}
                        onClick={() => handleInsertRhyme(w)}
                        className="rounded-md border px-1.5 py-0.5 text-xs hover:bg-accent transition-colors"
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {rhymePopup.result.multiSyllable.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">
                    Multi-syllable
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {rhymePopup.result.multiSyllable.map((w) => (
                      <button
                        key={w}
                        onClick={() => handleInsertRhyme(w)}
                        className="rounded-md border px-1.5 py-0.5 text-xs hover:bg-accent transition-colors"
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {rhymePopup.result.perfect.length === 0 &&
                rhymePopup.result.slant.length === 0 &&
                rhymePopup.result.multiSyllable.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No rhymes found for this word.
                  </p>
                )}
            </>
          )}
        </div>
      )}

      {contextMenu && (
        <EditorContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          mode="lyrics"
          hasSelection={contextMenu.selectedText.length > 0}
          onSelectAI={handleActionSelect}
          onMove={handleMove}
          onClose={() => setContextMenu(null)}
        />
      )}

      <LyricsHistory
        songId={songId}
        currentContent={content}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        onRestore={handleRestore}
      />
    </>
  );
}

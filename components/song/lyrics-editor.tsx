"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { Loader2 } from "lucide-react";
import type { EditorView } from "@codemirror/view";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import type { EditorAIAction } from "@/lib/ai";
import { useEditorAIWidget } from "@/hooks/use-editor-ai-widget";
import { MarkdownEditor, type EditorContextMenuInfo } from "./markdown-editor";
import { EditorContextMenu } from "./editor-context-menu";

export function LyricsEditor({
  songId,
  onMoveText,
}: {
  songId: Id<"songs">;
  onMoveText?: (text: string) => void;
}) {
  const lyrics = useQuery(api.lyrics.getBySong, { songId });
  const saveLyrics = useMutation(api.lyrics.save);

  const [content, setContent] = useState("");
  const [initialized, setInitialized] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- AI state ---
  const { runAction, dismiss, aiExtension, viewRef } = useEditorAIWidget();
  const [contextMenu, setContextMenu] = useState<EditorContextMenuInfo | null>(
    null
  );

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

  // --- Context menu handlers ---
  const handleContextMenu = useCallback((info: EditorContextMenuInfo) => {
    setContextMenu(info);
  }, []);

  const handleActionSelect = useCallback(
    (action: EditorAIAction) => {
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
        hasSelection
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
      <MarkdownEditor
        value={content}
        onChange={setContent}
        placeholder={`Write your lyrics here...

[Verse 1]
Your first verse

[Chorus]
The chorus goes here`}
        additionalExtensions={[aiExtension]}
        onEditorContextMenu={handleContextMenu}
        onView={handleView}
      />

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
    </>
  );
}

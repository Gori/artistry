"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { Loader2 } from "lucide-react";
import type { EditorView } from "@codemirror/view";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import type { EditorAIAction } from "@/lib/ai";
import { useEditorAIWidget } from "@/hooks/use-editor-ai-widget";
import { MarkdownEditor, type EditorContextMenuInfo } from "./markdown-editor";
import { EditorContextMenu } from "./editor-context-menu";
import { imagePasteExtension } from "@/lib/codemirror/image-paste";
import { useImageUpload } from "@/hooks/use-image-upload";

export function NotesPanel({
  songId,
  onMoveText,
}: {
  songId: Id<"songs">;
  onMoveText?: (text: string) => void;
}) {
  const notes = useQuery(api.notes.getBySong, { songId });
  const saveNotes = useMutation(api.notes.save);
  const { uploadImage } = useImageUpload();

  const [content, setContent] = useState("");
  const [initialized, setInitialized] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- AI state ---
  const { runAction, dismiss, aiExtension, viewRef } = useEditorAIWidget();
  const [contextMenu, setContextMenu] = useState<EditorContextMenuInfo | null>(
    null
  );

  useEffect(() => {
    if (notes !== undefined && !initialized) {
      setContent(notes?.content ?? "");
      setInitialized(true);
    }
  }, [notes, initialized]);

  useEffect(() => {
    if (!initialized) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void saveNotes({ songId, content });
    }, 500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [content, songId, saveNotes, initialized]);

  const additionalExtensions = useMemo(
    () => [aiExtension, imagePasteExtension(uploadImage)],
    [aiExtension, uploadImage]
  );

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

    // Append to lyrics via parent callback
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

  if (notes === undefined) {
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
        placeholder="Write notes here...

# Song structure ideas
**Key change** in the bridge section"
        additionalExtensions={additionalExtensions}
        onEditorContextMenu={handleContextMenu}
        onView={handleView}
      />

      {contextMenu && (
        <EditorContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          mode="notes"
          hasSelection={contextMenu.selectedText.length > 0}
          onSelectAI={handleActionSelect}
          onMove={handleMove}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}

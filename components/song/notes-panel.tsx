"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { Loader2, Plus, ChevronDown, ChevronUp, Image as ImageIcon, Link2, Type, Palette } from "lucide-react";
import type { EditorView } from "@codemirror/view";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import type { EditorAIAction } from "@/lib/ai";
import { useEditorAIWidget } from "@/hooks/use-editor-ai-widget";
import { MarkdownEditor, type EditorContextMenuInfo } from "./markdown-editor";
import { EditorContextMenu } from "./editor-context-menu";
import { ReferenceCard } from "./reference-card";
import { imagePasteExtension } from "@/lib/codemirror/image-paste";
import { useImageUpload } from "@/hooks/use-image-upload";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

  // --- References ---
  const references = useQuery(api.references.listBySong, { songId });
  const createReference = useMutation(api.references.create);
  const removeReference = useMutation(api.references.remove);
  const [refsExpanded, setRefsExpanded] = useState(true);

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

  // --- Reference handlers ---
  const handleAddText = useCallback(async () => {
    const text = prompt("Enter a text note:");
    if (text) {
      await createReference({ songId, type: "text", content: text });
    }
  }, [songId, createReference]);

  const handleAddLink = useCallback(async () => {
    const url = prompt("Enter a URL:");
    if (url) {
      await createReference({ songId, type: "link", content: url, title: url });
    }
  }, [songId, createReference]);

  const handleAddColor = useCallback(async () => {
    const color = prompt("Enter a hex color (e.g. #ff6b6b):");
    if (color) {
      await createReference({ songId, type: "color", content: color });
    }
  }, [songId, createReference]);

  const handleAddImage = useCallback(async () => {
    const url = prompt("Enter an image URL:");
    if (url) {
      await createReference({ songId, type: "image", content: url });
    }
  }, [songId, createReference]);

  if (notes === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Editor */}
      <div className="flex-1 overflow-hidden">
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
      </div>

      {/* References section */}
      <div className="border-t">
        <button
          onClick={() => setRefsExpanded(!refsExpanded)}
          className="flex w-full items-center gap-2 px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="font-medium">References</span>
          {references && references.length > 0 && (
            <span className="opacity-60">{references.length}</span>
          )}
          {refsExpanded ? (
            <ChevronUp className="size-3 ml-auto" />
          ) : (
            <ChevronDown className="size-3 ml-auto" />
          )}
        </button>

        {refsExpanded && (
          <div className="px-4 pb-3">
            {/* Add button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="xs" className="mb-2 gap-1">
                  <Plus className="size-3" />
                  Add Reference
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={handleAddImage} className="gap-2 text-xs">
                  <ImageIcon className="size-3" /> Image
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleAddLink} className="gap-2 text-xs">
                  <Link2 className="size-3" /> Link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleAddText} className="gap-2 text-xs">
                  <Type className="size-3" /> Note
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleAddColor} className="gap-2 text-xs">
                  <Palette className="size-3" /> Color
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Reference cards grid */}
            {references && references.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {references.map((ref) => (
                  <ReferenceCard
                    key={ref._id}
                    type={ref.type}
                    content={ref.content}
                    title={ref.title}
                    onDelete={() => void removeReference({ id: ref._id })}
                  />
                ))}
              </div>
            )}

            {(!references || references.length === 0) && (
              <p className="text-xs text-muted-foreground">
                Add images, links, colors, or notes as references for this song.
              </p>
            )}
          </div>
        )}
      </div>

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
    </div>
  );
}

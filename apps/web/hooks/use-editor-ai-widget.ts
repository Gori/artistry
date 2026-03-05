"use client";

import { useRef, useMemo, useEffect } from "react";
import type { EditorView } from "@codemirror/view";
import {
  createAIExtension,
  setAIBlock,
  updateAIContent,
  clearAIBlock,
  type AIWidgetCallbacks,
} from "@/lib/codemirror/ai-widget";
import { useEditorAI } from "@/hooks/use-editor-ai";

/**
 * Encapsulates all AI widget wiring for a CodeMirror editor:
 * - The streaming AI hook (`useEditorAI`)
 * - Callback refs for accept/replace/dismiss
 * - The CM extension (stable identity)
 * - The useEffect that syncs React state → CM effects
 *
 * Usage: call this hook, pass `aiExtension` into your editor's
 * `additionalExtensions`, and use `runAction` / `dismiss` / `aiBlock`
 * from the returned object.
 */
export function useEditorAIWidget() {
  const { aiBlock, runAction, dismiss } = useEditorAI();
  const viewRef = useRef<EditorView | null>(null);
  const aiBlockInitialized = useRef(false);

  // Callbacks ref — always points at current React functions
  const aiCallbacksRef = useRef<AIWidgetCallbacks>({
    onAcceptText: () => {},
    onReplaceLine: () => {},
    onDismiss: () => {},
  });
  aiCallbacksRef.current = {
    onAcceptText: (text, insertPos) => {
      viewRef.current?.dispatch({
        changes: { from: insertPos, insert: text },
      });
      dismiss();
    },
    onReplaceLine: (from, to, text) => {
      viewRef.current?.dispatch({
        changes: { from, to, insert: text },
      });
      dismiss();
    },
    onDismiss: () => dismiss(),
  };

  // Stable AI extension (never changes identity)
  const aiExtension = useMemo(
    () => createAIExtension(aiCallbacksRef),
    []
  );

  // Sync AI state → CodeMirror effects
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    if (aiBlock === null) {
      if (aiBlockInitialized.current) {
        view.dispatch({ effects: clearAIBlock.of(undefined) });
        aiBlockInitialized.current = false;
      }
      return;
    }

    if (!aiBlockInitialized.current) {
      view.dispatch({
        effects: setAIBlock.of({
          pos: aiBlock.pos,
          content: aiBlock.content,
          loading: aiBlock.status === "loading",
          action: aiBlock.action,
          targetText: aiBlock.targetText,
          selFrom: aiBlock.selFrom,
          selTo: aiBlock.selTo,
          hasSelection: aiBlock.hasSelection,
        }),
      });
      aiBlockInitialized.current = true;
    } else {
      view.dispatch({
        effects: updateAIContent.of({
          content: aiBlock.content,
          loading: aiBlock.status === "loading",
        }),
      });
    }
  }, [aiBlock]);

  return { aiBlock, runAction, dismiss, aiExtension, viewRef };
}

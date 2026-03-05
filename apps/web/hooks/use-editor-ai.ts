"use client";

import { useState, useCallback, useRef } from "react";
import type { EditorAIAction } from "@/lib/ai";

export interface AIBlockState {
  status: "loading" | "done" | "error";
  content: string;
  action: EditorAIAction;
  /** The text the AI is operating on (selection or full lyrics) */
  targetText: string;
  lineNumber: number;
  /** Start of the replacement range */
  selFrom: number;
  /** End of the replacement range */
  selTo: number;
  /** Widget anchor position in the document */
  pos: number;
  /** Whether the user had an active text selection */
  hasSelection: boolean;
}

export function useEditorAI() {
  const [aiBlock, setAIBlock] = useState<AIBlockState | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runAction = useCallback(
    async (
      action: EditorAIAction,
      targetText: string,
      fullLyrics: string,
      lineNumber: number,
      selFrom: number,
      selTo: number,
      pos: number,
      hasSelection: boolean,
      extra?: { userInstruction?: string; emotion?: string }
    ) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setAIBlock({
        status: "loading",
        content: "",
        action,
        targetText,
        lineNumber,
        selFrom,
        selTo,
        pos,
        hasSelection,
      });

      try {
        const response = await fetch("/api/ai/lyrics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            targetText,
            fullLyrics,
            lineNumber,
            hasSelection,
            ...(extra?.userInstruction && { userInstruction: extra.userInstruction }),
            ...(extra?.emotion && { emotion: extra.emotion }),
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          setAIBlock((prev) =>
            prev
              ? { ...prev, status: "error", content: "Failed to generate response." }
              : null
          );
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          setAIBlock((prev) =>
            prev ? { ...prev, content: prev.content + chunk } : null
          );
        }

        setAIBlock((prev) => (prev ? { ...prev, status: "done" } : null));
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setAIBlock((prev) =>
            prev
              ? { ...prev, status: "error", content: "Failed to generate response." }
              : null
          );
        }
      }
    },
    []
  );

  const dismiss = useCallback(() => {
    abortRef.current?.abort();
    setAIBlock(null);
  }, []);

  return { aiBlock, runAction, dismiss };
}

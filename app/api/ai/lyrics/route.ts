import { streamText } from "ai";
import { aiModel } from "@/lib/ai";
import { buildPrompt } from "@/lib/ai/prompts";
import type { EditorAIAction } from "@/lib/ai";

export const maxDuration = 30;

export async function POST(req: Request) {
  const body = await req.json();
  const { action, targetText, fullLyrics, lineNumber, hasSelection, userInstruction, emotion } =
    body as {
      action: EditorAIAction;
      targetText: string;
      fullLyrics: string;
      lineNumber: number;
      hasSelection: boolean;
      userInstruction?: string;
      emotion?: string;
    };

  const { system, user } = buildPrompt(action, {
    targetText,
    fullLyrics,
    lineNumber,
    hasSelection,
    userInstruction,
    emotion,
  });

  const maxTokens =
    action === "continue-writing" || action === "free-form"
      ? 800
      : action === "rewrite-emotion"
        ? 600
        : 500;

  const result = streamText({
    model: aiModel,
    system,
    prompt: user,
    maxOutputTokens: maxTokens,
  });

  return result.toTextStreamResponse();
}

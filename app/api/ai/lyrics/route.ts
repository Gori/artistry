import { streamText } from "ai";
import { aiModel } from "@/lib/ai";
import { buildPrompt } from "@/lib/ai/prompts";
import type { EditorAIAction } from "@/lib/ai";

export const maxDuration = 30;

export async function POST(req: Request) {
  const body = await req.json();
  const { action, targetText, fullLyrics, lineNumber, hasSelection } = body as {
    action: EditorAIAction;
    targetText: string;
    fullLyrics: string;
    lineNumber: number;
    hasSelection: boolean;
  };

  const { system, user } = buildPrompt(action, {
    targetText,
    fullLyrics,
    lineNumber,
    hasSelection,
  });

  const result = streamText({
    model: aiModel,
    system,
    prompt: user,
    maxOutputTokens: 500,
  });

  return result.toTextStreamResponse();
}

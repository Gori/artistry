import { anthropic } from "@ai-sdk/anthropic";

export const aiModel = anthropic("claude-sonnet-4-6");

export type EditorAIAction =
  | "alternatives"
  | "add-verse"
  | "explain-theme"
  | "find-synonyms"
  | "find-rhymes"
  | "overall-impression"
  | "check-grammar";

export interface EditorAIActionDef {
  id: EditorAIAction;
  label: string;
}

export const AI_ACTIONS: EditorAIActionDef[] = [
  { id: "alternatives", label: "Give me 5 alternatives" },
  { id: "add-verse", label: "Add another verse" },
  { id: "explain-theme", label: "Explain the theme" },
  { id: "find-synonyms", label: "Find synonyms" },
  { id: "find-rhymes", label: "Find other words that rhyme" },
  { id: "overall-impression", label: "Overall impression" },
  { id: "check-grammar", label: "Check grammar" },
];

// Backward-compat aliases
export type LyricsAction = EditorAIAction;
export type LyricsActionDef = EditorAIActionDef;
export const LYRICS_ACTIONS = AI_ACTIONS;
export const lyricsModel = aiModel;

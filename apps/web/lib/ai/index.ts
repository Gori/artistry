import { anthropic } from "@ai-sdk/anthropic";

export const aiModel = anthropic("claude-sonnet-4-6");

export type EditorAIAction =
  | "alternatives"
  | "add-verse"
  | "continue-writing"
  | "free-form"
  | "rewrite-emotion"
  | "explain-theme"
  | "find-synonyms"
  | "find-rhymes"
  | "overall-impression"
  | "check-grammar";

export interface EditorAIActionDef {
  id: EditorAIAction;
  label: string;
  group?: "generate" | "rewrite" | "analyze";
  /** For free-form, the user-typed instruction */
  userInstruction?: string;
  /** For rewrite-emotion, the target emotion */
  emotion?: string;
}

export const AI_ACTIONS: EditorAIActionDef[] = [
  // Generate
  { id: "continue-writing", label: "Continue writing", group: "generate" },
  { id: "add-verse", label: "Add another verse", group: "generate" },
  // Rewrite
  { id: "alternatives", label: "Give me 5 alternatives", group: "rewrite" },
  { id: "find-synonyms", label: "Find synonyms", group: "rewrite" },
  // Analyze
  { id: "explain-theme", label: "Explain the theme", group: "analyze" },
  { id: "overall-impression", label: "Overall impression", group: "analyze" },
  { id: "find-rhymes", label: "Find rhymes", group: "analyze" },
  { id: "check-grammar", label: "Check grammar", group: "analyze" },
];

export const EMOTIONS = [
  "Tender",
  "Angry",
  "Joyful",
  "Melancholy",
  "Defiant",
  "Playful",
] as const;

export type Emotion = (typeof EMOTIONS)[number];

// Backward-compat aliases
export type LyricsAction = EditorAIAction;
export type LyricsActionDef = EditorAIActionDef;
export const LYRICS_ACTIONS = AI_ACTIONS;
export const lyricsModel = aiModel;

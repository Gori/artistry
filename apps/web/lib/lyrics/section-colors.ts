/**
 * Shared section color definitions used across the lyrics editor,
 * structure outline, and teleprompter.
 *
 * Each map uses the same section-name keys but different value formats
 * depending on where they are consumed (CSS variables, Tailwind classes, etc.).
 */

/** CSS custom-property values — used inside CodeMirror inline styles */
export const SECTION_COLORS: Record<string, string> = {
  verse: "var(--section-verse)",
  chorus: "var(--section-chorus)",
  bridge: "var(--section-bridge)",
  "pre-chorus": "var(--section-pre-chorus)",
  "pre chorus": "var(--section-pre-chorus)",
  intro: "var(--section-intro)",
  outro: "var(--section-outro)",
  hook: "var(--section-hook)",
  instrumental: "var(--section-instrumental)",
  interlude: "var(--section-interlude)",
};

/** Tailwind bg/text/border utility classes — used in the structure outline */
export const SECTION_OUTLINE_COLORS: Record<string, string> = {
  verse: "bg-section-verse/20 text-section-verse border-section-verse/30",
  chorus: "bg-section-chorus/20 text-section-chorus border-section-chorus/30",
  bridge: "bg-section-bridge/20 text-section-bridge border-section-bridge/30",
  "pre-chorus":
    "bg-section-pre-chorus/20 text-section-pre-chorus border-section-pre-chorus/30",
  "pre chorus":
    "bg-section-pre-chorus/20 text-section-pre-chorus border-section-pre-chorus/30",
  intro: "bg-section-intro/20 text-section-intro border-section-intro/30",
  outro: "bg-section-outro/20 text-section-outro border-section-outro/30",
  hook: "bg-section-hook/20 text-section-hook border-section-hook/30",
  instrumental:
    "bg-section-instrumental/20 text-section-instrumental border-section-instrumental/30",
  interlude:
    "bg-section-interlude/20 text-section-interlude border-section-interlude/30",
};

/** Tailwind text-only utility classes — used in the teleprompter */
export const SECTION_TEXT_COLORS: Record<string, string> = {
  verse: "text-section-verse",
  chorus: "text-section-chorus",
  bridge: "text-section-bridge",
  "pre-chorus": "text-section-pre-chorus",
  "pre chorus": "text-section-pre-chorus",
  intro: "text-section-intro",
  outro: "text-section-outro",
  hook: "text-section-hook",
  instrumental: "text-section-instrumental",
  interlude: "text-section-interlude",
};

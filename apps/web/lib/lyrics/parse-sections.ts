export interface LyricsSection {
  name: string;
  startLine: number;
  endLine: number;
  content: string;
  /** Full raw text including the [Section] marker line */
  rawText: string;
  wordCount: number;
  lineCount: number;
}

const SECTION_RE = /^\[([^\]]+)\]\s*$/;

/**
 * Parse lyrics into sections based on [Section] markers.
 * Lines before the first marker are grouped as "Intro" (or skipped if empty).
 */
export function parseSections(content: string): LyricsSection[] {
  if (!content.trim()) return [];

  const lines = content.split("\n");
  const sections: LyricsSection[] = [];
  let currentName = "";
  let currentStart = 0;
  let currentLines: string[] = [];

  function flush(endLine: number) {
    const text = currentLines.join("\n");
    const nonEmpty = currentLines.filter((l) => l.trim().length > 0);
    if (nonEmpty.length === 0 && !currentName) return;

    // Build rawText: include the [Section] marker line + content lines
    const rawLines = currentName
      ? [`[${currentName}]`, ...currentLines]
      : currentLines;
    // Trim trailing empty lines from rawText
    while (rawLines.length > 0 && rawLines[rawLines.length - 1].trim() === "") {
      rawLines.pop();
    }

    sections.push({
      name: currentName || "Intro",
      startLine: currentStart,
      endLine,
      content: text,
      rawText: rawLines.join("\n"),
      wordCount: nonEmpty.join(" ").split(/\s+/).filter(Boolean).length,
      lineCount: nonEmpty.length,
    });
  }

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(SECTION_RE);
    if (match) {
      flush(i - 1);
      currentName = match[1];
      currentStart = i;
      currentLines = [];
    } else {
      currentLines.push(lines[i]);
    }
  }

  flush(lines.length - 1);
  return sections;
}

/**
 * Reconstruct lyrics content from reordered sections.
 * Joins sections with double newlines between them.
 */
export function rebuildFromSections(sections: LyricsSection[]): string {
  return sections.map((s) => s.rawText).join("\n\n");
}

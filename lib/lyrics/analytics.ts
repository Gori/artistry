import { parseSections } from "./parse-sections";

const STOP_WORDS = new Set([
  "i", "me", "my", "myself", "we", "our", "ours", "you", "your", "yours",
  "he", "him", "his", "she", "her", "hers", "it", "its", "they", "them",
  "their", "theirs", "what", "which", "who", "whom", "this", "that", "these",
  "those", "am", "is", "are", "was", "were", "be", "been", "being", "have",
  "has", "had", "do", "does", "did", "will", "would", "shall", "should",
  "may", "might", "must", "can", "could", "a", "an", "the", "and", "but",
  "if", "or", "because", "as", "until", "while", "of", "at", "by", "for",
  "with", "about", "against", "between", "through", "during", "before",
  "after", "above", "below", "to", "from", "up", "down", "in", "out", "on",
  "off", "over", "under", "again", "further", "then", "once", "here",
  "there", "when", "where", "why", "how", "all", "both", "each", "few",
  "more", "most", "other", "some", "such", "no", "nor", "not", "only",
  "own", "same", "so", "than", "too", "very", "just", "don", "t", "s",
  "ll", "ve", "re", "d", "m", "ain", "gonna", "gotta", "wanna",
]);

/** Count syllables in a single word (regex-based English estimation) */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length === 0) return 0;
  if (w.length <= 2) return 1;

  let count = 0;
  const vowels = "aeiouy";
  let prevVowel = false;

  for (let i = 0; i < w.length; i++) {
    const isVowel = vowels.includes(w[i]);
    if (isVowel && !prevVowel) count++;
    prevVowel = isVowel;
  }

  // Adjustments
  if (w.endsWith("e") && !w.endsWith("le") && !w.endsWith("be") && !w.endsWith("ce") && !w.endsWith("ge")) {
    count = Math.max(1, count - 1);
  }
  if (w.endsWith("le") && w.length > 2 && !vowels.includes(w[w.length - 3])) {
    count++;
  }
  if (w.endsWith("es") && !w.endsWith("les") && !w.endsWith("ies")) {
    count = Math.max(1, count - 1);
  }
  if (w.endsWith("ed") && !w.endsWith("ted") && !w.endsWith("ded")) {
    count = Math.max(1, count - 1);
  }
  if (w.endsWith("tion") || w.endsWith("sion")) {
    // Already counted as one syllable
  }

  return Math.max(1, count);
}

/** Count syllables in a line of text */
export function countLineSyllables(line: string): number {
  return line
    .split(/\s+/)
    .filter(Boolean)
    .reduce((sum, word) => sum + countSyllables(word), 0);
}

export interface WordFrequency {
  word: string;
  count: number;
}

export interface SectionStats {
  name: string;
  wordCount: number;
  lineCount: number;
}

export interface LyricsAnalytics {
  totalWords: number;
  totalLines: number;
  totalSections: number;
  uniqueWords: number;
  vocabularyRichness: number;
  topWords: WordFrequency[];
  sections: SectionStats[];
  avgSyllablesPerLine: number;
  syllableRange: [number, number];
  rhymeDensity: number;
  estimatedDuration: string;
  readingLevel: number;
}

/** Compute analytics for lyrics content */
export function analyzeLyrics(content: string, tempo?: string): LyricsAnalytics {
  const sections = parseSections(content);
  const lines = content.split("\n");
  const SECTION_RE = /^\[([^\]]+)\]\s*$/;
  const contentLines = lines.filter(
    (l) => l.trim().length > 0 && !SECTION_RE.test(l)
  );

  // Word counting
  const allWords = contentLines
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z'\s-]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  const wordSet = new Set(allWords);

  // Frequency (excluding stop words)
  const freq = new Map<string, number>();
  for (const w of allWords) {
    if (!STOP_WORDS.has(w) && w.length > 1) {
      freq.set(w, (freq.get(w) ?? 0) + 1);
    }
  }
  const topWords = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));

  // Syllables per line
  const syllableCounts = contentLines.map(countLineSyllables);
  const avgSyllables =
    syllableCounts.length > 0
      ? syllableCounts.reduce((a, b) => a + b, 0) / syllableCounts.length
      : 0;
  const minSyl = syllableCounts.length > 0 ? Math.min(...syllableCounts) : 0;
  const maxSyl = syllableCounts.length > 0 ? Math.max(...syllableCounts) : 0;

  // Rhyme density - check line endings
  const endWords = contentLines
    .map((l) => {
      const words = l.trim().split(/\s+/);
      return words[words.length - 1]?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
    })
    .filter(Boolean);

  let rhymingLines = 0;
  for (let i = 0; i < endWords.length; i++) {
    for (let j = i + 1; j < endWords.length; j++) {
      if (endWords[i] === endWords[j]) continue;
      if (simpleRhymeCheck(endWords[i], endWords[j])) {
        rhymingLines++;
        break;
      }
    }
  }

  // Estimated duration
  const bpm = tempo ? parseInt(tempo) : 120;
  const wordsPerMinute = bpm * 0.6; // rough: ~0.6 words per beat
  const durationMin = allWords.length / wordsPerMinute;
  const mins = Math.floor(durationMin);
  const secs = Math.round((durationMin - mins) * 60);
  const estimatedDuration = `${mins}:${secs.toString().padStart(2, "0")}`;

  // Flesch-Kincaid approximation
  const totalSyllables = allWords.reduce((s, w) => s + countSyllables(w), 0);
  const sentences = contentLines.length;
  const readingLevel =
    sentences > 0 && allWords.length > 0
      ? 0.39 * (allWords.length / sentences) +
        11.8 * (totalSyllables / allWords.length) -
        15.59
      : 0;

  return {
    totalWords: allWords.length,
    totalLines: contentLines.length,
    totalSections: sections.length,
    uniqueWords: wordSet.size,
    vocabularyRichness:
      allWords.length > 0 ? wordSet.size / allWords.length : 0,
    topWords,
    sections: sections.map((s) => ({
      name: s.name,
      wordCount: s.wordCount,
      lineCount: s.lineCount,
    })),
    avgSyllablesPerLine: Math.round(avgSyllables * 10) / 10,
    syllableRange: [minSyl, maxSyl],
    rhymeDensity:
      endWords.length > 0 ? Math.round((rhymingLines / endWords.length) * 100) : 0,
    estimatedDuration,
    readingLevel: Math.round(Math.max(0, readingLevel) * 10) / 10,
  };
}

/** Simple rhyme check: compare last 2-3 characters */
function simpleRhymeCheck(a: string, b: string): boolean {
  if (a.length < 2 || b.length < 2) return false;
  const endA = a.slice(-3);
  const endB = b.slice(-3);
  if (endA === endB) return true;
  if (a.slice(-2) === b.slice(-2)) return true;
  return false;
}

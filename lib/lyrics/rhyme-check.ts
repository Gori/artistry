const VOWELS = "aeiouy";

/**
 * Normalize common English vowel spellings to canonical phonetic forms.
 * Only handles unambiguous patterns to avoid false positives.
 */
function normalizeForRhyme(word: string): string {
  let w = word.toLowerCase().replace(/[^a-z]/g, "");

  // Vowel-consonant-silent-e → long vowel (apply before digraph rules)
  w = w.replace(/a([^aeiou])e$/, "ay$1"); // lane, make, face
  w = w.replace(/i([^aeiou])e$/, "ii$1"); // line, fire, mine
  w = w.replace(/u([^aeiou])e$/, "uu$1"); // June, tune, rule

  // Digraph normalizations (unambiguous)
  w = w.replace(/igh/g, "ii"); // night, light, sight
  w = w.replace(/oo/g, "uu"); // moon, soon, tool
  w = w.replace(/ea/g, "ee"); // beat, sea, mean
  w = w.replace(/ai/g, "ay"); // rain, pain, gain
  w = w.replace(/oi/g, "oy"); // coin, join, point

  // Terminal patterns
  w = w.replace(/ue$/, "uu"); // blue, true, clue
  w = w.replace(/ew$/, "uu"); // knew, blew, flew

  return w;
}

/**
 * Extract the rhyme-relevant suffix: from the last vowel group to the end.
 */
function getRhymeSuffix(normalized: string): string {
  let start = -1;
  for (let i = normalized.length - 1; i >= 0; i--) {
    if (VOWELS.includes(normalized[i])) {
      start = i;
      while (start > 0 && VOWELS.includes(normalized[start - 1])) {
        start--;
      }
      break;
    }
  }
  return start >= 0 ? normalized.slice(start) : normalized;
}

/**
 * Check if two words rhyme using phonetic suffix comparison
 * with raw suffix fallback for cases normalization doesn't cover.
 */
export function isPhoneticRhyme(a: string, b: string): boolean {
  const cleanA = a.toLowerCase().replace(/[^a-z]/g, "");
  const cleanB = b.toLowerCase().replace(/[^a-z]/g, "");

  if (cleanA.length < 1 || cleanB.length < 1) return false;

  // Identical words count as rhyming in songs (repeated lines, choruses)
  if (cleanA === cleanB) return true;

  // Primary: phonetic suffix comparison
  const suffA = getRhymeSuffix(normalizeForRhyme(a));
  const suffB = getRhymeSuffix(normalizeForRhyme(b));
  if (suffA.length >= 2 && suffA === suffB) return true;

  // Fallback: raw last-3 or last-2 character match
  if (cleanA.length >= 3 && cleanB.length >= 3 && cleanA.slice(-3) === cleanB.slice(-3)) return true;
  if (cleanA.length >= 2 && cleanB.length >= 2 && cleanA.slice(-2) === cleanB.slice(-2)) return true;

  return false;
}

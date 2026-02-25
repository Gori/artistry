/**
 * Chord theory helpers: parsing, diatonic chord detection, key-based chord palettes.
 */

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

const FLAT_TO_SHARP: Record<string, string> = {
  Db: "C#", Eb: "D#", Fb: "E", Gb: "F#", Ab: "G#", Bb: "A#", Cb: "B",
};

const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11]; // W W H W W W H
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10]; // W H W W H W W

export interface ParsedChord {
  root: string;
  quality: string; // "m", "7", "m7", "maj7", "sus4", "dim", "aug", etc.
  display: string; // full chord name as written
}

/** Parse a chord string like "Am7", "C#m", "Dsus4" */
export function parseChord(chord: string): ParsedChord | null {
  const match = chord.match(/^([A-G][#b]?)(.*?)$/);
  if (!match) return null;

  let root = match[1];
  const quality = match[2] || "";

  // Normalize flats to sharps
  if (root.includes("b") && root.length === 2) {
    root = FLAT_TO_SHARP[root] ?? root;
  }

  return { root, quality, display: chord };
}

/** Get the note index (0-11) for a root note */
function noteIndex(note: string): number {
  const normalized = FLAT_TO_SHARP[note] ?? note;
  return NOTE_NAMES.indexOf(normalized as typeof NOTE_NAMES[number]);
}

/** Check if a chord is diatonic to a given key */
export function isDiatonic(chord: string, key: string): boolean {
  const parsed = parseChord(chord);
  if (!parsed) return false;

  // Determine if key is major or minor
  const isMinor = key.includes("m") && !key.includes("maj");
  const keyRoot = key.replace(/m$/, "").replace(/\s*(major|minor)$/i, "");
  const keyIdx = noteIndex(keyRoot);
  if (keyIdx === -1) return false;

  const intervals = isMinor ? MINOR_INTERVALS : MAJOR_INTERVALS;
  const scaleNotes = intervals.map((i) => (keyIdx + i) % 12);
  const chordRoot = noteIndex(parsed.root);

  return chordRoot !== -1 && scaleNotes.includes(chordRoot);
}

export interface ChordPaletteItem {
  chord: string;
  numeral: string;
}

/** Get diatonic chords for a key */
export function getDiatonicChords(key: string): ChordPaletteItem[] {
  const isMinor = key.includes("m") && !key.includes("maj");
  const keyRoot = key.replace(/m$/, "").replace(/\s*(major|minor)$/i, "");
  const keyIdx = noteIndex(keyRoot);
  if (keyIdx === -1) return [];

  const intervals = isMinor ? MINOR_INTERVALS : MAJOR_INTERVALS;
  const majorNumerals = ["I", "ii", "iii", "IV", "V", "vi", "vii°"];
  const minorNumerals = ["i", "ii°", "III", "iv", "v", "VI", "VII"];
  const majorQualities = ["", "m", "m", "", "", "m", "dim"];
  const minorQualities = ["m", "dim", "", "m", "m", "", ""];

  const numerals = isMinor ? minorNumerals : majorNumerals;
  const qualities = isMinor ? minorQualities : majorQualities;

  return intervals.map((interval, i) => {
    const noteIdx = (keyIdx + interval) % 12;
    const note = NOTE_NAMES[noteIdx];
    const quality = qualities[i];
    return {
      chord: note + quality,
      numeral: numerals[i],
    };
  });
}

/** Regex to match inline chord syntax: {Am}, {C#m7}, etc. */
export const CHORD_RE = /\{([A-G][#b]?[^}]*)\}/g;

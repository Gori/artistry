/**
 * Rhyme lookup API route backed by Datamuse.
 * Free, no auth, 100k requests/day.
 * Results are cached in-memory (rhymes never change).
 */

interface DatamuseWord {
  word: string;
  score: number;
  numSyllables?: number;
}

const cache = new Map<string, { perfect: string[]; slant: string[]; multiSyllable: string[] }>();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const word = searchParams.get("word")?.toLowerCase().replace(/[^a-z]/g, "");

  if (!word) {
    return Response.json({ perfect: [], slant: [], multiSyllable: [] });
  }

  // Check cache
  const cached = cache.get(word);
  if (cached) {
    return Response.json(cached);
  }

  try {
    // Fetch perfect rhymes and near rhymes in parallel
    const [perfectRes, slantRes] = await Promise.all([
      fetch(`https://api.datamuse.com/words?rel_rhy=${encodeURIComponent(word)}&max=30`),
      fetch(`https://api.datamuse.com/words?rel_nry=${encodeURIComponent(word)}&max=20`),
    ]);

    const perfectData: DatamuseWord[] = perfectRes.ok ? await perfectRes.json() : [];
    const slantData: DatamuseWord[] = slantRes.ok ? await slantRes.json() : [];

    // Categorize perfect rhymes by syllable count
    const perfect: string[] = [];
    const multiSyllable: string[] = [];

    for (const entry of perfectData) {
      if (entry.word === word) continue;
      const syllables = entry.numSyllables ?? 1;
      if (syllables > 2 || entry.word.includes(" ")) {
        multiSyllable.push(entry.word);
      } else {
        perfect.push(entry.word);
      }
    }

    // Slant rhymes — filter out any that are already in perfect
    const perfectSet = new Set(perfect);
    const multiSet = new Set(multiSyllable);
    const slant = slantData
      .map((e) => e.word)
      .filter((w) => w !== word && !perfectSet.has(w) && !multiSet.has(w));

    const result = {
      perfect: perfect.slice(0, 12),
      slant: slant.slice(0, 10),
      multiSyllable: multiSyllable.slice(0, 8),
    };

    // Cache it
    cache.set(word, result);

    return Response.json(result);
  } catch {
    return Response.json({ perfect: [], slant: [], multiSyllable: [] });
  }
}

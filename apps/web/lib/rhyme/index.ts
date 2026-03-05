/**
 * Rhyme lookup client.
 * Calls our /api/ai/rhyme endpoint which proxies Datamuse with caching.
 */

export interface RhymeResult {
  perfect: string[];
  slant: string[];
  multiSyllable: string[];
}

const EMPTY: RhymeResult = { perfect: [], slant: [], multiSyllable: [] };

// Client-side cache to avoid refetching the same word
const clientCache = new Map<string, RhymeResult>();

export async function findRhymes(word: string): Promise<RhymeResult> {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return EMPTY;

  const cached = clientCache.get(w);
  if (cached) return cached;

  try {
    const res = await fetch(`/api/ai/rhyme?word=${encodeURIComponent(w)}`);
    if (!res.ok) return EMPTY;

    const result: RhymeResult = await res.json();
    clientCache.set(w, result);
    return result;
  } catch {
    return EMPTY;
  }
}

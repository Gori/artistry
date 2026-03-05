/**
 * Extracts peak amplitude data from an audio file for waveform visualization.
 * Uses Web Audio API to decode audio, then downsamples into bars.
 * Results are cached in memory to avoid re-decoding on re-renders.
 */

interface PeakData {
  peaks: number[];
  duration: number;
}

const cache = new Map<string, PeakData>();

export async function generatePeaks(
  audioUrl: string,
  barCount: number = 200
): Promise<PeakData> {
  const key = `${audioUrl}:${barCount}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const response = await fetch(audioUrl);
  const arrayBuffer = await response.arrayBuffer();

  const ctx = new AudioContext();
  const decoded = await ctx.decodeAudioData(arrayBuffer);
  await ctx.close();

  const rawData = decoded.getChannelData(0);
  const samplesPerBar = Math.floor(rawData.length / barCount);
  const peaks: number[] = [];

  for (let i = 0; i < barCount; i++) {
    const start = i * samplesPerBar;
    const end = Math.min(start + samplesPerBar, rawData.length);
    let max = 0;
    for (let j = start; j < end; j++) {
      const abs = Math.abs(rawData[j]);
      if (abs > max) max = abs;
    }
    peaks.push(max);
  }

  // Normalize peaks to 0-1 range
  const maxPeak = Math.max(...peaks, 0.01);
  const normalized = peaks.map((p) => p / maxPeak);

  const result: PeakData = { peaks: normalized, duration: decoded.duration };
  cache.set(key, result);
  return result;
}

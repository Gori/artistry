/**
 * Downsamples audio to 16kHz mono WAV for Whisper transcription.
 * Uses only browser-native APIs (AudioContext + OfflineAudioContext).
 *
 * 16kHz mono is what Whisper uses internally, so there's zero transcription
 * quality loss. A 12-minute recording at this rate is ~23MB (well under 25MB).
 */

const WHISPER_MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const TARGET_SAMPLE_RATE = 16_000;

/**
 * If the file exceeds 24 MB, re-encode as 16 kHz mono WAV.
 * Returns the original file when it's already small enough.
 */
export async function compressForTranscription(file: File): Promise<File> {
  // 1 MB margin so we don't land right at the boundary
  if (file.size <= WHISPER_MAX_BYTES - 1024 * 1024) return file;

  const arrayBuffer = await file.arrayBuffer();
  const ctx = new AudioContext();
  const decoded = await ctx.decodeAudioData(arrayBuffer);
  await ctx.close();

  const offlineCtx = new OfflineAudioContext(
    1, // mono
    Math.ceil(decoded.duration * TARGET_SAMPLE_RATE),
    TARGET_SAMPLE_RATE
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineCtx.destination);
  source.start();

  const rendered = await offlineCtx.startRendering();
  const wav = encodeWav(rendered);

  if (wav.size > WHISPER_MAX_BYTES) {
    throw new Error(
      "Audio is too long for transcription (over ~12 minutes at 16 kHz mono)."
    );
  }

  return new File([wav], "audio.wav", { type: "audio/wav" });
}

// ---------------------------------------------------------------------------
// WAV encoder — 16-bit PCM, no dependencies
// ---------------------------------------------------------------------------

function encodeWav(buffer: AudioBuffer): Blob {
  const samples = buffer.getChannelData(0);
  const numSamples = samples.length;
  const bytesPerSample = 2; // 16-bit
  const dataSize = numSamples * bytesPerSample;
  const headerSize = 44;

  const out = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(out);

  // RIFF header
  writeStr(view, 0, "RIFF");
  view.setUint32(4, headerSize + dataSize - 8, true);
  writeStr(view, 8, "WAVE");

  // fmt sub-chunk
  writeStr(view, 12, "fmt ");
  view.setUint32(16, 16, true); // sub-chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true); // bits per sample

  // data sub-chunk
  writeStr(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = headerSize;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += bytesPerSample;
  }

  return new Blob([out], { type: "audio/wav" });
}

function writeStr(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

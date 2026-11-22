export const TRACK_PREVIEW_MAX_BYTES = 512 * 1024;

export async function loadTrackPreview(path: string, audioCache: string, signal: AbortSignal): Promise<Blob> {
  signal.throwIfAborted();
  const cached = await globalThis.caches?.open(audioCache)
    .then(cache => cache.match(path))
    .catch(() => undefined);
  signal.throwIfAborted();

  const response = cached ?? await fetch(path, {
    headers: { Range: `bytes=0-${TRACK_PREVIEW_MAX_BYTES - 1}` },
    signal,
  });
  if (!response.ok || !response.body) throw new Error('Unable to load preview audio');

  // Some hosts ignore Range. Stop reading at the same limit even for a full response.
  const reader = response.body.getReader();
  const prefix = new Uint8Array(TRACK_PREVIEW_MAX_BYTES);
  let length = 0;
  try {
    while (length < prefix.length) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value.subarray(0, prefix.length - length);
      prefix.set(chunk, length);
      length += chunk.length;
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  signal.throwIfAborted();
  if (!length) throw new Error('Unable to load preview audio');
  return new Blob([prefix.subarray(0, length)], { type: 'audio/mpeg' });
}

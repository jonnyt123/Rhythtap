import {assertEquals, assertRejects, assertStrictEquals} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {loadTrackPreview, TRACK_PREVIEW_MAX_BYTES} from '../src/track-preview.ts';

const trackPath = '/Rhythtap/audio/song.mp3?v=release';
const audioCache = 'rhythtap-audio-v2';

async function withPreviewSources(network: typeof fetch, match: (path: string) => Response | undefined, test: () => Promise<void>) {
  const originalFetch = globalThis.fetch;
  const originalCaches = Object.getOwnPropertyDescriptor(globalThis, 'caches')!;
  globalThis.fetch = network;
  Object.defineProperty(globalThis, 'caches', {
    configurable: true,
    value: { open: async (name: string) => {
      assertEquals(name, audioCache);
      return { match: async (path: string) => match(path) };
    } },
  });
  try {
    await test();
  } finally {
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, 'caches', originalCaches);
  }
}

Deno.test('uncached track previews request only the first 512 KiB', async () => {
  const signal = new AbortController().signal;
  await withPreviewSources(async (path, options) => {
    assertEquals(path, trackPath);
    assertStrictEquals(options?.signal, signal);
    assertEquals(new Headers(options?.headers).get('Range'), 'bytes=0-524287');
    return new Response(new Uint8Array([1, 2, 3]), { status: 206 });
  }, () => undefined, async () => {
    const clip = await loadTrackPreview(trackPath, audioCache, signal);
    assertEquals(clip.type, 'audio/mpeg');
    assertEquals(new Uint8Array(await clip.arrayBuffer()), new Uint8Array([1, 2, 3]));
  });
});

Deno.test('a host that ignores Range is stopped at the preview byte limit', async () => {
  const chunk = new Uint8Array(TRACK_PREVIEW_MAX_BYTES / 2 + 1).fill(3);
  let cancelled = false;
  const body = new ReadableStream({
    pull(controller) { controller.enqueue(chunk); },
    cancel() { cancelled = true; },
  });
  await withPreviewSources(async () => new Response(body), () => undefined, async () => {
    const clip = await loadTrackPreview(trackPath, audioCache, new AbortController().signal);
    assertEquals(clip.size, 524_288);
    assertEquals(cancelled, true);
  });
});

Deno.test('a downloaded track can be previewed from the full-track cache without a fetch', async () => {
  await withPreviewSources(async () => {
    throw new Error('A cached track should play offline');
  }, path => {
    assertEquals(path, trackPath);
    return new Response(new Uint8Array(TRACK_PREVIEW_MAX_BYTES + 1));
  }, async () => {
    const clip = await loadTrackPreview(trackPath, audioCache, new AbortController().signal);
    assertEquals(clip.size, 524_288);
  });
});

Deno.test('stopping a pending preview aborts its audio request', async () => {
  const controller = new AbortController();
  let requestStarted!: () => void;
  const started = new Promise<void>(resolve => { requestStarted = resolve; });
  await withPreviewSources((_path, options) => new Promise((_resolve, reject) => {
    options?.signal?.addEventListener('abort', () => reject(options.signal?.reason), { once: true });
    requestStarted();
  }), () => undefined, async () => {
    const preview = loadTrackPreview(trackPath, audioCache, controller.signal);
    await started;
    controller.abort();
    const error = await assertRejects(() => preview, DOMException);
    assertEquals(error.name, 'AbortError');
  });
});

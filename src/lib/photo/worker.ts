/// <reference lib="webworker" />
import { renderPhoto, type Masks, type Rendered } from './effects';
import type { EditState } from './state';
import { PixiPhotoRenderer } from './pixi-renderer';
import { photoError } from './messages';
export type MaskView = 'none' | 'depth';
export type WorkerRequest =
  | { kind: 'init'; pixels: Uint8ClampedArray; width: number; height: number }
  | { kind: 'masks'; masks: Masks }
  | { kind: 'preview'; id: number; settings: EditState; previous: EditState; mask: MaskView }
  | { kind: 'export'; id: number; pixels: Uint8ClampedArray; width: number; height: number; settings: EditState; mask: MaskView };
export type WorkerResult = { kind: 'preview' | 'export'; id: number; image?: Rendered; previous?: Rendered; error?: string; backend?: string };
let preview: Extract<WorkerRequest, { kind: 'init' }> | undefined;
let masks: Masks = {}, previousKey = '';
let previousCache: Rendered | undefined;
let gpu: PixiPhotoRenderer | null = null, initialized = false;
let queue = Promise.resolve();
self.onmessage = ({ data }: MessageEvent<WorkerRequest>) => {
  // GPU startup is asynchronous. Keep init, mask changes and exports ordered.
  queue = queue.then(() => handle(data));
};
async function handle(data: WorkerRequest) {
  if (data.kind === 'init') { preview = data; masks = {}; previousKey = ''; return; }
  if (data.kind === 'masks') { masks = { ...masks, ...data.masks }; previousKey = ''; return; }
  try {
    const source = data.kind === 'export' ? data : preview;
    if (!source) throw photoError('photoNotSelected');
    if (!initialized) {
      initialized = true;
      try { gpu = await PixiPhotoRenderer.create(); } catch { gpu = null; }
    }
    const render = gpu ? gpu.render.bind(gpu) : renderPhoto;
    const image = render(source.pixels, source.width, source.height, data.settings, masks, data.mask);
    let previous: Rendered | undefined;
    if (data.kind === 'preview') {
      const key = JSON.stringify(data.previous);
      if (key !== previousKey || !previousCache) { previousCache = render(source.pixels, source.width, source.height, data.previous, masks); previousKey = key; }
      previous = { ...previousCache, pixels: previousCache.pixels.slice() };
    }
    const transfer: Transferable[] = [image.pixels.buffer]; if (previous) transfer.push(previous.pixels.buffer);
    self.postMessage({ kind: data.kind, id: data.id, image, previous, backend: gpu?.backend ?? 'CPU' } satisfies WorkerResult, { transfer });
  } catch (cause) { self.postMessage({ kind: data.kind, id: data.id, error: cause instanceof Error ? cause.message : 'photoProcessFailed' } satisfies WorkerResult); }
};

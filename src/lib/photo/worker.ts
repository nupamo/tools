/// <reference lib="webworker" />
import { renderPhoto, type Masks, type Rendered } from './effects';
import type { EditState } from './state';
export type MaskView = 'none' | 'person' | 'skin' | 'depth';
export type WorkerRequest =
  | { kind: 'init'; pixels: Uint8ClampedArray; width: number; height: number }
  | { kind: 'masks'; masks: Masks }
  | { kind: 'preview'; id: number; settings: EditState; previous: EditState; mask: MaskView }
  | { kind: 'export'; id: number; pixels: Uint8ClampedArray; width: number; height: number; settings: EditState };
export type WorkerResult = { kind: 'preview' | 'export'; id: number; image?: Rendered; previous?: Rendered; error?: string };
let preview: Extract<WorkerRequest, { kind: 'init' }> | undefined;
let masks: Masks = {}, previousKey = '';
let previousCache: Rendered | undefined;
self.onmessage = ({ data }: MessageEvent<WorkerRequest>) => {
  if (data.kind === 'init') { preview = data; masks = {}; previousKey = ''; return; }
  if (data.kind === 'masks') { masks = { ...masks, ...data.masks }; previousKey = ''; return; }
  try {
    const source = data.kind === 'export' ? data : preview;
    if (!source) throw new Error('사진을 먼저선택해주세요.');
    const image = renderPhoto(source.pixels, source.width, source.height, data.settings, masks, data.kind === 'preview' ? data.mask : 'none');
    let previous: Rendered | undefined;
    if (data.kind === 'preview') {
      const key = JSON.stringify(data.previous);
      if (key !== previousKey || !previousCache) { previousCache = renderPhoto(source.pixels, source.width, source.height, data.previous, masks); previousKey = key; }
      previous = { ...previousCache, pixels: previousCache.pixels.slice() };
    }
    const transfer: Transferable[] = [image.pixels.buffer]; if (previous) transfer.push(previous.pixels.buffer);
    self.postMessage({ kind: data.kind, id: data.id, image, previous } satisfies WorkerResult, { transfer });
  } catch (cause) { self.postMessage({ kind: data.kind, id: data.id, error: cause instanceof Error ? cause.message : '사진 처리에 실패했습니다.' } satisfies WorkerResult); }
};

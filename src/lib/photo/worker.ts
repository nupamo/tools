/// <reference lib="webworker" />
import { processPhoto, type Adjustments } from './process';

export type WorkerRequest =
  | { kind: 'init'; pixels: Uint8ClampedArray; width: number; height: number }
  | { kind: 'preview'; id: number; settings: Adjustments; mask: boolean }
  | { kind: 'export'; id: number; pixels: Uint8ClampedArray; width: number; height: number; settings: Adjustments };
export type WorkerResult = { kind: 'preview' | 'export'; id: number; pixels?: Uint8ClampedArray; width?: number; height?: number; error?: string };
let preview: Extract<WorkerRequest, {kind: 'init'}> | undefined;
self.onmessage = ({ data }: MessageEvent<WorkerRequest>) => {
  if (data.kind === 'init') { preview = data; return; }
  try {
    const image = data.kind === 'export' ? data : preview;
    if (!image) throw new Error('사진을 먼저 선택해주세요.');
    const pixels = processPhoto(image.pixels, image.width, image.height, data.settings, data.kind === 'preview' && data.mask);
    self.postMessage({ kind: data.kind, id: data.id, pixels, width: image.width, height: image.height } satisfies WorkerResult, { transfer: [pixels.buffer] });
  } catch (error) {
    self.postMessage({ kind: data.kind, id: data.id, error: error instanceof Error ? error.message : '보정 중 오류가 발생했습니다.' } satisfies WorkerResult);
  }
};

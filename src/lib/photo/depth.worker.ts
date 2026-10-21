/// <reference lib="webworker" />
import { pipeline, RawImage, env, type DepthEstimationPipeline } from '@huggingface/transformers';
env.allowLocalModels = false;
// GitHub Pages does not provide cross-origin isolation; inference still uses WebGPU.
if (env.backends.onnx.wasm) env.backends.onnx.wasm.numThreads = 1;
import { photoError } from './messages';
let estimator: DepthEstimationPipeline | undefined;
let queue = Promise.resolve();
async function run(data: { id: number; pixels: Uint8ClampedArray; width: number; height: number }) {
  try {
    if (!navigator.gpu) throw photoError('depthNeedsWebGPU');
    if (!estimator) {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter || adapter.info.isFallbackAdapter) throw photoError('depthNoGpu');
      estimator = await pipeline('depth-estimation', 'onnx-community/depth-anything-v2-small-ONNX', {
        device: 'webgpu', dtype: 'fp32',
        progress_callback: (event) => {
          if (event.status === 'progress') self.postMessage({ kind: 'progress', id: data.id, text: 'depthDownload', progress: event.progress / 100 });
          else self.postMessage({ kind: 'progress', id: data.id, text: 'depthPreparing' });
        },
      });
    }
    self.postMessage({ kind: 'progress', id: data.id, text: 'depthAnalyzing' });
    const result = await estimator(new RawImage(data.pixels, data.width, data.height, 4));
    const raw = result.predicted_depth;
    const width = raw.dims.at(-1)!, height = raw.dims.at(-2)!;
    const values = raw.data as Float32Array;
    let min = Infinity, max = -Infinity;
    for (const v of values) if (Number.isFinite(v)) { min = Math.min(min, v); max = Math.max(max, v); }
    if (!Number.isFinite(min) || max - min < 1e-8) throw photoError('depthIndistinct');
    const depth = new Float32Array(values.length);
    for (let i = 0; i < depth.length; i++) depth[i] = Number.isFinite(values[i]) ? Math.max(0, Math.min(1, (values[i] - min) / (max - min))) : 0;
    self.postMessage({ kind: 'result', id: data.id, depth: { data: depth, width, height } }, { transfer: [depth.buffer] });
    raw.dispose();
  } catch (cause) {
    if (estimator) { await estimator.dispose().catch(() => {}); estimator = undefined; }
    self.postMessage({ kind: 'error', id: data.id, error: cause instanceof Error ? cause.message : 'depthFailed' });
  }
}
self.onmessage = ({ data }) => { queue = queue.then(() => run(data)).catch(() => {}); };

/* Classic worker: MediaPipe's WASM loader uses importScripts. Keep off the UI thread. */
const VERSION = '1.0.1';
const RUNTIME = new URL(`vendor/mediapipe-${VERSION}/`, self.location.href).href;
const MODEL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite';
let segmenter, backend, queue = Promise.resolve();
function report(id, text, progress) { self.postMessage({ kind: 'progress', id, text, progress }); }
async function loadModel(id) {
  let cache;
  try { cache = await caches.open('tools-models-v1'); const hit = await cache.match(MODEL); if (hit) return new Uint8Array(await hit.arrayBuffer()); } catch {}
  const response = await fetch(MODEL);
  if (!response.ok) throw new Error('인물 모델을 다운로드하지 못했습니다.');
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array(await response.arrayBuffer());
  const total = Number(response.headers.get('Content-Length')) || 0, chunks = []; let loaded = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); loaded += value.length; report(id, '인물 모델 다운로드', total ? loaded / total : undefined); }
  const bytes = new Uint8Array(loaded); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  if (cache) { try { await cache.put(MODEL, new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream' } })); } catch {} }
  return bytes;
}
async function initialize(id) {
  if (segmenter) return;
  report(id, 'MediaPipe 준비 중');
  if (!self.Vision) importScripts(`${RUNTIME}vision_bundle.js`);
  const vision = await Vision.FilesetResolver.forVisionTasks(`${RUNTIME}wasm`);
  const modelAssetBuffer = await loadModel(id);
  const create = delegate => Vision.ImageSegmenter.createFromOptions(vision, {
    baseOptions: { modelAssetBuffer, delegate }, canvas: new OffscreenCanvas(1, 1), runningMode: 'IMAGE', outputCategoryMask: false, outputConfidenceMasks: true,
  });
  try { segmenter = await create('GPU'); backend = 'GPU'; }
  catch { report(id, 'CPU로 인물 모델 준비 중'); segmenter = await create('CPU'); backend = 'CPU'; }
}
async function run(data) {
  const image = data.image;
  try {
    await initialize(data.id);
    report(data.id, '인물 영역 분석 중');
    let result;
    try { result = segmenter.segment(image); }
    catch (error) {
      if (backend !== 'GPU') throw error;
      segmenter.close(); segmenter = null;
      const vision = await Vision.FilesetResolver.forVisionTasks(`${RUNTIME}wasm`);
      const modelAssetBuffer = await loadModel(data.id);
      segmenter = await Vision.ImageSegmenter.createFromOptions(vision, { baseOptions: { modelAssetBuffer, delegate: 'CPU' }, canvas: new OffscreenCanvas(1, 1), runningMode: 'IMAGE', outputCategoryMask: false, outputConfidenceMasks: true });
      backend = 'CPU'; result = segmenter.segment(image);
    }
    try {
      const channels = result.confidenceMasks;
      if (!channels || channels.length < 6) throw new Error('인물 마스크를 읽을 수 없습니다.');
      const width = channels[0].width, height = channels[0].height;
      const background = channels[0].getAsFloat32Array();
      const person = new Float32Array(width * height);
      for (let i = 0; i < person.length; i++) { person[i] = Math.max(0, Math.min(1, 1 - background[i])); }
      self.postMessage({ kind: 'result', id: data.id, backend, person: { data: person, width, height } }, [person.buffer]);
    } finally { result.close(); }
  } catch (cause) { self.postMessage({ kind: 'error', id: data.id, error: cause instanceof Error ? cause.message : '인물 분석에 실패했습니다.' }); }
  finally { image?.close(); }
}
self.onmessage = ({ data }) => { queue = queue.then(() => run(data)).catch(() => {}); };

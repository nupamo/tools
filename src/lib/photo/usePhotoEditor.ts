import { useEffect, useRef, useState } from 'react';
import { INITIAL, GROUPS, commitEdit, newHistory, undoEdit, redoEdit, restorePreset, type EditHistory, type EditState, type Tab } from './state';
import { sample, type Masks, type Rendered } from './effects';
import { ModelClient, type ModelProgress } from './model-client';
import type { WorkerRequest, WorkerResult, MaskView } from './worker';
export type ModelState = { status: 'idle' | 'loading' | 'ready' | 'error'; text: string; progress?: number; backend?: string };
type Photo = { name: string; width: number; height: number };
type Preview = Extract<WorkerRequest, {kind: 'preview'}>;
const paint = (canvas: HTMLCanvasElement | null, image: Rendered) => {
  if (!canvas) return;
  canvas.width = image.width; canvas.height = image.height;
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('사진을 표시할 수 없습니다.');
  ctx.putImageData(new ImageData(new Uint8ClampedArray(image.pixels), image.width, image.height), 0, 0);
};
export function usePhotoEditor() {
  const [photo, setPhoto] = useState<Photo | null>(null), [history, setHistory] = useState<EditHistory>(newHistory);
  const historyRef = useRef(history), draftBase = useRef<EditState | null>(null);
  const [tab, setTab] = useState<Tab>('light'), [compare, setCompare] = useState<'current' | 'original' | 'previous'>('current');
  const [maskView, setMaskView] = useState<MaskView>('none'), [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false), [rendering, setRendering] = useState(false), [exporting, setExporting] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [format, setFormat] = useState<'png' | 'jpeg'>('png');
  const [segmentation, setSegmentation] = useState<ModelState>({ status: 'idle', text: '사진을 선택하면 인물 분석' });
  const [depth, setDepth] = useState<ModelState>({ status: 'idle', text: '깊이 모델은 사용할 때만 로드' });
  const [depthSupported, setDepthSupported] = useState(false), [savedPreset, setSavedPreset] = useState<EditState | null>(null);
  const currentCanvas = useRef<HTMLCanvasElement>(null), originalCanvas = useRef<HTMLCanvasElement>(null), previousCanvas = useRef<HTMLCanvasElement>(null);
  const bitmap = useRef<ImageBitmap | null>(null), masks = useRef<Masks>({}), previewPixels = useRef<{pixels: Uint8ClampedArray; width: number; height: number} | null>(null);
  const worker = useRef<Worker | null>(null), seq = useRef(0), wanted = useRef(0), generation = useRef(0), loadTicket = useRef(0);
  const pending = useRef<Preview | null>(null), inFlight = useRef(false), alive = useRef(true);
  const exportResult = useRef<{ resolve: (value: WorkerResult) => void; reject: (error: Error) => void } | null>(null);
  const segmentClient = useRef<ModelClient | null>(null), depthClient = useRef<ModelClient | null>(null);
  const locked = loading || exporting;
  const busyRef = useRef(false); busyRef.current = locked;
  function putHistory(next: EditHistory) { historyRef.current = next; setHistory(next); }
  function finishEdit() {
    if (!draftBase.current) return;
    const base = draftBase.current; draftBase.current = null;
    putHistory(commitEdit(historyRef.current, historyRef.current.present, base));
  }
  function update(patch: Partial<EditState>, continuous = false) {
    if (continuous) {
      if (!draftBase.current) draftBase.current = { ...historyRef.current.present };
      putHistory({ ...historyRef.current, present: { ...historyRef.current.present, ...patch } });
    } else {
      finishEdit(); putHistory(commitEdit(historyRef.current, { ...historyRef.current.present, ...patch }));
    }
    setCompare('current'); setMessage('');
    if (Object.entries(patch).some(([key, value]) => key.endsWith('Enabled') && value === false)) setMaskView('none');
    if (patch.background === 'transparent') setFormat('png');
  }
  function undo() { finishEdit(); putHistory(undoEdit(historyRef.current)); setCompare('current'); }
  function redo() { finishEdit(); putHistory(redoEdit(historyRef.current)); setCompare('current'); }
  function resetGroup() { const patch: Partial<EditState> = { [`${tab}Enabled`]: true }; for (const key of GROUPS[tab]) (patch as Record<string, unknown>)[key] = INITIAL[key]; update(patch); }
  function resetAll() { update({ ...INITIAL }); setMaskView('none'); }
  function pump() {
    if (inFlight.current || !worker.current || !pending.current) return;
    inFlight.current = true; worker.current.postMessage(pending.current); pending.current = null;
  }
  function initializeEngine() {
    if (!previewPixels.current) return;
    worker.current?.terminate(); inFlight.current = false; pending.current = null;
    const next = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    next.onmessage = ({ data }: MessageEvent<WorkerResult>) => {
      if (data.kind === 'export') { if (data.error) exportResult.current?.reject(new Error(data.error)); else exportResult.current?.resolve(data); exportResult.current = null; return; }
      inFlight.current = false;
      if (data.id === wanted.current) {
        try { if (data.error) throw new Error(data.error); if (data.image) paint(currentCanvas.current, data.image); if (data.previous) paint(previousCanvas.current, data.previous); }
        catch (cause) { setError(cause instanceof Error ? cause.message : '미리보기 표시 실패'); }
        setRendering(false);
      }
      pump();
    };
    next.onerror = () => {
      setError('사진 처리에 실패했습니다. 사진을 다시 선택해주세요.'); setRendering(false);
      exportResult.current?.reject(new Error('사진 처리에 실패했습니다.')); exportResult.current = null;
      next.terminate(); worker.current = null; pending.current = null; inFlight.current = false;
    };
    worker.current = next;
    const p = previewPixels.current, pixels = p.pixels.slice();
    next.postMessage({ kind: 'init', pixels, width: p.width, height: p.height } satisfies WorkerRequest, [pixels.buffer]);
    next.postMessage({ kind: 'masks', masks: masks.current } satisfies WorkerRequest);
  }
  function acceptMasks(next: Masks) {
    masks.current = { ...masks.current, ...next };
    worker.current?.postMessage({ kind: 'masks', masks: next } satisfies WorkerRequest);
    setRevision(v => v + 1);
  }
  async function analyzePerson(force = false) {
    if (!bitmap.current || (!force && segmentation.status === 'loading')) return;
    const gen = generation.current;
    setSegmentation({ status: 'loading', text: '인물 모델 준비 중' });
    try {
      segmentClient.current ??= new ModelClient(() => new Worker(`${import.meta.env.BASE_URL}segment-worker.js`));
      const b = bitmap.current, scale = Math.min(1, 1024 / Math.max(b.width, b.height));
      const image = await createImageBitmap(b, { resizeWidth: Math.max(1, Math.round(b.width * scale)), resizeHeight: Math.max(1, Math.round(b.height * scale)) });
      const result = await segmentClient.current.run({ image }, [image], (progress: ModelProgress) => { if (alive.current && gen === generation.current) setSegmentation({ status: 'loading', ...progress }); });
      if (!alive.current || gen !== generation.current) return;
      if (!result.person || !result.skin) throw new Error('인물 마스크가 없습니다.');
      acceptMasks({ person: result.person, skin: result.skin });
      let max = 0; for (const x of result.person.data) max = Math.max(max, x);
      setSegmentation({ status: 'ready', text: max > .5 ? '인물·피부 분석 완료' : '인물이 뚜렷하지 않습니다. 영역을 확인해주세요.', backend: result.backend });
    } catch (cause) { if (alive.current && gen === generation.current) setSegmentation({ status: 'error', text: cause instanceof Error ? cause.message : '인물 분석 실패' }); }
  }
  async function analyzeDepth() {
    if (!bitmap.current || depth.status === 'loading' || !depthSupported) return;
    if (masks.current.depth) { update({ focusMode: 'depth' }); return; }
    const gen = generation.current;
    setDepth({ status: 'loading', text: '깊이 모델 준비 중' });
    try {
      depthClient.current ??= new ModelClient(() => new Worker(new URL('./depth.worker.ts', import.meta.url), { type: 'module' }));
      const p = previewPixels.current!, pixels = p.pixels.slice();
      const result = await depthClient.current.run({ pixels, width: p.width, height: p.height }, [pixels.buffer], (progress: ModelProgress) => { if (alive.current && gen === generation.current) setDepth({ status: 'loading', ...progress }); });
      if (!alive.current || gen !== generation.current) return;
      if (!result.depth) throw new Error('깊이 지도가 없습니다.');
      acceptMasks({ depth: result.depth });
      setDepth({ status: 'ready', text: '깊이 분석 완료', backend: 'WebGPU' });
      update({ focusMode: 'depth', depthFocus: sample(result.depth, historyRef.current.present.focusX, historyRef.current.present.focusY) });
    } catch (cause) { if (alive.current && gen === generation.current) setDepth({ status: 'error', text: cause instanceof Error ? cause.message : '깊이 분석 실패' }); }
  }
  useEffect(() => {
    alive.current = true;
    try { const stored = localStorage.getItem('tools-photo-preset-v1'); if (stored) setSavedPreset(restorePreset(JSON.parse(stored))); } catch {}
    void (async () => { try { const adapter = await navigator.gpu?.requestAdapter(); if (alive.current) setDepthSupported(!!adapter && !adapter.info.isFallbackAdapter); } catch {} })();
    const release = () => { setCompare('current'); finishEdit(); };
    const visibility = () => { if (document.hidden) release(); };
    const keydown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || !photoRef.current || busyRef.current) return;
      const target = event.target as HTMLElement;
      if (target.matches('input:not([type=range]), textarea, select') || target.isContentEditable) return;
      if (event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
      else if (event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
    };
    window.addEventListener('pointerup', finishEdit); window.addEventListener('pointercancel', release); window.addEventListener('blur', release); window.addEventListener('keydown', keydown); document.addEventListener('visibilitychange', visibility);
    return () => { alive.current = false; generation.current++; worker.current?.terminate(); segmentClient.current?.dispose(); depthClient.current?.dispose(); bitmap.current?.close(); window.removeEventListener('pointerup', finishEdit); window.removeEventListener('pointercancel', release); window.removeEventListener('blur', release); window.removeEventListener('keydown', keydown); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  const photoRef = useRef<Photo | null>(null);
  useEffect(() => {
    if (!photo || !worker.current) return;
    const id = ++seq.current; wanted.current = id; setRendering(true);
    const timer = setTimeout(() => { pending.current = { kind: 'preview', id, settings: history.present, previous: draftBase.current ?? history.past.at(-1) ?? INITIAL, mask: maskView }; pump(); }, 55);
    return () => clearTimeout(timer);
  }, [history.present, history.past, photo, revision, maskView]);
  async function loadFile(file: File) {
    if (locked) return;
    setError(''); setMessage('');
    if (!/\.(jpe?g|png|webp|avif)$/i.test(file.name)) { setError('JPG, PNG, WebP, AVIF 사진을 선택해주세요.'); return; }
    if (file.size > 40 * 1024 * 1024) { setError('40MB 이하의 사진을 선택해주세요.'); return; }
    const ticket = ++loadTicket.current; setLoading(true); let next: ImageBitmap | null = null;
    try {
      next = await createImageBitmap(file, { imageOrientation: 'from-image' });
      if (next.width * next.height > 24_000_000 || Math.max(next.width, next.height) > 8192) throw new Error('최대 2,400만 화소, 긴 변 8,192px까지 지원합니다.');
      if (!alive.current || ticket !== loadTicket.current) return;
      const scale = Math.min(1, 1400 / Math.max(next.width, next.height)), width = Math.max(1, Math.round(next.width * scale)), height = Math.max(1, Math.round(next.height * scale));
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true }); if (!ctx) throw new Error('사진을 처리할 수 없습니다.');
      ctx.drawImage(next, 0, 0, width, height); const pixels = ctx.getImageData(0, 0, width, height).data;
      generation.current++; if (segmentClient.current?.busy) segmentClient.current.dispose(); if (depthClient.current?.busy) depthClient.current.dispose(); masks.current = {}; bitmap.current?.close(); bitmap.current = next; next = null;
      previewPixels.current = { pixels, width, height }; initializeEngine();
      const image = { pixels, width, height, offsetX: 0, offsetY: 0 }; paint(originalCanvas.current, image); paint(currentCanvas.current, image); paint(previousCanvas.current, image);
      draftBase.current = null; putHistory(newHistory()); setCompare('current'); setMaskView('none');
      const p = { name: file.name, width: bitmap.current.width, height: bitmap.current.height }; photoRef.current = p; setPhoto(p);
      setSegmentation({ status: 'idle', text: '인물 분석 준비 중' }); setDepth({ status: 'idle', text: '깊이 모델은 사용할 때만 로드' });
      setRevision(v => v + 1);
      // Avoid closure status from a previous image preventing the next request.
      void analyzePerson(true);
    } catch (cause) { if (alive.current && ticket === loadTicket.current) setError(cause instanceof Error && !/decode|source image|InvalidState/i.test(cause.message) ? cause.message : '사진을 열지 못했습니다. 지원 형식과 파일 상태를 확인해주세요.'); }
    finally { next?.close(); if (alive.current && ticket === loadTicket.current) setLoading(false); }
  }
  async function save() {
    finishEdit();
    if (!photo || !bitmap.current || !worker.current || locked || rendering) return;
    const edit = historyRef.current.present; setExporting(true); setError(''); setMessage('');
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const output = document.createElement('canvas'); output.width = photo.width; output.height = photo.height;
      const ctx = output.getContext('2d'); if (!ctx) throw new Error('저장할 메모리가 부족합니다.');
      ctx.drawImage(bitmap.current, 0, 0); const pixels = ctx.getImageData(0, 0, output.width, output.height).data;
      const result = await new Promise<WorkerResult>((resolve, reject) => {
        exportResult.current = { resolve, reject };
        timer = setTimeout(() => { worker.current?.terminate(); worker.current = null; exportResult.current = null; reject(new Error('저장 시간이 초과되었습니다. 더 작은 사진으로 다시 시도해주세요.')); }, 120_000);
        worker.current!.postMessage({ kind: 'export', id: ++seq.current, pixels, width: output.width, height: output.height, settings: edit } satisfies WorkerRequest, [pixels.buffer]);
      });
      if (!result.image) throw new Error('저장할 사진을 만들지 못했습니다.'); paint(output, result.image);
      if (format === 'jpeg') { ctx.globalCompositeOperation = 'destination-over'; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, output.width, output.height); }
      const blob = await new Promise<Blob>((resolve, reject) => output.toBlob(value => value ? resolve(value) : reject(new Error('사진 인코딩 실패')), `image/${format}`, .95));
      const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `${photo.name.replace(/\.[^.]+$/, '')}-edited.${format === 'jpeg' ? 'jpg' : 'png'}`; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000); output.width = output.height = 0; setMessage('저장할 사진을 만들었습니다.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '사진 저장 실패'); }
    finally { clearTimeout(timer); if (alive.current) setExporting(false); }
  }
  function storePreset() { try { const copy = { ...historyRef.current.present }; localStorage.setItem('tools-photo-preset-v1', JSON.stringify(copy)); setSavedPreset(copy); setMessage('내 설정을 저장했습니다.'); } catch { setError('이 브라우저에서 설정을 저장하지 못했습니다.'); } }
  function applySavedPreset() {
    if (!savedPreset) return;
    const next = { ...savedPreset };
    if (!masks.current.person) { next.smoothing = next.skinTone = next.outlineWidth = 0; next.background = 'original'; if (next.focusMode === 'person') next.focusMode = 'off'; }
    if (!masks.current.depth && next.focusMode === 'depth') next.focusMode = 'off';
    update(next); setMessage('내 설정을 적용했습니다. 준비되지 않은 모델 효과는 제외했습니다.');
  }
  function pick(x: number, y: number, continuous: boolean) {
    if (tab === 'flare') update({ flareX: x, flareY: y }, continuous);
    else if (tab === 'focus' && historyRef.current.present.focusMode === 'depth' && masks.current.depth) update({ focusX: x, focusY: y, depthFocus: sample(masks.current.depth, x, y) }, continuous);
    else if (tab === 'focus' && historyRef.current.present.focusMode === 'manual') update({ focusX: x, focusY: y }, continuous);
  }
  return { photo, history, edit: history.present, tab, setTab, compare, setCompare, maskView, setMaskView, locked, loading, rendering, exporting, engineReady: !!worker.current, error, setError, message, format, setFormat, segmentation, depth, depthSupported, savedPreset, currentCanvas, originalCanvas, previousCanvas, update, finishEdit, undo, redo, resetGroup, resetAll, loadFile, analyzePerson, analyzeDepth, save, storePreset, applySavedPreset, pick, hasMasks: !!masks.current.person, hasDepth: !!masks.current.depth };
}
export type PhotoEditorModel = ReturnType<typeof usePhotoEditor>;

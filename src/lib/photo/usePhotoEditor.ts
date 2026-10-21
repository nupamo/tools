import { useEffect, useRef, useState } from 'react';
import { INITIAL, GROUPS, commitEdit, editGroup, newHistory, undoEdit, redoEdit, type EditHistory, type EditState, type Tab } from './state';
import { addPreset, readPresets, replacePreset, writePresets, type SavedPreset } from './presets';
import { sample, type Masks, type Rendered } from './effects';
import { ModelClient, type ModelProgress } from './model-client';
import type { WorkerRequest, WorkerResult, MaskView } from './worker';
import { isPhotoMessage, photoError, type PhotoMessage } from './messages';
export type ModelState = { status: 'idle' | 'loading' | 'ready' | 'error'; text: string; progress?: number; backend?: string };
type Photo = { name: string; width: number; height: number };
type Preview = Extract<WorkerRequest, {kind: 'preview'}>;
const paint = (canvas: HTMLCanvasElement | null, image: Rendered) => {
  if (!canvas) return;
  canvas.width = image.width; canvas.height = image.height;
  const ctx = canvas.getContext('2d'); if (!ctx) throw photoError('canvasUnavailable');
  ctx.putImageData(new ImageData(new Uint8ClampedArray(image.pixels), image.width, image.height), 0, 0);
};
// Status text: code-keyed messages in the page language. Unknown errors (browser or library text) pass through.
export type PhotoStatusText = Record<PhotoMessage, string>;
export function usePhotoEditor(t: PhotoStatusText) {
  const say = (cause: unknown, fallback: PhotoMessage) => cause instanceof Error && cause.message ? (isPhotoMessage(cause.message) ? t[cause.message] : cause.message) : t[fallback];
  const [photo, setPhoto] = useState<Photo | null>(null), [history, setHistory] = useState<EditHistory>(newHistory);
  const historyRef = useRef(history);
  const [tab, setTabState] = useState<Tab>('light'), [compare, setCompare] = useState<'current' | 'original' | 'previous'>('current');
  const [maskView, setMaskView] = useState<MaskView>('none'), [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false), [rendering, setRendering] = useState(false), [exporting, setExporting] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [format, setFormat] = useState<'png' | 'jpeg'>('png');
  const [depth, setDepth] = useState<ModelState>({ status: 'idle', text: t.depthIdle });
  const [renderBackend, setRenderBackend] = useState('');
  const depthPending = useRef<number | null>(null), depthSelect = useRef(false), tabRef = useRef<Tab>('light');
  const [depthSupported, setDepthSupported] = useState(false), [savedPresets, setSavedPresets] = useState<SavedPreset[]>([]);
  const currentCanvas = useRef<HTMLCanvasElement>(null), originalCanvas = useRef<HTMLCanvasElement>(null), previousCanvas = useRef<HTMLCanvasElement>(null);
  const bitmap = useRef<ImageBitmap | null>(null), masks = useRef<Masks>({}), previewPixels = useRef<{pixels: Uint8ClampedArray; width: number; height: number} | null>(null);
  const worker = useRef<Worker | null>(null), seq = useRef(0), wanted = useRef(0), generation = useRef(0), loadTicket = useRef(0);
  const pending = useRef<Preview | null>(null), inFlight = useRef(false), alive = useRef(true);
  const exportResult = useRef<{ resolve: (value: WorkerResult) => void; reject: (error: Error) => void } | null>(null);
  const depthClient = useRef<ModelClient | null>(null);
  const [panel, setPanelState] = useState<'presets' | 'advanced'>('presets');
  const locked = loading || exporting;
  function setPanel(next: 'presets' | 'advanced') { finishEffect(); depthSelect.current = false; setMaskView('none'); setCompare('current'); setPanelState(next); }
  const busyRef = useRef(false); busyRef.current = locked;
  function putHistory(next: EditHistory) { historyRef.current = next; setHistory(next); }
  function finishEffect() { if (historyRef.current.group) putHistory({ ...historyRef.current, group: undefined }); }
  function setTab(next: Tab) {
    if (next !== tabRef.current) { finishEffect(); depthSelect.current = false; }
    tabRef.current = next; setTabState(next);
  }
  function update(patch: Partial<EditState>) {
    putHistory(commitEdit(historyRef.current, { ...historyRef.current.present, ...patch }, undefined, editGroup(patch)));
    if (patch.focusMode && patch.focusMode !== 'depth') depthSelect.current = false;
    setCompare('current'); setMessage('');
    if (patch.focusMode && patch.focusMode !== 'depth') setMaskView('none');
    if (patch.frame === 'round') setFormat('png');
  }
  function undo() { depthSelect.current = false; putHistory(undoEdit(historyRef.current)); setCompare('current'); }
  function redo() { depthSelect.current = false; putHistory(redoEdit(historyRef.current)); setCompare('current'); }
  function resetGroup() { const patch: Partial<EditState> = {}; for (const key of GROUPS[tab]) (patch as Record<string, unknown>)[key] = INITIAL[key]; update(patch); }
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
      if (data.backend) setRenderBackend(data.backend);
      if (data.id === wanted.current) {
        try { if (data.error) throw new Error(data.error); if (data.image) paint(currentCanvas.current, data.image); if (data.previous) paint(previousCanvas.current, data.previous); }
        catch (cause) { setError(say(cause, 'previewFailed')); }
        setRendering(false);
      }
      pump();
    };
    next.onerror = () => {
      setError(t.photoProcessFailedRetry); setRendering(false);
      exportResult.current?.reject(photoError('photoProcessFailed')); exportResult.current = null;
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
  async function analyzeDepth(activateFocus = true) {
    if (!bitmap.current || !depthSupported) return;
    if (activateFocus) depthSelect.current = true;
    if (masks.current.depth) { if (activateFocus) update({ focusMode: 'depth', depthFocus: sample(masks.current.depth, historyRef.current.present.focusX, historyRef.current.present.focusY) }); return; }
    const gen = generation.current;
    if (depthPending.current === gen) return;
    depthPending.current = gen;
    setDepth({ status: 'loading', text: t.depthPreparing });
    try {
      depthClient.current ??= new ModelClient(() => new Worker(new URL('./depth.worker.ts', import.meta.url), { type: 'module' }));
      const p = previewPixels.current!, pixels = p.pixels.slice();
      const result = await depthClient.current.run({ pixels, width: p.width, height: p.height }, [pixels.buffer], (progress: ModelProgress) => { if (alive.current && gen === generation.current) setDepth({ status: 'loading', text: isPhotoMessage(progress.text) ? t[progress.text] : progress.text, progress: progress.progress }); });
      if (!alive.current || gen !== generation.current) return;
      if (!result.depth) throw photoError('depthMissing');
      acceptMasks({ depth: result.depth });
      setDepth({ status: 'ready', text: t.depthReady, backend: 'WebGPU' });
      if (depthSelect.current) update({ focusMode: 'depth', depthFocus: sample(result.depth, historyRef.current.present.focusX, historyRef.current.present.focusY) });
    } catch (cause) { if (alive.current && gen === generation.current) setDepth({ status: 'error', text: say(cause, 'depthFailed') }); }
    finally { if (depthPending.current === gen) depthPending.current = null; }
  }
  useEffect(() => {
    alive.current = true;
    try { setSavedPresets(readPresets(localStorage, t.legacyPresetName)); } catch { setError(t.presetsStorageUnreadable); }
    void (async () => { try { const adapter = await navigator.gpu?.requestAdapter(); if (alive.current) setDepthSupported(!!adapter && !adapter.info.isFallbackAdapter); } catch {} })();
    const release = () => { setCompare('current'); };
    const visibility = () => { if (document.hidden) release(); };
    const keydown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || !photoRef.current || busyRef.current) return;
      const target = event.target as HTMLElement;
      if (target.matches('input:not([type=range]), textarea, select') || target.isContentEditable) return;
      if (event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
      else if (event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
    };
    window.addEventListener('pointercancel', release); window.addEventListener('blur', release); window.addEventListener('keydown', keydown); document.addEventListener('visibilitychange', visibility);
    return () => { alive.current = false; generation.current++; worker.current?.terminate(); depthClient.current?.dispose(); bitmap.current?.close(); window.removeEventListener('pointercancel', release); window.removeEventListener('blur', release); window.removeEventListener('keydown', keydown); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  const photoRef = useRef<Photo | null>(null);
  useEffect(() => {
    if (!photo || !worker.current) return;
    const id = ++seq.current; wanted.current = id; setRendering(true);
    const timer = setTimeout(() => { pending.current = { kind: 'preview', id, settings: history.present, previous: history.past.at(-1) ?? INITIAL, mask: maskView }; pump(); }, 55);
    return () => clearTimeout(timer);
  }, [history.present, history.past, photo, revision, maskView]);
  useEffect(() => {
    if (photo && depthSupported && depth.status === 'idle' && history.present.focusMode === 'depth') void analyzeDepth(false);
  }, [photo, tab, depthSupported, depth.status, history.present.focusMode]);
  async function loadFile(file: File) {
    if (locked) return;
    setError(''); setMessage('');
    if (!/\.(jpe?g|png|webp|avif)$/i.test(file.name)) { setError(t.fileType); return; }
    if (file.size > 40 * 1024 * 1024) { setError(t.fileTooLarge); return; }
    const ticket = ++loadTicket.current; setLoading(true); let next: ImageBitmap | null = null;
    try {
      next = await createImageBitmap(file, { imageOrientation: 'from-image' });
      if (next.width * next.height > 24_000_000 || Math.max(next.width, next.height) > 8192) throw photoError('photoTooLarge');
      if (!alive.current || ticket !== loadTicket.current) return;
      const scale = Math.min(1, 1400 / Math.max(next.width, next.height)), width = Math.max(1, Math.round(next.width * scale)), height = Math.max(1, Math.round(next.height * scale));
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true }); if (!ctx) throw photoError('photoUnprocessable');
      ctx.drawImage(next, 0, 0, width, height); const pixels = ctx.getImageData(0, 0, width, height).data;
      generation.current++; depthPending.current = null; depthSelect.current = false; if (depthClient.current?.busy) depthClient.current.dispose(); masks.current = {}; bitmap.current?.close(); bitmap.current = next; next = null;
      previewPixels.current = { pixels, width, height }; setRenderBackend(''); initializeEngine();
      const image = { pixels, width, height, offsetX: 0, offsetY: 0 }; paint(originalCanvas.current, image); paint(currentCanvas.current, image); paint(previousCanvas.current, image);
      putHistory(newHistory()); setCompare('current'); setMaskView('none');
      const p = { name: file.name, width: bitmap.current.width, height: bitmap.current.height }; photoRef.current = p; setPhoto(p);
      setDepth({ status: 'idle', text: t.depthIdle });
      setRevision(v => v + 1);
    } catch (cause) { if (alive.current && ticket === loadTicket.current) setError(cause instanceof Error && !/decode|source image|InvalidState/i.test(cause.message) ? say(cause, 'photoOpenFailed') : t.photoOpenFailed); }
    finally { next?.close(); if (alive.current && ticket === loadTicket.current) setLoading(false); }
  }
  async function save() {
    if (!photo || !bitmap.current || !worker.current || locked || rendering) return;
    const edit = historyRef.current.present, exportingDepth = maskView === 'depth', outputFormat = exportingDepth ? 'png' : format; setExporting(true); setError(''); setMessage('');
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const output = document.createElement('canvas'); output.width = photo.width; output.height = photo.height;
      const ctx = output.getContext('2d'); if (!ctx) throw photoError('outOfMemory');
      ctx.drawImage(bitmap.current, 0, 0); const pixels = ctx.getImageData(0, 0, output.width, output.height).data;
      const result = await new Promise<WorkerResult>((resolve, reject) => {
        exportResult.current = { resolve, reject };
        timer = setTimeout(() => { worker.current?.terminate(); worker.current = null; exportResult.current = null; reject(photoError('saveTimeout')); }, 120_000);
        worker.current!.postMessage({ kind: 'export', id: ++seq.current, pixels, width: output.width, height: output.height, settings: edit, mask: exportingDepth ? 'depth' : 'none' } satisfies WorkerRequest, [pixels.buffer]);
      });
      if (!result.image) throw photoError('saveBuildFailed'); paint(output, result.image);
      if (outputFormat === 'jpeg') { ctx.globalCompositeOperation = 'destination-over'; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, output.width, output.height); }
      const blob = await new Promise<Blob>((resolve, reject) => output.toBlob(value => value ? resolve(value) : reject(photoError('encodeFailed')), `image/${outputFormat}`, .95));
      const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `${photo.name.replace(/\.[^.]+$/, '')}-${exportingDepth ? 'depth' : 'edited'}.${outputFormat === 'jpeg' ? 'jpg' : 'png'}`; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000); output.width = output.height = 0; setMessage(t.saved);
    } catch (cause) { setError(say(cause, 'saveFailed')); }
    finally { clearTimeout(timer); if (alive.current) setExporting(false); }
  }
  function persistPresets(next: SavedPreset[], success: string) {
    try { writePresets(localStorage, next); setSavedPresets(next); setError(''); setMessage(success); return true; }
    catch { setError(t.presetWriteFailed); return false; }
  }
  function storePreset(name: string) {
    try { const next = addPreset(savedPresets, name, historyRef.current.present); return persistPresets(next, t.presetSaved) ? next.at(-1)!.id : null; }
    catch (cause) { setError(say(cause, 'presetSaveFailed')); return null; }
  }
  function overwritePreset(id: string) { persistPresets(replacePreset(savedPresets, id, historyRef.current.present), t.presetOverwritten); }
  function deletePreset(id: string) { persistPresets(savedPresets.filter(preset => preset.id !== id), t.presetDeleted); }
  function applyPreset(settings: EditState) {
    finishEffect(); setMaskView('none'); update({ ...settings });
    if (settings.focusMode === 'depth' && !masks.current.depth) {
      setMessage(depthSupported ? t.presetAppliedDepthLoading : t.presetAppliedDepthUnsupported);
    }
  }
  function pick(x: number, y: number) {
    if (tab === 'flare') update({ flareX: x, flareY: y });
    else if (tab === 'focus' && historyRef.current.present.focusMode === 'depth' && masks.current.depth) update({ focusX: x, focusY: y, depthFocus: sample(masks.current.depth, x, y) });
    else if (tab === 'focus' && historyRef.current.present.focusMode === 'manual') update({ focusX: x, focusY: y });
  }
  return { photo, history, edit: history.present, tab, setTab, panel, setPanel, compare, setCompare, maskView, setMaskView, locked, loading, rendering, exporting, engineReady: !!worker.current, renderBackend, error, setError, message, format, setFormat, depth, depthSupported, savedPresets, currentCanvas, originalCanvas, previousCanvas, update, finishEffect, undo, redo, resetGroup, resetAll, loadFile, analyzeDepth, save, storePreset, overwritePreset, deletePreset, applyPreset, pick, hasDepth: !!masks.current.depth };
}
export type PhotoEditorModel = ReturnType<typeof usePhotoEditor>;

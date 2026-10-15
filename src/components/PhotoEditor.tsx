import { useEffect, useRef, useState } from 'react';
import { Theme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';
import { Button } from '@astryxdesign/core/Button';
import { Slider } from '@astryxdesign/core/Slider';
import { DEFAULTS, NATURAL, type Adjustments } from '../lib/photo/process';
import type { WorkerRequest, WorkerResult } from '../lib/photo/worker';

type Photo = { name: string; width: number; height: number };
type Preview = Extract<WorkerRequest, { kind: 'preview' }>;
const controls: { key: keyof Adjustments; label: string; min: number; max: number }[] = [
  { key: 'smoothing', label: '피부 부드럽게', min: 0, max: 100 },
  { key: 'skinTone', label: '피부톤 밝기', min: -50, max: 50 },
  { key: 'exposure', label: '전체 밝기', min: -100, max: 100 },
  { key: 'warmth', label: '따뜻함', min: -50, max: 50 },
  { key: 'contrast', label: '대비', min: -50, max: 50 },
  { key: 'saturation', label: '채도', min: -50, max: 50 },
];

export default function PhotoEditor() {
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [settings, setSettings] = useState<Adjustments>({ ...DEFAULTS });
  const [revision, setRevision] = useState(0);
  const [mask, setMask] = useState(false);
  const [compare, setCompare] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [format, setFormat] = useState<'png' | 'jpeg'>('png');
  const fileInput = useRef<HTMLInputElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const originalCanvas = useRef<HTMLCanvasElement>(null);
  const bitmap = useRef<ImageBitmap | null>(null);
  const worker = useRef<Worker | null>(null);
  const sequence = useRef(0);
  const wanted = useRef(0);
  const pending = useRef<Preview | null>(null);
  const inFlight = useRef(false);
  const exportResult = useRef<{ resolve: (value: WorkerResult) => void; reject: (reason: Error) => void } | null>(null);
  const alive = useRef(true);
  const locked = loading || exporting;

  function pump() {
    if (inFlight.current || !pending.current || !worker.current) return;
    inFlight.current = true;
    worker.current.postMessage(pending.current);
    pending.current = null;
  }

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; worker.current?.terminate(); bitmap.current?.close(); };
  }, []);

  useEffect(() => {
    if (!photo || !worker.current) return;
    const id = ++sequence.current;
    wanted.current = id;
    setRendering(true);
    const timer = window.setTimeout(() => {
      pending.current = { kind: 'preview', id, settings: { ...settings }, mask };
      pump();
    }, 90);
    return () => window.clearTimeout(timer);
  }, [settings, mask, revision, photo]);

  function chooseFile() { if (fileInput.current) { fileInput.current.value = ''; fileInput.current.click(); } }

  async function loadFile(file: File) {
    if (locked) return;
    setError(''); setMessage('');
    if (!/\.(jpe?g|png|webp|avif)$/i.test(file.name)) { setError('JPG, PNG, WebP, AVIF 사진을 선택해주세요. HEIC은 JPG로 변환한 뒤 사용할 수 있습니다.'); return; }
    if (file.size > 40 * 1024 * 1024) { setError('40MB 이하의 사진을 선택해주세요.'); return; }
    setLoading(true);
    let next: ImageBitmap | null = null;
    try {
      next = await createImageBitmap(file, { imageOrientation: 'from-image' });
      if (next.width * next.height > 24_000_000 || Math.max(next.width, next.height) > 8192) throw new Error('최대 2,400만 화소, 긴 변 8,192px까지 지원합니다. 사진 크기를 줄여주세요.');
      const scale = Math.min(1, 1400 / Math.max(next.width, next.height));
      const width = Math.max(1, Math.round(next.width * scale));
      const height = Math.max(1, Math.round(next.height * scale));
      const source = document.createElement('canvas'); source.width = width; source.height = height;
      const context = source.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('이 브라우저에서 사진을 처리할 수 없습니다.');
      context.drawImage(next, 0, 0, width, height);
      const pixels = context.getImageData(0, 0, width, height).data;
      const nextWorker = new Worker(new URL('../lib/photo/worker.ts', import.meta.url), { type: 'module' });
      nextWorker.onmessage = ({ data }: MessageEvent<WorkerResult>) => {
        if (data.kind === 'export') {
          if (data.error) exportResult.current?.reject(new Error(data.error));
          else exportResult.current?.resolve(data);
          exportResult.current = null;
          return;
        }
        inFlight.current = false;
        if (data.id === wanted.current) {
          if (data.error) setError(data.error);
          else if (canvas.current && data.pixels && data.width && data.height) {
            canvas.current.width = data.width; canvas.current.height = data.height;
            canvas.current.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(data.pixels), data.width, data.height), 0, 0);
          }
          setRendering(false);
        }
        pump();
      };
      nextWorker.onerror = () => {
        setError('사진 처리에 실패했습니다. 사진을 다시 선택해주세요.');
        setRendering(false); inFlight.current = false; pending.current = null;
        exportResult.current?.reject(new Error('사진 처리에 실패했습니다.'));
        exportResult.current = null;
        worker.current?.terminate(); worker.current = null;
      };
      worker.current?.terminate(); bitmap.current?.close();
      worker.current = nextWorker; bitmap.current = next; next = null;
      inFlight.current = false; pending.current = null;
      const original = originalCanvas.current!;
      original.width = width; original.height = height;
      original.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height), 0, 0);
      if (canvas.current) { canvas.current.width = width; canvas.current.height = height; canvas.current.getContext('2d')?.drawImage(source, 0, 0); }
      const init: WorkerRequest = { kind: 'init', width, height, pixels };
      nextWorker.postMessage(init, [pixels.buffer]);
      setSettings({ ...DEFAULTS }); setMask(false); setCompare(false);
      setPhoto({ name: file.name, width: bitmap.current.width, height: bitmap.current.height });
      setRevision(value => value + 1);
    } catch (cause) {
      setError(cause instanceof Error && !/decode|source image|InvalidState/i.test(cause.message) ? cause.message : '사진을 열 수 없습니다. 파일이 손상되지 않았는지, 브라우저에서 지원하는 형식인지 확인해주세요.');
    } finally { next?.close(); if (alive.current) setLoading(false); }
  }

  async function save() {
    if (!bitmap.current || !photo || !worker.current || locked || rendering) return;
    setExporting(true); setError(''); setMessage('');
    try {
      const output = document.createElement('canvas'); output.width = photo.width; output.height = photo.height;
      const context = output.getContext('2d');
      if (!context) throw new Error('저장할 메모리가 부족합니다. 더 작은 사진으로 다시 시도해주세요.');
      context.drawImage(bitmap.current, 0, 0);
      const pixels = context.getImageData(0, 0, output.width, output.height).data;
      const request: WorkerRequest = { kind: 'export', id: ++sequence.current, pixels, width: output.width, height: output.height, settings: { ...settings } };
      const result = await new Promise<WorkerResult>((resolve, reject) => { exportResult.current = { resolve, reject }; worker.current!.postMessage(request, [pixels.buffer]); });
      if (!result.pixels) throw new Error('저장할 사진을 만들지 못했습니다.');
      context.putImageData(new ImageData(new Uint8ClampedArray(result.pixels), output.width, output.height), 0, 0);
      if (format === 'jpeg') { context.globalCompositeOperation = 'destination-over'; context.fillStyle = '#fff'; context.fillRect(0, 0, output.width, output.height); }
      const blob = await new Promise<Blob>((resolve, reject) => output.toBlob(value => value ? resolve(value) : reject(new Error('파일 저장에 실패했습니다.')), `image/${format}`, .95));
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = `${photo.name.replace(/\.[^.]+$/, '')}-edited.${format === 'jpeg' ? 'jpg' : 'png'}`;
      document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      output.width = output.height = 0;
      setMessage('저장할 사진을 만들었습니다.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '저장하지 못했습니다. 사진 크기를 줄여 다시 시도해주세요.'); }
    finally { if (alive.current) setExporting(false); }
  }

  return <Theme theme={neutralTheme} mode="light">
    <section className="editor" aria-label="인물 사진 보정">
      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/avif,.jpg,.jpeg,.png,.webp,.avif" className="visually-hidden" tabIndex={-1} aria-label="사진 파일" disabled={locked} onChange={event => { const file = event.target.files?.[0]; if (file) void loadFile(file); }} />
      <div className="editor-toolbar">
        <div className="file-info">{photo ? <><span className="file-name" title={photo.name}>{photo.name}</span><span className="dimensions">{photo.width.toLocaleString()} × {photo.height.toLocaleString()}</span></> : <span>인물 사진</span>}</div>
        <div className="toolbar-actions">
          <Button label={photo ? '다른 사진' : '사진 선택'} size="sm" onClick={chooseFile} isDisabled={locked} />
          <Button label={compare ? '보정 보기' : '원본 비교'} size="sm" variant="ghost" aria-pressed={compare} onClick={() => setCompare(value => !value)} isDisabled={!photo || locked} />
        </div>
      </div>
      <div className="editor-body">
        <div className={`photo-stage ${dragging ? 'is-dragging' : ''} ${photo ? 'has-photo' : ''}`} aria-busy={loading || rendering || exporting}
          onDragOver={event => { event.preventDefault(); if (!locked) setDragging(true); }}
          onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
          onDrop={event => { event.preventDefault(); setDragging(false); if (locked) return; if (event.dataTransfer.files.length > 1) { setError('사진은 한 장씩 선택해주세요.'); return; } const file = event.dataTransfer.files[0]; if (file) void loadFile(file); }}>
          <div className="canvas-frame" hidden={!photo}>
            <canvas ref={canvas} aria-label="보정된 사진" style={{ visibility: compare ? 'hidden' : 'visible' }} />
            <canvas ref={originalCanvas} aria-label="원본 사진" style={{ visibility: compare ? 'visible' : 'hidden' }} />
          </div>
          {!photo && <button type="button" className="empty-upload" disabled={locked} onClick={chooseFile}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m3 17 5-5 4 4 3-3 6 6"/></svg>
            <strong>{loading ? '사진 여는 중…' : '사진을 놓거나 선택하세요'}</strong>
            <span>JPG · PNG · WebP · AVIF</span>
            <small>최대 40MB · 2,400만 화소 · 긴 변 8,192px</small>
          </button>}
          {photo && <span className="preview-label">{compare ? '원본' : mask ? '피부색 영역' : '보정'}</span>}
          {(loading || rendering || exporting) && <span className="progress-chip" role="status">{exporting ? '원본 크기로 저장 중…' : loading ? '사진 여는 중…' : '미리보기 반영 중…'}</span>}
        </div>
        <aside className="adjustments" aria-label="보정 조절">
          <div className="adjustment-heading"><h2>보정</h2><Button label="초기화" size="sm" variant="ghost" isDisabled={!photo || locked} onClick={() => { setSettings({ ...DEFAULTS }); setMask(false); setCompare(false); setMessage(''); }} /></div>
          <div className="preset-row"><Button label="자연스럽게" size="sm" isDisabled={!photo || locked} onClick={() => { setSettings({ ...NATURAL }); setCompare(false); setMask(false); }} /><span>가볍게 한 번에</span></div>
          <fieldset disabled={!photo || locked} className="slider-list"><legend className="visually-hidden">보정값</legend>
            {controls.map(control => <div className={`slider-item ${control.key === 'exposure' ? 'colour-start' : ''}`} key={control.key}>
              <Slider label={control.label} value={settings[control.key]} min={control.min} max={control.max} step={1} valueDisplay="text" isDisabled={!photo || locked} onChange={(value: number) => { setSettings(current => ({ ...current, [control.key]: value })); setCompare(false); setMessage(''); }} />
            </div>)}
          </fieldset>
          <div className="mask-row"><label><input type="checkbox" checked={mask} disabled={!photo || locked} onChange={event => { setMask(event.target.checked); setCompare(false); }} />피부 영역 확인</label><span>피부색 기준 · 얼굴 인식 없음</span></div>
          <div className="export-controls">
            <label className="format-row">저장 형식<select value={format} disabled={locked} onChange={event => setFormat(event.target.value as 'png' | 'jpeg')}><option value="png">PNG · 투명도 유지</option><option value="jpeg">JPG · 품질 95%</option></select></label>
            <Button label="사진 저장" variant="primary" width="100%" isLoading={exporting} isDisabled={!photo || loading || rendering || !worker.current} onClick={() => void save()} />
            <span className="export-note">원본 크기 · 촬영 메타데이터 제외</span>
          </div>
        </aside>
      </div>
      <div className={`editor-status ${error ? 'has-error' : ''}`} role={error ? 'alert' : 'status'} aria-live="polite">{error || message || (mask ? '초록색은 피부색으로 판단한 영역입니다. 피부 외의 비슷한 색에도 적용될 수 있습니다. 저장에는 표시되지 않습니다.' : format === 'jpeg' ? 'JPG 저장 시 투명한 부분은 흰색으로 채웁니다.' : '사진은 서버로 전송되지 않습니다.')}</div>
    </section>
  </Theme>;
}

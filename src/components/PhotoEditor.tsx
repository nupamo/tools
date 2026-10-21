import { useRef, useState, type PointerEvent } from 'react';
import { Theme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';
import { Button } from '@astryxdesign/core/Button';
import { usePhotoEditor } from '../lib/photo/usePhotoEditor';
import { frameGeometry } from '../lib/photo/effects';
import PhotoControls from './PhotoControls';
import ToolIcon from './ToolIcon';
import { getMessages, type Locale } from '../i18n';
import { MessagesContext } from '../i18n/react';
export default function PhotoEditor({ locale = 'ko', label }: { locale?: Locale; label: string }) {
  const m = getMessages(locale), t = m.photo;
  const e = usePhotoEditor(t.status), input = useRef<HTMLInputElement>(null), [dragging, setDragging] = useState(false), picking = useRef(false);
  function choose() { if (input.current) { input.current.value = ''; input.current.click(); } }
  const canPick = e.panel === 'advanced' && !e.locked && !!e.photo && e.compare === 'current' && ((e.tab === 'flare' && e.edit.flareStyle !== 'none') || (e.tab === 'focus' && (e.edit.focusMode === 'manual' || e.edit.focusMode === 'depth')));
  function pick(event: PointerEvent<HTMLDivElement>) {
    const canvas = e.currentCanvas.current, original = e.originalCanvas.current;
    if (!canvas || !original) return;
    const rect = canvas.getBoundingClientRect(), scale = Math.min(rect.width / canvas.width, rect.height / canvas.height);
    const left = rect.left + (rect.width - canvas.width * scale) / 2, top = rect.top + (rect.height - canvas.height * scale) / 2;
    const g = frameGeometry(original.width, original.height, e.maskView === 'depth' ? { ...e.edit, frame: 'none' } : e.edit);
    const x = ((event.clientX - left) / scale - g.offsetX) / original.width, y = ((event.clientY - top) / scale - g.offsetY) / original.height;
    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) e.pick(x, y);
  }
  const original = e.originalCanvas.current, geometry = original ? frameGeometry(original.width, original.height, e.maskView === 'depth' ? { ...e.edit, frame: 'none' } : e.edit) : null;
  const px = e.tab === 'flare' ? e.edit.flareX : e.edit.focusX, py = e.tab === 'flare' ? e.edit.flareY : e.edit.focusY;
  const working = e.loading || e.rendering || e.exporting;
  return <MessagesContext value={m}><Theme theme={neutralTheme} mode="system"><section className="editor" aria-label={label}>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif,.jpg,.jpeg,.png,.webp,.avif" className="visually-hidden" tabIndex={-1} aria-label={t.file} disabled={e.locked} onChange={event => { const file = event.target.files?.[0]; if (file) void e.loadFile(file); }} />
    <div className="editor-toolbar"><div className="file-info">{e.photo ? <><span className="file-name" title={e.photo.name}>{e.photo.name}</span><span className="dimensions">{e.photo.width.toLocaleString(locale)} × {e.photo.height.toLocaleString(locale)}{e.renderBackend && <span className="render-backend">{e.renderBackend}</span>}</span></> : <span>{t.start}</span>}</div>
      <div className="toolbar-actions"><Button icon={<ToolIcon name="imagePlus" />} label={e.photo ? t.another : t.choose} size="sm" isDisabled={e.locked} onClick={choose} />
        <Button icon={<ToolIcon name="undo" />} label={t.undo} size="sm" variant="ghost" isDisabled={!e.history.past.length || e.locked} onClick={e.undo} aria-keyshortcuts="Control+Z Meta+Z" /><Button icon={<ToolIcon name="redo" />} label={t.redo} size="sm" variant="ghost" isDisabled={!e.history.future.length || e.locked} onClick={e.redo} aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z" />
        <Button icon={<ToolIcon name="reset" />} label={t.resetAll} size="sm" variant="ghost" isDisabled={!e.photo || e.locked} onClick={e.resetAll} />
      </div>
    </div>
    <div className="editor-body"><div className={`photo-stage ${dragging ? 'is-dragging' : ''} ${canPick ? 'can-pick' : ''}`} aria-busy={working}
      onDragOver={event => { event.preventDefault(); if (!e.locked) setDragging(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
      onDrop={event => { event.preventDefault(); setDragging(false); if (event.dataTransfer.files.length > 1) e.setError(t.oneAtATime); else if (event.dataTransfer.files[0]) void e.loadFile(event.dataTransfer.files[0]); }}>
      <div className="canvas-frame" hidden={!e.photo} tabIndex={canPick ? 0 : undefined} role="group" aria-label={canPick ? t.pickArea : t.preview}
        onKeyDown={event => { if (!canPick || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return; event.preventDefault(); const step = event.shiftKey ? .05 : .01; e.pick(Math.max(0,Math.min(1,px + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0))), Math.max(0,Math.min(1,py + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0)))); }}
        onPointerDown={event => { if (!canPick || event.button !== 0) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); picking.current = true; pick(event); }}
        onPointerMove={event => { if (picking.current && canPick) pick(event); }}
        onPointerUp={() => { picking.current = false; }} onPointerCancel={() => { picking.current = false; }} onLostPointerCapture={() => { picking.current = false; }}>
        <canvas ref={e.currentCanvas} aria-label={t.edited} style={{ visibility: e.compare === 'current' ? 'visible' : 'hidden' }} />
        <canvas ref={e.originalCanvas} aria-label={t.originalPhoto} style={{ visibility: e.compare === 'original' ? 'visible' : 'hidden' }} />
        <canvas ref={e.previousCanvas} aria-label={t.previousEdit} style={{ visibility: e.compare === 'previous' ? 'visible' : 'hidden' }} />
        {canPick && geometry && original && <svg className="focus-overlay" viewBox={`0 0 ${geometry.width} ${geometry.height}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          {e.tab === 'focus' && e.edit.focusMode === 'manual' && <circle cx={geometry.offsetX + px * original.width} cy={geometry.offsetY + py * original.height} r={Math.min(original.width, original.height) * e.edit.focusRadius / 200} className="focus-boundary" />}
          <circle cx={geometry.offsetX + px * original.width} cy={geometry.offsetY + py * original.height} r="8" vectorEffect="non-scaling-stroke" /><path d={`M${geometry.offsetX + px * original.width - 16},${geometry.offsetY + py * original.height}h32 M${geometry.offsetX + px * original.width},${geometry.offsetY + py * original.height - 16}v32`} vectorEffect="non-scaling-stroke" />
        </svg>}
      </div>
      {!e.photo && <button type="button" className="empty-upload" disabled={e.locked} onClick={choose}><ToolIcon name="imagePlus" size="lg" /><strong>{e.loading ? t.opening : t.drop}</strong><span>JPG · PNG · WebP · AVIF</span><small>{t.limits}</small></button>}
      {e.photo && <span className="preview-label">{t.labels[e.compare === 'current' && e.maskView === 'depth' ? 'depth' : e.compare]}</span>}
      {working && <span className="progress-chip" role="status">{e.exporting ? t.exporting : e.loading ? t.opening : t.rendering}</span>}
    </div><PhotoControls editor={e} /></div>
  </section></Theme></MessagesContext>;
}

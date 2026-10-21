import { Button } from '@astryxdesign/core/Button';
import { Slider } from '@astryxdesign/core/Slider';
import { type EditState, type Tab } from '../lib/photo/state';
import type { PhotoEditorModel } from '../lib/photo/usePhotoEditor';
import ToolIcon, { type ToolIconName } from './ToolIcon';
import HoldButton from './HoldButton';
import PhotoPresets from './PhotoPresets';
import { useMessages } from '../i18n/react';
const TABS: { id: Tab; icon: ToolIconName }[] = [
  { id: 'light', icon: 'sun' }, { id: 'color', icon: 'palette' },
  { id: 'focus', icon: 'focus' },
  { id: 'glow', icon: 'sparkles' },
  { id: 'flare', icon: 'sunrise' }, { id: 'frame', icon: 'frame' },
];
const SLIDER_ICONS: Partial<Record<keyof EditState, ToolIconName>> = {
  exposure: 'sun', contrast: 'contrast', highlights: 'sunDim', shadows: 'moon',
  warmth: 'thermometer', tint: 'paintbrush', saturation: 'palette', vibrance: 'sparkles',
  depthFocus: 'layers', blur: 'aperture', focusRadius: 'expand', focusRange: 'layers',
  glow: 'sparkles', glowRadius: 'expand',
  flare: 'sun', flareSize: 'maximize', frameWidth: 'frame',
};
export default function PhotoControls({ editor: e }: { editor: PhotoEditorModel }) {
  const t = useMessages().photo, s = t.sliders;
  const baseDisabled = !e.photo || e.locked, disabled = baseDisabled;
  function slider(key: keyof EditState, label: string, min = 0, max = 100, unavailable = false) {
    return <div key={key} className="icon-slider" data-disabled={disabled || unavailable || undefined}><ToolIcon name={SLIDER_ICONS[key] ?? 'sliders'} size="sm" /><Slider label={label} min={min} max={max} step={1} value={key === 'depthFocus' ? Math.round(e.edit.depthFocus * 100) : e.edit[key] as number} valueDisplay="text" isDisabled={disabled || unavailable}
      onChange={(value: number) => e.update({ [key]: key === 'depthFocus' ? value / 100 : value })} /></div>;
  }
  function color(key: 'frameColor', label: string, unavailable = false) {
    return <label className="color-control"><span className="control-label"><ToolIcon name="palette" size="sm" />{label}</span><input type="color" value={e.edit[key]} disabled={disabled || unavailable} onChange={event => e.update({ [key]: event.target.value })} /></label>;
  }
  return <aside className="adjustments" aria-label={t.adjustments}>
    <div className="panel-tabs" role="tablist" aria-label={t.mode}>{(['presets', 'advanced'] as const).map((panel, i) => <button key={panel} type="button" role="tab" id={`panel-tab-${panel}`} aria-selected={e.panel === panel} aria-controls={`panel-${panel}`} tabIndex={e.panel === panel ? 0 : -1} onClick={() => e.setPanel(panel)} onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); const next = event.key === 'Home' ? 'presets' : event.key === 'End' ? 'advanced' : e.panel === 'presets' ? 'advanced' : 'presets'; e.setPanel(next); document.getElementById(`panel-tab-${next}`)?.focus();
    }}><ToolIcon name={i === 0 ? 'wand' : 'sliders'} size="sm" />{i === 0 ? t.presetsTab : t.advancedTab}</button>)}</div>
    <div id="panel-presets" role="tabpanel" aria-labelledby="panel-tab-presets" hidden={e.panel !== 'presets'}><PhotoPresets editor={e} /></div>
    <div id="panel-advanced" className="advanced-panel" role="tabpanel" aria-labelledby="panel-tab-advanced" hidden={e.panel !== 'advanced'}>
    <div className="effect-tabs" role="tablist" aria-label={t.kind}>{TABS.map(tab => <button key={tab.id} id={`tab-${tab.id}`} type="button" role="tab" aria-selected={e.tab === tab.id} aria-controls="effect-panel" tabIndex={e.tab === tab.id ? 0 : -1} onClick={() => { e.setTab(tab.id); e.setMaskView('none'); }} onKeyDown={event => {
      if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); const i = TABS.findIndex(x => x.id === e.tab), next = event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : (i + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
      e.setTab(TABS[next].id); e.setMaskView('none'); document.getElementById(`tab-${TABS[next].id}`)?.focus();
    }}><ToolIcon name={tab.icon} size="sm" />{t.tabs[tab.id]}</button>)}</div>
    <div className="effect-panel" id="effect-panel" role="tabpanel" aria-labelledby={`tab-${e.tab}`}>
      <div className="adjustment-heading"><h2>{t.tabs[e.tab]}</h2><Button icon={<ToolIcon name="reset" />} label={t.resetGroup} variant="ghost" size="sm" isDisabled={baseDisabled} onClick={e.resetGroup} /></div>
      {e.tab === 'light' && <><div className="controls-grid">{slider('exposure', s.exposure, -100)}{slider('contrast', s.contrast, -50, 50)}{slider('highlights', s.highlights, -100)}{slider('shadows', s.shadows, -100)}</div></>}
      {e.tab === 'color' && <div className="controls-grid">{slider('warmth', s.warmth, -50, 50)}{slider('tint', s.tint, -50, 50)}{slider('saturation', s.saturation, -100)}{slider('vibrance', s.vibrance, -100)}</div>}
      {e.tab === 'focus' && <><div className="choice-grid" aria-label={t.focusMode}>{(['off', 'manual', 'depth'] as const).map((mode, i) => <button key={mode} type="button" aria-pressed={e.edit.focusMode === mode} disabled={disabled || (mode === 'depth' && !e.hasDepth && (!e.depthSupported || e.depth.status === 'loading'))} onClick={() => mode === 'depth' && !e.hasDepth ? void e.analyzeDepth() : e.update({ focusMode: mode })}><ToolIcon name={(['off', 'focus', 'layers'] as const)[i]} size="sm" />{mode === 'depth' && e.depth.status === 'loading' ? t.depthLoading : t.focusModes[mode]}</button>)}</div>
        <div className="controls-grid">{slider('blur', s.blur, 0, 100, e.edit.focusMode === 'off')}{e.edit.focusMode === 'manual' && slider('focusRadius', s.focusRadius, 5, 100)}{e.edit.focusMode === 'depth' && <>{slider('depthFocus', s.depthFocus, 0, 100, !e.hasDepth)}{slider('focusRange', s.focusRange, 0, 80, !e.hasDepth)}</>}</div>
        {(e.edit.focusMode === 'manual' || e.edit.focusMode === 'depth') && <p className="panel-note">{t.focusNote}</p>}
        {!e.depthSupported && <p className="panel-note">{t.depthUnsupported}</p>}
        {e.hasDepth && <label className="check-control"><input type="checkbox" checked={e.maskView === 'depth'} disabled={disabled} onChange={event => e.setMaskView(event.target.checked ? 'depth' : 'none')} />{t.showDepth}</label>}
      </>}
      {e.tab === 'glow' && <><div className="controls-grid">{slider('glow', s.glow)}{slider('glowRadius', s.glowRadius, 0, 100, e.edit.glow === 0)}</div><p className="panel-note">{t.glowNote}</p></>}
      {e.tab === 'flare' && <><div className="choice-grid" aria-label={t.flareShape}>{(['none', 'soft', 'star', 'ghost'] as const).map((style, i) => <button type="button" key={style} disabled={disabled} aria-pressed={e.edit.flareStyle === style} onClick={() => e.update({ flareStyle: style })}><ToolIcon name={(['off', 'sunDim', 'sun', 'circle'] as const)[i]} size="sm" />{t.flares[style]}</button>)}</div><div className="controls-grid">{slider('flare', s.flare, 0, 100, e.edit.flareStyle === 'none')}{slider('flareSize', s.flareSize, 0, 100, e.edit.flareStyle === 'none')}</div>{e.edit.flareStyle !== 'none' && <p className="panel-note">{t.flareNote}</p>}</>}
      {e.tab === 'frame' && <><div className="choice-grid" aria-label={t.frameLabel}>{(['none', 'solid', 'double', 'polaroid', 'round'] as const).map((style, i) => <button type="button" key={style} disabled={disabled} aria-pressed={e.edit.frame === style} onClick={() => e.update({ frame: style })}><ToolIcon name={(['off', 'square', 'layers', 'image', 'rounded'] as const)[i]} size="sm" />{t.frames[style]}</button>)}</div><div className="controls-grid">{slider('frameWidth', e.edit.frame === 'round' ? s.frameRadius : s.frameWidth, 1, 12, e.edit.frame === 'none')}</div>{e.edit.frame !== 'round' && color('frameColor', t.frameColor, e.edit.frame === 'none')}<p className="panel-note">{e.edit.frame === 'round' ? t.roundNote : t.frameNote}</p></>}
    </div>
    </div>
    <div className="panel-bottom">
      {e.panel === 'advanced' && e.tab === 'focus' && e.depth.status !== 'idle' && <div className={`model-state ${e.depth.status === 'error' ? 'has-error' : ''}`} role="status"><span>{e.depth.text}{e.depth.progress !== undefined && ` ${Math.round(e.depth.progress * 100)}%`}</span>{e.depth.status === 'error' && <Button icon={<ToolIcon name="layers" />} label={t.reanalyze} size="sm" isDisabled={baseDisabled} onClick={() => void e.analyzeDepth()} />}</div>}
      {(e.error || e.message) && <div className={`panel-status ${e.error ? 'has-error' : ''}`} role={e.error ? 'alert' : 'status'}>{e.error || e.message}</div>}
      <div className="export-controls">
        <div className="export-settings"><label className="format-row">{t.format}<select value={e.maskView === 'depth' ? 'png' : e.format} disabled={e.locked || e.maskView === 'depth'} onChange={event => e.setFormat(event.target.value as 'png' | 'jpeg')}><option value="png">{t.png}</option><option value="jpeg">{t.jpeg}</option></select></label></div>
        <div className="compare-actions" role="group" aria-label={t.compare}>
          <HoldButton icon={<ToolIcon name="eye" size="sm" />} label={t.viewOriginal} disabled={baseDisabled} active={e.compare === 'original'} onHold={() => e.setCompare('original')} onRelease={() => e.setCompare('current')} />
          <HoldButton icon={<ToolIcon name="history" size="sm" />} label={t.viewPrevious} disabled={!e.history.past.length || e.locked || e.rendering} active={e.compare === 'previous'} onHold={() => e.setCompare('previous')} onRelease={() => e.setCompare('current')} />
        </div>
        <Button icon={<ToolIcon name="download" />} label={e.maskView === 'depth' ? t.saveDepth : t.savePhoto} variant="primary" width="100%" isLoading={e.exporting} isDisabled={baseDisabled || e.rendering || !e.engineReady} onClick={() => void e.save()} />
        <span className="export-note">{e.maskView === 'depth' ? t.notes.depth : e.format === 'jpeg' ? t.notes.jpeg : !['none', 'round'].includes(e.edit.frame) ? t.notes.frame : t.notes.plain}</span>
      </div>
    </div>
  </aside>;
}

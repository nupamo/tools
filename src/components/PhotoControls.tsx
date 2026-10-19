import { Button } from '@astryxdesign/core/Button';
import { Slider } from '@astryxdesign/core/Slider';
import { type EditState, type Tab } from '../lib/photo/state';
import type { PhotoEditorModel } from '../lib/photo/usePhotoEditor';
import ToolIcon, { type ToolIconName } from './ToolIcon';
import HoldButton from './HoldButton';
import PhotoPresets from './PhotoPresets';
const TABS: { id: Tab; label: string; icon: ToolIconName }[] = [
  { id: 'light', label: '밝기', icon: 'sun' }, { id: 'color', label: '색감', icon: 'palette' },
  { id: 'focus', label: '초점', icon: 'focus' },
  { id: 'glow', label: '뽀샤시', icon: 'sparkles' },
  { id: 'flare', label: '플레어', icon: 'sunrise' }, { id: 'frame', label: '테두리', icon: 'frame' },
];
const SLIDER_ICONS: Partial<Record<keyof EditState, ToolIconName>> = {
  exposure: 'sun', contrast: 'contrast', highlights: 'sunDim', shadows: 'moon',
  warmth: 'thermometer', tint: 'paintbrush', saturation: 'palette', vibrance: 'sparkles',
  depthFocus: 'layers', blur: 'aperture', focusRadius: 'expand', focusRange: 'layers',
  glow: 'sparkles', glowRadius: 'expand',
  flare: 'sun', flareSize: 'maximize', frameWidth: 'frame',
};
export default function PhotoControls({ editor: e }: { editor: PhotoEditorModel }) {
  const baseDisabled = !e.photo || e.locked, disabled = baseDisabled;
  function slider(key: keyof EditState, label: string, min = 0, max = 100, unavailable = false) {
    return <div key={key} className="icon-slider" data-disabled={disabled || unavailable || undefined}><ToolIcon name={SLIDER_ICONS[key] ?? 'sliders'} size="sm" /><Slider label={label} min={min} max={max} step={1} value={key === 'depthFocus' ? Math.round(e.edit.depthFocus * 100) : e.edit[key] as number} valueDisplay="text" isDisabled={disabled || unavailable}
      onChange={(value: number) => e.update({ [key]: key === 'depthFocus' ? value / 100 : value })} /></div>;
  }
  function color(key: 'frameColor', label: string, unavailable = false) {
    return <label className="color-control"><span className="control-label"><ToolIcon name="palette" size="sm" />{label}</span><input type="color" value={e.edit[key]} disabled={disabled || unavailable} onChange={event => e.update({ [key]: event.target.value })} /></label>;
  }
  return <aside className="adjustments" aria-label="사진 조절">
    <div className="panel-tabs" role="tablist" aria-label="편집 모드">{(['presets', 'advanced'] as const).map((panel, i) => <button key={panel} type="button" role="tab" id={`panel-tab-${panel}`} aria-selected={e.panel === panel} aria-controls={`panel-${panel}`} tabIndex={e.panel === panel ? 0 : -1} onClick={() => e.setPanel(panel)} onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); const next = event.key === 'Home' ? 'presets' : event.key === 'End' ? 'advanced' : e.panel === 'presets' ? 'advanced' : 'presets'; e.setPanel(next); document.getElementById(`panel-tab-${next}`)?.focus();
    }}><ToolIcon name={i === 0 ? 'wand' : 'sliders'} size="sm" />{i === 0 ? '프리셋' : '고급'}</button>)}</div>
    <div id="panel-presets" role="tabpanel" aria-labelledby="panel-tab-presets" hidden={e.panel !== 'presets'}><PhotoPresets editor={e} /></div>
    <div id="panel-advanced" className="advanced-panel" role="tabpanel" aria-labelledby="panel-tab-advanced" hidden={e.panel !== 'advanced'}>
    <div className="effect-tabs" role="tablist" aria-label="보정 종류">{TABS.map(t => <button key={t.id} id={`tab-${t.id}`} type="button" role="tab" aria-selected={e.tab === t.id} aria-controls="effect-panel" tabIndex={e.tab === t.id ? 0 : -1} onClick={() => { e.setTab(t.id); e.setMaskView('none'); }} onKeyDown={event => {
      if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); const i = TABS.findIndex(x => x.id === e.tab), next = event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : (i + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
      e.setTab(TABS[next].id); e.setMaskView('none'); document.getElementById(`tab-${TABS[next].id}`)?.focus();
    }}><ToolIcon name={t.icon} size="sm" />{t.label}</button>)}</div>
    <div className="effect-panel" id="effect-panel" role="tabpanel" aria-labelledby={`tab-${e.tab}`}>
      <div className="adjustment-heading"><h2>{TABS.find(t => t.id === e.tab)?.label}</h2><Button icon={<ToolIcon name="reset" />} label="이 항목 초기화" variant="ghost" size="sm" isDisabled={baseDisabled} onClick={e.resetGroup} /></div>
      {e.tab === 'light' && <><div className="controls-grid">{slider('exposure', '노출', -100)}{slider('contrast', '대비', -50, 50)}{slider('highlights', '밝은 영역', -100)}{slider('shadows', '어두운 영역', -100)}</div></>}
      {e.tab === 'color' && <div className="controls-grid">{slider('warmth', '색온도', -50, 50)}{slider('tint', '색조', -50, 50)}{slider('saturation', '채도', -100)}{slider('vibrance', '생동감', -100)}</div>}
      {e.tab === 'focus' && <><div className="choice-grid" aria-label="초점 방식">{(['off', 'manual', 'depth'] as const).map((mode, i) => <button key={mode} type="button" aria-pressed={e.edit.focusMode === mode} disabled={disabled || (mode === 'depth' && !e.hasDepth && (!e.depthSupported || e.depth.status === 'loading'))} onClick={() => mode === 'depth' && !e.hasDepth ? void e.analyzeDepth() : e.update({ focusMode: mode })}><ToolIcon name={(['off', 'focus', 'layers'] as const)[i]} size="sm" />{['없음', '직접 지정', e.depth.status === 'loading' ? '깊이 분석 중' : '깊이 초점'][i]}</button>)}</div>
        <div className="controls-grid">{slider('blur', '흐림 강도', 0, 100, e.edit.focusMode === 'off')}{e.edit.focusMode === 'manual' && slider('focusRadius', '선명한 범위', 5, 100)}{e.edit.focusMode === 'depth' && <>{slider('depthFocus', '초점 깊이', 0, 100, !e.hasDepth)}{slider('focusRange', '선명한 깊이 범위', 0, 80, !e.hasDepth)}</>}</div>
        {(e.edit.focusMode === 'manual' || e.edit.focusMode === 'depth') && <p className="panel-note">사진을 누르거나 드래그해 초점을 맞춥니다.</p>}
        {!e.depthSupported && <p className="panel-note">깊이 초점: WebGPU·하드웨어 가속 필요</p>}
        {e.hasDepth && <label className="check-control"><input type="checkbox" checked={e.maskView === 'depth'} disabled={disabled} onChange={event => e.setMaskView(event.target.checked ? 'depth' : 'none')} />깊이 지도 확인</label>}
      </>}
      {e.tab === 'glow' && <><div className="controls-grid">{slider('glow', '뽀샤시 강도')}{slider('glowRadius', '빛 번짐 크기', 0, 100, e.edit.glow === 0)}</div><p className="panel-note">사진 전체에 부드러운 빛을 더합니다.</p></>}
      {e.tab === 'flare' && <><div className="choice-grid" aria-label="플레어 모양">{(['none', 'soft', 'star', 'ghost'] as const).map((style, i) => <button type="button" key={style} disabled={disabled} aria-pressed={e.edit.flareStyle === style} onClick={() => e.update({ flareStyle: style })}><ToolIcon name={(['off', 'sunDim', 'sun', 'circle'] as const)[i]} size="sm" />{['없음', '부드러운 빛', '빛줄기', '렌즈 고스트'][i]}</button>)}</div><div className="controls-grid">{slider('flare', '빛 강도', 0, 100, e.edit.flareStyle === 'none')}{slider('flareSize', '빛 크기', 0, 100, e.edit.flareStyle === 'none')}</div>{e.edit.flareStyle !== 'none' && <p className="panel-note">사진을 누르거나 드래그해 빛의 위치를 잡습니다.</p>}</>}
      {e.tab === 'frame' && <><div className="choice-grid" aria-label="사진 테두리">{(['none', 'solid', 'double', 'polaroid', 'round'] as const).map((style, i) => <button type="button" key={style} disabled={disabled} aria-pressed={e.edit.frame === style} onClick={() => e.update({ frame: style })}><ToolIcon name={(['off', 'square', 'layers', 'image', 'rounded'] as const)[i]} size="sm" />{['없음', '단색 여백', '이중선', '폴라로이드', '둥근 모서리'][i]}</button>)}</div><div className="controls-grid">{slider('frameWidth', e.edit.frame === 'round' ? '모서리 둥글기' : '여백 두께', 1, 12, e.edit.frame === 'none')}</div>{e.edit.frame !== 'round' && color('frameColor', '여백 색', e.edit.frame === 'none')}<p className="panel-note">{e.edit.frame === 'round' ? '사진 크기를 유지하고 모서리만 둥글게 처리합니다.' : '원본을 자르지 않고 바깥에 여백을 더합니다.'}</p></>}
    </div>
    </div>
    <div className="panel-bottom">
      {e.panel === 'advanced' && e.tab === 'focus' && e.depth.status !== 'idle' && <div className={`model-state ${e.depth.status === 'error' ? 'has-error' : ''}`} role="status"><span>{e.depth.text}{e.depth.progress !== undefined && ` ${Math.round(e.depth.progress * 100)}%`}</span>{e.depth.status === 'error' && <Button icon={<ToolIcon name="layers" />} label="다시 분석" size="sm" isDisabled={baseDisabled} onClick={() => void e.analyzeDepth()} />}</div>}
      {(e.error || e.message) && <div className={`panel-status ${e.error ? 'has-error' : ''}`} role={e.error ? 'alert' : 'status'}>{e.error || e.message}</div>}
      <div className="export-controls">
        <div className="export-settings"><label className="format-row">저장 형식<select value={e.maskView === 'depth' ? 'png' : e.format} disabled={e.locked || e.maskView === 'depth'} onChange={event => e.setFormat(event.target.value as 'png' | 'jpeg')}><option value="png">PNG · 투명도 유지</option><option value="jpeg">JPG · 품질 95%</option></select></label></div>
        <div className="compare-actions" role="group" aria-label="누르는 동안 비교">
          <HoldButton icon={<ToolIcon name="eye" size="sm" />} label="원본 보기" disabled={baseDisabled} active={e.compare === 'original'} onHold={() => e.setCompare('original')} onRelease={() => e.setCompare('current')} />
          <HoldButton icon={<ToolIcon name="history" size="sm" />} label="이전 보기" disabled={!e.history.past.length || e.locked || e.rendering} active={e.compare === 'previous'} onHold={() => e.setCompare('previous')} onRelease={() => e.setCompare('current')} />
        </div>
        <Button icon={<ToolIcon name="download" />} label={e.maskView === 'depth' ? '깊이 지도 저장' : '사진 저장'} variant="primary" width="100%" isLoading={e.exporting} isDisabled={baseDisabled || e.rendering || !e.engineReady} onClick={() => void e.save()} />
        <span className="export-note">{e.maskView === 'depth' ? '현재 깊이 지도를 원본 크기 PNG로 저장' : e.format === 'jpeg' ? 'JPG: 투명한 부분은 흰색으로 저장' : !['none', 'round'].includes(e.edit.frame) ? '원본 크기 보정 · 테두리만큼 여백 추가' : '원본 크기로 저장'}</span>
      </div>
    </div>
  </aside>;
}

import { Button } from '@astryxdesign/core/Button';
import { Slider } from '@astryxdesign/core/Slider';
import { PRESETS, type EditState, type Tab } from '../lib/photo/state';
import type { PhotoEditorModel } from '../lib/photo/usePhotoEditor';
const TABS: { id: Tab; label: string }[] = [{ id: 'light', label: '밝기' }, { id: 'color', label: '색감' }, { id: 'skin', label: '피부' }, { id: 'focus', label: '초점' }, { id: 'subject', label: '인물·배경' }, { id: 'glow', label: '뽀샤시' }, { id: 'flare', label: '플레어' }, { id: 'frame', label: '테두리' }];
export default function PhotoControls({ editor: e }: { editor: PhotoEditorModel }) {
  const enabledKey = `${e.tab}Enabled` as keyof EditState, enabled = e.edit[enabledKey] === true;
  const baseDisabled = !e.photo || e.locked, disabled = baseDisabled || !enabled, skinDisabled = disabled || !e.hasMasks;
  function slider(key: keyof EditState, label: string, min = 0, max = 100, unavailable = false) {
    return <Slider key={key} label={label} min={min} max={max} step={1} value={e.edit[key] as number} valueDisplay="text" isDisabled={disabled || unavailable}
      onChange={(value: number) => e.update({ [key]: value }, true)} onChangeEnd={() => e.finishEdit()} />;
  }
  function color(key: 'backgroundColor' | 'outlineColor' | 'frameColor', label: string, unavailable = false) {
    return <label className="color-control">{label}<input type="color" value={e.edit[key]} disabled={disabled || unavailable} onChange={event => e.update({ [key]: event.target.value }, true)} onBlur={e.finishEdit} /></label>;
  }
  return <aside className="adjustments" aria-label="사진 조절">
    <div className="effect-tabs" role="tablist" aria-label="보정 종류">{TABS.map(t => <button key={t.id} id={`tab-${t.id}`} type="button" role="tab" aria-selected={e.tab === t.id} aria-controls="effect-panel" tabIndex={e.tab === t.id ? 0 : -1} onClick={() => { e.finishEdit(); e.setTab(t.id); e.setMaskView('none'); }} onKeyDown={event => {
      if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); const i = TABS.findIndex(x => x.id === e.tab), next = event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : (i + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
      e.finishEdit(); e.setTab(TABS[next].id); e.setMaskView('none'); document.getElementById(`tab-${TABS[next].id}`)?.focus();
    }}>{t.label}</button>)}</div>
    <div className="effect-panel" id="effect-panel" role="tabpanel" aria-labelledby={`tab-${e.tab}`}>
      <div className="adjustment-heading"><h2>{TABS.find(t => t.id === e.tab)?.label}</h2><label className="check-control effect-toggle"><input type="checkbox" checked={enabled} disabled={baseDisabled} onChange={event => e.update({ [enabledKey]: event.target.checked })} />적용</label><Button label="이 항목 초기화" variant="ghost" size="sm" isDisabled={baseDisabled} onClick={e.resetGroup} /></div>
      {e.tab === 'light' && <><div className="controls-grid">{slider('exposure', '노출', -100)}{slider('contrast', '대비', -50, 50)}{slider('highlights', '밝은 영역', -100)}{slider('shadows', '어두운 영역', -100)}</div><div className="preset-grid">{Object.entries(PRESETS).map(([name, preset]) => <Button key={name} label={name} size="sm" isDisabled={disabled} onClick={() => e.update(preset)} />)}</div></>}
      {e.tab === 'color' && <div className="controls-grid">{slider('warmth', '색온도', -50, 50)}{slider('tint', '색조', -50, 50)}{slider('saturation', '채도', -100)}{slider('vibrance', '생동감', -100)}</div>}
      {e.tab === 'skin' && <><div className="controls-grid">{slider('smoothing', '피부 부드럽게', 0, 100, !e.hasMasks)}{slider('skinTone', '피부톤 밝기', -50, 50, !e.hasMasks)}</div><label className="check-control"><input type="checkbox" checked={e.maskView === 'skin'} disabled={skinDisabled} onChange={event => e.setMaskView(event.target.checked ? 'skin' : 'none')} />피부 영역 확인</label><p className="panel-note">얼굴·몸 피부에만 적용합니다.</p></>}
      {e.tab === 'focus' && <><div className="choice-grid" aria-label="초점 방식">{(['off', 'manual', 'person', 'depth'] as const).map((mode, i) => <button key={mode} type="button" aria-pressed={e.edit.focusMode === mode} disabled={disabled || (mode === 'person' && !e.hasMasks) || (mode === 'depth' && !e.hasDepth)} onClick={() => e.update({ focusMode: mode })}>{['없음', '직접 지정', '인물 유지', '깊이 초점'][i]}</button>)}</div>
        <div className="controls-grid">{slider('blur', '흐림 강도', 0, 100, e.edit.focusMode === 'off')}{e.edit.focusMode === 'manual' && slider('focusRadius', '선명한 범위', 5, 100)}{e.edit.focusMode === 'depth' && slider('focusRange', '초점 깊이 범위', 0, 80)}</div>
        {(e.edit.focusMode === 'manual' || e.edit.focusMode === 'depth') && <p className="panel-note">사진을 누르거나 드래그해 초점을 맞춥니다.</p>}
        {!e.hasDepth && <Button label={e.depth.status === 'loading' ? '깊이 분석 중' : '깊이 모델 불러오기'} size="sm" isDisabled={disabled || !e.depthSupported || e.depth.status === 'loading'} onClick={() => void e.analyzeDepth()} />}
        {!e.depthSupported && <p className="panel-note">깊이 초점: WebGPU·하드웨어 가속 필요</p>}
        {e.depth.status !== 'idle' && <div className={`model-message ${e.depth.status === 'error' ? 'has-error' : ''}`} role="status">{e.depth.text}{e.depth.progress !== undefined && ` ${Math.round(e.depth.progress * 100)}%`}</div>}
        {e.hasDepth && <label className="check-control"><input type="checkbox" checked={e.maskView === 'depth'} disabled={disabled} onChange={event => e.setMaskView(event.target.checked ? 'depth' : 'none')} />깊이 지도 확인</label>}
      </>}
      {e.tab === 'subject' && <><div className="choice-grid three" aria-label="배경">{(['original', 'transparent', 'solid'] as const).map((mode, i) => <button key={mode} type="button" aria-pressed={e.edit.background === mode} disabled={skinDisabled} onClick={() => e.update({ background: mode })}>{['배경 유지', '배경 제거', '단색 배경'][i]}</button>)}</div>
        {e.edit.background === 'solid' && color('backgroundColor', '배경색', !e.hasMasks)}
        <div className="controls-grid">{slider('outlineWidth', '인물 테두리 두께', 0, 6, !e.hasMasks)}{slider('maskThreshold', '인물 경계 조절', 10, 90, !e.hasMasks)}{slider('maskFeather', '경계 부드럽게', 1, 40, !e.hasMasks)}</div>
        {color('outlineColor', '인물 테두리 색', !e.hasMasks)}
        <label className="check-control"><input type="checkbox" checked={e.maskView === 'person'} disabled={skinDisabled} onChange={event => e.setMaskView(event.target.checked ? 'person' : 'none')} />인물 영역 확인</label>
      </>}
      {e.tab === 'glow' && <><div className="controls-grid">{slider('glow', '뽀샤시 강도')}{slider('glowRadius', '빛 번짐 크기')}</div><p className="panel-note">사진 전체에 부드러운 빛을 더합니다.</p></>}
      {e.tab === 'flare' && <><div className="choice-grid three" aria-label="플레어 모양">{(['soft', 'star', 'ghost'] as const).map((style, i) => <button type="button" key={style} disabled={disabled} aria-pressed={e.edit.flareStyle === style} onClick={() => e.update({ flareStyle: style })}>{['부드러운 빛', '빛줄기', '렌즈 고스트'][i]}</button>)}</div><div className="controls-grid">{slider('flare', '빛 강도')}{slider('flareSize', '빛 크기')}</div><p className="panel-note">사진에서 빛의 위치를 잡습니다.</p></>}
      {e.tab === 'frame' && <><div className="choice-grid" aria-label="사진 테두리">{(['none', 'solid', 'double', 'polaroid', 'round'] as const).map((style, i) => <button type="button" key={style} disabled={disabled} aria-pressed={e.edit.frame === style} onClick={() => e.update({ frame: style })}>{['없음', '단색 여백', '이중선', '폴라로이드', '둥근 모서리'][i]}</button>)}</div><div className="controls-grid">{slider('frameWidth', '여백 두께', 1, 12, e.edit.frame === 'none')}</div>{color('frameColor', '여백 색', e.edit.frame === 'none')}<p className="panel-note">원본을 자르지 않고 바깥에 여백을 더합니다.</p></>}
    </div>
    <div className="panel-bottom">
      {(e.tab === 'skin' || e.tab === 'subject' || e.tab === 'focus') && <div className="model-state" role="status"><span>{e.segmentation.text}{e.segmentation.backend && ` · ${e.segmentation.backend}`}{e.segmentation.progress !== undefined && ` ${Math.round(e.segmentation.progress * 100)}%`}</span>{e.segmentation.status === 'error' && <Button label="다시 분석" size="sm" onClick={() => void e.analyzePerson()} isDisabled={baseDisabled} />}</div>}
      <div className="preset-actions"><Button label="내 설정 저장" size="sm" variant="ghost" isDisabled={baseDisabled} onClick={e.storePreset} /><Button label="불러오기" size="sm" variant="ghost" isDisabled={baseDisabled || !e.savedPreset} onClick={e.applySavedPreset} /></div>
      <div className="export-controls"><label className="format-row">저장 형식<select value={e.format} disabled={e.locked} onChange={event => e.setFormat(event.target.value as 'png' | 'jpeg')}><option value="png">PNG · 투명도 유지</option><option value="jpeg">JPG · 품질 95%</option></select></label><Button label="사진 저장" variant="primary" width="100%" isLoading={e.exporting} isDisabled={baseDisabled || e.rendering || !e.engineReady} onClick={() => void e.save()} /><span className="export-note">원본 크기 보정 · 테두리만큼 여백 추가</span></div>
    </div>
  </aside>;
}

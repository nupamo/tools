import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { INITIAL, PRESETS } from '../lib/photo/state';
import type { PhotoEditorModel } from '../lib/photo/usePhotoEditor';
import ToolIcon, { type ToolIconName } from './ToolIcon';
const PRESET_ICONS: Record<string, ToolIconName> = { 자연스럽게: 'wand', 따뜻하게: 'sun', 차분하게: 'moon', 흑백: 'contrast' };
export default function PhotoPresets({ editor: e }: { editor: PhotoEditorModel }) {
  const [name, setName] = useState(''), [selected, setSelected] = useState('');
  const disabled = !e.photo || e.locked;
  const current = e.savedPresets.find(preset => preset.id === selected) ?? e.savedPresets[0];
  function save() { const id = e.storePreset(name); if (id) { setSelected(id); setName(''); } }
  return <div className="presets-panel">
    <section className="preset-section" aria-labelledby="preset-defaults">
      <h2 id="preset-defaults">기본 프리셋</h2>
      <div className="preset-grid">{Object.entries(PRESETS).map(([title, preset]) => <Button key={title} icon={<ToolIcon name={PRESET_ICONS[title] ?? 'wand'} />} label={title} size="sm" isDisabled={disabled} onClick={() => e.applyPreset({ ...INITIAL, ...preset })} />)}</div>
    </section>
    <section className="preset-section" aria-labelledby="preset-saved">
      <h2 id="preset-saved">내 프리셋 <span className="preset-count">{e.savedPresets.length}</span></h2>
      <div className="preset-save-row"><input type="text" aria-label="새 프리셋 이름" placeholder="새 프리셋 이름" maxLength={60} value={name} disabled={disabled} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing && name.trim()) { event.preventDefault(); save(); } }} /><Button icon={<ToolIcon name="save" />} label="저장" size="sm" isDisabled={disabled || !name.trim()} onClick={save} /></div>
      {current ? <>
        <select className="saved-preset-select" aria-label="저장한 프리셋 선택" value={current.id} disabled={disabled} onChange={event => setSelected(event.target.value)}>{e.savedPresets.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</select>
        <div className="preset-actions"><Button icon={<ToolIcon name="history" />} label="적용" size="sm" isDisabled={disabled} onClick={() => e.applyPreset(current.settings)} /><Button icon={<ToolIcon name="save" />} label="덮어쓰기" size="sm" variant="ghost" isDisabled={disabled} onClick={() => e.overwritePreset(current.id)} /><Button icon={<ToolIcon name="trash" />} label="삭제" size="sm" variant="ghost" isDisabled={disabled} onClick={() => e.deletePreset(current.id)} /></div>
      </> : <p className="panel-note">저장된 프리셋이 없습니다.</p>}
    </section>
  </div>;
}

import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { INITIAL, PRESETS, type PresetId } from '../lib/photo/state';
import { useMessages } from '../i18n/react';
import type { PhotoEditorModel } from '../lib/photo/usePhotoEditor';
import ToolIcon, { type ToolIconName } from './ToolIcon';
const PRESET_ICONS: Record<PresetId, ToolIconName> = { natural: 'wand', warm: 'sun', calm: 'moon', mono: 'contrast' };
export default function PhotoPresets({ editor: e }: { editor: PhotoEditorModel }) {
  const t = useMessages().photo.presets;
  const [name, setName] = useState(''), [selected, setSelected] = useState('');
  const disabled = !e.photo || e.locked;
  const current = e.savedPresets.find(preset => preset.id === selected) ?? e.savedPresets[0];
  function save() { const id = e.storePreset(name); if (id) { setSelected(id); setName(''); } }
  return <div className="presets-panel">
    <section className="preset-section" aria-labelledby="preset-defaults">
      <h2 id="preset-defaults">{t.defaults}</h2>
      <div className="preset-grid">{(Object.entries(PRESETS) as [PresetId, typeof PRESETS[PresetId]][]).map(([id, preset]) => <Button key={id} icon={<ToolIcon name={PRESET_ICONS[id]} />} label={t.names[id]} size="sm" isDisabled={disabled} onClick={() => e.applyPreset({ ...INITIAL, ...preset })} />)}</div>
    </section>
    <section className="preset-section" aria-labelledby="preset-saved">
      <h2 id="preset-saved">{t.mine} <span className="preset-count">{e.savedPresets.length}</span></h2>
      <div className="preset-save-row"><input type="text" aria-label={t.newName} placeholder={t.newName} maxLength={60} value={name} disabled={disabled} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing && name.trim()) { event.preventDefault(); save(); } }} /><Button icon={<ToolIcon name="save" />} label={t.save} size="sm" isDisabled={disabled || !name.trim()} onClick={save} /></div>
      {current ? <>
        <select className="saved-preset-select" aria-label={t.select} value={current.id} disabled={disabled} onChange={event => setSelected(event.target.value)}>{e.savedPresets.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</select>
        <div className="preset-actions"><Button icon={<ToolIcon name="history" />} label={t.apply} size="sm" isDisabled={disabled} onClick={() => e.applyPreset(current.settings)} /><Button icon={<ToolIcon name="save" />} label={t.overwrite} size="sm" variant="ghost" isDisabled={disabled} onClick={() => e.overwritePreset(current.id)} /><Button icon={<ToolIcon name="trash" />} label={t.delete} size="sm" variant="ghost" isDisabled={disabled} onClick={() => e.deletePreset(current.id)} /></div>
      </> : <p className="panel-note">{t.empty}</p>}
    </section>
  </div>;
}

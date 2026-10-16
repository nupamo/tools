import { useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { PRESETS } from '../lib/photo/state';
import type { PhotoEditorModel } from '../lib/photo/usePhotoEditor';
import ToolIcon, { type ToolIconName } from './ToolIcon';

const PRESET_ICONS: Record<string, ToolIconName> = { 자연스럽게: 'wand', 따뜻하게: 'sun', 차분하게: 'moon', 흑백: 'contrast' };

export default function PhotoPresets({ editor: e }: { editor: PhotoEditorModel }) {
  const [isOpen, setIsOpen] = useState(false);
  const disabled = !e.photo || e.locked;
  return <>
    <Button icon={<ToolIcon name="wand" />} label="프리셋" size="sm" variant="ghost" isDisabled={disabled}
      aria-haspopup="dialog" onClick={() => { e.finishEffect(); e.setCompare('current'); setIsOpen(true); }} />
    <Dialog isOpen={isOpen} onOpenChange={setIsOpen} width={420}>
      <DialogHeader title="프리셋" onOpenChange={setIsOpen} />
      <div className="preset-dialog-content">
        <section className="preset-section" aria-labelledby="preset-defaults">
          <h3 id="preset-defaults">기본 프리셋</h3>
          <div className="preset-grid">{Object.entries(PRESETS).map(([name, preset]) =>
            <Button key={name} icon={<ToolIcon name={PRESET_ICONS[name] ?? 'wand'} />} label={name} size="sm" isDisabled={disabled}
              onClick={() => { e.update({ ...preset, lightEnabled: true, colorEnabled: true }); setIsOpen(false); }} />
          )}</div>
        </section>
        <section className="preset-section" aria-labelledby="preset-saved">
          <h3 id="preset-saved">내 설정</h3>
          <div className="preset-grid">
            <Button icon={<ToolIcon name="save" />} label="현재 설정 저장" size="sm" isDisabled={disabled}
              onClick={() => { e.storePreset(); setIsOpen(false); }} />
            <Button icon={<ToolIcon name="history" />} label="저장한 설정 불러오기" size="sm" isDisabled={disabled || !e.savedPreset}
              onClick={() => { e.applySavedPreset(); setIsOpen(false); }} />
          </div>
          {!e.savedPreset && <p className="panel-note">저장된 설정이 없습니다.</p>}
        </section>
      </div>
    </Dialog>
  </>;
}

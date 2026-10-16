import { restorePreset, type EditState } from './state';
export const PRESET_KEY = 'tools-photo-presets-v2';
export type SavedPreset = { id: string; name: string; settings: EditState };
type PresetStorage = Pick<Storage, 'getItem' | 'setItem'>;
export function readPresets(storage: PresetStorage): SavedPreset[] {
  const stored = storage.getItem(PRESET_KEY);
  if (stored !== null) {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) throw new Error('저장한 프리셋을 읽지 못했습니다.');
    const ids = new Set<string>();
    return parsed.flatMap(entry => {
      if (!entry || typeof entry.id !== 'string' || typeof entry.name !== 'string' || !entry.name.trim() || ids.has(entry.id)) return [];
      const settings = restorePreset(entry.settings); if (!settings) return [];
      ids.add(entry.id); return [{ id: entry.id, name: entry.name.slice(0, 60), settings }];
    });
  }
  const legacy = storage.getItem('tools-photo-preset-v1');
  if (!legacy) return [];
  const settings = restorePreset(JSON.parse(legacy)); if (!settings) return [];
  const migrated = [{ id: 'legacy', name: '이전에 저장한 설정', settings }];
  // Leave v1 intact. A denied write must not discard the user's old preset.
  try { writePresets(storage, migrated); } catch {}
  return migrated;
}
export function writePresets(storage: PresetStorage, presets: SavedPreset[]) {
  storage.setItem(PRESET_KEY, JSON.stringify(presets));
}
export function addPreset(presets: SavedPreset[], name: string, settings: EditState): SavedPreset[] {
  const title = name.trim().slice(0, 60);
  if (!title) throw new Error('프리셋 이름을 입력해주세요.');
  if (presets.some(preset => preset.name === title)) throw new Error('같은 이름이 있습니다. 다른 이름을 쓰거나 기존 프리셋을 덮어쓰세요.');
  return [...presets, { id: crypto.randomUUID(), name: title, settings: { ...settings } }];
}
export function replacePreset(presets: SavedPreset[], id: string, settings: EditState): SavedPreset[] {
  return presets.map(preset => preset.id === id ? { ...preset, settings: { ...settings } } : preset);
}

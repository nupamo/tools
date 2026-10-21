import { restorePreset, type EditState } from './state';
import { photoError } from './messages';
export const PRESET_KEY = 'tools-photo-presets-v2';
export type SavedPreset = { id: string; name: string; settings: EditState };
type PresetStorage = Pick<Storage, 'getItem' | 'setItem'>;
export function readPresets(storage: PresetStorage, legacyName = 'Saved settings'): SavedPreset[] {
  const stored = storage.getItem(PRESET_KEY);
  if (stored !== null) {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) throw photoError('presetsUnreadable');
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
  const migrated = [{ id: 'legacy', name: legacyName, settings }];
  // Leave v1 intact. A denied write must not discard the user's old preset.
  try { writePresets(storage, migrated); } catch {}
  return migrated;
}
export function writePresets(storage: PresetStorage, presets: SavedPreset[]) {
  storage.setItem(PRESET_KEY, JSON.stringify(presets));
}
export function addPreset(presets: SavedPreset[], name: string, settings: EditState): SavedPreset[] {
  const title = name.trim().slice(0, 60);
  if (!title) throw photoError('presetNameRequired');
  if (presets.some(preset => preset.name === title)) throw photoError('presetNameTaken');
  return [...presets, { id: crypto.randomUUID(), name: title, settings: { ...settings } }];
}
export function replacePreset(presets: SavedPreset[], id: string, settings: EditState): SavedPreset[] {
  return presets.map(preset => preset.id === id ? { ...preset, settings: { ...settings } } : preset);
}

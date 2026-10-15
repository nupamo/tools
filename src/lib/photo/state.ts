export interface EditState {
  lightEnabled: boolean; colorEnabled: boolean; skinEnabled: boolean; focusEnabled: boolean;
  subjectEnabled: boolean; glowEnabled: boolean; flareEnabled: boolean; frameEnabled: boolean;
  exposure: number; contrast: number; highlights: number; shadows: number;
  warmth: number; tint: number; saturation: number; vibrance: number;
  smoothing: number; skinTone: number;
  focusMode: 'off' | 'manual' | 'person' | 'depth'; blur: number;
  focusX: number; focusY: number; focusRadius: number; focusRange: number; depthFocus: number;
  background: 'original' | 'transparent' | 'solid'; backgroundColor: string;
  maskThreshold: number; maskFeather: number; outlineWidth: number; outlineColor: string;
  glow: number; glowRadius: number;
  flare: number; flareSize: number; flareX: number; flareY: number; flareStyle: 'soft' | 'star' | 'ghost';
  frame: 'none' | 'solid' | 'double' | 'polaroid' | 'round'; frameWidth: number; frameColor: string;
}
export const INITIAL: EditState = {
  lightEnabled: true, colorEnabled: true, skinEnabled: true, focusEnabled: true, subjectEnabled: true, glowEnabled: true, flareEnabled: true, frameEnabled: true,
  exposure: 0, contrast: 0, highlights: 0, shadows: 0, warmth: 0, tint: 0, saturation: 0, vibrance: 0,
  smoothing: 0, skinTone: 0, focusMode: 'off', blur: 45, focusX: .5, focusY: .5, focusRadius: 35, focusRange: 20, depthFocus: .5,
  background: 'original', backgroundColor: '#eeeeee', maskThreshold: 50, maskFeather: 18, outlineWidth: 0, outlineColor: '#ffffff',
  glow: 0, glowRadius: 35, flare: 0, flareSize: 40, flareX: .8, flareY: .2, flareStyle: 'soft',
  frame: 'none', frameWidth: 4, frameColor: '#ffffff',
};
export const PRESETS: Record<string, Partial<EditState>> = {
  자연스럽게: { exposure: 6, contrast: 3, highlights: -10, shadows: 12, warmth: 2, tint: 0, saturation: 0, vibrance: 12 },
  따뜻하게: { exposure: 4, contrast: -5, highlights: -12, shadows: 8, warmth: 24, tint: 3, saturation: -3, vibrance: 8 },
  차분하게: { exposure: 0, contrast: -10, highlights: -15, shadows: 15, warmth: -12, tint: 3, saturation: -18, vibrance: 0 },
  흑백: { exposure: 0, contrast: 15, highlights: -8, shadows: 5, warmth: 0, tint: 0, saturation: -100, vibrance: 0 },
};
export const GROUPS = {
  light: ['exposure', 'contrast', 'highlights', 'shadows'], color: ['warmth', 'tint', 'saturation', 'vibrance'],
  skin: ['smoothing', 'skinTone'], focus: ['focusMode', 'blur', 'focusX', 'focusY', 'focusRadius', 'focusRange', 'depthFocus'],
  subject: ['background', 'backgroundColor', 'maskThreshold', 'maskFeather', 'outlineWidth', 'outlineColor'],
  glow: ['glow', 'glowRadius'], flare: ['flare', 'flareSize', 'flareX', 'flareY', 'flareStyle'], frame: ['frame', 'frameWidth', 'frameColor'],
} satisfies Record<string, (keyof EditState)[]>;
export type Tab = keyof typeof GROUPS;
export const equalEdits = (a: EditState, b: EditState) => JSON.stringify(a) === JSON.stringify(b);
export interface EditHistory { past: EditState[]; present: EditState; future: EditState[]; }
export const newHistory = (): EditHistory => ({ past: [], present: { ...INITIAL }, future: [] });
export function commitEdit(history: EditHistory, next: EditState, base = history.present): EditHistory {
  if (equalEdits(next, base)) return { ...history, present: next };
  return { past: [...history.past, { ...base }].slice(-50), present: { ...next }, future: [] };
}
export function undoEdit(h: EditHistory): EditHistory {
  if (!h.past.length) return h;
  return { past: h.past.slice(0, -1), present: h.past.at(-1)!, future: [{ ...h.present }, ...h.future] };
}
export function redoEdit(h: EditHistory): EditHistory {
  if (!h.future.length) return h;
  return { past: [...h.past, { ...h.present }].slice(-50), present: h.future[0], future: h.future.slice(1) };
}
export function restorePreset(value: unknown): EditState | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>, result = { ...INITIAL };
  for (const key of Object.keys(INITIAL) as (keyof EditState)[]) {
    const item = v[key];
    if (typeof INITIAL[key] === 'boolean') {
      if (typeof item !== 'boolean') return null;
      (result as unknown as Record<string, unknown>)[key] = item;
    } else if (typeof INITIAL[key] === 'number') {
      if (typeof item !== 'number' || !Number.isFinite(item)) return null;
      const bounds: Partial<Record<keyof EditState, [number, number]>> = {
        exposure: [-100,100], contrast: [-50,50], highlights: [-100,100], shadows: [-100,100], warmth: [-50,50], tint: [-50,50], saturation: [-100,100], vibrance: [-100,100], skinTone: [-50,50],
        focusX: [0,1], focusY: [0,1], flareX: [0,1], flareY: [0,1], depthFocus: [0,1], focusRadius: [5,100], focusRange: [0,80], outlineWidth: [0,6], maskThreshold: [10,90], maskFeather: [1,40], frameWidth: [1,12],
      };
      const [lo,hi] = bounds[key] ?? [0,100];
      (result as unknown as Record<string, unknown>)[key] = Math.max(lo, Math.min(hi, item));
    } else if (key.endsWith('Color')) {
      if (typeof item !== 'string' || !/^#[0-9a-f]{6}$/i.test(item)) return null;
      (result as unknown as Record<string, unknown>)[key] = item;
    } else {
      const enums: Partial<Record<keyof EditState, string[]>> = { focusMode: ['off', 'manual', 'person', 'depth'], background: ['original', 'transparent', 'solid'], frame: ['none', 'solid', 'double', 'polaroid', 'round'], flareStyle: ['soft', 'star', 'ghost'] };
      if (typeof item !== 'string' || !enums[key]?.includes(item)) return null;
      (result as unknown as Record<string, unknown>)[key] = item;
    }
  }
  for (const k of ['focusX', 'focusY', 'depthFocus', 'flareX', 'flareY'] as const) result[k] = Math.max(0, Math.min(1, result[k]));
  return result;
}

export function effectiveState(raw: EditState): EditState {
  const result = { ...raw };
  for (const tab of Object.keys(GROUPS) as Tab[]) {
    if (raw[`${tab}Enabled` as keyof EditState] === false)
      for (const key of GROUPS[tab]) (result as unknown as Record<string, unknown>)[key] = INITIAL[key];
  }
  return result;
}

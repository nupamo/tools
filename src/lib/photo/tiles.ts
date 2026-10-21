import type { EditState } from './state';
import { photoError } from './messages';

export interface PhotoTile { x: number; y: number; width: number; height: number; left: number; top: number; right: number; bottom: number; }

// Each tile includes every neighbour read by the filter chain. Crop the halo
// only after all effects, so export uses the same pixel radii as the preview.
export function filterHalo(w: number, h: number, s: EditState) {
  const min = Math.min(w, h);
  const bloom = s.glow > 0 ? min * (.002 + s.glowRadius / 100 * .025) * 6 : 0;
  const focus = s.focusMode !== 'off' && s.blur > 0 ? min * s.blur / 100 * .035 : 0;
  return Math.ceil(bloom + focus + 8);
}

export function photoTiles(w: number, h: number, halo: number, textureLimit: number, coreLimit = 1536): PhotoTile[] {
  const core = Math.min(coreLimit, textureLimit - 2 * halo);
  if (core < 64) throw photoError('effectTooLarge');
  const tiles: PhotoTile[] = [];
  for (let y = 0; y < h; y += core) for (let x = 0; x < w; x += core) {
    const width = Math.min(core, w - x), height = Math.min(core, h - y);
    tiles.push({ x, y, width, height, left: Math.max(0, x - halo), top: Math.max(0, y - halo), right: Math.min(w, x + width + halo), bottom: Math.min(h, y + height + halo) });
  }
  return tiles;
}

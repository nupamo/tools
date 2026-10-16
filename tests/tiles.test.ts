import assert from 'node:assert/strict';
import { test } from 'node:test';
import { photoTiles, filterHalo } from '../src/lib/photo/tiles';
import { INITIAL } from '../src/lib/photo/state';

test('export tiles cover every original pixel once and stay inside GPU limits', () => {
  const width = 8192, height = 97, halo = 128;
  const tiles = photoTiles(width, height, halo, 2048);
  const counts = new Uint8Array(width * height);
  for (const t of tiles) {
    assert(t.right - t.left <= 2048 && t.bottom - t.top <= 2048);
    assert.equal(t.left, Math.max(0, t.x - halo));
    assert.equal(t.right, Math.min(width, t.x + t.width + halo));
    for (let y = t.y; y < t.y + t.height; y++) for (let x = t.x; x < t.x + t.width; x++) counts[y * width + x]++;
  }
  assert(counts.every(n => n === 1));
});

test('tile overlap includes the combined blur, glow and outline chain at original resolution', () => {
  const edit = { ...INITIAL, focusMode: 'person' as const, blur: 100, glow: 100, glowRadius: 100, outlineWidth: 6 };
  const small = filterHalo(1200, 800, edit), full = filterHalo(6000, 4000, edit);
  assert(full > (small - 8) * 4.9);
  const tiles = photoTiles(6000, 4000, full, 4096);
  for (const t of tiles) assert(t.right - t.left <= 4096 && t.bottom - t.top <= 4096);
  assert.throws(() => photoTiles(6000, 4000, 1020, 2048), /효과 범위/);
});

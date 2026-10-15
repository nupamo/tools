import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULTS, NATURAL, processPhoto, skinWeight } from '../src/lib/photo/process';

test('neutral settings reproduce exact pixels including transparency without mutating input', () => {
  const source = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255, 205, 153, 122, 0, 12, 63, 191, 128]);
  const before = source.slice();
  const result = processPhoto(source, 2, 2, DEFAULTS);
  assert.deepEqual(result, before);
  assert.deepEqual(source, before);
  assert.notEqual(result, source);
});

test('positive exposure doubles midtone channels at +1 EV and preserves alpha', () => {
  const result = processPhoto(new Uint8ClampedArray([40, 50, 60, 125]), 1, 1, { ...DEFAULTS, exposure: 100 });
  assert.deepEqual([...result], [80, 100, 120, 125]);
});

test('skin-tone adjustment affects skin-coloured regions while leaving neutral and cool colours alone', () => {
  for (const colour of [[230, 180, 150], [155, 105, 75], [85, 55, 38]]) assert.ok(skinWeight(...colour as [number, number, number]) > .1);
  for (const colour of [[128, 128, 128], [30, 80, 220], [30, 180, 50]]) assert.equal(skinWeight(...colour as [number, number, number]), 0);
  const source = new Uint8ClampedArray([200, 150, 120, 255, 50, 100, 200, 255]);
  const result = processPhoto(source, 2, 1, { ...DEFAULTS, skinTone: 40 });
  assert.ok(result[0] > source[0]);
  assert.deepEqual(result.slice(4), source.slice(4));
});

test('skin smoothing reduces high-frequency variation and preserves input/alpha', () => {
  const source = new Uint8ClampedArray(16 * 16 * 4);
  for (let p = 0; p < source.length; p += 4) { const offset = ((p / 4) % 2) * 10; source.set([200 + offset, 150 + offset, 120 + offset, 175], p); }
  const before = source.slice();
  const result = processPhoto(source, 16, 16, { ...DEFAULTS, smoothing: 100 });
  const variation = (data: Uint8ClampedArray) => { let sum = 0; for (let x = 2; x < 14; x++) sum += Math.abs(data[(8 * 16 + x) * 4] - data[(8 * 16 + x - 1) * 4]); return sum; };
  assert.ok(variation(result) < variation(source));
  assert.deepEqual(source, before);
  for (let p = 3; p < result.length; p += 4) assert.equal(result[p], 175);
});

test('one-pixel and thin images, extreme settings and mask preview produce finite byte pixels', () => {
  for (const [width, height] of [[1, 1], [1, 7], [7, 1]]) {
    const source = new Uint8ClampedArray(width * height * 4).fill(180);
    for (const settings of [NATURAL, { ...DEFAULTS, smoothing: 100, exposure: 100, contrast: 100, saturation: 100, warmth: -100 }]) {
      for (const mask of [true, false]) {
        const result = processPhoto(source, width, height, settings, mask);
        assert.equal(result.length, source.length);
        assert.ok([...result].every(Number.isFinite));
        for (let p = 3; p < result.length; p += 4) assert.equal(result[p], source[p]);
      }
    }
  }
});

test('mask preview is distinct and never modifies the source used by export', () => {
  const source = new Uint8ClampedArray([200, 150, 120, 255]);
  const preview = processPhoto(source, 1, 1, NATURAL, true);
  const saved = processPhoto(source, 1, 1, NATURAL, false);
  assert.notDeepEqual(preview, saved);
  assert.deepEqual(source, new Uint8ClampedArray([200, 150, 120, 255]));
});

test('reject inconsistent dimensions rather than returning a corrupt image', () => {
  assert.throws(() => processPhoto(new Uint8ClampedArray(4), 2, 2, DEFAULTS), /dimensions/);
});

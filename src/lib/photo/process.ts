export interface Adjustments {
  smoothing: number;
  skinTone: number;
  exposure: number;
  warmth: number;
  contrast: number;
  saturation: number;
}
export const DEFAULTS: Adjustments = { smoothing: 0, skinTone: 0, exposure: 0, warmth: 0, contrast: 0, saturation: 0 };
export const NATURAL: Adjustments = { smoothing: 28, skinTone: 10, exposure: 8, warmth: 2, contrast: 0, saturation: 3 };

const clamp = (v: number, min = 0, max = 255) => Math.min(max, Math.max(min, v));
const ramp = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** Soft colour mask, deliberately not advertised as face detection/segmentation.
 * All skin colours can occur outside skin (wood/walls etc.). Expose a mask preview.
 */
export function skinWeight(r: number, g: number, b: number): number {
  const y = .299 * r + .587 * g + .114 * b;
  const cb = 128 - .168736 * r - .331264 * g + .5 * b;
  const cr = 128 + .5 * r - .418688 * g - .081312 * b;
  return ramp(130, 143, cr) * (1 - ramp(173, 190, cr))
    * ramp(68, 86, cb) * (1 - ramp(121, 139, cb))
    * ramp(12, 38, y) * (1 - ramp(242, 255, y));
}

// Four directional, edge-aware recursive passes. O(pixels), constant work per
// pixel even at original resolution. Original luminance guides every pass.
function soften(source: Uint8ClampedArray, width: number, height: number) {
  const result = source.slice();
  const radius = Math.max(1.3, Math.min(width, height) / 360);
  const spatial = Math.exp(-Math.SQRT2 / radius);
  const range = Float32Array.from({ length: 256 }, (_, i) => Math.exp(-i / 12));
  const luma = (p: number) => (source[p] * 77 + source[p + 1] * 150 + source[p + 2] * 29) >> 8;
  const blend = (p: number, q: number) => {
    if (source[p + 3] === 0 || source[q + 3] === 0) return;
    const a = spatial * range[Math.abs(luma(p) - luma(q))];
    for (let c = 0; c < 3; c++) result[p + c] += a * (result[q + c] - result[p + c]);
  };
  for (let y = 0; y < height; y++) {
    for (let x = 1; x < width; x++) { const p = (y * width + x) * 4; blend(p, p - 4); }
    for (let x = width - 2; x >= 0; x--) { const p = (y * width + x) * 4; blend(p, p + 4); }
  }
  for (let x = 0; x < width; x++) {
    for (let y = 1; y < height; y++) { const p = (y * width + x) * 4; blend(p, p - width * 4); }
    for (let y = height - 2; y >= 0; y--) { const p = (y * width + x) * 4; blend(p, p + width * 4); }
  }
  return result;
}

export function processPhoto(source: Uint8ClampedArray, width: number, height: number, raw: Adjustments, mask = false): Uint8ClampedArray {
  if (source.length !== width * height * 4 || width < 1 || height < 1) throw new Error('Invalid image dimensions');
  const s = Object.fromEntries(Object.entries(DEFAULTS).map(([key]) => [key, clamp(Number(raw[key as keyof Adjustments]) || 0, key === 'smoothing' ? 0 : -100, 100)])) as unknown as Adjustments;
  const blurred = s.smoothing > 0 && !mask ? soften(source, width, height) : source;
  const result = new Uint8ClampedArray(source.length);
  const exposure = 2 ** (s.exposure / 100);
  const contrast = 1 + s.contrast / 150;
  const saturation = 1 + s.saturation / 100;
  for (let p = 0; p < source.length; p += 4) {
    const skin = skinWeight(source[p], source[p + 1], source[p + 2]);
    const a = skin * s.smoothing / 100 * .85;
    let r = source[p] + (blurred[p] - source[p]) * a;
    let g = source[p + 1] + (blurred[p + 1] - source[p + 1]) * a;
    let b = source[p + 2] + (blurred[p + 2] - source[p + 2]) * a;
    const lift = skin * s.skinTone * .24;
    r = (r + lift + s.warmth * .32) * exposure;
    g = (g + lift) * exposure;
    b = (b + lift - s.warmth * .32) * exposure;
    r = (r - 128) * contrast + 128; g = (g - 128) * contrast + 128; b = (b - 128) * contrast + 128;
    const luma = .2126 * r + .7152 * g + .0722 * b;
    r = luma + (r - luma) * saturation; g = luma + (g - luma) * saturation; b = luma + (b - luma) * saturation;
    if (mask) { const overlay = skin * .65; r = r * (1 - overlay) + 52 * overlay; g = g * (1 - overlay) + 188 * overlay; b = b * (1 - overlay) + 128 * overlay; }
    result[p] = r; result[p + 1] = g; result[p + 2] = b; result[p + 3] = source[p + 3];
  }
  return result;
}

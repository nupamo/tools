import { effectiveState, type EditState } from './state';
export interface Plane { data: Float32Array; width: number; height: number; }
export interface Masks { person?: Plane; depth?: Plane; }
export interface Rendered { pixels: Uint8ClampedArray; width: number; height: number; offsetX: number; offsetY: number; }
export const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export function smooth(a: number, b: number, x: number) { const t = clamp((x - a) / Math.max(.00001, b - a)); return t * t * (3 - 2 * t); }
export function sample(map: Plane, x: number, y: number): number {
  const px = clamp(x) * (map.width - 1), py = clamp(y) * (map.height - 1);
  const x0 = Math.floor(px), y0 = Math.floor(py), x1 = Math.min(x0 + 1, map.width - 1), y1 = Math.min(y0 + 1, map.height - 1);
  const tx = px - x0, ty = py - y0;
  return map.data[y0 * map.width + x0] * (1 - tx) * (1 - ty) + map.data[y0 * map.width + x1] * tx * (1 - ty)
    + map.data[y1 * map.width + x0] * (1 - tx) * ty + map.data[y1 * map.width + x1] * tx * ty;
}
const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) || 0);
function mapBytes(plane: Plane, w: number, h: number, threshold = .5, feather = .18) {
  const result = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) result[y * w + x] = Math.round(255 * smooth(threshold - feather, threshold + feather, sample(plane, (x + .5) / w, (y + .5) / h)));
  return result;
}

/** Sliding box filter, O(n) independent of radius. Premultiplied inputs prevent transparent-edge darkening. */
export function boxBlur(input: Uint8ClampedArray, w: number, h: number, radius: number): Uint8ClampedArray {
  const r = Math.max(1, Math.round(radius)), count = r * 2 + 1;
  const temp = new Uint8ClampedArray(input.length), out = new Uint8ClampedArray(input.length);
  for (let y = 0; y < h; y++) for (let c = 0; c < 4; c++) {
    let sum = 0;
    for (let i = -r; i <= r; i++) sum += input[(y * w + clamp(i, 0, w - 1)) * 4 + c];
    for (let x = 0; x < w; x++) {
      temp[(y * w + x) * 4 + c] = sum / count;
      sum += input[(y * w + Math.min(w - 1, x + r + 1)) * 4 + c] - input[(y * w + Math.max(0, x - r)) * 4 + c];
    }
  }
  for (let x = 0; x < w; x++) for (let c = 0; c < 4; c++) {
    let sum = 0;
    for (let i = -r; i <= r; i++) sum += temp[(clamp(i, 0, h - 1) * w + x) * 4 + c];
    for (let y = 0; y < h; y++) {
      out[(y * w + x) * 4 + c] = sum / count;
      sum += temp[(Math.min(h - 1, y + r + 1) * w + x) * 4 + c] - temp[(Math.max(0, y - r) * w + x) * 4 + c];
    }
  }
  return out;
}
function weightedBlur(source: Uint8ClampedArray, w: number, h: number, radius: number, weights?: Uint8Array) {
  let premultiplied: Uint8ClampedArray = new Uint8ClampedArray(source.length);
  for (let p = 0, i = 0; p < source.length; p += 4, i++) {
    const a = source[p + 3] / 255 * (weights ? weights[i] / 255 : 1);
    for (let c = 0; c < 3; c++) premultiplied[p + c] = source[p + c] * a;
    premultiplied[p + 3] = a * 255;
  }
  premultiplied = boxBlur(premultiplied, w, h, radius * .6);
  const result = boxBlur(premultiplied, w, h, radius * .6);
  for (let p = 0; p < source.length; p += 4) {
    const a = result[p + 3] / 255;
    for (let c = 0; c < 3; c++) result[p + c] = a > .008 ? result[p + c] / a : source[p + c];
    result[p + 3] = source[p + 3];
  }
  return result;
}

/** Chamfer distance to foreground in 1/3 px units. Bounded memory, rounded outside strokes. */
export function distanceToSubject(mask: Uint8Array, w: number, h: number) {
  const d = new Uint16Array(w * h); for (let i = 0; i < d.length; i++) d[i] = mask[i] >= 128 ? 0 : 60000;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (x) d[i] = Math.min(d[i], d[i - 1] + 3);
    if (y) { d[i] = Math.min(d[i], d[i - w] + 3); if (x) d[i] = Math.min(d[i], d[i - w - 1] + 4); if (x < w - 1) d[i] = Math.min(d[i], d[i - w + 1] + 4); }
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x;
    if (x < w - 1) d[i] = Math.min(d[i], d[i + 1] + 3);
    if (y < h - 1) { d[i] = Math.min(d[i], d[i + w] + 3); if (x) d[i] = Math.min(d[i], d[i + w - 1] + 4); if (x < w - 1) d[i] = Math.min(d[i], d[i + w + 1] + 4); }
  }
  return d;
}

export function renderPhoto(source: Uint8ClampedArray, w: number, h: number, raw: EditState, masks: Masks = {}, showMask: 'none' | 'person' | 'depth' = 'none'): Rendered {
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 || source.length !== w * h * 4) throw new Error('사진 크기가 올바르지 않습니다.');
  const s = effectiveState(raw);
  const min = Math.min(w, h), pixels = new Uint8ClampedArray(source.length);
  const needsPerson = s.focusMode === 'person' || s.background !== 'original' || s.outlineWidth > 0 || showMask === 'person';
  const person = masks.person && needsPerson ? mapBytes(masks.person, w, h, s.maskThreshold / 100, Math.max(.005, s.maskFeather / 100)) : undefined;
  const exposure = 2 ** (s.exposure / 100), contrast = 1 + s.contrast / 150, saturation = 1 + s.saturation / 100;
  for (let p = 0, i = 0; p < pixels.length; p += 4, i++) {
    const l = (.2126 * source[p] + .7152 * source[p + 1] + .0722 * source[p + 2]) / 255;
    const tonal = s.shadows * .7 * (1 - smooth(.05, .65, l)) + s.highlights * .7 * smooth(.35, .95, l);
    let r = (source[p] + tonal + s.warmth * .35 + s.tint * .15) * exposure;
    let g = (source[p + 1] + tonal - s.tint * .2) * exposure;
    let b = (source[p + 2] + tonal - s.warmth * .35 + s.tint * .15) * exposure;
    r = (r - 128) * contrast + 128; g = (g - 128) * contrast + 128; b = (b - 128) * contrast + 128;
    const lum = .2126 * r + .7152 * g + .0722 * b;
    const chroma = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    const sat = saturation * (1 + s.vibrance / 100 * (1 - clamp(chroma)));
    pixels[p] = lum + (r - lum) * sat; pixels[p + 1] = lum + (g - lum) * sat; pixels[p + 2] = lum + (b - lum) * sat; pixels[p + 3] = source[p + 3];
  }
  if (s.glow > 0) {
    const soft = weightedBlur(pixels, w, h, Math.max(1, min * (.002 + s.glowRadius / 100 * .025)));
    for (let p = 0; p < pixels.length; p += 4) for (let c = 0; c < 3; c++) {
      const a = pixels[p + c] / 255, b = soft[p + c] / 255;
      const screened = (1 - (1 - a) * (1 - b)) * 255;
      pixels[p + c] += (screened - pixels[p + c]) * s.glow / 100 * .65;
    }
  }
  if (s.focusMode !== 'off' && s.blur > 0) {
    const amounts = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (s.focusMode === 'person') amounts[i] = person ? 255 - person[i] : 0;
      else if (s.focusMode === 'depth') amounts[i] = masks.depth ? smooth(s.focusRange / 200, s.focusRange / 200 + .22, Math.abs(sample(masks.depth, (x + .5) / w, (y + .5) / h) - s.depthFocus)) * 255 : 0;
      else { const dx = (x / w - s.focusX) * w / min, dy = (y / h - s.focusY) * h / min; const radius = s.focusRadius / 200; amounts[i] = smooth(radius, radius + .2, Math.hypot(dx, dy)) * 255; }
    }
    // Focused pixels do not contribute colour to defocused regions. This avoids
    // the common bright foreground halo in a plain whole-image blur.
    const blurred = weightedBlur(pixels, w, h, Math.max(1, min * s.blur / 100 * .035), amounts);
    for (let p = 0, i = 0; p < pixels.length; p += 4, i++) for (let c = 0; c < 3; c++) pixels[p + c] += (blurred[p + c] - pixels[p + c]) * amounts[i] / 255;
  }
  if (s.flare > 0) {
    const radius = min * (.03 + s.flareSize / 100 * .45), cx = s.flareX * w, cy = s.flareY * h;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy) / radius;
      let strength = Math.exp(-d * d * 4) * .75 + Math.exp(-d * 3) * .25;
      if (s.flareStyle === 'star') strength += Math.exp(-Math.abs(dy) / Math.max(1, radius * .018)) * Math.exp(-Math.abs(dx) / (radius * 2)) * .65 + Math.exp(-Math.abs(dx) / Math.max(1, radius * .018)) * Math.exp(-Math.abs(dy) / (radius * 1.5)) * .4;
      let ghost = 0;
      if (s.flareStyle === 'ghost') for (let k = 1; k <= 3; k++) { const gx = cx + (w / 2 - cx) * k * .65, gy = cy + (h / 2 - cy) * k * .65; const gd = Math.hypot(x - gx, y - gy) / (radius * (.15 + k * .08)); ghost += Math.exp(-((gd - .8) ** 2) * 80) * .14; }
      const p = (y * w + x) * 4, a = clamp((strength + ghost) * s.flare / 100);
      const colour = ghost > strength ? [155, 200, 255] : [255, 229, 185];
      for (let c = 0; c < 3; c++) pixels[p + c] = 255 - (255 - pixels[p + c]) * (1 - colour[c] / 255 * a);
    }
  }
  if (person) {
    const background = rgb(s.backgroundColor), outline = rgb(s.outlineColor);
    const radius = s.outlineWidth / 100 * min, distances = radius > 0 ? distanceToSubject(person, w, h) : undefined;
    for (let p = 0, i = 0; p < pixels.length; p += 4, i++) {
      const subject = person[i] / 255, origAlpha = pixels[p + 3] / 255;
      const a = s.background === 'original' ? origAlpha : origAlpha * subject;
      const stroke = distances ? (1 - smooth(radius - .5, radius + .5, distances[i] / 3)) * (1 - subject) : 0;
      const combined = a + stroke * (1 - a);
      if (s.background === 'original') {
        for (let c = 0; c < 3; c++) pixels[p + c] += (outline[c] - pixels[p + c]) * stroke;
      } else {
        for (let c = 0; c < 3; c++) {
          const value = combined ? (pixels[p + c] * a + outline[c] * stroke * (1 - a)) / combined : 0;
          pixels[p + c] = s.background === 'solid' ? value * combined + background[c] * (1 - combined) : value;
        }
        pixels[p + 3] = s.background === 'solid' ? 255 : combined * 255;
      }
    }
  }
  const plane = showMask === 'person' ? masks.person : showMask === 'depth' ? masks.depth : undefined;
  if (plane) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = (y * w + x) * 4, m = showMask === 'person' && person ? person[y * w + x] / 255 : clamp(sample(plane, (x + .5) / w, (y + .5) / h));
    if (showMask === 'depth') { pixels[p] = pixels[p + 1] = pixels[p + 2] = m * 255; pixels[p + 3] = 255; }
    else { pixels[p] *= 1 - m * .6; pixels[p + 1] = pixels[p + 1] * (1 - m * .6) + 190 * m * .6; pixels[p + 2] *= 1 - m * .6; }
  }
  return addFrame(pixels, w, h, s);
}

export function frameGeometry(w: number, h: number, raw: EditState) {
  const s = effectiveState(raw);
  const pad = (s.frame === 'none' || s.frame === 'round') ? 0 : Math.max(1, Math.round(Math.min(w, h) * s.frameWidth / 100));
  return { width: w + pad * 2, height: h + pad * (s.frame === 'polaroid' ? 4 : 2), offsetX: pad, offsetY: pad };
}
export function addFrame(pixels: Uint8ClampedArray, w: number, h: number, s: EditState): Rendered {
  const geometry = frameGeometry(w, h, s), { width, height, offsetX: pad } = geometry;
  if (s.frame === 'none') return { pixels, ...geometry };
  if (s.frame === 'round') {
    const output = pixels.slice(), radius = Math.min(w, h) * s.frameWidth / 100;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = Math.max(radius - (x + .5), x + .5 - (w - radius), 0);
      const dy = Math.max(radius - (y + .5), y + .5 - (h - radius), 0);
      output[(y * w + x) * 4 + 3] *= 1 - smooth(radius - .5, radius + .5, Math.hypot(dx, dy));
    }
    return { pixels: output, ...geometry };
  }
  const output = new Uint8ClampedArray(width * height * 4), colour = rgb(s.frameColor);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = (y * width + x) * 4;
    const border = Math.min(x, y, width - 1 - x, height - 1 - y);
    const doubleLine = s.frame === 'double' && border > pad * .35 && border < pad * .65;
    output[p] = doubleLine ? 80 : colour[0]; output[p + 1] = doubleLine ? 80 : colour[1]; output[p + 2] = doubleLine ? 80 : colour[2]; output[p + 3] = 255;
  }
  for (let y = 0; y < h; y++) output.set(pixels.subarray(y * w * 4, (y + 1) * w * 4), ((y + pad) * width + pad) * 4);
  return { pixels: output, ...geometry };
}

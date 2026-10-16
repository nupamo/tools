import { clamp, sample, type Plane } from './effects';

/** Depth refines ambiguous semantic boundaries; it never identifies a person
 * on its own. Keep confident labels and require local foreground/background
 * depth separation before changing a probability. Runs once per model result. */
export function refinePersonMask(person?: Plane, depth?: Plane): { person?: Plane; refined: boolean } {
  if (!person || !depth || person.width < 1 || person.height < 1 || depth.width < 1 || depth.height < 1) return { person, refined: false };
  let low = Infinity, high = -Infinity;
  for (const v of depth.data) if (Number.isFinite(v)) { low = Math.min(low, v); high = Math.max(high, v); }
  if (high - low < 1e-5 || !Number.isFinite(low)) return { person, refined: false };
  const scale = Math.min(1, 1024 / Math.max(depth.width, depth.height));
  const width = Math.max(1, Math.round(depth.width * scale)), height = Math.max(1, Math.round(depth.height * scale));
  const data = new Float32Array(width * height);
  const rx = Math.min(16, Math.max(3, width / person.width * 4));
  const ry = Math.min(16, Math.max(3, height / person.height * 4));
  let changed = false;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = width === 1 ? .5 : x / (width - 1), v = height === 1 ? .5 : y / (height - 1);
    const raw = sample(person, u, v), p = Number.isFinite(raw) ? clamp(raw) : 0, d = sample(depth, u, v);
    const i = y * width + x; data[i] = p;
    if (p <= .02 || p >= .98 || !Number.isFinite(d)) continue;
    let fg = 0, bg = 0, fz = 0, bz = 0, fz2 = 0, bz2 = 0;
    for (const distance of [.5, 1, 1.5]) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx * rx * distance, ny = y + dy * ry * distance;
      if (nx < 0 || ny < 0 || nx > width - 1 || ny > height - 1) continue;
      const nu = width === 1 ? .5 : nx / (width - 1), nv = height === 1 ? .5 : ny / (height - 1);
      const q = sample(person, nu, nv), z = sample(depth, nu, nv);
      if (!Number.isFinite(z) || !Number.isFinite(q)) continue;
      const weight = 1 / (1 + distance * distance * (dx * dx + dy * dy));
      if (q >= .85) { fg += weight; fz += z * weight; fz2 += z * z * weight; }
      if (q <= .15) { bg += weight; bz += z * weight; bz2 += z * z * weight; }
    }
    if (fg === 0 || bg === 0) continue;
    fz /= fg; bz /= bg;
    const separation = Math.abs(fz - bz);
    if (separation < .025) continue;
    const noise = Math.sqrt(Math.max(0, fz2 / fg - fz * fz)) + Math.sqrt(Math.max(0, bz2 / bg - bz * bz));
    const confidence = clamp((separation - .025) / (.08 + noise * 2));
    const sigma = Math.max(.008, Math.min(.08, separation * .35));
    const foreground = Math.exp(-.5 * ((d - fz) / sigma) ** 2);
    const background = Math.exp(-.5 * ((d - bz) / sigma) ** 2);
    const evidence = clamp(Math.log(foreground + 1e-5) - Math.log(background + 1e-5), -6, 6);
    const logit = Math.log(p / (1 - p)) + evidence * 4 * p * (1 - p) * confidence * .8;
    data[i] = 1 / (1 + Math.exp(-logit));
    if (Math.abs(data[i] - p) > .01) changed = true;
  }
  return changed ? { person: { data, width, height }, refined: true } : { person, refined: false };
}

/// <reference lib="webworker" />
import 'pixi.js/webworker';
import { BlurFilter, BufferImageSource, DOMAdapter, Filter, GlProgram, Rectangle, RenderTexture, Sprite, Texture, TexturePool, Ticker, WebGLRenderer, WebWorkerAdapter } from 'pixi.js';
import { AdjustmentFilter } from 'pixi-filters/adjustment';
import { AdvancedBloomFilter } from 'pixi-filters/advanced-bloom';
import { OutlineFilter } from 'pixi-filters/outline';
import { addFrame, clamp, type Masks, type Plane, type Rendered } from './effects';
import { effectiveState, type EditState } from './state';
import { filterHalo, photoTiles, type PhotoTile } from './tiles';
import { shaders, vertex } from './photo-shaders';

export type MaskView = 'none' | 'person' | 'skin' | 'depth';
type UniformValue = { value: number | number[]; type: 'f32' | 'vec2<f32>' | 'vec3<f32>' | 'vec4<f32>' };
const scalar = (value: number): UniformValue => ({ value, type: 'f32' });
const vec = (...value: number[]): UniformValue => ({ value, type: `vec${value.length}<f32>` as UniformValue['type'] });
const color = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);

function maskTexture(plane?: Plane) {
  if (!plane) return Texture.WHITE;
  const data = new Uint8Array(plane.width * plane.height * 4);
  for (let i = 0; i < plane.data.length; i++) { data[i * 4] = Math.round(clamp(plane.data[i]) * 255); data[i * 4 + 3] = 255; }
  return new Texture({ source: new BufferImageSource({ resource: data, width: plane.width, height: plane.height, format: 'rgba8unorm', alphaMode: 'no-premultiply-alpha', scaleMode: 'linear' }) });
}

/** Pixi owns textures, render targets, filters and blending; this class only
 * supplies model-aware passes and photo coordinates. No DOM or React needed. */
export class PixiPhotoRenderer {
  readonly backend = 'PixiJS · WebGL2';
  private renderer = new WebGLRenderer<OffscreenCanvas>();
  private textureLimit = 4096;

  static async create() {
    DOMAdapter.set(WebWorkerAdapter);
    // Stills render on demand. Do not keep an animation loop alive while idle.
    Ticker.system.autoStart = false;
    Ticker.system.stop();
    const engine = new PixiPhotoRenderer();
    try {
      await engine.renderer.init({ canvas: new OffscreenCanvas(1, 1), width: 1, height: 1, resolution: 1, backgroundAlpha: 0, antialias: false, powerPreference: 'high-performance', preferWebGLVersion: 2, skipExtensionImports: true });
      const gl = engine.renderer.gl;
      if (gl.isContextLost() || engine.renderer.context.webGLVersion !== 2) throw new Error('WebGL2 초기화에 실패했습니다.');
      engine.textureLimit = Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE));
      return engine;
    } catch (error) { engine.destroy(); throw error; }
  }

  destroy() { try { this.renderer.destroy(); } catch {} }

  render(source: Uint8ClampedArray, w: number, h: number, raw: EditState, masks: Masks = {}, view: MaskView = 'none', coreLimit?: number): Rendered {
    if (w < 1 || h < 1 || source.length !== w * h * 4) throw new Error('사진 크기가 올바르지 않습니다.');
    if (this.renderer.gl.isContextLost()) throw new Error('GPU 연결이 끊겼습니다. 사진을 다시 선택해주세요.');
    const s = effectiveState(raw);
    const active = s.exposure || s.contrast || s.highlights || s.shadows || s.warmth || s.tint || s.saturation || s.vibrance ||
      (masks.skin && (s.smoothing || s.skinTone)) || s.glow || (s.focusMode !== 'off' && s.blur) || s.flare ||
      (masks.person && (s.background !== 'original' || s.outlineWidth)) || view !== 'none';
    if (!active) return addFrame(source.slice(), w, h, s);
    const result = new Uint8ClampedArray(source.length);
    const textures = { person: maskTexture(masks.person), skin: maskTexture(masks.skin), depth: maskTexture(masks.depth) };
    try {
      for (const tile of photoTiles(w, h, filterHalo(w, h, s), this.textureLimit, coreLimit)) {
        const tw = tile.right - tile.left;
        const pixels = this.tile(source, w, h, tile, s, masks, textures, view);
        for (let y = 0; y < tile.height; y++) {
          const start = ((tile.y - tile.top + y) * tw + tile.x - tile.left) * 4;
          result.set(pixels.subarray(start, start + tile.width * 4), ((tile.y + y) * w + tile.x) * 4);
        }
      }
      return addFrame(result, w, h, s);
    } finally {
      for (const texture of Object.values(textures)) if (texture !== Texture.WHITE) texture.destroy(true);
      // Release pooled filter textures after large exports, rather than leaving
      // every visited tile size resident for the rest of the editing session.
      TexturePool.clear(true);
      this.renderer.gc.run();
    }
  }

  private tile(source: Uint8ClampedArray, w: number, h: number, tile: PhotoTile, s: EditState, masks: Masks,
    masksTex: { person: Texture; skin: Texture; depth: Texture }, view: MaskView) {
    const tw = tile.right - tile.left, th = tile.bottom - tile.top, min = Math.min(w, h);
    const input = new Uint8Array(tw * th * 4);
    for (let y = 0; y < th; y++) {
      input.set(source.subarray(((tile.top + y) * w + tile.left) * 4, ((tile.top + y) * w + tile.right) * 4), y * tw * 4);
    }
    // Typed-array uploads do not premultiply in WebGL. Do it explicitly once.
    for (let p = 0; p < input.length; p += 4) { const alpha = input[p + 3] / 255; for (let c = 0; c < 3; c++) input[p + c] = Math.round(input[p + c] * alpha); }
    const original = new Texture({ source: new BufferImageSource({ resource: input, width: tw, height: th, format: 'rgba8unorm', alphaMode: 'premultiplied-alpha', scaleMode: 'linear' }) });
    const targets = new Set<RenderTexture>();
    const uniforms: Record<string, UniformValue> = {
      uShape: vec(w, h, tile.left, tile.top), uTile: vec(tw, th),
      uPersonSize: vec(masksTex.person.width, masksTex.person.height), uSkinSize: vec(masksTex.skin.width, masksTex.skin.height), uDepthSize: vec(masksTex.depth.width, masksTex.depth.height),
      uAvailable: vec(+!!masks.person, +!!masks.skin, +!!masks.depth),
      uFocus: vec(s.focusX, s.focusY, s.focusRadius / 200, s.focusRange / 200), uFocusMode: scalar(['off', 'manual', 'person', 'depth'].indexOf(s.focusMode)), uFocusDepth: scalar(s.depthFocus),
      uBorder: vec(s.maskThreshold / 100, Math.max(.005, s.maskFeather / 100)), uSkin: vec(s.smoothing / 100, s.skinTone),
      uTone: vec(s.highlights, s.shadows, s.warmth, s.tint), uVibrance: scalar(s.vibrance / 100),
      uFlare: vec(s.flare / 100, s.flareSize / 100, s.flareX, s.flareY), uFlareStyle: scalar(['soft', 'star', 'ghost'].indexOf(s.flareStyle)),
      uBackground: vec(...color(s.backgroundColor)), uOverlay: scalar(['none', 'skin', 'person', 'depth'].indexOf(view)), uMix: scalar(0),
    };
    const custom = (name: keyof typeof shaders, other: Texture = Texture.WHITE, mix = 0) => new Filter({
      glProgram: GlProgram.from({ vertex, fragment: shaders[name], name: `photo-${name}` }),
      resources: {
        photoUniforms: { ...uniforms, uMix: scalar(mix) }, uOther: other.source,
        uPerson: masksTex.person.source, uSkinMask: masksTex.skin.source, uDepthMap: masksTex.depth.source,
      },
    });
    const pass = (texture: Texture, ...effects: Filter[]) => {
      const target = RenderTexture.create({ width: tw, height: th, resolution: 1 }); targets.add(target);
      const sprite = new Sprite(texture); sprite.filterArea = new Rectangle(0, 0, tw, th);
      // Neighbours are in the halo. A fixed filter area also makes secondary
      // samplers independent of Pixi's internal power-of-two texture pooling.
      for (const effect of effects) { effect.padding = 0; }
      sprite.filters = effects;
      try { this.renderer.render({ container: sprite, target, clear: true }); }
      finally {
        sprite.destroy();
        for (const effect of effects) {
          // Pixi shares group 0 between filters. Detach the last input before
          // releasing targets; the filter owns and destroys its other groups.
          const shared = effect.groups?.[0];
          if (shared) { shared.setResource(Texture.WHITE.source, 1); shared.setResource(Texture.WHITE.source.style, 2); }
          effect.destroy();
        }
      }
      return target;
    };
    const retire = (...textures: Texture[]) => {
      for (const texture of textures) if (targets.delete(texture as RenderTexture)) texture.destroy(true);
    };
    const advance = (input: Texture, ...effects: Filter[]) => {
      const next = pass(input, ...effects); retire(input); return next;
    };
    const blur = (strength: number) => {
      const filter = new BlurFilter({ strength, quality: 3 });
      filter.repeatEdgePixels = true;
      return filter;
    };
    try {
      let current: Texture = original;
      if (masks.skin && (s.smoothing || s.skinTone)) {
        let soft = current;
        if (s.smoothing) {
          const weighted = pass(current, custom('skinWeight'));
          soft = advance(weighted, blur(Math.max(1, min / 500)));
        }
        const before = current;
        current = pass(current, custom('skinBlend', soft));
        retire(before, soft);
      }
      if (s.highlights || s.shadows || s.warmth || s.tint || s.vibrance) current = advance(current, custom('tone'));
      if (s.exposure || s.contrast || s.saturation) current = advance(current, new AdjustmentFilter({ brightness: 2 ** (s.exposure / 100), contrast: 1 + s.contrast / 150, saturation: 1 + s.saturation / 100 }));
      if (s.glow) {
        const before = current, radius = Math.max(1, min * (.002 + s.glowRadius / 100 * .025));
        const soft = pass(before, blur(radius));
        current = pass(before, custom('softGlow', soft, s.glow / 100 * .35)); retire(soft);
        current = advance(current, new AdvancedBloomFilter({ threshold: .65, bloomScale: s.glow / 100 * .55, brightness: 1, blur: radius * .5, quality: 4 }));
        current = advance(current, custom('restoreAlpha', before)); retire(before);
      }
      if (s.focusMode !== 'off' && s.blur) current = advance(current, custom('focus', Texture.WHITE, min * s.blur / 100 * .035));
      if (s.flare) current = advance(current, custom('flare'));
      if (masks.person && (s.background !== 'original' || s.outlineWidth)) {
        const before = current, cutout = pass(current, custom('cutout'));
        current = cutout;
        if (s.outlineWidth) {
          const line = pass(cutout, new OutlineFilter({ thickness: s.outlineWidth / 100 * min, color: s.outlineColor, quality: .5, knockout: s.background === 'original' }));
          current = s.background === 'original' ? pass(before, custom('outlineOver', line)) : line;
          retire(cutout, before); if (current !== line) retire(line);
        }
        if (s.background !== 'original') retire(before);
        if (s.background === 'solid') current = advance(current, custom('background'));
      }
      if ((view === 'skin' && masks.skin) || (view === 'person' && masks.person) || (view === 'depth' && masks.depth)) current = advance(current, custom('overlay'));
      // The initial upload is already premultiplied; neutral paths avoid the GPU
      // entirely. extract.pixels returns premultiplied values for render targets.
      if (current === original) current = pass(current);
      const { pixels } = this.renderer.extract.pixels({ target: current });
      for (let p = 0; p < pixels.length; p += 4) {
        const alpha = pixels[p + 3] / 255;
        if (alpha > 0) for (let c = 0; c < 3; c++) pixels[p + c] = Math.round(pixels[p + c] / alpha);
      }
      return pixels;
    } finally {
      for (const texture of targets) texture.destroy(true);
      original.destroy(true);
    }
  }
}

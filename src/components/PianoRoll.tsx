import { useEffect, useRef, type PointerEvent } from 'react';
import { WHOLE, type Conversion } from '../lib/midi/convert';

// Voice colours come from theme tokens so they follow light and dark mode.
const HUES = ['blue', 'red', 'green', 'orange', 'purple', 'pink', 'teal', 'yellow', 'cyan'];
const VOICE_TOKENS = [...HUES.map(c => `--color-border-${c}`), ...HUES.map(c => `--color-icon-${c}`)];
const ROW = 8, KEYS = 34, BLACK = [1, 3, 6, 8, 10];

interface Props { conversion: Conversion | null; meter: { numerator: number; denominator: number }; zoom: number; position: number; following: boolean; label: string; onSeek: (units: number) => void }

function resolve(element: HTMLElement, tokens: string[]) {
  const probe = document.createElement('span'); element.append(probe);
  const colors = tokens.map(token => { probe.style.color = `var(${token})`; return getComputedStyle(probe).color; });
  probe.remove(); return colors;
}

export default function PianoRoll({ conversion, meter, zoom, position, following, label, onSeek }: Props) {
  const scroller = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), palette = useRef<string[]>([]);
  const notes = conversion?.voices.flat() ?? [];
  const low = notes.length ? notes.reduce((m, n) => Math.min(m, n.pitch), 127) - 2 : 48, high = notes.length ? notes.reduce((m, n) => Math.max(m, n.pitch), 0) + 2 : 84;
  const length = (conversion?.end ?? WHOLE * 4) + WHOLE, width = KEYS + length * zoom, height = (high - low + 1) * ROW;

  function draw() {
    const box = scroller.current, c = canvas.current; if (!box || !c) return;
    const dpr = window.devicePixelRatio || 1, w = box.clientWidth, h = box.clientHeight;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const ctx = c.getContext('2d'); if (!ctx) return;
    if (!palette.current.length) palette.current = resolve(box, ['--color-background-surface', '--color-background-muted', '--color-border', '--color-border-emphasized', '--color-text-secondary', '--color-accent', ...VOICE_TOKENS]);
    const [surface, muted, line, strong, text, accent, ...voiceColors] = palette.current, fills = voiceColors.slice(0, HUES.length), edges = voiceColors.slice(HUES.length);
    const sx = box.scrollLeft, sy = box.scrollTop, x = (u: number) => KEYS + u * zoom - sx, y = (p: number) => (high - p) * ROW - sy;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = surface; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = muted;
    for (let p = low; p <= high; p++) if (BLACK.includes(p % 12)) ctx.fillRect(KEYS, y(p), w, ROW);
    const beat = WHOLE / meter.denominator, bar = beat * meter.numerator, first = Math.max(0, Math.floor((sx / zoom) / beat) * beat);
    for (let u = first; x(u) < w; u += beat) { ctx.fillStyle = u % bar === 0 ? strong : line; ctx.fillRect(Math.round(x(u)), 0, 1, h); }
    conversion?.voices.forEach((voice, i) => {
      ctx.fillStyle = fills[i % HUES.length]; ctx.strokeStyle = edges[i % HUES.length]; ctx.lineWidth = 1;
      for (const n of voice) {
        const left = x(n.start), right = x(n.end); if (right < KEYS || left > w) continue;
        const top = y(n.pitch) + 1, width = Math.max(2, right - left - 1);
        ctx.fillRect(left, top, width, ROW - 2); ctx.strokeRect(left + .5, top + .5, width - 1, ROW - 3);
      }
    });
    ctx.fillStyle = surface; ctx.fillRect(0, 0, KEYS, h);
    ctx.fillStyle = line; ctx.fillRect(KEYS - 1, 0, 1, h);
    ctx.fillStyle = text; ctx.font = '9px system-ui, sans-serif'; ctx.textBaseline = 'middle';
    for (let p = low; p <= high; p++) if (p % 12 === 0) ctx.fillText(`C${p / 12 - 1}`, 4, y(p) + ROW / 2);
    const head = x(position);
    if (head >= KEYS && head <= w) { ctx.fillStyle = accent; ctx.fillRect(Math.round(head), 0, 2, h); }
  }

  useEffect(() => {
    const box = scroller.current; if (!box) return;
    const redraw = () => draw(), theme = matchMedia('(prefers-color-scheme: dark)');
    const retheme = () => { palette.current = []; draw(); };
    const resize = new ResizeObserver(redraw); resize.observe(box);
    // The header toggle sets html[data-color-mode]; without it the OS setting decides.
    const toggle = new MutationObserver(retheme); toggle.observe(document.documentElement, { attributeFilter: ['data-color-mode'] });
    box.addEventListener('scroll', redraw, { passive: true }); theme.addEventListener('change', retheme);
    return () => { resize.disconnect(); toggle.disconnect(); box.removeEventListener('scroll', redraw); theme.removeEventListener('change', retheme); };
  });
  useEffect(() => {
    const box = scroller.current; if (!box) return;
    if (!conversion) return;
    const middle = (high - (low + high) / 2) * ROW - box.clientHeight / 2;
    box.scrollTop = Math.max(0, middle); box.scrollLeft = 0;
  }, [conversion?.voices]);
  useEffect(() => {
    const box = scroller.current; if (!box || !following) return;
    const head = KEYS + position * zoom;
    if (head < box.scrollLeft + KEYS || head > box.scrollLeft + box.clientWidth * .85) box.scrollLeft = head - KEYS - box.clientWidth * .15;
  }, [position, following, zoom]);
  useEffect(draw);

  function seek(event: PointerEvent<HTMLDivElement>) {
    const box = scroller.current!, rect = box.getBoundingClientRect(), at = (event.clientX - rect.left + box.scrollLeft - KEYS) / zoom;
    if (at >= 0) onSeek(Math.min(at, conversion?.end ?? 0));
  }
  return <div className="piano-roll">
    <canvas ref={canvas} aria-hidden="true" />
    <div ref={scroller} className="piano-roll-scroll" role="img" aria-label={label} onPointerDown={event => { if (event.button === 0 && conversion) seek(event); }}>
      <div style={{ width, height }} />
    </div>
  </div>;
}

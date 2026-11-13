import { DRUM_CHANNEL, type MidiSong } from './smf';

// Time is measured in units of 1/192 of a whole note, so straight lengths down to 1/64 and triplets down to 1/48 are whole numbers.
export const WHOLE = 192;
export type MmlFormat = 'generic' | 'mabinogi';
export const MABINOGI_VOICES = 3;
export const GRIDS = { '8': 24, '16': 12, '32': 6, '64': 3, '12': 16, '24': 8 } as const;
export type Grid = keyof typeof GRIDS;

export interface ConvertOptions { format: MmlFormat; grid: Grid; tracks: number[]; drums: boolean; voices: number; volume: boolean }
export interface VoiceNote { start: number; end: number; pitch: number; velocity: number }
export interface TempoMark { at: number; bpm: number }
export interface Conversion { voices: VoiceNote[][]; tempos: TempoMark[]; mml: string[]; blocks: string[]; kept: number; dropped: number; end: number }

const RANGE: Record<MmlFormat, { octaves: [number, number]; tempo: [number, number] }> = {
  generic: { octaves: [0, 8], tempo: [1, 999] },
  mabinogi: { octaves: [1, 8], tempo: [32, 255] },
};
const NAMES = ['c', 'c+', 'd', 'd+', 'e', 'f', 'f+', 'g', 'g+', 'a', 'a+', 'b'];
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Lengths MML can write in one token. Straight lengths come first so ties prefer them.
const TOKENS: [string, number][] = [
  ...[1, 2, 4, 8, 16, 32, 64].map(l => [`${l}`, WHOLE / l] as [string, number]),
  ...[1, 2, 4, 8, 16, 32].map(l => [`${l}.`, WHOLE / l * 1.5] as [string, number]),
  ...[3, 6, 12, 24, 48].map(l => [`${l}`, WHOLE / l] as [string, number]),
];
const LIMIT = WHOLE * 3;
const BEST: (string[] | null)[] = [[]];
for (let d = 1; d <= LIMIT; d++) {
  let best: string[] | null = null;
  for (const [token, value] of TOKENS) {
    const rest = value <= d ? BEST[d - value] : null;
    if (rest && (!best || rest.length + 1 < best.length)) best = [token, ...rest];
  }
  BEST.push(best);
}
/** Splits a duration into MML length tokens joined by ties, fewest tokens first. */
export function lengths(units: number): string[] {
  const out: string[] = [];
  while (units > LIMIT) { out.push('1'); units -= WHOLE; }
  const tail = BEST[units];
  if (!tail) throw new RangeError(`No MML length for ${units}`);
  return [...out, ...tail];
}

/** Assigns notes to monophonic voices. Higher notes take lower voices; a voice whose note started earlier is cut short before a note is dropped. */
export function assignVoices(song: MidiSong, options: ConvertOptions) {
  const scale = WHOLE / 4 / song.ppq, grid = GRIDS[options.grid], wanted = new Set(options.tracks);
  const q = (tick: number) => Math.round(tick * scale / grid) * grid;
  const notes = song.notes
    .filter(n => wanted.has(n.track) && (options.drums || n.channel !== DRUM_CHANNEL))
    .map(n => { const start = q(n.tick); return { start, end: Math.max(start + grid, q(n.tick + n.duration)), pitch: n.pitch, velocity: n.velocity }; })
    .sort((a, b) => a.start - b.start || b.pitch - a.pitch);
  const voices: VoiceNote[][] = Array.from({ length: options.voices }, () => []);
  let dropped = 0;
  for (const note of notes) {
    const last = voices.map(v => v.at(-1));
    // The same pitch already sounding at this start is a doubled note.
    if (last.some(n => n && n.pitch === note.pitch && n.start === note.start)) { dropped++; continue; }
    let i = last.findIndex(n => !n || n.end <= note.start);
    if (i < 0) {
      let earliest = -1;
      last.forEach((n, j) => { if (n && n.start < note.start && (earliest < 0 || n.start < last[earliest]!.start)) earliest = j; });
      if (earliest < 0) { dropped++; continue; }
      i = earliest; last[i]!.end = note.start;
    }
    voices[i].push({ ...note });
  }
  return { voices, dropped, kept: notes.length - dropped };
}

export function tempoMarks(song: MidiSong, options: ConvertOptions): TempoMark[] {
  const scale = WHOLE / 4 / song.ppq, grid = GRIDS[options.grid], [lo, hi] = RANGE[options.format].tempo;
  const marks: TempoMark[] = [];
  for (const t of song.tempos) {
    const at = Math.round(t.tick * scale / grid) * grid, bpm = clamp(Math.round(60_000_000 / t.usPerQuarter), lo, hi);
    if (marks.at(-1)?.at === at) marks.pop();
    if (marks.at(-1)?.bpm !== bpm) marks.push({ at, bpm });
  }
  if (marks[0]?.at !== 0) marks.unshift({ at: 0, bpm: 120 });
  return marks;
}

function fitPitch(pitch: number, format: MmlFormat) {
  const [lo, hi] = RANGE[format].octaves, min = (lo + 1) * 12, max = (hi + 2) * 12 - 1;
  while (pitch < min) pitch += 12;
  while (pitch > max) pitch -= 12;
  return pitch;
}

/** Writes one voice. Tempo is written into every voice at the same time; a note across a tempo change is played again after it. */
export function writeVoice(notes: VoiceNote[], tempos: TempoMark[], options: Pick<ConvertOptions, 'volume'>): string {
  type Piece = { kind: 'note' | 'rest'; pitch: number; velocity: number; tokens: string[] } | { kind: 'tempo'; bpm: number };
  const pieces: Piece[] = [];
  let cursor = 0;
  const span = (kind: 'note' | 'rest', from: number, to: number, pitch = 0, velocity = 0) => {
    while (from < to) {
      const mark = tempos.find(t => t.at > from && t.at < to), stop = mark ? mark.at : to;
      pieces.push({ kind, pitch, velocity, tokens: lengths(stop - from) });
      if (mark) pieces.push({ kind: 'tempo', bpm: mark.bpm });
      from = stop;
    }
  };
  const tempoAt = (at: number) => { const mark = tempos.find(t => t.at === at && at > 0); if (mark) pieces.push({ kind: 'tempo', bpm: mark.bpm }); };
  for (const note of notes) {
    if (note.start > cursor) { tempoAt(cursor); span('rest', cursor, note.start); }
    tempoAt(note.start);
    span('note', note.start, note.end, note.pitch, note.velocity);
    cursor = note.end;
  }
  // Use the default length (l) that writes the fewest characters. MML starts at l4.
  const counts = new Map<string, number>();
  for (const p of pieces) if (p.kind !== 'tempo') for (const t of p.tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
  const cost = (u: string) => (u === '4' ? 0 : 1 + u.length) + [...counts].reduce((sum, [t, n]) => sum + (t === u ? 0 : t.length * n), 0);
  const unit = ['4', ...[...counts.keys()].filter(t => !t.endsWith('.'))].reduce((best, u) => cost(u) < cost(best) ? u : best);
  let out = `t${tempos[0].bpm}${unit === '4' ? '' : `l${unit}`}`, octave: number | null = null, volume: number | null = null;
  const len = (t: string) => t === unit ? '' : t;
  for (const p of pieces) {
    if (p.kind === 'tempo') { out += `t${p.bpm}`; continue; }
    if (p.kind === 'rest') { out += p.tokens.map(t => `r${len(t)}`).join(''); continue; }
    const o = Math.floor(p.pitch / 12) - 1, name = NAMES[p.pitch % 12];
    if (octave === null || Math.abs(o - octave) > 1) out += `o${o}`; else if (o > octave) out += '>'; else if (o < octave) out += '<';
    octave = o;
    if (options.volume) { const v = clamp(Math.round(p.velocity / 127 * 15), 1, 15); if (v !== volume) out += `v${v}`; volume = v; }
    out += p.tokens.map(t => `${name}${len(t)}`).join('&');
  }
  return notes.length ? out : '';
}

export function convert(song: MidiSong, options: ConvertOptions): Conversion {
  const { voices: raw, dropped, kept } = assignVoices(song, options);
  const voices = raw.map(v => v.map(n => ({ ...n, pitch: fitPitch(n.pitch, options.format) })));
  const tempos = tempoMarks(song, options);
  const mml = voices.map(v => writeVoice(v, tempos, options));
  const blocks: string[] = [];
  if (options.format === 'mabinogi') for (let i = 0; i < mml.length; i += MABINOGI_VOICES) blocks.push(`MML@${mml.slice(i, i + MABINOGI_VOICES).join(',')};`);
  else blocks.push(...mml);
  const end = voices.flat().reduce((m, n) => Math.max(m, n.end), 0);
  return { voices, tempos, mml, blocks, kept, dropped, end };
}

/** Seconds at a time in units, following the written tempo marks. */
export function unitsToSeconds(tempos: TempoMark[], at: number) {
  let seconds = 0;
  for (let i = 0; i < tempos.length; i++) {
    const from = tempos[i].at, to = Math.min(at, tempos[i + 1]?.at ?? Infinity);
    if (to <= from) break;
    seconds += (to - from) * 240 / WHOLE / tempos[i].bpm;
  }
  return seconds;
}

/** Time in units at a position in seconds. */
export function secondsToUnits(tempos: TempoMark[], seconds: number) {
  let at = 0;
  for (let i = 0; i < tempos.length; i++) {
    const perUnit = 240 / WHOLE / tempos[i].bpm, next = tempos[i + 1];
    const span = next ? (next.at - tempos[i].at) * perUnit : Infinity;
    if (seconds <= span) return tempos[i].at + seconds / perUnit;
    seconds -= span; at = next!.at;
  }
  return at;
}

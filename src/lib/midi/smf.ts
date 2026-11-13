import { midiError } from './messages';

export interface MidiNote { tick: number; duration: number; pitch: number; velocity: number; channel: number; track: number }
export interface MidiTrack { index: number; name: string; channels: number[]; program?: number; notes: number }
export interface TempoChange { tick: number; usPerQuarter: number }
export interface MidiSong { ppq: number; notes: MidiNote[]; tracks: MidiTrack[]; tempos: TempoChange[]; meter: { numerator: number; denominator: number }; endTick: number }

export const MAX_NOTES = 100_000;
export const DRUM_CHANNEL = 9;

function decodeText(bytes: Uint8Array) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch {}
  // Older Korean files are usually EUC-KR (CP949).
  try { return new TextDecoder('euc-kr').decode(bytes); } catch { return ''; }
}

// Standard MIDI File (format 0 or 1, PPQ timing).
export function parseMidi(buffer: ArrayBuffer): MidiSong {
  const data = new Uint8Array(buffer), view = new DataView(buffer);
  let pos = 0;
  const need = (n: number) => { if (pos + n > data.length) throw midiError('truncated'); };
  const u32 = () => { need(4); const v = view.getUint32(pos); pos += 4; return v; };
  const u16 = () => { need(2); const v = view.getUint16(pos); pos += 2; return v; };
  const u8 = () => { need(1); return data[pos++]; };
  const chunk = () => { need(4); const id = String.fromCharCode(...data.subarray(pos, pos + 4)); pos += 4; return id; };
  const vlq = () => { let v = 0; for (let i = 0; i < 4; i++) { const b = u8(); v = (v << 7) | (b & 0x7f); if (!(b & 0x80)) return v; } throw midiError('truncated'); };

  if (data.length < 14 || chunk() !== 'MThd') throw midiError('notMidi');
  const headerLength = u32(), headerEnd = pos + headerLength;
  u16(); const trackCount = u16(), division = u16();
  if (division & 0x8000) throw midiError('smpte');
  if (!division) throw midiError('notMidi');
  pos = headerEnd;

  const notes: MidiNote[] = [], tracks: MidiTrack[] = [], tempos: TempoChange[] = [];
  let meter: MidiSong['meter'] | undefined, endTick = 0;
  for (let t = 0; t < trackCount && pos + 8 <= data.length; t++) {
    const id = chunk(), length = u32(), end = Math.min(data.length, pos + length);
    if (id !== 'MTrk') { pos = end; t--; continue; }
    const track: MidiTrack = { index: tracks.length, name: '', channels: [], notes: 0 };
    const open = new Map<number, { tick: number; velocity: number }[]>();
    const channels = new Set<number>();
    let tick = 0, status = 0;
    const close = (channel: number, pitch: number, at: number) => {
      const started = open.get(channel * 128 + pitch)?.shift(); if (!started) return;
      notes.push({ tick: started.tick, duration: Math.max(0, at - started.tick), pitch, velocity: started.velocity, channel, track: track.index });
      track.notes++;
      if (notes.length > MAX_NOTES) throw midiError('tooManyNotes');
    };
    while (pos < end) {
      tick += vlq();
      let byte = u8();
      if (byte < 0x80) { if (!status) throw midiError('notMidi'); pos--; byte = status; }
      if (byte === 0xff) {
        const type = u8(), len = vlq(); need(len);
        const body = data.subarray(pos, pos + len); pos += len;
        if (type === 0x03 && !track.name) track.name = decodeText(body).trim();
        else if (type === 0x51 && len === 3) tempos.push({ tick, usPerQuarter: (body[0] << 16) | (body[1] << 8) | body[2] });
        else if (type === 0x58 && len >= 2 && !meter) meter = { numerator: body[0] || 4, denominator: 2 ** body[1] };
        else if (type === 0x2f) break;
        continue;
      }
      if (byte === 0xf0 || byte === 0xf7) { const len = vlq(); need(len); pos += len; continue; }
      status = byte;
      const kind = byte & 0xf0, channel = byte & 0x0f;
      if (kind === 0xc0 || kind === 0xd0) { const value = u8(); if (kind === 0xc0 && track.program === undefined) track.program = value; continue; }
      const a = u8(), b = u8();
      if (kind === 0x90 && b > 0) {
        channels.add(channel);
        const key = channel * 128 + a, list = open.get(key) ?? [];
        list.push({ tick, velocity: b }); open.set(key, list);
      } else if (kind === 0x80 || kind === 0x90) close(channel, a, tick);
    }
    for (const [key, list] of open) while (list.length) close(Math.floor(key / 128), key % 128, tick);
    endTick = Math.max(endTick, tick);
    track.channels = [...channels].sort((x, y) => x - y);
    tracks.push(track);
    pos = end;
  }
  if (!notes.length) throw midiError('noNotes');
  notes.sort((x, y) => x.tick - y.tick || y.pitch - x.pitch);
  tempos.sort((x, y) => x.tick - y.tick);
  if (!tempos.length || tempos[0].tick > 0) tempos.unshift({ tick: 0, usPerQuarter: 500_000 });
  return { ppq: division, notes, tracks, tempos, meter: meter ?? { numerator: 4, denominator: 4 }, endTick };
}

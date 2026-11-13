import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseMidi } from '../src/lib/midi/smf';
import { convert, lengths, unitsToSeconds, type ConvertOptions } from '../src/lib/midi/convert';

const vlq = (n: number) => { const out = [n & 0x7f]; while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80); return out; };
const u32 = (n: number) => [n >>> 24, (n >> 16) & 255, (n >> 8) & 255, n & 255];
function track(events: [number, ...number[]][]) {
  const body = events.flatMap(([delta, ...bytes]) => [...vlq(delta), ...bytes]).concat([0, 0xff, 0x2f, 0]);
  return [...'MTrk'].map(c => c.charCodeAt(0)).concat(u32(body.length), body);
}
function midi(tracks: number[][], ppq = 480) {
  const header = [...'MThd'].map(c => c.charCodeAt(0)).concat(u32(6), [0, 1, 0, tracks.length, ppq >> 8, ppq & 255]);
  return new Uint8Array([...header, ...tracks.flat()]).buffer;
}
const name = (text: string) => [0xff, 0x03, text.length, ...[...text].map(c => c.charCodeAt(0))];
const base: ConvertOptions = { format: 'generic', grid: '16', tracks: [0, 1, 2], drums: false, voices: 8, volume: false };

// Tempo track, a C major chord held for a half note then a melody, and a drum track. Tempo drops to 100 after a whole note.
const song = midi([
  track([[0, 0xff, 0x51, 3, 0x07, 0xa1, 0x20], [1920, 0xff, 0x51, 3, 0x09, 0x27, 0xc0]]),
  track([[0, ...name('Piano')], [0, 0x90, 60, 100], [0, 64, 100], [0, 67, 100], [960, 0x80, 60, 0], [0, 64, 0], [0, 67, 0],
    [0, 0x90, 72, 80], [480, 72, 0], [0, 74, 80], [480, 0x80, 74, 0], [0, 0x90, 76, 80], [960, 76, 0]]),
  track([[0, 0x99, 36, 100], [240, 0x89, 36, 0]]),
]);

test('reads notes with running status, names, tempo and drum channel', () => {
  const s = parseMidi(song);
  assert.equal(s.ppq, 480);
  assert.deepEqual(s.tracks.map(t => [t.name, t.notes, t.channels]), [['', 0, []], ['Piano', 6, [0]], ['', 1, [9]]]);
  assert.deepEqual(s.tempos.map(t => t.usPerQuarter), [500_000, 600_000]);
  assert.deepEqual(s.notes.slice(0, 3).map(n => [n.pitch, n.tick, n.duration]), [[67, 0, 960], [64, 0, 960], [60, 0, 960]]);
});

test('rejects files that are not MIDI', () => {
  assert.throws(() => parseMidi(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]).buffer), /notMidi/);
  assert.throws(() => parseMidi(midi([track([[0, 0xff, 0x03, 1, 65]])])), /noNotes/);
});

test('splits the chord into voices, writes ties, octaves and tempo, and skips drums', () => {
  const c = convert(parseMidi(song), base);
  assert.equal(c.kept, 6); assert.equal(c.dropped, 0);
  assert.deepEqual(c.mml.filter(Boolean), ['t120o4g2>cdt100e2', 't120o4e2', 't120o4c2']);
  assert.equal(unitsToSeconds(c.tempos, 192), 2);
  assert.equal(unitsToSeconds(c.tempos, 288), 2 + 60 / 100 * 2);
});

test('mabinogi groups three voices per score and drops or shortens what does not fit', () => {
  const c = convert(parseMidi(song), { ...base, format: 'mabinogi', voices: 2, volume: true, drums: true });
  assert.equal(c.blocks.length, 1);
  assert.match(c.blocks[0], /^MML@t120o4v12g2.*,t120.*;$/);
  assert.equal(c.dropped, 2);
});

test('lengths use dots, triplets and ties', () => {
  assert.deepEqual(lengths(72), ['4.']);
  assert.deepEqual(lengths(16), ['12']);
  assert.deepEqual(lengths(60), ['4', '16']);
  assert.deepEqual(lengths(15), ['16', '64']);
  assert.deepEqual(lengths(192 * 5), ['1', '1', '1.', '1.']);
});

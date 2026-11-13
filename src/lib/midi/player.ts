import { unitsToSeconds, type Conversion } from './convert';

interface Scheduled { time: number; end: number; pitch: number; velocity: number }

/** Plays a conversion with a simple oscillator synth. Notes are scheduled a little ahead on the audio clock. */
export class MmlPlayer {
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | undefined;
  private queue: Scheduled[] = [];
  private next = 0;
  private startedAt = 0;
  private offset = 0;
  private duration = 0;
  private voices = new Set<OscillatorNode>();
  playing = false;

  constructor(private onEnd: () => void) {}

  private ensure() {
    if (!this.context) {
      this.context = new AudioContext();
      const compressor = this.context.createDynamicsCompressor();
      this.output = this.context.createGain(); this.output.gain.value = .5;
      this.output.connect(compressor).connect(this.context.destination);
    }
    return this.context;
  }

  async play(conversion: Conversion, from = 0) {
    this.stop();
    const context = this.ensure();
    await context.resume();
    const seconds = (u: number) => unitsToSeconds(conversion.tempos, u);
    this.queue = conversion.voices.flat()
      .map(n => ({ time: seconds(n.start), end: seconds(n.end), pitch: n.pitch, velocity: n.velocity }))
      .filter(n => n.end > from)
      .sort((a, b) => a.time - b.time);
    this.duration = seconds(conversion.end);
    this.next = 0; this.offset = from; this.startedAt = context.currentTime + .05; this.playing = true;
    this.pump();
    this.timer = setInterval(() => this.pump(), 50);
  }

  /** Current position in seconds of the song. */
  get position() {
    if (!this.playing || !this.context) return this.offset;
    return this.offset + Math.max(0, this.context.currentTime - this.startedAt);
  }

  private pump() {
    const horizon = this.position + .4;
    while (this.next < this.queue.length && this.queue[this.next].time < horizon) this.voice(this.queue[this.next++]);
    if (this.position >= this.duration + .2) { this.stop(); this.offset = 0; this.onEnd(); }
  }

  private voice(note: Scheduled) {
    const context = this.context!, at = this.startedAt + Math.max(0, note.time - this.offset), end = this.startedAt + (note.end - this.offset);
    const osc = context.createOscillator(), gain = context.createGain();
    osc.type = 'triangle'; osc.frequency.value = 440 * 2 ** ((note.pitch - 69) / 12);
    const level = .08 + .22 * note.velocity / 127, release = Math.max(at + .01, end - .01);
    gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(level, at + .008);
    gain.gain.setTargetAtTime(level * .6, at + .01, .3);
    gain.gain.setValueAtTime(level * .6, release); gain.gain.linearRampToValueAtTime(0, release + .04);
    osc.connect(gain).connect(this.output!);
    osc.start(at); osc.stop(release + .05);
    this.voices.add(osc); osc.onended = () => { osc.disconnect(); gain.disconnect(); this.voices.delete(osc); };
  }

  /** Stops sound and keeps the position, so play() can resume from it. */
  pause() { const at = this.position; this.stop(); this.offset = at; }

  stop() {
    clearInterval(this.timer); this.timer = undefined;
    for (const osc of this.voices) { try { osc.stop(); } catch {} }
    this.voices.clear(); this.queue = []; this.playing = false;
  }

  dispose() { this.stop(); void this.context?.close(); this.context = null; }
}

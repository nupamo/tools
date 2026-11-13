import { useEffect, useMemo, useRef, useState } from 'react';
import { Theme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';
import { Button } from '@astryxdesign/core/Button';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { Selector } from '@astryxdesign/core/Selector';
import { Switch } from '@astryxdesign/core/Switch';
import { parseMidi, DRUM_CHANNEL, type MidiSong } from '../lib/midi/smf';
import { convert, secondsToUnits, unitsToSeconds, MABINOGI_VOICES, type Grid, type MmlFormat } from '../lib/midi/convert';
import { MmlPlayer } from '../lib/midi/player';
import { isMidiMessage, type MidiMessage } from '../lib/midi/messages';
import { getMessages, type Locale } from '../i18n';
import PianoRoll from './PianoRoll';
import ToolIcon from './ToolIcon';

const MAX_BYTES = 5 * 1024 * 1024, ZOOMS = [.125, .25, .5, 1, 2, 4];
const GRID_ORDER: Grid[] = ['8', '16', '32', '64', '12', '24'];

export default function Midi2Mml({ locale = 'ko', label }: { locale?: Locale; label: string }) {
  const t = getMessages(locale).midi, n = (value: number) => value.toLocaleString(locale);
  const input = useRef<HTMLInputElement>(null), player = useRef<MmlPlayer | null>(null), frame = useRef(0);
  const [song, setSong] = useState<MidiSong | null>(null), [fileName, setFileName] = useState(''), [loading, setLoading] = useState(false);
  const [format, setFormat] = useState<MmlFormat>('generic'), [grid, setGrid] = useState<Grid>('16');
  const [voiceCount, setVoiceCount] = useState(8), [scores, setScores] = useState(1), [volume, setVolume] = useState(true), [drums, setDrums] = useState(false);
  const [tracks, setTracks] = useState<number[]>([]), [zoom, setZoom] = useState(2);
  const [playing, setPlaying] = useState(false), [position, setPosition] = useState(0), [dragging, setDragging] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const say = (code: MidiMessage) => t.status[code];

  const conversion = useMemo(() => song && tracks.length
    ? convert(song, { format, grid, tracks, drums, volume, voices: format === 'mabinogi' ? scores * MABINOGI_VOICES : voiceCount })
    : null, [song, format, grid, tracks, drums, volume, voiceCount, scores]);
  const duration = conversion ? unitsToSeconds(conversion.tempos, conversion.end) : 0;

  useEffect(() => {
    player.current = new MmlPlayer(() => { setPlaying(false); setPosition(0); });
    return () => { cancelAnimationFrame(frame.current); player.current?.dispose(); };
  }, []);
  // Settings change the notes, so playback restarts from the start of the new result.
  useEffect(() => { player.current?.stop(); setPlaying(false); setPosition(0); }, [conversion]);
  useEffect(() => {
    if (!playing || !conversion) return;
    const tick = () => { setPosition(secondsToUnits(conversion.tempos, player.current!.position)); frame.current = requestAnimationFrame(tick); };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [playing, conversion]);
  const toggleRef = useRef(toggle); toggleRef.current = toggle;
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key !== ' ' || event.repeat || target.closest('input, textarea, select, button, [role=combobox], [role=radio]')) return;
      event.preventDefault(); toggleRef.current();
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, []);

  function choose() { if (input.current) { input.current.value = ''; input.current.click(); } }
  async function loadFile(file: File) {
    setError(''); setMessage('');
    if (!/\.midi?$/i.test(file.name)) { setError(say('notMidi')); return; }
    if (file.size > MAX_BYTES) { setError(say('fileTooLarge')); return; }
    setLoading(true);
    try {
      const next = parseMidi(await file.arrayBuffer());
      setSong(next); setFileName(file.name); setTracks(next.tracks.filter(track => track.notes).map(track => track.index));
    } catch (cause) { setError(cause instanceof Error && isMidiMessage(cause.message) ? say(cause.message) : say('openFailed')); }
    finally { setLoading(false); }
  }
  async function playFrom(units: number) {
    if (!conversion || !player.current) return;
    try { await player.current.play(conversion, unitsToSeconds(conversion.tempos, units)); setPlaying(true); setError(''); }
    catch { setPlaying(false); setError(say('audioFailed')); }
  }
  function toggle() {
    if (playing) { player.current?.pause(); setPlaying(false); setPosition(conversion ? secondsToUnits(conversion.tempos, player.current!.position) : 0); }
    else void playFrom(position >= (conversion?.end ?? 0) ? 0 : position);
  }
  function stop() { player.current?.stop(); setPlaying(false); setPosition(0); }
  function seek(units: number) { setPosition(units); if (playing) void playFrom(units); }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setError(''); setMessage(say('copied')); }
    catch { setMessage(''); setError(say('copyFailed')); }
  }
  const time = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  const options = (count: number, text: (i: number) => string) => Array.from({ length: count }, (_, i) => ({ value: `${i + 1}`, label: text(i + 1) }));
  const disabled = !song || loading;

  return <Theme theme={neutralTheme} mode="system"><section className="editor midi-editor" aria-label={label}>
    <input ref={input} type="file" accept=".mid,.midi,audio/midi,audio/x-midi" className="visually-hidden" tabIndex={-1} aria-label={t.file} disabled={loading} onChange={event => { const file = event.target.files?.[0]; if (file) void loadFile(file); }} />
    <div className="editor-toolbar">
      <div className="file-info">{song ? <><span className="file-name" title={fileName}>{fileName}</span><span className="dimensions">{t.summary(n(song.notes.length), time(duration))}</span></> : <span>{t.start}</span>}</div>
      <div className="toolbar-actions">
        <Button icon={<ToolIcon name="fileMusic" />} label={song ? t.another : t.choose} size="sm" isDisabled={loading} onClick={choose} />
        <Button icon={<ToolIcon name={playing ? 'pause' : 'play'} />} label={playing ? t.pause : t.play} size="sm" variant="primary" isDisabled={!conversion} onClick={toggle} aria-keyshortcuts="Space" />
        <Button icon={<ToolIcon name="square" />} label={t.stop} size="sm" variant="ghost" isDisabled={!conversion || (!playing && position === 0)} onClick={stop} />
        <Button icon={<ToolIcon name="zoomOut" />} label={t.zoomOut} isIconOnly size="sm" variant="ghost" isDisabled={!song || zoom === 0} onClick={() => setZoom(z => z - 1)} />
        <Button icon={<ToolIcon name="zoomIn" />} label={t.zoomIn} isIconOnly size="sm" variant="ghost" isDisabled={!song || zoom === ZOOMS.length - 1} onClick={() => setZoom(z => z + 1)} />
      </div>
    </div>
    <div className="editor-body midi-body">
      <div className={`midi-stage ${dragging ? 'is-dragging' : ''}`} aria-busy={loading}
        onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
        onDrop={event => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file) void loadFile(file); }}>
        {song ? <PianoRoll conversion={conversion} meter={song.meter} zoom={ZOOMS[zoom]} position={position} following={playing} label={t.roll} onSeek={seek} />
          : <button type="button" className="empty-upload" disabled={loading} onClick={choose}><ToolIcon name="fileMusic" size="lg" /><strong>{loading ? t.opening : t.drop}</strong><small>{t.limits}</small></button>}
      </div>
      <aside className="adjustments midi-panel" aria-label={t.settings}>
        <div className="midi-settings">
          <SegmentedControl label={t.format} value={format} onChange={value => setFormat(value as MmlFormat)} size="sm" layout="fill" isDisabled={disabled}>
            <SegmentedControlItem value="generic" label={t.formats.generic} />
            <SegmentedControlItem value="mabinogi" label={t.formats.mabinogi} />
          </SegmentedControl>
          <div className="midi-selects">
            <Selector label={t.grid} size="sm" width="100%" isDisabled={disabled} value={grid} onChange={value => setGrid(value as Grid)}
              options={GRID_ORDER.map(g => ({ value: g, label: t.grids[g] }))} />
            {format === 'mabinogi'
              ? <Selector label={t.scores} size="sm" width="100%" isDisabled={disabled} value={`${scores}`} onChange={value => setScores(Number(value))} options={options(6, t.scoreCount)} />
              : <Selector label={t.voices} size="sm" width="100%" isDisabled={disabled} value={`${voiceCount}`} onChange={value => setVoiceCount(Number(value))} options={options(16, t.voiceCount)} />}
          </div>
          <Switch label={t.volume} size="sm" value={volume} isDisabled={disabled} onChange={setVolume} />
          <CheckboxInput label={t.drums} size="sm" value={drums} isDisabled={disabled} onChange={setDrums} />
        </div>
        {song && <fieldset className="midi-tracks"><legend>{t.tracks}</legend>
          {song.tracks.filter(track => track.notes).map(track => <CheckboxInput key={track.index} size="sm" isDisabled={loading}
            label={t.trackName(track.index, track.name)}
            description={[t.trackNotes(n(track.notes)), track.channels.includes(DRUM_CHANNEL) ? t.drumTag : ''].filter(Boolean).join(' · ')}
            value={tracks.includes(track.index)} onChange={checked => setTracks(list => checked ? [...list, track.index].sort((a, b) => a - b) : list.filter(i => i !== track.index))} />)}
        </fieldset>}
        {song && <section className="midi-output" aria-labelledby="midi-output-heading">
          <div className="adjustment-heading"><h2 id="midi-output-heading">{t.output}</h2>{conversion && <span className="panel-note">{t.result(n(conversion.kept), n(conversion.dropped))}</span>}</div>
          {conversion && conversion.dropped > 0 && <p className="panel-note">{t.droppedHint}</p>}
          {!conversion || !conversion.kept ? <p className="panel-note">{t.empty}</p> : conversion.blocks.map((block, i) => {
            if (!block) return null;
            const parts = format === 'mabinogi' ? conversion.mml.slice(i * MABINOGI_VOICES, (i + 1) * MABINOGI_VOICES) : [block];
            const title = format === 'mabinogi' ? t.score(i) : t.voice(i);
            return <div className="mml-block" key={i}>
              <div className="mml-block-head"><strong>{title}</strong>
                <span className="mml-count">{format === 'mabinogi' ? parts.map((part, j) => `${t.parts[j]} ${t.chars(n(part.length))}`).join(' · ') : t.chars(n(block.length))}</span>
                <Button icon={<ToolIcon name="copy" />} label={`${t.copy} · ${title}`} isIconOnly size="sm" variant="ghost" onClick={() => void copy(block)} />
              </div>
              <textarea className="mml-text" readOnly rows={3} value={block} aria-label={title} spellCheck={false} onFocus={event => event.currentTarget.select()} />
            </div>;
          })}
        </section>}
        {(error || message) && <div className={`panel-status ${error ? 'has-error' : ''}`} role={error ? 'alert' : 'status'}>{error || message}</div>}
      </aside>
    </div>
  </section></Theme>;
}

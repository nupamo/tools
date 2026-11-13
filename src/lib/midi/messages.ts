// MIDI code reports errors as these codes, never as UI text. The UI translates them with src/i18n.
export const MIDI_MESSAGES = ['notMidi', 'smpte', 'truncated', 'noNotes', 'tooManyNotes', 'fileTooLarge', 'openFailed', 'audioFailed', 'copied', 'copyFailed'] as const;
export type MidiMessage = typeof MIDI_MESSAGES[number];
export const midiError = (code: MidiMessage) => new Error(code);
export const isMidiMessage = (value: unknown): value is MidiMessage => (MIDI_MESSAGES as readonly unknown[]).includes(value);

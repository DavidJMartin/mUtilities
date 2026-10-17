// Drum pattern as a MIDI file on channel 10 (General MIDI drums), via the
// shared writer in core/midi.js (no tempo event). Shuffle is baked into the
// note positions.

import { ACCENT_ROW, TICKS_PER_BAR, TICKS_PER_BEAT, rowAt, rowFires, swingTicks } from './logic.js';
import { GM_NOTES } from './voices.js';
import { downloadBlob, timestamp } from '../../core/files.js';
import { MIDI_PPQ, buildMidiFile } from '../../core/midi.js';

const SCALE = MIDI_PPQ / TICKS_PER_BEAT;
const NOTE_LENGTH = MIDI_PPQ / 8;
const BASE_VELOCITY = 90;
const DRUM_CHANNEL = 9;

export function buildMidi({ gens, rows, accentAmount }, bars) {
    const notes = [];
    for (let t = 0; t < bars * TICKS_PER_BAR; t++) {
        const accent = rowAt(gens, rows[ACCENT_ROW], t);
        for (let r = 0; r < ACCENT_ROW; r++) {
            if (!rowFires(gens, rows[r], t)) continue;
            notes.push({
                at: Math.round((t + swingTicks(t, rows[r])) * SCALE),
                length: NOTE_LENGTH,
                note: GM_NOTES[r],
                velocity: accent ? Math.round(BASE_VELOCITY + (127 - BASE_VELOCITY) * accentAmount) : BASE_VELOCITY,
            });
        }
    }
    return buildMidiFile(notes, { channel: DRUM_CHANNEL });
}

export function downloadMidi(state, bars) {
    const blob = new Blob([buildMidi(state, bars)], { type: 'audio/midi' });
    downloadBlob(blob, `logical-drums-${bars}bar${bars > 1 ? 's' : ''}-${timestamp()}.mid`);
}

// Export the next N bars as MIDI, rendered offline from the current registers
// and random-number state (see renderNotes), via the shared writer. With two
// melodies, A is on MIDI channel 1 and B on channel 2, so they can be split.

import { downloadBlob, timestamp } from '../../core/files.js';
import { MIDI_PPQ, buildMidiFile } from '../../core/midi.js';
import { TICKS_PER_BEAT, renderNotes } from './logic.js';

const SCALE = MIDI_PPQ / TICKS_PER_BEAT;
const VELOCITY = 100;

export function buildMidi(state, rngState, bars) {
    const notes = renderNotes(state, rngState, bars).map(n => ({
        at: n.tick * SCALE,
        length: Math.round(n.length * SCALE),
        note: n.midi,
        velocity: VELOCITY,
        channel: n.voice,
    }));
    return buildMidiFile(notes);
}

export function downloadMidi(state, rngState, bars) {
    const blob = new Blob([buildMidi(state, rngState, bars)], { type: 'audio/midi' });
    downloadBlob(blob, `twin-turing-${bars}bar${bars > 1 ? 's' : ''}-${timestamp()}.mid`);
}

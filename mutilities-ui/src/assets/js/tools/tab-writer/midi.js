// The whole tab as a MIDI file (shared writer, no tempo event). Each note lasts
// its beat's duration.

import { downloadBlob, timestamp } from '../../core/files.js';
import { MIDI_PPQ, buildMidiFile } from '../../core/midi.js';
import { TICKS_PER_BEAT, songNotes } from './logic.js';

const SCALE = MIDI_PPQ / TICKS_PER_BEAT;

export function buildMidi(song) {
    return buildMidiFile(songNotes(song).map(n => ({
        at: n.start * SCALE,
        length: n.length * SCALE,
        note: n.midi,
        velocity: 96,
    })));
}

export function downloadMidi(song) {
    downloadBlob(new Blob([buildMidi(song)], { type: 'audio/midi' }), `tab-writer-${timestamp()}.mid`);
}

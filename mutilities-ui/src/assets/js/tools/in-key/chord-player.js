// Strums chord voicings. A filtered sawtooth whose brightness falls away as
// it rings stands in for a plucked string, with a little reverb for body.

import * as Tone from 'tone';
import { ensureAudioRunning } from '../../core/audio.js';

const STRUM_GAP = 0.03; // seconds between strings
const RING_TIME = 1.5; // seconds each strum is held before releasing
const CHORD_LENGTH = 1.4; // seconds per chord when playing a progression

let synth = null;

function createSynth() {
    const limiter = new Tone.Limiter(-1).toDestination();
    const reverb = new Tone.Reverb({ decay: 1.2, wet: 0.18 }).connect(limiter);
    const voice = new Tone.PolySynth(Tone.MonoSynth, {
        oscillator: { type: 'sawtooth' },
        filter: { type: 'lowpass', Q: 1, rolloff: -24 },
        // Bright at the pick, then mellowing as the string rings
        filterEnvelope: { attack: 0.002, decay: 0.35, sustain: 0.25, release: 1, baseFrequency: 350, octaves: 3.5 },
        // A quick initial drop for the pick, then a slower fade on release
        envelope: { attack: 0.003, decay: 0.4, sustain: 0.35, release: 1.2 },
    }).connect(reverb);
    voice.volume.value = -14;
    return voice;
}

async function ready() {
    await ensureAudioRunning();
    synth ??= createSynth();
}

function strumAt(midiNotes, time, length) {
    midiNotes.forEach((midi, i) => {
        synth.triggerAttackRelease(Tone.Frequency(midi, 'midi').toFrequency(), length, time + i * STRUM_GAP);
    });
}

/** @param {number[]} midiNotes low to high */
export async function strum(midiNotes) {
    await ready();
    strumAt(midiNotes, Tone.now(), RING_TIME);
}

/**
 * Strum each chord in turn; onChord(index) fires as each one sounds.
 * @param {number[][]} chords
 * @returns {Promise<void>} resolves when the last chord has rung out
 */
export async function playProgression(chords, onChord) {
    await ready();
    const start = Tone.now() + 0.05;
    chords.forEach((notes, i) => {
        strumAt(notes, start + i * CHORD_LENGTH, CHORD_LENGTH);
        setTimeout(() => onChord(i), (0.05 + i * CHORD_LENGTH) * 1000);
    });
    return new Promise(resolve => setTimeout(resolve, (0.05 + chords.length * CHORD_LENGTH) * 1000));
}

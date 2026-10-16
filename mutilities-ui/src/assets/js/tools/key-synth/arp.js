// Arpeggiator for the Key Synth. It runs on the shared clock (core/clock.js)
// as a rhythmic tool: hold keys and it starts at once, or on the next beat if
// something else (e.g. Logical Drums) is already playing, so it's always in
// time with it.
//
// Latch keeps it going after you let go; playing a new chord after letting go
// replaces the latched one. Switching latch off lets the notes go.

import * as Tone from 'tone';
import { clock } from '../../core/clock.js';
import { midiNumber, parseNote } from '../../music/theory.js';

const PLAYER_ID = 'key-synth-arp';

export const ARP_DIRECTIONS = [
    { value: 'updown', label: 'UP/DN' },
    { value: 'up', label: 'UP' },
    { value: 'down', label: 'DOWN' },
    { value: 'played', label: 'ORDER' },
    { value: 'random', label: 'RAND' },
];

/** Notes per beat: 1, 1/2, 1/3 (triplets) and 1/4 of a beat each */
export const ARP_RATES = [1, 2, 3, 4];
export const rateLabel = perBeat => (perBeat === 1 ? '1' : `1/${perBeat}`);

export const ARP_OCTAVES = { min: 1, max: 3 };

export const DEFAULT_ARP = { on: false, latch: false, direction: 'up', rate: 2, octaves: 1, gate: 0.5 };

const toMidi = (note) => {
    const { pc, octave } = parseNote(note);
    return midiNumber(pc, octave);
};
const transpose = (note, octaves) => {
    const { pc, octave } = parseNote(note);
    return `${pc}${octave + octaves}`;
};

/**
 * The notes to step through, from the held notes in the order they were
 * pressed. Up/down doesn't repeat the top and bottom notes. Random returns the
 * pool to pick from.
 */
export function arpSequence(notes, direction, octaves) {
    const spread = (list) => Array.from({ length: octaves }, (_, o) => list.map(n => transpose(n, o))).flat();
    if (direction === 'played') return spread(notes);

    const up = spread([...notes].sort((a, b) => toMidi(a) - toMidi(b)));
    if (direction === 'down') return up.reverse();
    if (direction === 'updown') return up.length > 2 ? [...up, ...up.slice(1, -1).reverse()] : up;
    return up;
}

/**
 * onNote(note) is called (in step with the audio) for each note played, for the display.
 * onStop() is called when the arp is stopped from outside (the playground strip), so the
 * page can clear its latched keys.
 */
export function createArp(engine, onNote, onStop = () => {}) {
    let options = { ...DEFAULT_ARP };
    let notes = []; // what the arp plays, in press order
    const held = new Set(); // keys physically down right now
    let repeatId = null;
    let step = 0;
    let last = null;

    const play = (time) => {
        const sequence = arpSequence(notes, options.direction, options.octaves);
        if (!sequence.length) return;

        let note;
        if (options.direction === 'random') {
            // Avoid the same note twice in a row when there's a choice
            const choices = sequence.length > 1 ? sequence.filter(n => n !== last) : sequence;
            note = choices[Math.floor(Math.random() * choices.length)];
        } else {
            note = sequence[step % sequence.length];
        }
        step += 1;
        last = note;

        const stepSeconds = 60 / clock.bpm / options.rate;
        engine.playNote(note, stepSeconds * options.gate, time);
        Tone.Draw.schedule(() => onNote(note), time);
    };

    const schedule = (startTicks) => {
        const interval = `${Tone.Transport.PPQ / options.rate}i`;
        repeatId = Tone.Transport.scheduleRepeat(play, interval, `${startTicks}i`);
    };
    const unschedule = () => {
        if (repeatId !== null) Tone.Transport.clear(repeatId);
        repeatId = null;
    };

    clock.register(PLAYER_ID, {
        name: 'Key Synth arp',
        short: 'Arp',
        page: 'key-synth',
        sync: 'clock',
        start: (startTicks) => {
            step = 0;
            schedule(startTicks);
        },
        // Stopping lets go of everything, latched notes included
        stop: () => {
            unschedule();
            if (notes.length) {
                notes = [];
                held.clear();
                onStop();
            }
        },
    });

    const sync = () => {
        if (notes.length && !clock.isPlaying(PLAYER_ID)) clock.launch(PLAYER_ID, { quantise: 'beat' });
        if (!notes.length && clock.isPlaying(PLAYER_ID)) clock.stop(PLAYER_ID);
    };

    return {
        get options() {
            return options;
        },

        get notes() {
            return notes;
        },

        isOn: () => options.on,

        set(change) {
            const previous = options;
            options = { ...options, ...change };

            if (!options.on) {
                notes = [];
                held.clear();
            } else if (previous.latch && !options.latch) {
                // Let go of everything that isn't still being held
                notes = notes.filter(n => held.has(n));
            }

            // A new rate takes effect from the next beat, staying in time
            if (options.rate !== previous.rate && repeatId !== null) {
                unschedule();
                schedule(clock.next('beat').startTicks);
            }
            sync();
        },

        noteDown(note) {
            // With latch on, a new chord after letting go replaces the old one
            if (options.latch && held.size === 0) notes = [];
            held.add(note);
            if (!notes.includes(note)) notes = [...notes, note];
            sync();
        },

        noteUp(note) {
            held.delete(note);
            if (!options.latch) notes = notes.filter(n => n !== note);
            sync();
        },

        /** Physical keys all let go (e.g. leaving the page); latched notes keep playing */
        releaseHeld() {
            held.clear();
            if (!options.latch) notes = [];
            sync();
        },

        /** Stop and forget everything (e.g. changing octave) */
        clear() {
            notes = [];
            held.clear();
            sync();
        },
    };
}

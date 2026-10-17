// Twin Turing: two Turing-machine shift registers mixed into one melody.
// Pure logic: no audio, no DOM. Playback and MIDI export both run this.
//
// One machine (after Music Thing Modular's Turing Machine):
//   - a loop of 2–16 bits. Each step rotates it by one; the bit coming round
//     is flipped with a chance set by `knob`, laid out like the hardware's
//     big knob (flip chance = 1 − knob):
//     knob 1   (fully right) → never flips: locked loop
//     knob 0.5 (centre)      → flips half the time: random
//     knob 0   (fully left)  → always flips: "double lock", a loop twice as
//                              long, inverted on the second pass
//     in between, the loop "slips": it repeats but changes now and then
//   - Write: while held, the bit coming round is replaced with a 1 (or 0),
//     like the hardware's write switch
//   - its value is the 8 bits at the front of the loop read as a number,
//     0–255, scaled to 0–1.
//
// The two values are summed into one melody in scale steps:
//   steps = round(A × rangeA) + round(B × rangeB)
// then played up the scale from the root, so every note is in key.

import { SCALES, midiNumber } from '../../music/theory.js';

export const TICKS_PER_BEAT = 48;
export const TICKS_PER_BAR = TICKS_PER_BEAT * 4;
export const MAX_BITS = 16;

/** Steps per beat as ticks: 2 beats, 1 beat, 1/2, 1/3, 1/4 */
export const RATES = [
    { ticks: 96, label: '2' },
    { ticks: 48, label: '1' },
    { ticks: 24, label: '1/2' },
    { ticks: 16, label: '1/3' },
    { ticks: 12, label: '1/4' },
];

/** Finest grid that lands on every rate's steps */
export const GRID_TICKS = 4;

export const RANGE_MAX = 14; // two octaves of a seven-note scale

/**
 * When notes play:
 *   pulse: only on steps where the machine's newest bit is 1, like the Mk2's
 *          Pulse out. The pulses loop and slip along with the melody, giving rhythm.
 *   new:   every step, but a repeated pitch holds instead of playing again.
 *   every: every step plays.
 */
export const TRIGGERS = [
    { value: 'pulse', label: 'Pulse' },
    { value: 'new', label: 'New note' },
    { value: 'every', label: 'Every step' },
];

/** Small fast seeded random number generator (mulberry32), so export can replay the future exactly */
export function createRng(seed) {
    let a = seed >>> 0;
    const next = () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.state = () => a;
    next.restore = (s) => { a = s >>> 0; };
    return next;
}

/** The knob: 1 = never flip (locked), 0.5 = random, 0 = always flip (double lock) */
export const flipChance = knob => 1 - knob;

/** Patches from before the double lock stored `lock` (1 locked, 0 random); same flip chance on the new knob */
export const knobFromOldLock = lock => (1 + lock) / 2;

export const randomBits = (rng, count = MAX_BITS) => Array.from({ length: count }, () => (rng() < 0.5 ? 1 : 0));

/**
 * Advance one machine by a step (mutates `machine.bits`). The register holds
 * MAX_BITS bits; only the first `length` take part in the loop.
 */
export function stepMachine(machine, rng) {
    const { bits, length } = machine;
    let wrapped = bits[length - 1];
    // Always draw, so writing doesn't change the random sequence that follows
    if (rng() < flipChance(machine.knob)) wrapped ^= 1;
    if (machine.write === 0 || machine.write === 1) wrapped = machine.write;
    for (let i = length - 1; i > 0; i--) bits[i] = bits[i - 1];
    bits[0] = wrapped;
}

/** The machine's value, 0–1: the front 8 bits of the loop (repeating if the loop is shorter) */
export function machineValue(machine) {
    let n = 0;
    for (let i = 0; i < 8; i++) n = (n << 1) | machine.bits[i % machine.length];
    return n / 255;
}

/** A machine switched off (only B can be) neither steps nor moves the pitch */
const isOn = m => m.on !== false;

export function scaleSteps(machines) {
    return machines.filter(isOn).reduce((sum, m) => sum + Math.round(machineValue(m) * m.range), 0);
}

/** MIDI note for a number of scale steps above the root in the base octave */
export function stepsToMidi(steps, { root, scale, octave }) {
    const intervals = SCALES[scale].intervals;
    const octaves = Math.floor(steps / intervals.length);
    const degree = steps % intervals.length;
    return midiNumber(root, octave) + octaves * 12 + intervals[degree];
}

/** Which machines step at this tick (positions from the bar line the pattern started on) */
export const stepsAt = (machines, tick) => machines.map(m => isOn(m) && tick % RATES[m.rate].ticks === 0);

/**
 * Advance the machines that step at `tick` and return the notes that sound
 * (an empty list if none). Each note is { voice, midi, length } with length
 * in ticks.
 *
 * mode 'summed' (one melody, voice 0): pitch = A's steps + B's steps.
 *   notesOn 'a': notes on A's steps (B only moves the pitch); 'both': on either's steps.
 * mode 'separate' (two melodies): each machine plays its own notes on its own
 *   steps, A from the base octave (voice 0), B from octaveB above it (voice 1).
 */
export function tick(state, rng, tickIndex) {
    const due = stepsAt(state.machines, tickIndex);
    if (!due.some(Boolean)) return [];
    state.machines.forEach((m, i) => { if (due[i]) stepMachine(m, rng); });

    // A machine "fires" on its step; with Pulse triggers, only if its newest bit is 1
    const fired = state.machines.map((m, i) => due[i] && (state.trigger !== 'pulse' || m.bits[0] === 1));

    if (state.mode === 'separate') {
        return state.machines.flatMap((m, i) => (fired[i] ? [{
            voice: i,
            midi: stepsToMidi(Math.round(machineValue(m) * m.range), { ...state, octave: state.octave + (i === 1 ? state.octaveB : 0) }),
            length: Math.max(1, RATES[m.rate].ticks * state.gate),
        }] : []));
    }

    const fires = state.notesOn === 'both' ? fired[0] || fired[1] : fired[0];
    if (!fires) return [];

    // The note lasts until the next step of whatever triggered it, scaled by gate
    const stepTicks = Math.min(...state.machines.filter((_, i) => fired[i] && (i === 0 || state.notesOn === 'both')).map(m => RATES[m.rate].ticks));
    return [{
        voice: 0,
        midi: stepsToMidi(scaleSteps(state.machines), state),
        length: Math.max(1, stepTicks * state.gate),
    }];
}

/** A deep copy of the bits so a simulation doesn't disturb the live machines */
export const cloneState = state => ({ ...state, machines: state.machines.map(m => ({ ...m, bits: [...m.bits] })) });

/**
 * The next note after `fromTick`, worked out on a copy (the live machines and
 * random state are untouched). Used to decide whether a note should hold into
 * a repeat of the same pitch (New note triggers).
 */
export function peekNextNote(state, rngState, fromTick, voice = 0, maxTicks = TICKS_PER_BAR * 2) {
    const sim = cloneState(state);
    const rng = createRng(0);
    rng.restore(rngState);
    for (let t = fromTick + GRID_TICKS; t <= fromTick + maxTicks; t += GRID_TICKS) {
        const note = tick(sim, rng, t).find(n => n.voice === voice);
        if (note) return { tick: t, ...note };
    }
    return null;
}

/**
 * With New note triggers, back-to-back notes of the same pitch in the same voice
 * become one longer note (from the first start to the last end).
 */
export function tieRepeats(notes) {
    const out = [];
    const lastByVoice = new Map();
    for (const note of notes) {
        const last = lastByVoice.get(note.voice);
        if (last && last.midi === note.midi) {
            last.length = note.tick + note.length - last.tick;
        } else {
            const copy = { ...note };
            out.push(copy);
            lastByVoice.set(note.voice, copy);
        }
    }
    return out;
}

/**
 * Render the next `bars` bars as notes, starting from the current registers
 * and random-number state, without touching either. Fully locked, this is
 * exactly the loop you're hearing; otherwise it's the future the live
 * playback would also take (same seed), from a fresh bar.
 */
export function renderNotes(state, rngState, bars) {
    const sim = cloneState(state);
    const rng = createRng(0);
    rng.restore(rngState);
    const notes = [];
    for (let t = 0; t < bars * TICKS_PER_BAR; t += GRID_TICKS) {
        tick(sim, rng, t).forEach(note => notes.push({ tick: t, ...note }));
    }
    return state.trigger === 'new' ? tieRepeats(notes) : notes;
}

// `write` (0, 1 or null) is only set while a Write button is held; it isn't saved
const machine = (rate, range, knob) => ({ on: true, length: 8, knob, rate, range, bits: Array(MAX_BITS).fill(0), write: null });

/**
 * Both registers start empty (all 0s), as on the hardware. The knobs sit a
 * little short of fully locked, so a pattern grows out of silence and slips;
 * turn fully right to freeze it.
 */
export function defaultState() {
    return {
        // C major, like the other tools
        root: 'C',
        scale: 'major',
        octave: 3,
        mode: 'summed', // or 'separate': two melodies, one per machine
        octaveB: 1, // separate mode: B plays this many octaves above A
        notesOn: 'a',
        gate: 0.5,
        wave: 'sawtooth',
        trigger: 'pulse', // see TRIGGERS
        machines: [
            machine(2, 7, 0.85), // A: 8ths, up to an octave, "70% locked" (flips 15% of steps)
            machine(0, 4, 0.95), // B: every 2 beats, nudges the melody up to 4 steps, "90% locked"
        ],
    };
}

// Pure pattern logic: no audio, no DOM. Every voice is a function of the
// tick, so playback, the lights and MIDI export all call the same code and
// can't disagree.
//
// Time is counted in ticks of 48 per beat (12 per 16th). That divides by
// every allowed multiplier, so "do A and B land together" is an integer
// comparison, triplets included.

export const TICKS_PER_BEAT = 48;
export const TICKS_PER_STEP = 12;
export const TICKS_PER_BAR = TICKS_PER_BEAT * 4;

/** ×/÷ values in knob order: negative = divide (pulse every n beats), positive = multiply (n per beat) */
export const RATES = [-16, -12, -8, -6, -4, -3, -2, 1, 2, 3, 4, 6, 8, 12, 16];

export const GATES = [
    { value: 'AND', label: 'AND' },
    { value: 'OR', label: 'OR' },
    { value: 'XOR', label: 'XOR' },
    { value: 'ANDNOT', label: 'AND NOT' },
];

export const LETTERS = 'ABCDEF';
export const SHUFFLES = [50, 54, 58, 62, 66, 70, 75];
export const MAX_SIGNALS = 3;
export const EUCLID_MAX_STEPS = 16;

const mod = (a, b) => ((a % b) + b) % b;
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

export const rateLabel = v => (v < 0 ? `/${-v}` : `×${v}`);

/** Length of one cycle in ticks */
export function period(g) {
    if (g.type === 'euclid') return g.n * TICKS_PER_STEP;
    return g.rate > 0 ? TICKS_PER_BEAT / g.rate : TICKS_PER_BEAT * -g.rate;
}

/** Largest shift in 16ths; 0 means shifting would change nothing (e.g. ×4 and up) */
export function shiftMax(g) {
    if (g.type === 'euclid') return g.n - 1;
    return Math.max(0, Math.floor(period(g) / TICKS_PER_STEP) - 1);
}

/** Is generator g high at tick t? Triggers are high for one tick, gates for the first half of each cycle */
export function signalAt(g, t) {
    if (g.type === 'euclid') {
        if (mod(t, TICKS_PER_STEP)) return false;
        const i = mod(t / TICKS_PER_STEP - g.shift, g.n);
        return g.k > 0 && (i * g.k) % g.n < g.k;
    }
    const p = period(g);
    const u = mod(t - g.shift * TICKS_PER_STEP, p);
    return g.mode === 'gate' ? u < p / 2 : u === 0;
}

/**
 * Evaluate a row's chain left to right with no precedence:
 * A OR B XOR C means (A OR B) XOR C. A null signal is always off.
 */
export function rowAt(gens, row, t) {
    const sig = id => (id == null ? false : signalAt(gens[id], t));
    let v = sig(row.sigs[0]);
    row.gates.forEach((op, i) => {
        const b = sig(row.sigs[i + 1]);
        if (op === 'AND') v = v && b;
        else if (op === 'OR') v = v || b;
        else if (op === 'XOR') v = v !== b;
        else v = v && !b;
    });
    return v;
}

/** A drum fires when its result goes from off to on */
export const rowFires = (gens, row, t) => rowAt(gens, row, t) && !rowAt(gens, row, t - 1);

export const isSilent = row => row.sigs.every(s => s == null);

/** Shuffle resolution per drum: swing the off-beat 16ths or the off-beat 8ths */
export const SWING_UNITS = [
    { value: '8', label: '8th', ticks: TICKS_PER_STEP * 2 },
    { value: '16', label: '16th', ticks: TICKS_PER_STEP },
];

/**
 * Ticks to delay a hit by. Only hits exactly on an off-beat of the row's
 * swing unit move: with 16ths that's the "e" and "a", with 8ths the "and".
 */
export function swingTicks(t, row) {
    const unit = SWING_UNITS.find(u => u.value === row.swing).ticks;
    if (mod(t, unit * 2) !== unit) return 0;
    return (row.shuffle / 100 - 0.5) * 2 * unit;
}

export function summary(g) {
    if (g.type === 'euclid') return `E(${g.k},${g.n})` + (g.shift ? ` ↻${g.shift}` : '');
    return rateLabel(g.rate) + (g.shift ? ` +${g.shift}` : '') + (g.mode === 'gate' ? ' gate' : '');
}

/** "Repeats every …" text, from the generators the drums and accent actually use */
export function loopText(gens, rows) {
    const used = [...new Set(rows.flatMap(r => r.sigs).filter(s => s != null))];
    if (!used.length) return 'Nothing patched';

    const ticks = used.map(i => period(gens[i])).reduce((a, b) => (a * b) / gcd(a, b));
    if (ticks % TICKS_PER_BEAT) return `Repeats every ${ticks / TICKS_PER_STEP} sixteenths`;

    const beats = ticks / TICKS_PER_BEAT;
    if (beats % 4) return `Repeats every ${beats} beat${beats > 1 ? 's' : ''}`;
    return `Repeats every ${beats / 4} bar${beats > 4 ? 's' : ''}`;
}

/** Keep a generator's values in range after an edit */
export function clampGenerator(g) {
    const next = { ...g };
    next.n = Math.max(2, Math.min(EUCLID_MAX_STEPS, next.n));
    next.k = Math.max(0, Math.min(next.k, next.n));
    next.shift = Math.max(0, Math.min(next.shift, shiftMax(next)));
    if (next.type === 'euclid') next.mode = 'trig';
    return next;
}

const md = (rate, shift = 0) => ({ type: 'md', rate, shift, mode: 'trig', k: 3, n: 8 });
const row = (sig = null) => ({ sigs: [sig], gates: [], shuffle: 50, swing: '16' });

/**
 * Opens as a basic beat using triggers only; gates are left to discover.
 * Kick on 1 and 3, snare on 2 and 4, closed hat on 8ths.
 */
export function defaultPatch() {
    return {
        gens: [md(-2), md(-2, 4), md(2), md(4), md(3), md(-4)],
        // kick, snare, tom, closed hat, open hat, woodblock, accent
        rows: [row(0), row(1), row(), row(2), row(), row(), row()],
    };
}

/** Clearing keeps each drum's shuffle settings */
export const emptyRow = ({ shuffle, swing }) => ({ sigs: [null], gates: [], shuffle, swing });

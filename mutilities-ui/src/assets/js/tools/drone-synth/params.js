import { WAVEFORMS as SHAPES } from '../../core/audio.js';
import { PITCH_CLASSES, SCALES, frequency, scaleNotesInOctaves } from '../../music/theory.js';
import { SATURATION_MODES, toneFrequency } from './saturation.js';

export { SHAPES };

const VOICE_COUNT = 4;

const NOTE_OCTAVES = { from: 2, to: 5 };

export const FILTER_TYPES = [
    { value: 'lowpass', label: 'LP' },
    { value: 'highpass', label: 'HP' },
    { value: 'bandpass', label: 'BP' },
    { value: 'notch', label: 'NOTCH' },
];

// LFO rates also show how long one cycle takes, which is easier to feel
const lfoRate = (v) => {
    const seconds = 1 / v;
    const cycle = seconds >= 60 ? `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s` : `${Math.round(seconds)}s`;
    return `${v < 0.1 ? v.toFixed(3) : v.toFixed(2)} Hz · ${cycle}`;
};
const percent = (v) => `${Math.round(v * 100)} %`;
const formatHz = (hz) => (hz < 1000 ? `${Math.round(hz)} Hz` : `${(hz / 1000).toFixed(1)} kHz`);

export const RANGES = {
    volume: { label: 'Volume', min: -40, max: 0, step: 0.1, format: v => `${v.toFixed(1)} dB` },
    filterFreq: { label: 'Frequency', min: 20, max: 8000, step: 10, format: v => `${Math.round(v)} Hz` },
    filterRes: { label: 'Resonance', min: 0.1, max: 20, step: 0.1, format: v => v.toFixed(1) },
    // Log sliders: the slow end, where drones live, gets most of the travel
    filterLfoRate: { label: 'Rate', min: 0.005, max: 0.4, scale: 'log', format: lfoRate },
    filterLfoDepth: { label: 'Depth', min: 0, max: 100, step: 1, format: v => `${Math.round(v)} %` },
    ampLfoRate: { label: 'Rate', min: 0.005, max: 0.4, scale: 'log', format: lfoRate },
    // How far below the Volume setting the LFO dips; 48 dB is close to silent
    ampLfoDepth: { label: 'Depth', min: 0, max: 48, step: 0.5, format: v => `−${v.toFixed(1)} dB` },
    reverbDecay: { label: 'Decay', min: 0.5, max: 15, step: 0.1, format: v => `${v.toFixed(1)} s` },
    reverbMix: { label: 'Mix', min: 0, max: 1, step: 0.01, format: percent },
    reverbModulation: { label: 'Modulation', min: 0, max: 1, step: 0.01, format: percent },
    saturationDrive: { label: 'Drive', min: 0, max: 1, step: 0.01, format: percent },
    saturationTone: { label: 'Tone', min: 0, max: 1, step: 0.01, format: v => formatHz(toneFrequency(v)) },
    saturationMix: { label: 'Mix', min: 0, max: 1, step: 0.01, format: percent },
    textureLevel: { label: 'Level', min: 0, max: 1, step: 0.01, format: percent },
    textureTone: { label: 'Tone', min: 0, max: 1, step: 0.01, format: v => (v < 0.34 ? 'Dark' : v < 0.67 ? 'Warm' : 'Bright') },
    textureCrackle: { label: 'Crackle', min: 0, max: 1, step: 0.01, format: percent },
    textureMotion: { label: 'Motion', min: 0, max: 1, step: 0.01, format: percent },
    drift: { label: 'Drift', min: 0, max: 1, step: 0.01, format: v => (v > 0.5 ? `${Math.round(v * 100)} % · notes` : `${Math.round(v * 100)} %`) },
};

export function defaultFx() {
    return {
        reverb: { on: true, decay: 10, mix: 1, modulation: 0.35 },
        saturation: { on: false, mode: 'tube', drive: 0.5, tone: 0.6, mix: 0.5 },
    };
}

// Off by default. Crackle starts at 0: it's a specific flavour to add when wanted
export function defaultTexture() {
    return { on: false, level: 0.5, tone: 0.45, crackle: 0, motion: 0.5 };
}

export const DEFAULT_DRIFT = 0.2;

export function noteOptionsForKey(root, scaleType) {
    return scaleNotesInOctaves(root, scaleType, NOTE_OCTAVES.from, NOTE_OCTAVES.to);
}

const randomIn = (min, max) => min + Math.random() * (max - min);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// Spread evenly across orders of magnitude, so 0.01 Hz is as likely as 0.1 Hz
const logIn = (min, max) => min * (max / min) ** Math.random();

// Randomised LFOs lean slow, so the drone evolves over a minute or so rather
// than wobbling: mostly 17–200 s cycles, now and then a quicker 7–17 s one for
// movement. Each voice gets its own rate, so they drift in and out of phase.
const FAST_LFO_CHANCE = 0.1;
const slowLfoRate = () => (Math.random() < FAST_LFO_CHANCE ? logIn(0.06, 0.15) : logIn(0.005, 0.06));

// Voices start with randomised notes, filters and LFOs so every visit sounds
// a bit different. filterLfoDepth is a % of filterFreq either side;
// ampLfoDepth is dB below full level.
export function createVoices(noteOptions) {
    return Array.from({ length: VOICE_COUNT }, () => randomiseVoice({
        on: true,
        note: noteOptions[0],
        shape: 'sine',
        volume: -20,
        filterType: 'lowpass',
        filterFreq: 600,
        filterRes: 1,
        filterLfoOn: true,
        filterLfoRate: 0.2,
        filterLfoDepth: 50,
        ampLfoOn: true,
        ampLfoRate: 0.2,
        ampLfoDepth: 12,
    }, noteOptions, { keepShape: true }));
}

function weighted(weights) {
    const entries = Object.entries(weights);
    let roll = Math.random() * entries.reduce((sum, [, w]) => sum + w, 0);
    for (const [value, w] of entries) {
        roll -= w;
        if (roll < 0) return value;
    }
    return entries[0][0];
}

// A filter can only shape harmonics that are there, so Randomise leans
// heavily towards saw. Square is kept rare by taste; sine and triangle have
// (almost) no harmonics, so they're occasional too.
const SHAPE_WEIGHTS = { sine: 1, triangle: 1.2, sawtooth: 6, square: 0.8 };

// Cutoff is set relative to the voice's note, in octaves above its
// fundamental, so it always lands among that note's harmonics. Resonance means
// different things per type in Web Audio: for low/high-pass it's the height of
// the resonant peak (dB), for band-pass and notch it's how narrow the band is.
const FILTERS_RICH = {
    lowpass: { weight: 4, octaves: [0.5, 4.5], res: [1, 16] },
    bandpass: { weight: 3, octaves: [1, 4], res: [2, 10] },
    highpass: { weight: 1.5, octaves: [0.5, 3], res: [1, 12] },
    notch: { weight: 1.5, octaves: [0.5, 3.5], res: [1, 6] },
};
// Sine and triangle: keep the filter around the fundamental, where a resonant
// peak or a narrow band can still make it swell and fade as the LFO sweeps
const FILTERS_PURE = {
    lowpass: { weight: 3, octaves: [-0.3, 1.5], res: [2, 16] },
    bandpass: { weight: 1, octaves: [-0.15, 0.15], res: [1, 4] },
};

function randomFilter(note, shape) {
    const options = shape === 'sine' || shape === 'triangle' ? FILTERS_PURE : FILTERS_RICH;
    const type = weighted(Object.fromEntries(Object.entries(options).map(([t, o]) => [t, o.weight])));
    const { octaves, res } = options[type];
    const hz = frequency(note) * 2 ** randomIn(...octaves);
    return {
        filterType: type,
        filterFreq: Math.round(Math.min(RANGES.filterFreq.max, Math.max(40, hz)) / 10) * 10,
        // Skewed towards gentler settings, with the odd screamer
        filterRes: Math.round((res[0] + (res[1] - res[0]) * Math.random() ** 1.4) * 10) / 10,
    };
}

// Level and which modulators are switched on stay as the user set them.
export function randomiseVoice(voice, noteOptions, { keepShape = false } = {}) {
    const note = pick(noteOptions);
    const shape = keepShape ? voice.shape : weighted(SHAPE_WEIGHTS);
    return {
        ...voice,
        note,
        shape,
        ...randomFilter(note, shape),
        filterLfoRate: slowLfoRate(),
        filterLfoDepth: randomIn(45, 90),
        ampLfoRate: slowLfoRate(),
        // Deep enough that voices properly fade in and out
        ampLfoDepth: Math.round(randomIn(18, 42) * 2) / 2,
    };
}

export function noteForKey(note, noteOptions) {
    return noteOptions.includes(note) ? note : pick(noteOptions);
}

// ===== Importing settings =====

const clampTo = (range, value, fallback) => (
    Number.isFinite(value) ? Math.min(range.max, Math.max(range.min, value)) : fallback
);
const oneOf = (options, value, fallback) => (options.some(o => o.value === value) ? value : fallback);
const bool = (value, fallback) => (typeof value === 'boolean' ? value : fallback);

/**
 * Check an imported patch against the current state (`current` supplies the
 * fallback for anything missing or invalid). Numbers are clamped to their
 * slider ranges, choices checked against their options, and notes moved into
 * the patch's key.
 */
export function sanitizeDroneSettings(settings, current) {
    const key = {
        root: PITCH_CLASSES.includes(settings.key?.root) ? settings.key.root : current.key.root,
        scale: settings.key?.scale in SCALES ? settings.key.scale : current.key.scale,
    };
    const notes = noteOptionsForKey(key.root, key.scale);

    if (!Array.isArray(settings.voices) || settings.voices.length !== current.voices.length) {
        throw new Error('Expected four oscillators');
    }
    const voices = settings.voices.map((v, i) => {
        const was = current.voices[i];
        return {
            ...was,
            on: bool(v?.on, was.on),
            note: noteForKey(typeof v?.note === 'string' ? v.note : was.note, notes),
            shape: oneOf(SHAPES, v?.shape, was.shape),
            volume: clampTo(RANGES.volume, v?.volume, was.volume),
            filterType: oneOf(FILTER_TYPES, v?.filterType, was.filterType),
            filterFreq: clampTo(RANGES.filterFreq, v?.filterFreq, was.filterFreq),
            filterRes: clampTo(RANGES.filterRes, v?.filterRes, was.filterRes),
            filterLfoOn: bool(v?.filterLfoOn, was.filterLfoOn),
            filterLfoRate: clampTo(RANGES.filterLfoRate, v?.filterLfoRate, was.filterLfoRate),
            filterLfoDepth: clampTo(RANGES.filterLfoDepth, v?.filterLfoDepth, was.filterLfoDepth),
            ampLfoOn: bool(v?.ampLfoOn, was.ampLfoOn),
            ampLfoRate: clampTo(RANGES.ampLfoRate, v?.ampLfoRate, was.ampLfoRate),
            ampLfoDepth: clampTo(RANGES.ampLfoDepth, v?.ampLfoDepth, was.ampLfoDepth),
        };
    });

    const rv = settings.fx?.reverb ?? {};
    const sat = settings.fx?.saturation ?? {};
    const tx = settings.texture ?? {};
    const { fx, texture } = current;

    return {
        key,
        voices,
        fx: {
            reverb: {
                on: bool(rv.on, fx.reverb.on),
                decay: clampTo(RANGES.reverbDecay, rv.decay, fx.reverb.decay),
                mix: clampTo(RANGES.reverbMix, rv.mix, fx.reverb.mix),
                modulation: clampTo(RANGES.reverbModulation, rv.modulation, fx.reverb.modulation),
            },
            saturation: {
                on: bool(sat.on, fx.saturation.on),
                mode: oneOf(SATURATION_MODES, sat.mode, fx.saturation.mode),
                drive: clampTo(RANGES.saturationDrive, sat.drive, fx.saturation.drive),
                tone: clampTo(RANGES.saturationTone, sat.tone, fx.saturation.tone),
                mix: clampTo(RANGES.saturationMix, sat.mix, fx.saturation.mix),
            },
        },
        texture: {
            on: bool(tx.on, texture.on),
            level: clampTo(RANGES.textureLevel, tx.level, texture.level),
            tone: clampTo(RANGES.textureTone, tx.tone, texture.tone),
            crackle: clampTo(RANGES.textureCrackle, tx.crackle, texture.crackle),
            motion: clampTo(RANGES.textureMotion, tx.motion, texture.motion),
        },
        drift: clampTo(RANGES.drift, settings.drift, current.drift),
    };
}

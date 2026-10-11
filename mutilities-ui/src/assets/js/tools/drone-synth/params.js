import { WAVEFORMS as SHAPES } from '../../core/audio.js';
import { scaleNotesInOctaves } from '../../music/theory.js';

export { SHAPES };

const VOICE_COUNT = 4;

const NOTE_OCTAVES = { from: 2, to: 5 };

export const FILTER_TYPES = [
    { value: 'lowpass', label: 'LP' },
    { value: 'highpass', label: 'HP' },
    { value: 'bandpass', label: 'BP' },
    { value: 'notch', label: 'NOTCH' },
];

const hz = (decimals) => (v) => `${v.toFixed(decimals)} Hz`;
const percent = (v) => `${Math.round(v * 100)} %`;

export const RANGES = {
    volume: { label: 'Volume', min: -40, max: 0, step: 0.1, format: v => `${v.toFixed(1)} dB` },
    filterFreq: { label: 'Frequency', min: 20, max: 8000, step: 10, format: v => `${Math.round(v)} Hz` },
    filterRes: { label: 'Resonance', min: 0.1, max: 20, step: 0.1, format: v => v.toFixed(1) },
    filterLfoRate: { label: 'Rate', min: 0.001, max: 0.4, step: 0.001, format: hz(3) },
    filterLfoDepth: { label: 'Depth', min: 0, max: 100, step: 1, format: v => `${Math.round(v)} %` },
    ampLfoRate: { label: 'Rate', min: 0.001, max: 0.4, step: 0.001, format: hz(3) },
    ampLfoDepth: { label: 'Depth', min: 0, max: 24, step: 0.1, format: v => `${v.toFixed(1)} dB` },
    reverbDecay: { label: 'Decay', min: 0.5, max: 15, step: 0.1, format: v => `${v.toFixed(1)} s` },
    reverbMix: { label: 'Mix', min: 0, max: 1, step: 0.01, format: percent },
    distortionAmount: { label: 'Amount', min: 0, max: 1, step: 0.01, format: percent },
    distortionMix: { label: 'Mix', min: 0, max: 1, step: 0.01, format: percent },
};

export function defaultFx() {
    return {
        reverb: { on: true, decay: 10, mix: 1 },
        distortion: { on: false, amount: 0.5, mix: 0.5 },
    };
}

export function noteOptionsForKey(root, scaleType) {
    return scaleNotesInOctaves(root, scaleType, NOTE_OCTAVES.from, NOTE_OCTAVES.to);
}

const randomIn = (min, max) => min + Math.random() * (max - min);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

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

// Level, filter type and which modulators are switched on stay as the user
// set them.
export function randomiseVoice(voice, noteOptions, { keepShape = false } = {}) {
    return {
        ...voice,
        note: pick(noteOptions),
        shape: keepShape ? voice.shape : pick(SHAPES).value,
        filterFreq: Math.round(randomIn(300, 1000)),
        filterLfoRate: randomIn(0.001, 0.4),
        filterLfoDepth: randomIn(20, 80),
        ampLfoRate: randomIn(0.001, 0.4),
        ampLfoDepth: randomIn(6, 18),
    };
}

export function noteForKey(note, noteOptions) {
    return noteOptions.includes(note) ? note : pick(noteOptions);
}

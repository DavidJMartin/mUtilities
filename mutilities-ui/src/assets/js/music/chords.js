// Chord types and the chords that fit a key. Pure functions only.

import { pitchClassIndex, scalePitchClasses, transpose } from './theory.js';

// Chord tones are written as scale degrees; this maps each to semitones
const TONE_SEMITONES = {
    '1': 0, '♭2': 1, '2': 2, '♭3': 3, '3': 4, '4': 5, '♭5': 6,
    '5': 7, '♯5': 8, '6': 9, '𝄫7': 9, '♭7': 10, '7': 11, '9': 2,
};

export const CHORD_GROUPS = [
    { value: 'all', label: 'ALL' },
    { value: 'triad', label: 'TRIADS' },
    { value: 'seventh', label: '7THS' },
    { value: 'colour', label: 'SUS & ADD' },
];

export const CHORD_TYPES = [
    { id: 'maj', symbol: '', group: 'triad', tones: ['1', '3', '5'] },
    { id: 'min', symbol: 'm', group: 'triad', tones: ['1', '♭3', '5'] },
    { id: 'dim', symbol: 'dim', group: 'triad', tones: ['1', '♭3', '♭5'] },
    { id: 'aug', symbol: 'aug', group: 'triad', tones: ['1', '3', '♯5'] },
    { id: 'maj7', symbol: 'maj7', group: 'seventh', tones: ['1', '3', '5', '7'] },
    { id: 'dom7', symbol: '7', group: 'seventh', tones: ['1', '3', '5', '♭7'] },
    { id: 'min7', symbol: 'm7', group: 'seventh', tones: ['1', '♭3', '5', '♭7'] },
    { id: 'minMaj7', symbol: 'm(maj7)', group: 'seventh', tones: ['1', '♭3', '5', '7'] },
    { id: 'halfDim7', symbol: 'm7♭5', group: 'seventh', tones: ['1', '♭3', '♭5', '♭7'] },
    { id: 'dim7', symbol: 'dim7', group: 'seventh', tones: ['1', '♭3', '♭5', '𝄫7'] },
    { id: 'sus2', symbol: 'sus2', group: 'colour', tones: ['1', '2', '5'] },
    { id: 'sus4', symbol: 'sus4', group: 'colour', tones: ['1', '4', '5'] },
    { id: '7sus4', symbol: '7sus4', group: 'colour', tones: ['1', '4', '5', '♭7'] },
    { id: 'add9', symbol: 'add9', group: 'colour', tones: ['1', '3', '5', '9'] },
    { id: 'minAdd9', symbol: 'm(add9)', group: 'colour', tones: ['1', '♭3', '5', '9'] },
    { id: 'maj6', symbol: '6', group: 'colour', tones: ['1', '3', '5', '6'] },
    { id: 'min6', symbol: 'm6', group: 'colour', tones: ['1', '♭3', '5', '6'] },
    { id: 'power', symbol: '5', group: 'colour', tones: ['1', '5'] },
];

const TYPES_BY_ID = Object.fromEntries(CHORD_TYPES.map(t => [t.id, t]));

// Numerals by semitones above the key root, so they work for any scale
const NUMERALS = ['I', '♭II', 'II', '♭III', 'III', 'IV', '♯IV', 'V', '♭VI', 'VI', '♭VII', 'VII'];

export function chordId(root, typeId) {
    return `${root}|${typeId}`;
}

export function chordName(root, typeId) {
    return root + TYPES_BY_ID[typeId].symbol;
}

/** The chord's tones with their pitch classes, e.g. [{ label: '1', pc: 'C' }, ...] */
export function chordTones(root, typeId) {
    return TYPES_BY_ID[typeId].tones.map(label => ({ label, pc: transpose(root, TONE_SEMITONES[label]) }));
}

/** e.g. 'ii' for D minor in C major; null if the chord's root isn't in the key */
export function romanNumeral(keyRoot, root, typeId) {
    const semitones = (pitchClassIndex(root) - pitchClassIndex(keyRoot) + 12) % 12;
    const tones = TYPES_BY_ID[typeId].tones;
    let numeral = NUMERALS[semitones];
    if (tones.includes('♭3')) numeral = numeral.toLowerCase();
    if (typeId === 'dim' || typeId === 'dim7') numeral += '°';
    if (typeId === 'halfDim7') numeral += 'ø';
    if (typeId === 'aug') numeral += '+';
    return numeral;
}

// Pentatonic and blues scales are melodic: the chords played under them come
// from the key they're drawn from, plus the dominant 7ths of a 12-bar blues
// (I7, IV7, V7), even though those use notes the scale itself doesn't.
const HARMONY_SOURCES = {
    pentatonicMinor: { scale: 'minor', dominants: [0, 5, 7] },
    blues: { scale: 'minor', dominants: [0, 5, 7] },
    pentatonicMajor: { scale: 'major', dominants: [0, 5, 7] },
};

function harmonyFor(keyRoot, scaleType) {
    const source = HARMONY_SOURCES[scaleType];
    const scale = scalePitchClasses(keyRoot, scaleType);
    const parent = source ? scalePitchClasses(keyRoot, source.scale) : scale;
    const fromRoot = pc => (pitchClassIndex(pc) - pitchClassIndex(keyRoot) + 12) % 12;
    return {
        roots: [...new Set([...scale, ...parent])].sort((a, b) => fromRoot(a) - fromRoot(b)),
        noteSets: [new Set(scale), new Set(parent)],
        dominantRoots: new Set((source?.dominants ?? []).map(s => transpose(keyRoot, s))),
    };
}

// A chord fits if it's built entirely from the scale, or entirely from its
// parent key, or is one of the blues dominants
function fits(harmony, root, typeId) {
    const tones = chordTones(root, typeId);
    return harmony.noteSets.some(notes => tones.every(tone => notes.has(tone.pc)))
        || (typeId === 'dom7' && harmony.dominantRoots.has(root));
}

/**
 * The chords that work in a key, grouped by root:
 * [{ root, degree, chords: [{ id, root, type, name, outside }] }]
 * `outside` lists any chord notes the scale itself doesn't contain.
 */
export function chordsInKey(keyRoot, scaleType, group = 'all') {
    const harmony = harmonyFor(keyRoot, scaleType);
    return harmony.roots.map(root => {
        const chords = CHORD_TYPES
            .filter(t => group === 'all' || t.group === group)
            .filter(t => fits(harmony, root, t.id))
            .map(t => ({
                id: chordId(root, t.id),
                root,
                type: t.id,
                name: chordName(root, t.id),
                outside: notesOutsideScale(keyRoot, scaleType, root, t.id),
            }));
        const degree = NUMERALS[(pitchClassIndex(root) - pitchClassIndex(keyRoot) + 12) % 12];
        return { root, degree, chords };
    }).filter(row => row.chords.length > 0);
}

export function chordFitsKey(keyRoot, scaleType, root, typeId) {
    return fits(harmonyFor(keyRoot, scaleType), root, typeId);
}

export function notesOutsideScale(keyRoot, scaleType, root, typeId) {
    const scale = new Set(scalePitchClasses(keyRoot, scaleType));
    return chordTones(root, typeId).map(t => t.pc).filter(pc => !scale.has(pc));
}

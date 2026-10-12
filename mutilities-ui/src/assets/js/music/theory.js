// Pure functions only (no DOM or audio).
//   pitch class (pc): a note name without octave, using sharps: 'C', 'C#'
//   note: a pitch class with an octave, written as an id like 'C#4'

export const PITCH_CLASSES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const ENHARMONIC_NAMES = {
    'C': 'C', 'C#': 'C#/Db', 'D': 'D', 'D#': 'D#/Eb', 'E': 'E', 'F': 'F',
    'F#': 'F#/Gb', 'G': 'G', 'G#': 'G#/Ab', 'A': 'A', 'A#': 'A#/Bb', 'B': 'B',
};

export const SCALES = {
    major: { name: 'Major', intervals: [0, 2, 4, 5, 7, 9, 11] },
    minor: { name: 'Natural Minor', intervals: [0, 2, 3, 5, 7, 8, 10] },
    harmonicMinor: { name: 'Harmonic Minor', intervals: [0, 2, 3, 5, 7, 8, 11] },
    melodicMinor: { name: 'Melodic Minor', intervals: [0, 2, 3, 5, 7, 9, 11] },
    dorian: { name: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10] },
    phrygian: { name: 'Phrygian', intervals: [0, 1, 3, 5, 7, 8, 10] },
    lydian: { name: 'Lydian', intervals: [0, 2, 4, 6, 7, 9, 11] },
    mixolydian: { name: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10] },
    locrian: { name: 'Locrian', intervals: [0, 1, 3, 5, 6, 8, 10] },
    pentatonicMajor: { name: 'Pentatonic Major', intervals: [0, 2, 4, 7, 9] },
    pentatonicMinor: { name: 'Pentatonic Minor', intervals: [0, 3, 5, 7, 10] },
    blues: { name: 'Blues', intervals: [0, 3, 5, 6, 7, 10] },
};

// High string first, as tab is written
export const GUITAR_STRINGS = [
    { name: 'e', pc: 'E', octave: 4 },
    { name: 'B', pc: 'B', octave: 3 },
    { name: 'G', pc: 'G', octave: 3 },
    { name: 'D', pc: 'D', octave: 3 },
    { name: 'A', pc: 'A', octave: 2 },
    { name: 'E', pc: 'E', octave: 2 },
];

export function pitchClassIndex(pc) {
    return PITCH_CLASSES.indexOf(pc);
}

export function isBlackKey(pc) {
    return pc.includes('#');
}

export function transpose(pc, semitones) {
    return PITCH_CLASSES[(pitchClassIndex(pc) + semitones + 120) % 12];
}

export function scalePitchClasses(root, scaleType) {
    const scale = SCALES[scaleType];
    return scale ? scale.intervals.map(i => transpose(root, i)) : [];
}

export function keyName(root, scaleType) {
    return `${root} ${SCALES[scaleType].name}`;
}

export function sortPitchClasses(pcs) {
    return [...pcs].sort((a, b) => pitchClassIndex(a) - pitchClassIndex(b));
}

const INTERVAL_LABELS = ['Root', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'];

/** Interval of each scale note from the root, e.g. blues: Root ♭3 4 ♭5 5 ♭7 */
export function scaleDegreeLabels(scaleType) {
    const { intervals } = SCALES[scaleType];
    return intervals.map(semitones => {
        // Six semitones is a ♯4 in scales without a natural 4th (Lydian)
        if (semitones === 6 && !intervals.includes(5)) return '♯4';
        return INTERVAL_LABELS[semitones];
    });
}

/** Every key (root + scale type) that contains all the given pitch classes */
export function findMatchingKeys(pcs) {
    const wanted = [...pcs];
    if (wanted.length === 0) return [];

    const matches = [];
    for (const root of PITCH_CLASSES) {
        for (const type of Object.keys(SCALES)) {
            const inScale = new Set(scalePitchClasses(root, type));
            if (wanted.every(pc => inScale.has(pc))) {
                matches.push({ id: keyId(root, type), root, type, name: keyName(root, type) });
            }
        }
    }
    return matches;
}

export function keyId(root, type) {
    return `${root}|${type}`;
}

/** Shifts that take a sample recorded in fromPc to toPc, e.g. { down: -5, up: 7 } */
export function semitoneShifts(fromPc, toPc) {
    const up = (pitchClassIndex(toPc) - pitchClassIndex(fromPc) + 12) % 12;
    return up === 0 ? { down: 0, up: 0 } : { down: up - 12, up };
}

function noteId(pc, octave) {
    return `${pc}${octave}`;
}

export function parseNote(id) {
    const match = /^([A-G]#?)(-?\d+)$/.exec(id);
    if (!match) throw new Error(`Invalid note: ${id}`);
    return { pc: match[1], octave: Number(match[2]) };
}

// C4 = 60
export function midiNumber(pc, octave) {
    return (octave + 1) * 12 + pitchClassIndex(pc);
}

// A4 = 440 Hz
export function frequency(noteIdString) {
    const { pc, octave } = parseNote(noteIdString);
    return 440 * Math.pow(2, (midiNumber(pc, octave) - 69) / 12);
}

/** Every note from `from` to `to` inclusive, e.g. noteRange('C3', 'B4') */
export function noteRange(from, to) {
    const start = parseNote(from);
    const end = parseNote(to);
    const first = midiNumber(start.pc, start.octave);
    const last = midiNumber(end.pc, end.octave);

    const notes = [];
    for (let midi = first; midi <= last; midi++) {
        const pc = PITCH_CLASSES[midi % 12];
        const octave = Math.floor(midi / 12) - 1;
        notes.push({ id: noteId(pc, octave), pc, octave });
    }
    return notes;
}

export function scaleNotesInOctaves(root, scaleType, fromOctave, toOctave) {
    const inScale = new Set(scalePitchClasses(root, scaleType));
    const notes = [];
    for (let octave = fromOctave; octave <= toOctave; octave++) {
        for (const pc of PITCH_CLASSES) {
            if (inScale.has(pc)) notes.push(noteId(pc, octave));
        }
    }
    return notes;
}

export function rootOptions() {
    return PITCH_CLASSES.map(pc => ({ value: pc, label: pc }));
}

export function scaleOptions() {
    return Object.entries(SCALES).map(([value, scale]) => ({ value, label: scale.name }));
}

/**
 * Music Theory Constants and Helper Functions
 * Contains core music data structures and utility functions for note/scale calculations
 */

// ===== Music Theory Constants =====
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const NOTE_NAMES = {
    'C': 'C', 'C#': 'C#/Db', 'D': 'D', 'D#': 'D#/Eb', 'E': 'E', 'F': 'F',
    'F#': 'F#/Gb', 'G': 'G', 'G#': 'G#/Ab', 'A': 'A', 'A#': 'A#/Bb', 'B': 'B'
};

// Scale intervals (semitones from root)
const SCALES = {
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
    blues: { name: 'Blues', intervals: [0, 3, 5, 6, 7, 10] }
};

// Guitar string tuning (standard tuning: E A D G B E)
const GUITAR_STRINGS = [
    { note: 'E', octave: 4, name: 'e' },  // high E
    { note: 'B', octave: 3, name: 'B' },
    { note: 'G', octave: 3, name: 'G' },
    { note: 'D', octave: 3, name: 'D' },
    { note: 'A', octave: 2, name: 'A' },
    { note: 'E', octave: 2, name: 'E' }   // low E
];

// MIDI note number mapping (C4 = 60, etc.)
const MIDI_BASE = { 'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11 };

// ===== Helper Functions =====

/**
 * Get the index of a note in the chromatic scale
 * @param {string} note - Note name (e.g., 'C', 'C#')
 * @returns {number} Index from 0-11
 */
function getNoteIndex(note) {
    return NOTES.indexOf(note);
}

/**
 * Get the note at a given interval from a root note
 * @param {string} rootNote - The starting note
 * @param {number} semitones - Number of semitones to transpose
 * @returns {string} The resulting note name
 */
function getNoteAtInterval(rootNote, semitones) {
    const rootIndex = getNoteIndex(rootNote);
    return NOTES[(rootIndex + semitones) % 12];
}

/**
 * Get all notes in a scale
 * @param {string} rootNote - The root note of the scale
 * @param {string} scaleType - The type of scale (e.g., 'major', 'minor')
 * @returns {string[]} Array of note names in the scale
 */
function getScaleNotes(rootNote, scaleType) {
    const scale = SCALES[scaleType];
    if (!scale) return [];
    return scale.intervals.map(interval => getNoteAtInterval(rootNote, interval));
}

/**
 * Normalize a note name (convert flats to sharps)
 * @param {string} note - Note name that may include flats
 * @returns {string} Normalized note name using sharps
 */
function normalizeNote(note) {
    const flatToSharp = {
        'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#',
        'Ab': 'G#', 'Bb': 'A#', 'Cb': 'B'
    };
    return flatToSharp[note] || note;
}

/**
 * Get MIDI note number for a note and octave
 * @param {string} note - Note name
 * @param {number} octave - Octave number
 * @returns {number} MIDI note number
 */
function getMidiNoteNumber(note, octave) {
    return (octave + 1) * 12 + MIDI_BASE[note];
}

/**
 * Get MIDI note numbers for a pitch class across common octaves
 * @param {string} pitchClass - The pitch class (note name)
 * @returns {number[]} Array of MIDI note numbers for octaves 2-5
 */
function getMidiNotesForPitchClass(pitchClass) {
    const midiNotes = [];
    for (let octave = 2; octave <= 5; octave++) {
        midiNotes.push(getMidiNoteNumber(pitchClass, octave));
    }
    return midiNotes;
}

/**
 * Find all possible keys that contain the given notes
 * @param {Set<string>} notes - Set of note names
 * @returns {Array<{root: string, type: string, name: string}>} Array of matching keys
 */
function findPossibleKeys(notes) {
    if (notes.size === 0) return [];
    
    const normalizedNotes = new Set([...notes].map(normalizeNote));
    const possibleKeys = [];
    
    for (const root of NOTES) {
        for (const [scaleType, scale] of Object.entries(SCALES)) {
            const scaleNotes = new Set(getScaleNotes(root, scaleType));
            
            // Check if all selected notes are in this scale
            let allNotesInScale = true;
            for (const note of normalizedNotes) {
                if (!scaleNotes.has(note)) {
                    allNotesInScale = false;
                    break;
                }
            }
            
            if (allNotesInScale) {
                possibleKeys.push({
                    root: root,
                    type: scaleType,
                    name: `${NOTE_NAMES[root]} ${scale.name}`
                });
            }
        }
    }
    
    return possibleKeys;
}

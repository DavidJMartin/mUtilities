// Guitar fingerings for a chord, in two tiers:
//   1. Standard shapes guitarists already know (the open E, A, C, G and D
//      families), written as tab at their home key and slid up the neck. At
//      their home fret they're the open chord; moved up, the open strings
//      become a barre (the classic E- and A-shape barre chords).
//   2. A fretboard search for anything the library doesn't cover, plus a few
//      extra fingerings after the standard ones. Every candidate is built from
//      the real pitch of each string, so open strings only appear when they
//      belong to the chord.

import { GUITAR_STRINGS, midiNumber, pitchClassIndex, transpose } from './theory.js';

const STRINGS_LOW_TO_HIGH = [...GUITAR_STRINGS].reverse();
const MAX_FRET = 15;
const MAX_STRETCH = 3; // frets between the lowest and highest fretted note
const MAX_FINGERS = 4;
const MAX_EXTRA = 4; // search results shown after the standard shapes
const MAX_SEARCH_ONLY = 8; // search results when there's no standard shape

// [home key, tab at that key], low E to high e
const SHAPES = {
    maj: [['E', '022100'], ['A', 'x02220'], ['C', 'x32010'], ['C', 'x3201x'], ['G', '320003'], ['D', 'xx0232']],
    min: [['E', '022000'], ['A', 'x02210'], ['D', 'xx0231']],
    dom7: [['E', '020100'], ['A', 'x02020'], ['C', 'x32310'], ['G', '320001'], ['D', 'xx0212']],
    maj7: [['E', '021100'], ['A', 'x02120'], ['C', 'x32000'], ['D', 'xx0222']],
    min7: [['E', '020000'], ['A', 'x02010'], ['D', 'xx0211']],
    minMaj7: [['E', '021000'], ['A', 'x02110']],
    halfDim7: [['B', 'x2323x']],
    dim7: [['D', 'xx0101']],
    dim: [['A', 'x0121x']],
    aug: [['C', 'x3211x']],
    sus2: [['A', 'x02200'], ['D', 'xx0230']],
    sus4: [['E', '022200'], ['A', 'x02230'], ['D', 'xx0233']],
    '7sus4': [['E', '020200'], ['A', 'x02030'], ['D', 'xx0213']],
    add9: [['E', '024100'], ['C', 'x32030']],
    minAdd9: [['E', '024000']],
    maj6: [['E', '022120'], ['A', 'x02222'], ['D', 'xx0202']],
    min6: [['E', '022020'], ['A', 'x02212'], ['D', 'xx0201']],
    power: [['E', '022xxx'], ['A', 'x022xx']],
};

/**
 * @param {string} root
 * @param {string} typeId  a CHORD_TYPES id
 * @param {Array<{label: string, pc: string}>} tones  from chordTones()
 * @returns {Array<{frets: (number|null)[], labels: (string|null)[], midi: number[],
 *                  baseFret: number, barre: {fret: number, from: number, to: number}|null}>}
 *   standard shapes first (from the nut up), then extras; arrays run low E to
 *   high e, null = muted
 */
export function findVoicings(root, typeId, tones) {
    const context = {
        root,
        labelFor: new Map(tones.map(t => [t.pc, t.label])),
        // Guitarists usually drop the 5th from four-note chords
        required: tones.filter(t => !(tones.length >= 4 && t.label === '5')).map(t => t.pc),
        minStrings: tones.length <= 2 ? 2 : 4,
    };

    const standard = standardShapes(typeId, context);
    const searched = searchFretboard(context)
        .filter(v => !standard.some(s => isSameOrPartial(v, s)))
        // Open strings under a shape high up the neck are rarely comfortable
        .filter(v => !(v.position >= 3 && v.frets.includes(0)))
        .slice(0, standard.length ? MAX_EXTRA : MAX_SEARCH_ONLY);

    return [...standard, ...searched];
}

function standardShapes(typeId, context) {
    const rootIndex = pitchClassIndex(context.root);
    const voicings = [];
    for (const [shapeRoot, tab] of SHAPES[typeId] ?? []) {
        const template = parseTab(tab);
        const shift = (rootIndex - pitchClassIndex(shapeRoot) + 12) % 12;
        const frets = template.map(f => (f === null ? null : f + shift));
        if (Math.max(...frets.filter(f => f !== null)) > MAX_FRET) continue;
        const voicing = evaluate(frets, context);
        if (!voicing) continue;
        voicings.push(voicing);
    }
    return voicings.sort((a, b) => a.position - b.position);
}

function searchFretboard(context) {
    const found = new Map();
    for (let start = 1; start + MAX_STRETCH <= MAX_FRET; start++) {
        const options = STRINGS_LOW_TO_HIGH.map(string => {
            const choices = [null];
            if (context.labelFor.has(string.pc)) choices.push(0);
            for (let fret = start; fret <= start + MAX_STRETCH; fret++) {
                if (context.labelFor.has(transpose(string.pc, fret))) choices.push(fret);
            }
            return choices;
        });

        for (const frets of combinations(options)) {
            const key = frets.join(',');
            if (found.has(key)) continue;
            const voicing = evaluate(frets, context);
            if (voicing) found.set(key, voicing);
        }
    }

    // Drop shapes that are just a better shape with outer strings left out
    const kept = [];
    for (const voicing of [...found.values()].sort((a, b) => a.score - b.score)) {
        if (!kept.some(better => isSameOrPartial(voicing, better))) kept.push(voicing);
    }
    return kept;
}

function isSameOrPartial(voicing, other) {
    return voicing.frets.every((f, i) => f === null || f === other.frets[i]);
}

function parseTab(tab) {
    return [...tab].map(c => (c === 'x' ? null : Number(c)));
}

function* combinations(options, index = 0, current = []) {
    if (index === options.length) {
        yield [...current];
        return;
    }
    for (const choice of options[index]) {
        current.push(choice);
        yield* combinations(options, index + 1, current);
        current.pop();
    }
}

function evaluate(frets, { root, labelFor, required, minStrings }) {
    const sounded = frets.flatMap((fret, i) => (fret === null ? [] : [i]));
    if (sounded.length < minStrings) return null;

    // Sounding strings must be next to each other so the chord can be strummed
    if (sounded[sounded.length - 1] - sounded[0] + 1 !== sounded.length) return null;

    const pcs = frets.map((fret, i) => (fret === null ? null : transpose(STRINGS_LOW_TO_HIGH[i].pc, fret)));
    if (pcs[sounded[0]] !== root) return null;
    if (!required.every(pc => pcs.includes(pc))) return null;

    const fretted = sounded.filter(i => frets[i] > 0);
    const fretValues = fretted.map(i => frets[i]);
    const minFret = fretted.length ? Math.min(...fretValues) : 0;
    const maxFret = fretted.length ? Math.max(...fretValues) : 0;
    if (maxFret - minFret > MAX_STRETCH) return null;

    // With more fretted notes than fingers, one finger has to barre the lowest
    // fret, which only works if nothing between those strings is open
    const atMin = fretted.filter(i => frets[i] === minFret);
    const barreFrom = atMin[0];
    const barreTo = atMin[atMin.length - 1];
    const needsBarre = fretted.length > MAX_FINGERS;
    if (needsBarre) {
        const canBarre = atMin.length >= 2 && frets.slice(barreFrom, barreTo + 1).every(f => f === null || f >= minFret);
        if (!canBarre || 1 + fretted.length - atMin.length > MAX_FINGERS) return null;
    }
    const fingers = needsBarre ? 1 + fretted.length - atMin.length : fretted.length;

    const open = sounded.length - fretted.length;
    const muted = frets.length - sounded.length;
    const hasFifth = [...labelFor].some(([pc, label]) => label === '5' && pcs.includes(pc));
    // Lower is friendlier. Open strings help near the nut but are awkward
    // when the rest of the shape is high up the neck.
    const openWeight = minFret >= 3 ? 1 : -0.4;
    const score = minFret * 0.6 + muted * 1.2 + (maxFret - minFret) * 0.8 + fingers * 0.3
        + open * openWeight + (needsBarre ? 0.5 : 0) + (hasFifth ? 0 : 0.8);

    return {
        frets,
        labels: pcs.map(pc => (pc === null ? null : labelFor.get(pc))),
        midi: sounded.map(i => midiNumber(STRINGS_LOW_TO_HIGH[i].pc, STRINGS_LOW_TO_HIGH[i].octave) + frets[i]),
        baseFret: maxFret <= 4 ? 1 : minFret,
        barre: needsBarre ? { fret: minFret, from: barreFrom, to: barreTo } : null,
        position: minFret,
        score,
    };
}

/** e.g. 'x32010' (two-digit frets are separated by dashes: 'x-10-12-12-11-x') */
export function tabString(frets) {
    const parts = frets.map(f => (f === null ? 'x' : String(f)));
    return parts.some(p => p.length > 1) ? parts.join('-') : parts.join('');
}

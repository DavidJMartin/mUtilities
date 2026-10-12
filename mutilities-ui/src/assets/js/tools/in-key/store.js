// The page is driven by two things: the selected pitch classes, and a
// previewed key (set from the Possible keys chips or the Root / Scale
// dropdowns, which are two views of the same thing). Picking a note clears
// the preview, since it was a suggestion based on the old selection.

import {
    findMatchingKeys,
    keyId,
    keyName,
    scalePitchClasses,
    sortPitchClasses,
} from '../../music/theory.js';
import { chordId } from '../../music/chords.js';

// Above this many matches the list isn't useful, so ask for more notes
const MAX_LISTED_KEYS = 26;

export function createInKeyStore() {
    let state = {
        selected: new Set(),
        preview: null, // { root, type } | null
        sampleKey: 'C',
        chordGroup: 'all',
        chords: [], // [{ id, root, type, voicing }] in the order picked; voicing indexes the fingerings
    };
    const listeners = new Set();

    const update = (patch) => {
        state = { ...state, ...patch };
        listeners.forEach(fn => fn(state));
    };

    return {
        getState: () => state,

        subscribe(fn) {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },

        toggleNote(pc) {
            const selected = new Set(state.selected);
            if (selected.has(pc)) {
                selected.delete(pc);
            } else {
                selected.add(pc);
            }
            update({ selected, preview: null });
        },

        togglePreview(root, type) {
            const same = state.preview && state.preview.root === root && state.preview.type === type;
            update({ preview: same ? null : { root, type } });
        },

        setPreview(root, type) {
            update({ preview: root && type ? { root, type } : null });
        },

        setSampleKey(pc) {
            update({ sampleKey: pc });
        },

        clear() {
            update({ selected: new Set(), preview: null });
        },

        setChordGroup(group) {
            update({ chordGroup: group });
        },

        toggleChord(root, type) {
            const id = chordId(root, type);
            const chords = state.chords.some(c => c.id === id)
                ? state.chords.filter(c => c.id !== id)
                : [...state.chords, { id, root, type, voicing: 0 }];
            update({ chords });
        },

        removeChord(id) {
            update({ chords: state.chords.filter(c => c.id !== id) });
        },

        /** Step through a chord's fingerings, wrapping at either end */
        stepVoicing(id, delta, count) {
            update({
                chords: state.chords.map(c => (c.id === id ? { ...c, voicing: (c.voicing + delta + count) % count } : c)),
            });
        },

        clearChords() {
            update({ chords: [] });
        },
    };
}

/** Everything the view needs, derived from state in one place */
export function deriveView(state) {
    const { selected, preview } = state;

    const previewPcs = preview ? scalePitchClasses(preview.root, preview.type) : [];
    const previewOnly = new Set(previewPcs.filter(pc => !selected.has(pc)));

    const noteState = (pc) => (selected.has(pc) ? 'selected' : previewOnly.has(pc) ? 'preview' : null);

    const matches = findMatchingKeys(selected);

    return {
        noteState,
        shownNotes: sortPitchClasses([...selected, ...previewOnly]),
        matches,
        tooManyMatches: matches.length > MAX_LISTED_KEYS,
        preview: preview && {
            id: keyId(preview.root, preview.type),
            name: keyName(preview.root, preview.type),
            type: preview.type,
            pitchClasses: previewPcs,
        },
    };
}

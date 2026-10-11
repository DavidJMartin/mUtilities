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

// Above this many matches the list isn't useful, so ask for more notes
const MAX_LISTED_KEYS = 26;

export function createInKeyStore() {
    let state = {
        selected: new Set(),
        preview: null, // { root, type } | null
        sampleKey: 'C',
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
            pitchClasses: previewPcs,
        },
    };
}

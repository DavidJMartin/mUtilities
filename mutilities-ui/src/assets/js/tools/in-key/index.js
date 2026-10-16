import { el, refs, setOptions } from '../../core/dom.js';
import { MEDIA, watchMedia } from '../../core/media.js';
import { createKeyboard } from '../../components/keyboard.js';
import { createFretboard } from '../../components/fretboard.js';
import {
    ENHARMONIC_NAMES,
    PITCH_CLASSES,
    SCALES,
    scaleDegreeLabels,
    rootOptions,
    scaleOptions,
    semitoneShifts,
} from '../../music/theory.js';
import { createInKeyStore, deriveView } from './store.js';
import { createPatchMenu } from '../../components/patch-menu.js';
import { CHORD_GROUPS, CHORD_TYPES, chordId } from '../../music/chords.js';
import { initChordsView } from './chords-view.js';

const PIANO_RANGES = {
    wide: { from: 'C3', to: 'B4', showOctave: true, meta: 'C3 – B4' },
    compact: { from: 'C4', to: 'B4', showOctave: false, meta: 'One octave · C – B' },
};

const EMPTY_OPTION = { value: '', label: '—' };

export function initInKey(root) {
    const r = refs(root);
    const store = createInKeyStore();
    const chordsView = initChordsView(r, store);

    setOptions(r.root, [EMPTY_OPTION, ...rootOptions()], '');
    setOptions(r.scale, [EMPTY_OPTION, ...scaleOptions()], '');
    setOptions(r.sampleKey, PITCH_CLASSES.map(pc => ({ value: pc, label: `in ${pc}` })), 'C');

    r.guitar.append(createFretboard());

    watchMedia(MEDIA.compact, (compact) => {
        const range = compact ? PIANO_RANGES.compact : PIANO_RANGES.wide;
        r.piano.replaceChildren(createKeyboard({ ...range, label: 'Piano keyboard, select notes' }));
        r.pianoRange.textContent = range.meta;
        render(store.getState());
    });

    const onInstrumentClick = (event) => {
        const target = event.target.closest('[data-pc]');
        if (target) store.toggleNote(target.dataset.pc);
    };
    r.piano.addEventListener('click', onInstrumentClick);
    r.guitar.addEventListener('click', onInstrumentClick);

    const onKeySelect = () => store.setPreview(r.root.value, r.scale.value);
    r.root.addEventListener('change', onKeySelect);
    r.scale.addEventListener('change', onKeySelect);

    r.keys.addEventListener('click', (event) => {
        const chip = event.target.closest('[data-root]');
        if (chip) store.togglePreview(chip.dataset.root, chip.dataset.type);
    });

    r.sampleKey.addEventListener('change', () => store.setSampleKey(r.sampleKey.value));

    // Export / import the selection, previewed key and chord progression
    r.patch.append(createPatchMenu({
        tool: 'in-key-assistance',
        version: 1,
        getSettings: () => {
            const { selected, preview, sampleKey, chordGroup, chords } = store.getState();
            return {
                selected: [...selected],
                preview,
                sampleKey,
                chordGroup,
                chords: chords.map(({ root, type, voicing }) => ({ root, type, voicing })),
            };
        },
        applySettings: (settings) => {
            const pc = value => PITCH_CLASSES.includes(value);
            const preview = settings.preview && pc(settings.preview.root) && settings.preview.type in SCALES
                ? { root: settings.preview.root, type: settings.preview.type }
                : null;
            const chords = (Array.isArray(settings.chords) ? settings.chords : [])
                .filter(c => pc(c?.root) && CHORD_TYPES.some(t => t.id === c.type))
                .map(({ root, type, voicing }) => {
                    const chord = { id: chordId(root, type), root, type, voicing: 0 };
                    const count = chordsView.voicingCount(chord);
                    chord.voicing = Number.isInteger(voicing) && voicing >= 0 && voicing < count ? voicing : 0;
                    return chord;
                })
                .filter((c, i, all) => all.findIndex(o => o.id === c.id) === i);

            const sampleKey = pc(settings.sampleKey) ? settings.sampleKey : 'C';
            r.sampleKey.value = sampleKey;
            store.load({
                selected: (Array.isArray(settings.selected) ? settings.selected : []).filter(pc),
                preview,
                sampleKey,
                chordGroup: CHORD_GROUPS.some(g => g.value === settings.chordGroup) ? settings.chordGroup : 'all',
                chords,
            });
        },
    }));
    r.clear.addEventListener('click', () => {
        r.root.value = '';
        r.scale.value = '';
        store.clear();
    });

    function render(state) {
        const view = deriveView(state);
        chordsView.render(state);
        renderInstruments(view);
        renderKeyControls(state, view);
        renderPossibleKeys(state, view);
        renderScale(view);
        renderTranspose(state, view);
    }

    function renderInstruments(view) {
        root.querySelectorAll('.keyboard [data-pc], .fretboard [data-pc]').forEach(node => {
            const noteState = view.noteState(node.dataset.pc);
            if (noteState) {
                node.dataset.state = noteState;
            } else {
                delete node.dataset.state;
            }
            node.setAttribute('aria-pressed', String(noteState === 'selected'));
        });
    }

    function renderKeyControls(state, view) {
        if (state.preview) {
            r.root.value = state.preview.root;
            r.scale.value = state.preview.type;
        } else if (r.root.value && r.scale.value) {
            // The preview was cleared elsewhere. A half-chosen pair (root but
            // no scale yet) is left alone so the user can finish choosing.
            r.root.value = '';
            r.scale.value = '';
        }
        r.lcd.textContent = view.preview ? view.preview.name.toUpperCase() : '— — —';
    }

    function renderPossibleKeys(state, view) {
        const count = state.selected.size;
        r.keyCount.textContent = count === 0
            ? 'select notes'
            : view.tooManyMatches
                ? 'select more notes'
                : `${view.matches.length} match${view.matches.length === 1 ? '' : 'es'}`;

        if (count === 0 || view.tooManyMatches) {
            r.keys.replaceChildren(el('p', {
                class: 'placeholder',
                text: count === 0 ? 'Pick notes on the piano or guitar.' : 'Lots of keys fit. Add another note to narrow it down.',
            }));
            return;
        }

        if (view.matches.length === 0) {
            r.keys.replaceChildren(el('p', { class: 'placeholder', text: 'No key contains all of these notes.' }));
            return;
        }

        r.keys.replaceChildren(...view.matches.map(key => el('button', {
            class: 'chip',
            type: 'button',
            'aria-pressed': String(key.id === view.preview?.id),
            dataset: { root: key.root, type: key.type },
            text: key.name,
        })));
    }

    function renderScale(view) {
        r.scaleTitle.textContent = view.preview ? view.preview.name : 'No key previewed';

        const labels = view.preview ? scaleDegreeLabels(view.preview.type) : [];
        r.degrees.replaceChildren(...(view.preview
            ? view.preview.pitchClasses.map((pc, i) => el('div', { class: ['degree', i === 0 && 'degree--root'] },
                el('span', { class: 'degree__note', text: pc }),
                el('span', { class: 'degree__label', text: labels[i] })
            ))
            : [el('p', { class: 'placeholder', text: 'Pick a possible key or choose one above to see its scale.' })]
        ));

        r.selectedLine.replaceChildren(
            'Selected',
            ...(view.shownNotes.length
                ? view.shownNotes.map(pc => toneText(pc, view))
                : [el('span', { text: '—' })])
        );
    }

    function renderTranspose(state, view) {
        if (view.shownNotes.length === 0) {
            r.transpose.replaceChildren(el('p', { class: 'placeholder', text: 'Shifts to pitch a one-shot sample to each note.' }));
            return;
        }

        r.transpose.replaceChildren(...view.shownNotes.map(pc => {
            const { down, up } = semitoneShifts(state.sampleKey, pc);
            return el('div', { class: 'transpose__row' },
                toneText(pc, view),
                el('span', { class: 'transpose__down', text: down === 0 ? '0' : String(down) }),
                el('span', { class: 'transpose__up', text: up === 0 ? '0' : `+${up}` })
            );
        }));
    }

    // The media watcher above has already done the first render
    store.subscribe(render);
}

function toneText(pc, view) {
    return el('span', { class: 'tone-text', dataset: { state: view.noteState(pc) }, text: ENHARMONIC_NAMES[pc] });
}

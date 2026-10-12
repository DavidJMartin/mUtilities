// The "Chords in key" palette and the "Your chords" cards.

import { el } from '../../core/dom.js';
import { createChordDiagram } from '../../components/chord-diagram.js';
import { CHORD_GROUPS, chordFitsKey, chordName, chordTones, chordsInKey, notesOutsideScale, romanNumeral } from '../../music/chords.js';
import { findVoicings, tabString } from '../../music/guitar-voicings.js';
import { keyName } from '../../music/theory.js';
import { playProgression, strum } from './chord-player.js';

// Fingerings are found once per chord and reused
const voicingCache = new Map();

function voicingsFor(chord) {
    if (!voicingCache.has(chord.id)) {
        voicingCache.set(chord.id, findVoicings(chord.root, chord.type, chordTones(chord.root, chord.type)));
    }
    return voicingCache.get(chord.id);
}

/**
 * @param {Record<string, HTMLElement>} r  page refs
 * @param {ReturnType<typeof import('./store.js').createInKeyStore>} store
 */
export function initChordsView(r, store) {
    let playingIndex = null;

    r.chordGroup.append(...CHORD_GROUPS.map(g => el('button', {
        class: 'segmented__option', type: 'button', dataset: { value: g.value }, text: g.label,
    })));

    r.chordPalette.addEventListener('click', (event) => {
        const chip = event.target.closest('[data-chord]');
        if (!chip) return;
        const [root, type] = chip.dataset.chord.split('|');
        store.toggleChord(root, type);
    });

    r.chordCards.addEventListener('click', (event) => {
        const card = event.target.closest('[data-chord-card]');
        if (!card) return;
        const chord = store.getState().chords.find(c => c.id === card.dataset.chordCard);
        const voicings = voicingsFor(chord);
        const action = event.target.closest('[data-action]')?.dataset.action;

        if (action === 'remove') store.removeChord(chord.id);
        if (action === 'prev') store.stepVoicing(chord.id, -1, voicings.length);
        if (action === 'next') store.stepVoicing(chord.id, 1, voicings.length);
        if (action === 'play' && voicings.length) strum(voicings[chord.voicing].midi);
    });

    r.playChords.addEventListener('click', async () => {
        const chords = store.getState().chords.filter(c => voicingsFor(c).length);
        if (!chords.length) return;
        r.playChords.disabled = true;
        await playProgression(
            chords.map(c => voicingsFor(c)[c.voicing].midi),
            (i) => { playingIndex = i; render(store.getState()); }
        );
        playingIndex = null;
        r.playChords.disabled = false;
        render(store.getState());
    });

    r.clearChords.addEventListener('click', () => store.clearChords());

    r.chordGroup.addEventListener('click', (event) => {
        const option = event.target.closest('[data-value]');
        if (option) store.setChordGroup(option.dataset.value);
    });

    function render(state) {
        renderPalette(state);
        renderCards(state);
    }

    function renderPalette(state) {
        r.chordGroup.querySelectorAll('[data-value]').forEach(b => {
            b.setAttribute('aria-pressed', String(b.dataset.value === state.chordGroup));
        });

        if (!state.preview) {
            r.chordsTitle.textContent = 'Chords in key';
            r.chordPalette.replaceChildren(el('p', { class: 'placeholder', text: 'Preview a key above to see the chords that fit it.' }));
            return;
        }

        const { root, type } = state.preview;
        r.chordsTitle.textContent = `Chords in ${keyName(root, type)}`;
        const picked = new Set(state.chords.map(c => c.id));
        const rows = chordsInKey(root, type, state.chordGroup);

        const anyOutside = rows.some(row => row.chords.some(c => c.outside.length));

        r.chordPalette.replaceChildren(...(rows.length ? rows.map(row => el('div', { class: 'chord-row' },
            el('span', { class: 'chord-row__degree', text: row.degree }),
            el('div', { class: 'chip-list' }, row.chords.map(chord => el('button', {
                class: ['chip', chord.outside.length && 'chip--outside'],
                type: 'button',
                title: chord.outside.length ? `Adds ${chord.outside.join(', ')}` : null,
                'aria-pressed': String(picked.has(chord.id)),
                dataset: { chord: chord.id },
                text: chord.name,
            })))
        )) : [el('p', { class: 'placeholder', text: 'No chords of this kind fit this key.' })]),
        anyOutside && el('p', { class: 'meta', text: 'Dashed chords add notes the scale itself doesn’t use, like the chords under a blues riff.' }));
    }

    function renderCards(state) {
        r.playChords.hidden = state.chords.length === 0;
        r.clearChords.hidden = state.chords.length === 0;

        if (!state.chords.length) {
            r.chordCards.replaceChildren(el('p', { class: 'placeholder', text: 'Pick chords above to compare them here. Tap a chord name to hear it.' }));
            return;
        }

        r.chordCards.replaceChildren(...state.chords.map((chord, index) => chordCard(chord, index, state)));
    }

    function chordCard(chord, index, state) {
        const voicings = voicingsFor(chord);
        const voicing = voicings[chord.voicing];
        const name = chordName(chord.root, chord.type);
        const key = state.preview;
        const inKey = key && chordFitsKey(key.root, key.type, chord.root, chord.type);
        const numeral = inKey ? romanNumeral(key.root, chord.root, chord.type) : null;
        const outside = new Set(key ? notesOutsideScale(key.root, key.type, chord.root, chord.type) : []);

        return el('article', {
            class: 'panel chord-card',
            dataset: { chordCard: chord.id, playing: index === playingIndex },
        },
            el('div', { class: 'chord-card__head' },
                el('button', { class: 'chord-card__name', type: 'button', dataset: { action: 'play' }, 'aria-label': `Play ${name}` },
                    el('span', { text: name }),
                    el('span', { class: 'chord-card__play', 'aria-hidden': 'true', text: '▶' })
                ),
                el('span', { class: 'meta', text: numeral ?? (key ? 'outside key' : '') }),
                el('button', { class: 'chord-card__remove', type: 'button', dataset: { action: 'remove' }, 'aria-label': `Remove ${name}`, text: '×' })
            ),
            el('p', { class: 'chord-card__tones' }, chordTones(chord.root, chord.type).map(t => el('span', {},
                el('b', { text: t.pc }), ` ${t.label === '1' ? 'R' : t.label}`
            ))),
            outside.size > 0 && el('p', { class: 'chord-card__outside', text: `Adds ${[...outside].join(', ')} to the scale` }),
            voicing
                ? [
                    createChordDiagram(voicing, `${name}, ${tabString(voicing.frets)}`),
                    el('p', { class: 'meta chord-card__tab', text: tabString(voicing.frets) }),
                    el('div', { class: 'chord-card__voicing' },
                        el('button', { class: 'chord-card__step', type: 'button', dataset: { action: 'prev' }, 'aria-label': 'Previous fingering', text: '‹' }),
                        el('span', { class: 'meta chord-card__count', text: `${chord.voicing + 1} / ${voicings.length}` }),
                        el('button', { class: 'chord-card__step', type: 'button', dataset: { action: 'next' }, 'aria-label': 'Next fingering', text: '›' })
                    ),
                ]
                : el('p', { class: 'placeholder', text: 'No comfortable guitar shape found.' })
        );
    }

    return { render };
}

// Render-only, like the keyboard. Each element gets its grid position for
// both orientations as custom properties and instruments.css picks one by
// breakpoint, so the vertical phone neck needs no re-render or extra markup.

import { el } from '../core/dom.js';
import { GUITAR_STRINGS, transpose } from '../music/theory.js';

const FRET_MARKERS = new Set([3, 5, 7, 9, 12, 15, 17, 19, 21, 24]);
const STRING_GAUGES = ['1px', '1px', '1.5px', '2px', '2.5px', '3px'];

/** frets: how many after the first shown; from: the first fret shown (Tab Writer slides the neck) */
export function createFretboard({ frets = 12, from = 0 } = {}) {
    const stringCount = GUITAR_STRINGS.length;
    const children = [];

    GUITAR_STRINGS.forEach((string, s) => {
        // Horizontal: one row per string (high e at the top), frets as columns.
        // Vertical: one column per string (low E on the left), frets as rows.
        const hRow = s + 1;
        const vCol = stringCount - s + 1;

        children.push(el('span', {
            class: 'fretboard__string-label',
            'aria-hidden': 'true',
            style: { '--h-row': hRow, '--v-col': vCol },
            text: string.name,
        }));

        for (let fret = from; fret <= from + frets; fret++) {
            const col = fret - from + 2;
            const pc = transpose(string.pc, fret);
            children.push(el('button', {
                class: 'fretboard__cell',
                type: 'button',
                'aria-label': `${string.name} string, ${fret === 0 ? 'open' : `fret ${fret}`}: ${pc}`,
                dataset: { pc, fret, string: s },
                style: {
                    '--h-row': hRow,
                    '--h-col': col,
                    '--v-row': col,
                    '--v-col': vCol,
                    '--gauge': STRING_GAUGES[s],
                },
            }, el('span', { class: 'fretboard__dot', 'aria-hidden': 'true', text: pc })));
        }
    });

    for (let fret = from; fret <= from + frets; fret++) {
        children.push(el('span', {
            class: 'fretboard__fret-num',
            'aria-hidden': 'true',
            dataset: { fret, marker: FRET_MARKERS.has(fret) },
            style: { '--h-col': fret - from + 2, '--v-row': fret - from + 2 },
            text: fret,
        }));
    }

    return el('div', { class: 'fretboard', role: 'group', 'aria-label': 'Guitar fretboard, standard tuning' }, children);
}

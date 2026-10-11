// Render-only: callers handle interaction by delegating events on the
// returned element, so one component serves both the In Key piano and the
// playable Key Synth. Keys carry data-note ('C#4') and data-pc ('C#'); set
// data-state on a key to colour it.

import { el } from '../core/dom.js';
import { noteRange, isBlackKey } from '../music/theory.js';

/** caps maps note ids to computer keys, e.g. { C4: 'A' } */
export function createKeyboard({ from, to, showOctave = true, caps = {}, playable = false, label = 'Piano keyboard' }) {
    const notes = noteRange(from, to);
    const whiteCount = notes.filter(n => !isBlackKey(n.pc)).length;

    let whitesSoFar = 0;
    const keys = notes.map((note) => {
        const black = isBlackKey(note.pc);
        if (!black) whitesSoFar += 1;

        const cap = caps[note.id];
        const text = black || !showOctave ? note.pc : note.id;
        const spoken = `${note.pc.replace('#', ' sharp')} ${note.octave}`;

        return el('button', {
            class: ['keyboard__key', black ? 'keyboard__key--black' : 'keyboard__key--white'],
            type: 'button',
            'aria-label': cap ? `${spoken} (key ${cap})` : spoken,
            dataset: {
                note: note.id,
                pc: note.pc,
                last: !black && whitesSoFar === whiteCount,
            },
            // A black key sits on the boundary after the whites so far
            style: black ? { '--pos': whitesSoFar } : {},
        },
            cap && el('span', { class: 'keyboard__cap', 'aria-hidden': 'true', text: cap }),
            el('span', { 'aria-hidden': 'true', text })
        );
    });

    return el('div', {
        class: ['keyboard', playable && 'keyboard--playable'],
        role: 'group',
        'aria-label': label,
        style: { '--whites': whiteCount },
    }, keys);
}

// The playground strip: a slim bar under the header that appears whenever
// anything is playing. It shows the shared tempo and each running tool, so you
// can stop any of them (or all) without going back to its page.

import { el } from '../core/dom.js';
import { clock } from '../core/clock.js';
import { createStepper } from '../components/controls.js';

export function initPlaygroundStrip(root) {
    const tempo = createStepper({
        label: 'Tempo',
        inline: true,
        repeat: true,
        onStep: (dir) => { clock.bpm += dir; },
    });
    const list = el('ul', { class: 'playground__list', 'aria-label': 'Playing now' });
    const stopAll = el('button', {
        class: 'playground__stop-all',
        type: 'button',
        text: 'Stop all',
        on: { click: () => clock.stopAll() },
    });

    root.append(el('div', { class: 'playground__inner container' }, list, tempo.el, stopAll));

    // Its height as --playground-h, so other sticky things (the Tab Writer's tab on phones) sit below it
    new ResizeObserver(() => {
        document.documentElement.style.setProperty('--playground-h', `${root.offsetHeight}px`);
    }).observe(root);

    // Phones scroll the list sideways; fade the right edge while there's more to see
    const updateFade = () => {
        list.toggleAttribute('data-more', list.scrollLeft + list.clientWidth < list.scrollWidth - 1);
    };
    list.addEventListener('scroll', updateFade, { passive: true });
    new ResizeObserver(updateFade).observe(list);

    const render = () => {
        const active = clock.active();
        root.hidden = active.length === 0;
        stopAll.hidden = active.length < 2;
        // Tempo only matters to rhythmic tools
        tempo.el.hidden = !active.some(p => p.sync === 'clock');

        list.replaceChildren(...active.map(p => el('li', { class: 'playground__item', dataset: { state: p.state } },
            el('a', { class: 'playground__name', href: `#${p.page}` },
                el('span', { class: 'playground__led', 'aria-hidden': 'true' }),
                el('span', { class: 'playground__full', text: p.name }),
                el('span', { class: 'playground__short', 'aria-hidden': 'true', text: p.short }),
                p.state === 'queued' && el('span', { class: 'playground__queued', text: 'joining' })
            ),
            el('button', {
                class: 'playground__stop',
                type: 'button',
                'aria-label': `Stop ${p.name}`,
                text: '■',
                on: { click: () => clock.stop(p.id) },
            })
        )));
        updateFade();
    };

    const renderTempo = () => tempo.set(`${clock.bpm} BPM`);

    clock.onChange(render);
    clock.onBpmChange(renderTempo);
    renderTempo();
    render();
}

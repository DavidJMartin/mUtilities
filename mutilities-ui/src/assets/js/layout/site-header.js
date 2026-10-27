// Site header: the brand, then Home and every tool as a row of links (the
// current page in bold). LEDs show which tools are playing.

import { clock } from '../core/clock.js';

export function initSiteHeader(header, router) {
    const links = header.querySelectorAll('[data-nav]');

    const markCurrent = (page) => {
        links.forEach((link) => {
            if (link.dataset.nav === page) link.setAttribute('aria-current', 'page');
            else link.removeAttribute('aria-current');
        });
    };

    // LEDs for the tools that are playing (or joining)
    const renderPlaying = () => {
        const states = new Map(clock.active().map(p => [p.page, p.state]));
        links.forEach((link) => {
            const state = states.get(link.dataset.nav);
            if (state) link.dataset.playing = state;
            else delete link.dataset.playing;
        });
    };
    clock.onChange(renderPlaying);

    router.onChange(markCurrent);
    markCurrent(router.current());
    renderPlaying();
}

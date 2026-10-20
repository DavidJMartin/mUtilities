// Site header: the brand, the current tool's name, and a Tools button that
// opens every tool grouped by category (the same at every width, so the bar
// doesn't fill up as tools are added). LEDs show which tools are playing.

import { clock } from '../core/clock.js';
import { toggleData } from '../core/dom.js';

export function initSiteHeader(header, router) {
    const menuButton = header.querySelector('.menu-toggle');
    const menuLabel = header.querySelector('.menu-toggle__label');
    const nav = header.querySelector('.site-nav');
    const current = header.querySelector('[data-current-page]');
    const links = header.querySelectorAll('[data-nav]');

    const isOpen = () => 'menuOpen' in header.dataset;
    const setMenuOpen = (open) => {
        toggleData(header, 'menuOpen', open);
        menuButton.setAttribute('aria-expanded', String(open));
        menuLabel.textContent = open ? 'Close' : 'Tools';
    };

    menuButton.addEventListener('click', () => setMenuOpen(!isOpen()));

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && isOpen()) {
            setMenuOpen(false);
            menuButton.focus();
        }
    });

    // Click anywhere outside the panel to close it
    document.addEventListener('pointerdown', (event) => {
        if (isOpen() && !nav.contains(event.target) && !menuButton.contains(event.target)) setMenuOpen(false);
    });

    const markCurrent = (page) => {
        let name = '';
        links.forEach((link) => {
            const here = link.dataset.nav === page;
            if (here) {
                link.setAttribute('aria-current', 'page');
                if (page !== 'home') {
                    const num = link.querySelector('.site-nav__num')?.textContent;
                    name = `${num} · ${link.querySelector('.site-nav__label')?.textContent}`;
                }
            } else {
                link.removeAttribute('aria-current');
            }
        });
        current.textContent = name;
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

    router.onChange((page) => {
        markCurrent(page);
        setMenuOpen(false);
    });
    markCurrent(router.current());
    renderPlaying();
}

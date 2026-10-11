import { MEDIA, watchMedia } from '../core/media.js';
import { toggleData } from '../core/dom.js';

export function initSiteHeader(header, router) {
    const menuButton = header.querySelector('.menu-toggle');
    const menuLabel = header.querySelector('.menu-toggle__label');
    const links = header.querySelectorAll('[data-nav]');

    const setMenuOpen = (open) => {
        toggleData(header, 'menuOpen', open);
        menuButton.setAttribute('aria-expanded', String(open));
        menuLabel.textContent = open ? 'Close' : 'Menu';
    };

    menuButton.addEventListener('click', () => {
        setMenuOpen(menuButton.getAttribute('aria-expanded') !== 'true');
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && 'menuOpen' in header.dataset) {
            setMenuOpen(false);
            menuButton.focus();
        }
    });

    // The menu only exists on narrow layouts; don't leave it open when widening
    watchMedia(MEDIA.navCollapsed, (collapsed) => {
        if (!collapsed) setMenuOpen(false);
    });

    const markCurrent = (page) => {
        links.forEach(link => {
            if (link.dataset.nav === page) {
                link.setAttribute('aria-current', 'page');
            } else {
                link.removeAttribute('aria-current');
            }
        });
    };

    router.onChange((page) => {
        markCurrent(page);
        setMenuOpen(false);
    });
    markCurrent(router.current());
}

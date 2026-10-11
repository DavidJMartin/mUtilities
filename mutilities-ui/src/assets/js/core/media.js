// Keep in sync with the breakpoint list at the top of assets/css/tokens.css

export const MEDIA = {
    /** Phone layout: one-octave piano, vertical neck, collapsible panels */
    compact: '(max-width: 719.98px)',
    /** Header navigation collapsed behind the Menu button */
    navCollapsed: '(max-width: 959.98px)',
};

/** Calls callback(matches) now and on every change; returns an unsubscribe function */
export function watchMedia(query, callback) {
    const mql = window.matchMedia(query);
    const handler = () => callback(mql.matches);
    mql.addEventListener('change', handler);
    handler();
    return () => mql.removeEventListener('change', handler);
}

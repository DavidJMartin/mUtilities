// Links are ordinary href="#id" anchors, so the browser handles history and
// the router just reacts to hashchange. Pages are marked with data-page rather
// than id so the browser doesn't jump-scroll to the section.

export function createRouter({ defaultPage }) {
    const pages = new Map(
        [...document.querySelectorAll('[data-page]')].map(section => [section.dataset.page, section])
    );
    const listeners = new Set();
    let current = null;

    const pageFromHash = () => {
        const id = decodeURIComponent(window.location.hash.slice(1));
        return pages.has(id) ? id : null;
    };

    const show = (pageId) => {
        if (pageId === current) return;
        const previous = current;
        current = pageId;

        pages.forEach((section, id) => {
            section.hidden = id !== pageId;
        });

        const section = pages.get(pageId);
        document.title = section.dataset.title || document.title;

        if (previous !== null) window.scrollTo(0, 0);
        listeners.forEach(fn => fn(pageId, previous));
    };

    window.addEventListener('hashchange', () => {
        // Unknown hashes (e.g. a stale link) leave the current page in place
        const pageId = pageFromHash();
        if (pageId) show(pageId);
    });

    show(pageFromHash() ?? defaultPage);

    return {
        current: () => current,
        onChange(fn) {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
    };
}

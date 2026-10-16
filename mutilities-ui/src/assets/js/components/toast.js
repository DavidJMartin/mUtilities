// A short message that appears at the bottom of the screen and fades away,
// e.g. "Copied to clipboard". Screen readers hear it too.

import { el } from '../core/dom.js';

const SHOW_MS = 2600;

let toast = null;
let timer = null;

export function showToast(message, { error = false } = {}) {
    if (!toast) {
        toast = el('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
        document.body.append(toast);
    }
    clearTimeout(timer);
    toast.textContent = message;
    toast.toggleAttribute('data-error', error);
    toast.toggleAttribute('data-show', true);
    timer = setTimeout(() => toast.toggleAttribute('data-show', false), error ? SHOW_MS * 1.6 : SHOW_MS);
}

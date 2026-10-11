// Not wired up yet: needs a [data-page="random-melody"] section with
// data-ref="generate" and data-ref="result", and a call from main.js.
// Requests go through the /api/melody proxy in mutilities-ui/nginx.conf.

import { el, refs } from '../../core/dom.js';

const API_BASE_URL = '/api';

export function initMelodyGenerator(root) {
    const r = refs(root);

    r.generate.addEventListener('click', async () => {
        r.generate.disabled = true;
        r.generate.textContent = 'Generating…';

        try {
            const response = await fetch(`${API_BASE_URL}/melody/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            r.result.replaceChildren(el('pre', { text: JSON.stringify(data, null, 2) }));
        } catch (error) {
            r.result.replaceChildren(el('p', { class: 'notice', text: `Couldn't generate a melody: ${error.message}` }));
        } finally {
            r.generate.disabled = false;
            r.generate.textContent = 'Generate melody';
        }
    });
}

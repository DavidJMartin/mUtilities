// Modules are deferred, so the DOM is parsed and Tone.js (a deferred script
// listed earlier) has loaded by the time this runs.

import { initTheme } from './core/theme.js';
import { createRouter } from './core/router.js';
import { hasAudio } from './core/audio.js';
import { initSiteHeader } from './layout/site-header.js';
import { initInKey } from './tools/in-key/index.js';
import { initDroneSynth } from './tools/drone-synth/index.js';
import { initKeySynth } from './tools/key-synth/index.js';

const page = (id) => document.querySelector(`[data-page="${id}"]`);

initTheme();

const router = createRouter({ defaultPage: 'home' });
initSiteHeader(document.querySelector('.site-header'), router);

initInKey(page('in-key-assistance'));

// The synths need Tone.js; if it failed to load, say so instead of breaking
const synthPages = [
    ['drone-synth', (root) => initDroneSynth(root)],
    ['key-synth', (root) => initKeySynth(root, router)],
];

for (const [id, init] of synthPages) {
    const root = page(id);
    if (hasAudio()) {
        init(root);
    } else {
        root.querySelector('[data-ref="noAudio"]').hidden = false;
    }
}

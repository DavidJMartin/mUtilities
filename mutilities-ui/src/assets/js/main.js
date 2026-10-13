import { initTheme } from './core/theme.js';
import { createRouter } from './core/router.js';
import { initSiteHeader } from './layout/site-header.js';
import { bindSpaceToPlay } from './core/space-to-play.js';
import { initInKey } from './tools/in-key/index.js';
import { initDroneSynth } from './tools/drone-synth/index.js';
import { initKeySynth } from './tools/key-synth/index.js';
import { initLogicalDrums } from './tools/logical-drums/index.js';

const page = (id) => document.querySelector(`[data-page="${id}"]`);

initTheme();

const router = createRouter({ defaultPage: 'home' });
initSiteHeader(document.querySelector('.site-header'), router);

initInKey(page('in-key-assistance'));

initDroneSynth(page('drone-synth'));
initKeySynth(page('key-synth'), router);
initLogicalDrums(page('logical-drums'));

// Space plays/stops the tools that have a transport
for (const id of ['drone-synth', 'logical-drums']) {
    bindSpaceToPlay(router, id, page(id).querySelector('[data-ref="play"]'));
}

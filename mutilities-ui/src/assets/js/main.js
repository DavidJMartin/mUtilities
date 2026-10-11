import { initTheme } from './core/theme.js';
import { createRouter } from './core/router.js';
import { initSiteHeader } from './layout/site-header.js';
import { initInKey } from './tools/in-key/index.js';
import { initDroneSynth } from './tools/drone-synth/index.js';
import { initKeySynth } from './tools/key-synth/index.js';

const page = (id) => document.querySelector(`[data-page="${id}"]`);

initTheme();

const router = createRouter({ defaultPage: 'home' });
initSiteHeader(document.querySelector('.site-header'), router);

initInKey(page('in-key-assistance'));

initDroneSynth(page('drone-synth'));
initKeySynth(page('key-synth'), router);

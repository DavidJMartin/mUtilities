import { initTheme } from './core/theme.js';
import { setupMasterBus } from './core/audio.js';
import { createRouter } from './core/router.js';
import { initSiteHeader } from './layout/site-header.js';
import { initRecordButton } from './layout/record-button.js';
import { initPlaygroundStrip } from './layout/playground-strip.js';
import { bindSpaceToPlay } from './core/space-to-play.js';
import { initInKey } from './tools/in-key/index.js';
import { initDroneSynth } from './tools/drone-synth/index.js';
import { initKeySynth } from './tools/key-synth/index.js';
import { initLogicalDrums } from './tools/logical-drums/index.js';
import { initTwinTuring } from './tools/twin-turing/index.js';
import { initTabWriter } from './tools/tab-writer/index.js';

const page = (id) => document.querySelector(`[data-page="${id}"]`);

initTheme();
setupMasterBus();

const router = createRouter({ defaultPage: 'home' });
initSiteHeader(document.querySelector('.site-header'), router);
initRecordButton(document.querySelector('[data-record-toggle]'));
initPlaygroundStrip(document.querySelector('[data-playground]'));

initInKey(page('in-key-assistance'));

initDroneSynth(page('drone-synth'));
initKeySynth(page('key-synth'), router);
initLogicalDrums(page('logical-drums'));
initTwinTuring(page('twin-turing'));
initTabWriter(page('tab-writer'), router);

// Space plays/stops the tools that have a transport
for (const id of ['drone-synth', 'logical-drums', 'twin-turing', 'tab-writer']) {
    bindSpaceToPlay(router, id, page(id).querySelector('[data-ref="play"]'));
}


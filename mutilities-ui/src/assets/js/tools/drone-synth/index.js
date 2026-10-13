import { el, refs, setOptions, toggleData, uid } from '../../core/dom.js';
import { MEDIA, watchMedia } from '../../core/media.js';
import { ensureAudioRunning } from '../../core/audio.js';
import { createSegmented, createSelect, createSlider, createSwitch } from '../../components/controls.js';
import { SCALES, rootOptions, scaleOptions } from '../../music/theory.js';
import { DroneEngine } from './engine.js';
import { createDrift } from './drift.js';
import { SATURATION_MODES } from './saturation.js';
import {
    FILTER_TYPES,
    RANGES,
    SHAPES,
    DEFAULT_DRIFT,
    createVoices,
    defaultFx,
    defaultTexture,
    noteForKey,
    noteOptionsForKey,
    randomiseVoice,
} from './params.js';

export function initDroneSynth(root) {
    const r = refs(root);

    const key = { root: 'C', scale: 'major' };
    let noteOptions = noteOptionsForKey(key.root, key.scale);
    let fx = defaultFx();
    let texture = defaultTexture();
    let voices = createVoices(noteOptions);
    let playing = false;

    const engine = new DroneEngine(fx, voices, texture);

    const drift = createDrift({
        engine,
        getVoices: () => voices,
        getNoteOptions: () => noteOptions,
        changeNote: (index, note, glide) => {
            updateVoice(index, { note }, { glide });
            oscPanels[index].sync();
        },
    });
    drift.setAmount(DEFAULT_DRIFT);

    setOptions(r.root, rootOptions(), key.root);
    setOptions(r.scale, scaleOptions(), key.scale);

    const onKeyChange = () => {
        key.root = r.root.value;
        key.scale = r.scale.value;
        noteOptions = noteOptionsForKey(key.root, key.scale);
        voices.forEach((voice, i) => updateVoice(i, { note: noteForKey(voice.note, noteOptions) }));
        oscPanels.forEach(panel => panel.refreshNoteOptions());
        renderLcd();
    };
    r.root.addEventListener('change', onKeyChange);
    r.scale.addEventListener('change', onKeyChange);

    r.play.addEventListener('click', async () => {
        if (!playing) await ensureAudioRunning();
        playing = !playing;
        if (playing) {
            engine.start();
        } else {
            engine.stop();
        }
        drift.setRunning(playing);
        renderTransport();
    });

    r.randomise.addEventListener('click', () => {
        voices.forEach((voice, i) => updateVoice(i, randomiseVoice(voice, noteOptions)));
        oscPanels.forEach(panel => panel.sync());
    });

    const setFx = (name, patch) => {
        fx = { ...fx, [name]: { ...fx[name], ...patch } };
        engine.setFx(fx);
    };

    r.transport.append(slider(RANGES.drift, DEFAULT_DRIFT, v => drift.setAmount(v), 'cool').el);

    const setTexture = (patch) => {
        texture = { ...texture, ...patch };
        engine.setTexture(texture);
    };
    const texturePanel = createFxPanel('Texture', texture.on, on => setTexture({ on }), [
        slider(RANGES.textureLevel, texture.level, level => setTexture({ level })),
        slider(RANGES.textureTone, texture.tone, tone => setTexture({ tone })),
        slider(RANGES.textureCrackle, texture.crackle, crackle => setTexture({ crackle })),
        slider(RANGES.textureMotion, texture.motion, motion => setTexture({ motion }), 'cool'),
    ]);
    texturePanel.classList.add('drone__texture');
    r.texture.append(texturePanel);

    r.fx.append(
        createFxPanel('Reverb', fx.reverb.on, on => setFx('reverb', { on }), [
            slider(RANGES.reverbDecay, fx.reverb.decay, decay => setFx('reverb', { decay })),
            slider(RANGES.reverbMix, fx.reverb.mix, mix => setFx('reverb', { mix })),
            slider(RANGES.reverbModulation, fx.reverb.modulation, modulation => setFx('reverb', { modulation }), 'cool'),
        ]),
        createFxPanel('Saturation', fx.saturation.on, on => setFx('saturation', { on }), [
            createSegmented({
                label: 'Saturation mode',
                options: SATURATION_MODES,
                value: fx.saturation.mode,
                onChange: mode => setFx('saturation', { mode }),
            }),
            slider(RANGES.saturationDrive, fx.saturation.drive, drive => setFx('saturation', { drive })),
            slider(RANGES.saturationTone, fx.saturation.tone, tone => setFx('saturation', { tone })),
            slider(RANGES.saturationMix, fx.saturation.mix, mix => setFx('saturation', { mix })),
        ])
    );

    function updateVoice(index, patch, options) {
        voices = voices.map((voice, i) => (i === index ? { ...voice, ...patch } : voice));
        engine.setVoice(index, voices[index], options);
        oscPanels[index]?.renderSummary();
        renderLcd();
    }

    const oscPanels = voices.map((_, index) => createOscPanel({
        index,
        getVoice: () => voices[index],
        getNoteOptions: () => noteOptions,
        update: (patch) => updateVoice(index, patch),
    }));
    r.oscs.append(...oscPanels.map(panel => panel.el));

    // Oscillators collapse into tappable rows on phones; first one starts open
    watchMedia(MEDIA.compact, (compact) => {
        oscPanels.forEach((panel, i) => panel.setCollapsible(compact, i === 0));
    });

    function renderTransport() {
        r.play.setAttribute('aria-pressed', String(playing));
        r.playLabel.textContent = playing ? '■  Stop' : '▶  Play';
        renderLcd();
    }

    function renderLcd() {
        const keyLabel = `${key.root} ${SCALES[key.scale].name}`.toUpperCase();
        r.lcdLabel.textContent = `${playing ? 'Droning' : 'Stopped'} · ${keyLabel}`;
        toggleData(r.lcdLed, 'on', playing);

        const active = voices.filter(v => v.on).map(v => v.note);
        r.lcdNotes.textContent = active.length ? active.join(' · ') : '— no oscillators —';
    }

    renderTransport();
}

function slider(range, value, onInput, tone) {
    return createSlider({ ...range, value, onInput, tone });
}

function createFxPanel(name, on, onToggle, controls) {
    const panel = el('section', { class: 'panel' });
    const setOff = (isOn) => toggleData(panel, 'off', !isOn);

    const toggle = createSwitch({
        label: `Enable ${name.toLowerCase()}`,
        checked: on,
        onChange: (isOn) => {
            setOff(isOn);
            onToggle(isOn);
        },
    });

    panel.append(
        el('div', { class: 'panel__head panel__head--ruled' },
            el('h2', { class: 'panel__title', text: name }),
            toggle.el
        ),
        el('div', { class: 'fx__params' }, controls.map(c => c.el))
    );
    setOff(on);
    return panel;
}

function createOscPanel({ index, getVoice, getNoteOptions, update }) {
    const voice = getVoice();
    const bodyId = uid('osc-body');
    const number = index + 1;

    const noteText = el('span', { class: 'osc__note' });
    const summary = el('span', { class: 'osc__summary' });
    const toggleButton = el('button', {
        class: 'osc__toggle',
        type: 'button',
        'aria-controls': bodyId,
    },
        el('span', { class: 'osc__id' },
            el('span', { class: 'osc__eyebrow', text: `OSC ${number}` }),
            noteText
        ),
        summary,
        el('span', { class: 'osc__chev', 'aria-hidden': 'true' })
    );

    const enable = createSwitch({
        label: `Enable oscillator ${number}`,
        checked: voice.on,
        onChange: (on) => update({ on }),
    });

    const noteSelect = createSelect({
        label: 'Note',
        layout: 'inline',
        size: 'sm',
        options: [],
        value: voice.note,
        onChange: (note) => update({ note }),
    });

    const shape = createSegmented({
        label: `Oscillator ${number} waveform`,
        options: SHAPES,
        value: voice.shape,
        onChange: (value) => update({ shape: value }),
    });

    const volume = slider(RANGES.volume, voice.volume, v => update({ volume: v }), 'ink');

    const filterType = createSegmented({
        label: `Oscillator ${number} filter type`,
        options: FILTER_TYPES,
        value: voice.filterType,
        small: true,
        onChange: (value) => update({ filterType: value }),
    });
    const filterFreq = slider(RANGES.filterFreq, voice.filterFreq, v => update({ filterFreq: v }));
    const filterRes = slider(RANGES.filterRes, voice.filterRes, v => update({ filterRes: v }));

    const filterLfo = createLfoGroup({
        title: 'Filter LFO',
        number,
        on: voice.filterLfoOn,
        onToggle: (on) => update({ filterLfoOn: on }),
        sliders: [
            slider(RANGES.filterLfoRate, voice.filterLfoRate, v => update({ filterLfoRate: v }), 'cool'),
            slider(RANGES.filterLfoDepth, voice.filterLfoDepth, v => update({ filterLfoDepth: v }), 'cool'),
        ],
    });
    const ampLfo = createLfoGroup({
        title: 'Volume LFO',
        number,
        on: voice.ampLfoOn,
        onToggle: (on) => update({ ampLfoOn: on }),
        sliders: [
            slider(RANGES.ampLfoRate, voice.ampLfoRate, v => update({ ampLfoRate: v }), 'cool'),
            slider(RANGES.ampLfoDepth, voice.ampLfoDepth, v => update({ ampLfoDepth: v }), 'cool'),
        ],
    });

    const body = el('div', { class: 'osc__body', id: bodyId },
        el('div', { class: 'osc__voice' }, noteSelect.el, shape.el),
        volume.el,
        el('div', { class: 'param-group' },
            el('div', { class: 'param-group__head' },
                el('h3', { class: 'param-group__title', text: 'Filter' }),
                filterType.el
            ),
            el('div', { class: 'param-group__params' }, filterFreq.el, filterRes.el)
        ),
        filterLfo.el,
        ampLfo.el
    );

    const panel = el('article', { class: 'panel panel--raised osc', 'aria-label': `Oscillator ${number}` },
        el('div', { class: 'osc__head' }, toggleButton, enable.el),
        body
    );

    let collapsible = false;

    const setOpen = (open) => {
        toggleData(panel, 'open', open);
        toggleButton.setAttribute('aria-expanded', String(open));
    };

    toggleButton.addEventListener('click', () => {
        if (collapsible) setOpen(!('open' in panel.dataset));
    });

    const renderSummary = () => {
        const v = getVoice();
        noteText.textContent = v.note;
        summary.textContent = `${SHAPES.find(s => s.value === v.shape).label} · ${v.volume.toFixed(1)}dB`;
        toggleData(panel, 'off', !v.on);
    };

    const refreshNoteOptions = () => {
        noteSelect.setOptions(getNoteOptions().map(n => ({ value: n, label: n })), getVoice().note);
    };

    // Push the whole voice state into the controls, e.g. after randomising
    const sync = () => {
        const v = getVoice();
        enable.set(v.on);
        noteSelect.set(v.note);
        shape.set(v.shape);
        volume.set(v.volume);
        filterType.set(v.filterType);
        filterFreq.set(v.filterFreq);
        filterRes.set(v.filterRes);
        filterLfo.set(v.filterLfoOn, [v.filterLfoRate, v.filterLfoDepth]);
        ampLfo.set(v.ampLfoOn, [v.ampLfoRate, v.ampLfoDepth]);
        renderSummary();
    };

    const setCollapsible = (isCollapsible, openByDefault) => {
        collapsible = isCollapsible;
        toggleButton.disabled = !isCollapsible;
        if (isCollapsible) {
            setOpen(openByDefault);
        } else {
            toggleButton.removeAttribute('aria-expanded');
            toggleData(panel, 'open', false);
        }
    };

    refreshNoteOptions();
    renderSummary();

    return { el: panel, sync, renderSummary, refreshNoteOptions, setCollapsible };
}

function createLfoGroup({ title, number, on, onToggle, sliders }) {
    const group = el('div', { class: 'param-group' });
    const setOff = (isOn) => toggleData(group, 'off', !isOn);

    const toggle = createSwitch({
        label: `Enable oscillator ${number} ${title.toLowerCase()}`,
        checked: on,
        small: true,
        onChange: (isOn) => {
            setOff(isOn);
            onToggle(isOn);
        },
    });

    group.append(
        el('div', { class: 'param-group__head' },
            el('h3', { class: 'param-group__title', text: title }),
            toggle.el
        ),
        el('div', { class: 'param-group__params' }, sliders.map(s => s.el))
    );
    setOff(on);

    return {
        el: group,
        set(isOn, values) {
            toggle.set(isOn);
            setOff(isOn);
            values.forEach((v, i) => sliders[i].set(v));
        },
    };
}

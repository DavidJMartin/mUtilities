import { el, refs, toggleData } from '../../core/dom.js';
import { ensureAudioRunning } from '../../core/audio.js';
import { createSegmented, createSelect, createSlider, createStepper } from '../../components/controls.js';
import {
    GATES,
    LETTERS,
    MAX_SIGNALS,
    RATES,
    SHUFFLES,
    SWING_UNITS,
    TICKS_PER_BAR,
    TICKS_PER_BEAT,
    TICKS_PER_STEP,
    clampGenerator,
    defaultPatch,
    emptyRow,
    isSilent,
    loopText,
    rateLabel,
    shiftMax,
    summary,
} from './logic.js';
import { DrumEngine } from './engine.js';
import { VOICE_NAMES } from './voices.js';
import { downloadMidi } from './midi.js';

const ROW_NAMES = [...VOICE_NAMES, 'Accent'];
const ACCENT_ROW = 6;
const BPM_MIN = 40;
const BPM_MAX = 240;
const TRIGGER_FLASH_MS = 90;
const DRUM_FLASH_MS = 120;

const BAR_OPTIONS = [1, 2, 4, 8, 16].map(n => ({ value: String(n), label: `${n} bar${n > 1 ? 's' : ''}` }));

const TRIG_ICON = '<svg width="16" height="10" viewBox="0 0 16 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><polyline points="0,9 7,9 8,1 9,9 16,9"></polyline></svg>';
const GATE_ICON = '<svg width="16" height="10" viewBox="0 0 16 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><polyline points="0,9 3,9 3,1 9,1 9,9 16,9"></polyline></svg>';

// Like the drone, playback carries on when you switch tools, so a beat can
// run under the drone and key synth.
export function initLogicalDrums(root) {
    const r = refs(root);
    r.gateIcon.innerHTML = GATE_ICON;

    const state = {
        ...defaultPatch(),
        accentAmount: 0.6,
        bpm: 120,
        bars: 4,
        selected: 0,
    };
    // Which chain picker is open: { row, link, kind: 'sig' | 'gate' }
    let picker = null;

    const engine = new DrumEngine(() => state, {
        step: renderPosition,
        generator: (i, on, isGate) => lightGenerator(i, on, isGate),
        drum: flashDrum,
        accent: lightAccent,
    });

    // ===== Lights =====
    // Several elements can show one generator's LED (module, phone tile and
    // every chain chip that uses it), so they're found by data attribute.

    const genLit = Array(6).fill(false);
    const genTimers = [];

    const paintGenerator = (i) => {
        root.querySelectorAll(`[data-led="${i}"]`).forEach(led => toggleData(led, 'on', genLit[i]));
    };

    function lightGenerator(i, on, isGate) {
        if (!isGate && !on) return;
        clearTimeout(genTimers[i]);
        genLit[i] = on;
        paintGenerator(i);
        if (!isGate) {
            genTimers[i] = setTimeout(() => {
                genLit[i] = false;
                paintGenerator(i);
            }, TRIGGER_FLASH_MS);
        }
    }

    const rowViews = [];
    const drumTimers = [];

    function flashDrum(index, accented) {
        const name = rowViews[index].name;
        clearTimeout(drumTimers[index]);
        toggleData(name, 'on', true);
        toggleData(name, 'accented', accented);
        drumTimers[index] = setTimeout(() => {
            toggleData(name, 'on', false);
            toggleData(name, 'accented', false);
        }, DRUM_FLASH_MS);
    }

    // Accent stays lit while it's high, but a one-tick trigger still shows
    let accentLitAt = 0;
    function lightAccent(on) {
        const name = rowViews[ACCENT_ROW].name;
        clearTimeout(drumTimers[ACCENT_ROW]);
        if (on) {
            accentLitAt = performance.now();
            toggleData(name, 'on', true);
        } else {
            const wait = Math.max(0, DRUM_FLASH_MS - (performance.now() - accentLitAt));
            drumTimers[ACCENT_ROW] = setTimeout(() => toggleData(name, 'on', false), wait);
        }
    }

    function clearLights() {
        genTimers.forEach(clearTimeout);
        drumTimers.forEach(clearTimeout);
        genLit.fill(false);
        genLit.forEach((_, i) => paintGenerator(i));
        rowViews.forEach(view => {
            toggleData(view.name, 'on', false);
            toggleData(view.name, 'accented', false);
        });
    }

    // ===== Transport =====

    const tempo = createStepper({
        label: 'Tempo',
        hint: `${BPM_MIN}–${BPM_MAX}`,
        repeat: true,
        onStep: dir => setBpm(state.bpm + dir),
    });
    r.tempo.prepend(tempo.el);

    function setBpm(bpm) {
        state.bpm = Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(bpm)));
        engine.setBpm(state.bpm);
        tempo.set(`${state.bpm} BPM`);
        renderLcd();
    }

    let taps = [];
    r.tap.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        const now = performance.now();
        taps = taps.filter(t => now - t < 2000).concat(now).slice(-5);
        if (taps.length >= 2) setBpm(60000 / ((taps[taps.length - 1] - taps[0]) / (taps.length - 1)));
        toggleData(r.tap, 'on', true);
        setTimeout(() => toggleData(r.tap, 'on', false), 100);
    });

    r.bars.append(createSelect({
        label: 'MIDI length',
        options: BAR_OPTIONS,
        value: String(state.bars),
        onChange: (v) => { state.bars = Number(v); },
    }).el);

    r.export.addEventListener('click', () => downloadMidi(state, state.bars));

    r.play.addEventListener('click', async () => {
        if (engine.playing) {
            stop();
        } else {
            await ensureAudioRunning();
            engine.start(state.bpm);
            renderTransport();
        }
    });

    function stop() {
        engine.stop();
        clearLights();
        renderTransport();
    }

    function renderTransport() {
        r.play.setAttribute('aria-pressed', String(engine.playing));
        r.playLabel.textContent = engine.playing ? '■  Stop' : '▶  Play';
        renderLcd();
        if (!engine.playing) r.lcdValue.textContent = '—.—.—';
    }

    function renderLcd() {
        toggleData(r.lcdLed, 'on', engine.playing);
        r.lcdLabel.textContent = engine.playing ? `Running · ${state.bpm} BPM` : 'Stopped';
    }

    function renderPosition(tick) {
        const bar = Math.floor(tick / TICKS_PER_BAR) + 1;
        const beat = (Math.floor(tick / TICKS_PER_BEAT) % 4) + 1;
        const step = (Math.floor(tick / TICKS_PER_STEP) % 4) + 1;
        r.lcdValue.textContent = `${bar}.${beat}.${step}`;
    }

    // ===== Generators =====

    const generatorViews = state.gens.map((_, i) => createGenerator(i));
    r.signals.append(...generatorViews.map(v => v.el));
    r.tiles.append(...generatorViews.map(v => v.tile));

    function updateGenerator(i, change) {
        state.gens[i] = clampGenerator({ ...state.gens[i], ...change });
        generatorViews[i].sync();
        renderLoop();
    }

    function selectGenerator(i) {
        state.selected = i;
        generatorViews.forEach((view, j) => view.setSelected(j === i));
    }

    function createGenerator(i) {
        const letter = LETTERS[i];
        const led = () => el('span', { class: 'led', dataset: { led: i }, 'aria-hidden': 'true' });

        const summaryText = el('span', { class: 'signal__summary' });
        const tileSummary = el('span', { class: 'signal-tile__summary' });

        const type = createSegmented({
            label: `Signal ${letter} type`,
            options: [{ value: 'md', label: '×/÷' }, { value: 'euclid', label: 'Euclid' }],
            value: state.gens[i].type,
            onChange: v => updateGenerator(i, { type: v, shift: 0 }),
        });

        const rate = createStepper({
            label: 'Rate',
            onStep: (dir) => {
                const idx = RATES.indexOf(state.gens[i].rate) + dir;
                if (idx >= 0 && idx < RATES.length) updateGenerator(i, { rate: RATES[idx] });
            },
        });
        const shiftStep = (dir) => {
            const g = state.gens[i];
            const max = shiftMax(g);
            const next = g.shift + dir;
            updateGenerator(i, { shift: next < 0 ? max : next > max ? 0 : next });
        };
        const shift = createStepper({ label: 'Shift', hint: '16ths', onStep: shiftStep });
        const output = createSegmented({
            label: `Signal ${letter} output`,
            options: [{ value: 'trig', label: 'Trig' }, { value: 'gate', label: 'Gate' }],
            value: state.gens[i].mode,
            onChange: v => updateGenerator(i, { mode: v }),
        });
        // Spike and square-pulse icons beside the words
        output.el.querySelectorAll('.segmented__option').forEach(option => {
            option.insertAdjacentHTML('afterbegin', option.dataset.value === 'gate' ? GATE_ICON : TRIG_ICON);
        });

        const pulses = createStepper({ label: 'Pulses', hint: 'k', onStep: dir => updateGenerator(i, { k: state.gens[i].k + dir }) });
        const steps = createStepper({ label: 'Steps', hint: 'n', onStep: dir => updateGenerator(i, { n: state.gens[i].n + dir }) });
        const rotate = createStepper({ label: 'Rotate', hint: '16ths', onStep: shiftStep });

        const mdControls = el('div', { class: 'signal__controls' },
            rate.el,
            shift.el,
            el('div', { class: 'field signal__wide' },
                el('span', { class: 'field__label', text: 'Output' }),
                output.el
            )
        );
        const euclidControls = el('div', { class: 'signal__controls' },
            pulses.el,
            steps.el,
            el('div', { class: 'signal__wide' }, rotate.el)
        );

        const module = el('article', { class: 'panel panel--raised signal', 'aria-label': `Signal ${letter}` },
            el('div', { class: 'signal__head' },
                el('span', { class: 'signal__id' },
                    el('span', { class: 'signal__eyebrow', text: 'SIGNAL' }),
                    el('span', { class: 'signal__letter', text: letter })
                ),
                summaryText,
                led()
            ),
            el('div', { class: 'signal__body' }, type.el, mdControls, euclidControls)
        );

        const tile = el('button', {
            class: 'signal-tile',
            type: 'button',
            'aria-label': `Edit signal ${letter}`,
            on: { click: () => selectGenerator(i) },
        },
            el('span', { class: 'signal-tile__top' },
                el('span', { class: 'signal-tile__letter', text: letter }),
                led()
            ),
            tileSummary
        );

        const sync = () => {
            const g = state.gens[i];
            const isMd = g.type === 'md';
            summaryText.textContent = summary(g);
            tileSummary.textContent = summary(g);
            type.set(g.type);
            mdControls.hidden = !isMd;
            euclidControls.hidden = isMd;

            const max = shiftMax(g);
            rate.set(rateLabel(g.rate));
            shift.set(max === 0 ? '—' : String(g.shift), max === 0);
            output.set(g.mode);
            pulses.set(String(g.k));
            steps.set(String(g.n));
            rotate.set(String(g.shift));
        };

        const setSelected = (selected) => {
            toggleData(module, 'selected', selected);
            tile.setAttribute('aria-pressed', String(selected));
        };

        sync();
        setSelected(i === state.selected);
        return { el: module, tile, sync, setSelected };
    }

    // ===== Drums and accent =====

    ROW_NAMES.forEach((name, index) => {
        const view = createRow(index, name);
        rowViews.push(view);
        r.rows.append(view.el);
    });

    r.clear.addEventListener('click', () => {
        state.rows = state.rows.map(row => emptyRow(row));
        picker = null;
        rowViews.forEach(view => view.render());
        renderLoop();
    });

    function updateRow(index, change) {
        state.rows[index] = { ...state.rows[index], ...change };
        picker = null;
        rowViews[index].render();
        renderLoop();
    }

    function setPicker(next) {
        const previous = picker;
        picker = next;
        if (previous) rowViews[previous.row].render();
        if (next && next.row !== previous?.row) rowViews[next.row].render();
    }

    function createRow(index, label) {
        const isAccent = index === ACCENT_ROW;
        const status = el('span', { class: 'drum-row__status', text: isAccent ? 'off' : 'silent' });
        const name = el('div', { class: 'drum-row__name' },
            el('span', { class: 'drum-row__label', text: label }),
            !isAccent && el('span', { class: 'drum-row__acc', text: 'ACC' }),
            status
        );
        const chain = el('div', { class: 'chain' });

        let right;
        let shuffle;
        let swingUnit;
        if (isAccent) {
            right = createSlider({
                label: 'Amount',
                min: 0,
                max: 1,
                step: 0.05,
                value: state.accentAmount,
                format: v => `${Math.round(v * 100)}%`,
                tone: 'cool',
                onInput: (v) => { state.accentAmount = v; },
            }).el;
            right.classList.add('drum-row__amount');
        } else {
            shuffle = createStepper({
                label: 'Shuffle',
                inline: true,
                onStep: (dir) => {
                    const idx = SHUFFLES.indexOf(state.rows[index].shuffle) + dir;
                    if (idx >= 0 && idx < SHUFFLES.length) updateRow(index, { shuffle: SHUFFLES[idx] });
                },
            });
            right = shuffle.el;
            swingUnit = createSegmented({
                label: `${label} shuffle on 8ths or 16ths`,
                options: SWING_UNITS,
                value: state.rows[index].swing,
                small: true,
                onChange: v => updateRow(index, { swing: v }),
            });
        }

        const rowEl = el('div', { class: ['drum-row', isAccent && 'drum-row--accent'] },
            name,
            chain,
            el('div', { class: 'drum-row__right' }, right),
            swingUnit && el('div', { class: 'drum-row__unit' }, swingUnit.el)
        );

        const render = () => {
            const row = state.rows[index];
            toggleData(name, 'silent', isSilent(row));
            shuffle?.set(`${row.shuffle}%`);
            const canAdd = row.sigs.length < MAX_SIGNALS;
            chain.replaceChildren(
                ...row.sigs.map((sig, link) => createLink(index, link)),
                ...(canAdd ? [el('button', {
                    class: 'chain__add',
                    type: 'button',
                    'aria-label': 'Add a gate and signal',
                    text: '+',
                    on: {
                        click: () => {
                            const current = state.rows[index];
                            updateRow(index, { sigs: [...current.sigs, null], gates: [...current.gates, 'OR'] });
                        },
                    },
                })] : [])
            );
            // Rebuilt chips need the current light state
            genLit.forEach((_, i) => paintGenerator(i));
        };

        render();
        return { el: rowEl, name, render };
    }

    function createLink(index, link) {
        const row = state.rows[index];
        const sig = row.sigs[link];
        const isOpen = kind => picker?.row === index && picker.link === link && picker.kind === kind;
        const toggle = kind => setPicker(isOpen(kind) ? null : { row: index, link, kind });

        const sigButton = el('button', {
            class: 'chain__sig',
            type: 'button',
            'aria-haspopup': 'true',
            'aria-expanded': String(isOpen('sig')),
            'aria-label': `Signal: ${sig == null ? 'none' : LETTERS[sig]}`,
            dataset: { none: sig == null },
            on: { click: () => toggle('sig') },
        },
            sig == null
                ? el('span', { class: 'chain__none', text: 'none' })
                : [el('span', { class: 'led led--sm', dataset: { led: sig }, 'aria-hidden': 'true' }),
                    el('span', { class: 'chain__letter', text: LETTERS[sig] })],
            el('span', { class: 'chain__caret', 'aria-hidden': 'true', text: '↓' })
        );

        const sigMenu = isOpen('sig') && el('div', { class: 'picker picker--signals', role: 'menu' },
            [null, 0, 1, 2, 3, 4, 5].map(v => el('button', {
                class: ['picker__option', v == null && 'picker__option--none'],
                type: 'button',
                role: 'menuitem',
                'aria-pressed': String(v === sig),
                text: v == null ? 'none' : LETTERS[v],
                on: {
                    click: () => {
                        const sigs = state.rows[index].sigs.slice();
                        sigs[link] = v;
                        updateRow(index, { sigs });
                    },
                },
            }))
        );

        const parts = [el('div', { class: 'chain__anchor' }, sigButton, sigMenu)];

        if (link > 0) {
            const op = row.gates[link - 1];
            const gateButton = el('button', {
                class: 'chain__gate',
                type: 'button',
                'aria-haspopup': 'true',
                'aria-expanded': String(isOpen('gate')),
                on: { click: () => toggle('gate') },
            },
                el('span', { text: GATES.find(g => g.value === op).label }),
                el('span', { 'aria-hidden': 'true', text: '↓' })
            );
            const gateMenu = isOpen('gate') && el('div', { class: 'picker picker--gates', role: 'menu' },
                GATES.map(g => el('button', {
                    class: 'picker__option',
                    type: 'button',
                    role: 'menuitem',
                    'aria-pressed': String(g.value === op),
                    text: g.label,
                    on: {
                        click: () => {
                            const gates = state.rows[index].gates.slice();
                            gates[link - 1] = g.value;
                            updateRow(index, { gates });
                        },
                    },
                }))
            );
            parts.unshift(el('div', { class: 'chain__anchor' }, gateButton, gateMenu));
            parts.push(el('button', {
                class: 'chain__remove',
                type: 'button',
                'aria-label': 'Remove this gate and signal',
                text: '×',
                on: {
                    click: () => {
                        const current = state.rows[index];
                        updateRow(index, {
                            sigs: current.sigs.filter((_, j) => j !== link),
                            gates: current.gates.filter((_, j) => j !== link - 1),
                        });
                    },
                },
            }));
        }

        return el('div', { class: ['chain__link', link > 0 && 'chain__link--joined'] }, parts);
    }

    // Close an open picker on an outside click or Escape
    document.addEventListener('pointerdown', (event) => {
        if (picker && !event.target.closest('.chain__anchor')) setPicker(null);
    });
    document.addEventListener('keydown', (event) => {
        if (picker && event.key === 'Escape') setPicker(null);
    });

    function renderLoop() {
        r.loop.textContent = loopText(state.gens, state.rows);
    }

    setBpm(state.bpm);
    renderLoop();
    renderTransport();
}

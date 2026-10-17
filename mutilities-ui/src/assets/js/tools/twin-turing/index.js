import { el, refs, toggleData } from '../../core/dom.js';
import { WAVEFORMS, ensureAudioRunning } from '../../core/audio.js';
import { BPM_MAX, BPM_MIN, clock, playButtonState } from '../../core/clock.js';
import { createSegmented, createSelect, createSlider, createStepper, createSwitch } from '../../components/controls.js';
import { createPatchMenu } from '../../components/patch-menu.js';
import { PITCH_CLASSES, SCALES, rootOptions, scaleOptions } from '../../music/theory.js';
import { MAX_BITS, RANGE_MAX, RATES, TRIGGERS, defaultState, knobFromOldLock, randomBits } from './logic.js';
import { TuringEngine } from './engine.js';
import { downloadMidi } from './midi.js';

const PLAYER_ID = 'twin-turing';
const LETTERS = ['A', 'B'];
const OCTAVES = { min: 1, max: 5 };
const BAR_OPTIONS = [1, 2, 4, 8, 16].map(n => ({ value: String(n), label: `${n} bar${n > 1 ? 's' : ''}` }));
const MODES = [
    { value: 'summed', label: 'One' },
    { value: 'separate', label: 'Two' },
];
const OCTAVE_B = { min: -1, max: 2 };
const NOTES_ON = [
    { value: 'a', label: 'A steps' },
    { value: 'both', label: 'A + B steps' },
];

const midiName = midi => `${PITCH_CLASSES[midi % 12]}${Math.floor(midi / 12) - 1}`;

/**
 * The knob, laid out like the hardware: right locked, centre random, left
 * "double lock" (every bit flips: a loop twice as long, inverted). In
 * between, the loop slips.
 */
const knobLabel = (v) => {
    if (v >= 0.995) return 'Locked';
    if (v <= 0.005) return 'Locked ×2';
    if (Math.abs(v - 0.5) < 0.015) return 'Random';
    return v > 0.5 ? `${Math.round((v - 0.5) * 200)}% locked` : `Inverting ${Math.round((0.5 - v) * 200)}%`;
};

const machineSummary = m => `${m.length} bits · ${RATES[m.rate].label} · ${knobLabel(m.knob)}`;

export function initTwinTuring(root) {
    const r = refs(root);
    const state = { ...defaultState(), bars: 4 };

    const engine = new TuringEngine(() => state, renderStep);

    // ===== Transport =====

    const tempo = createStepper({
        label: 'Tempo',
        hint: `${BPM_MIN}–${BPM_MAX}`,
        repeat: true,
        onStep: (dir) => { clock.bpm += dir; },
    });
    r.tempo.append(tempo.el);
    const renderTempo = () => tempo.set(`${clock.bpm} BPM`);
    clock.onBpmChange(renderTempo);

    const rootSelect = createSelect({ label: 'Key', options: rootOptions(), value: state.root, onChange: (v) => { state.root = v; } });
    const scaleSelect = createSelect({ label: 'Scale', options: scaleOptions(), value: state.scale, onChange: (v) => { state.scale = v; } });
    r.key.append(rootSelect.el, scaleSelect.el);

    const barsSelect = createSelect({
        label: 'MIDI length',
        options: BAR_OPTIONS,
        value: String(state.bars),
        onChange: (v) => { state.bars = Number(v); },
    });
    r.bars.append(barsSelect.el);
    r.export.addEventListener('click', () => downloadMidi(state, engine.rng.state(), state.bars));

    clock.register(PLAYER_ID, {
        name: 'Twin Turing',
        short: 'Turing',
        page: PLAYER_ID,
        sync: 'clock',
        start: startTicks => engine.start(startTicks),
        stop: () => {
            engine.stop();
            clearLights();
        },
    });
    clock.onChange(renderTransport);

    r.play.addEventListener('click', async () => {
        if (clock.isPlaying(PLAYER_ID)) {
            clock.stop(PLAYER_ID);
        } else {
            await ensureAudioRunning();
            clock.launch(PLAYER_ID);
        }
    });

    function renderTransport() {
        const { label, look, pressed } = playButtonState(PLAYER_ID);
        r.play.setAttribute('aria-pressed', String(pressed));
        r.play.dataset.look = look;
        r.playLabel.textContent = label;
        const s = clock.state(PLAYER_ID);
        toggleData(r.lcdLed, 'on', s === 'playing');
        r.lcdLabel.textContent = s === 'playing' ? `Playing · ${state.root} ${SCALES[state.scale].name}`
            : s === 'queued' ? 'Joining on the next bar' : 'Stopped';
        if (s === 'stopped') r.lcdValue.textContent = '—';
    }

    // ===== Machines =====

    const machineViews = state.machines.map((_, i) => createMachine(i));
    r.machines.append(...machineViews.map(v => v.el));

    function createMachine(index) {
        const letter = LETTERS[index];
        const m = () => state.machines[index];

        const summary = el('span', { class: 'turing-machine__summary' });
        const led = el('span', { class: 'led', 'aria-hidden': 'true' });

        // The register, newest bit first. Display only: bits go in with Write, as on the hardware.
        const bitButtons = Array.from({ length: MAX_BITS }, () => el('span', { class: 'turing-bit' }));
        const register = el('div', { class: 'turing-register', role: 'img', 'aria-label': `Machine ${letter} register` }, bitButtons);

        const length = createStepper({
            label: 'Length',
            hint: 'bits',
            onStep: (dir) => {
                const next = m().length + dir;
                if (next >= 2 && next <= MAX_BITS) update({ length: next });
            },
        });
        const rate = createStepper({
            label: 'Rate',
            hint: 'beats',
            onStep: (dir) => {
                const next = m().rate + dir;
                if (next >= 0 && next < RATES.length) update({ rate: next });
            },
        });
        const range = createStepper({
            label: 'Range',
            hint: 'steps',
            onStep: (dir) => {
                const next = m().range + dir;
                if (next >= 0 && next <= RANGE_MAX) update({ range: next });
            },
        });
        const knob = createSlider({
            label: 'Lock',
            min: 0,
            max: 1,
            step: 0.01,
            value: m().knob,
            format: knobLabel,
            tone: 'cool',
            onInput: v => update({ knob: v }),
        });
        const randomise = el('button', {
            class: 'btn btn--outline turing-machine__randomise',
            type: 'button',
            text: 'Randomise',
            on: {
                click: () => {
                    m().bits = randomBits(engine.rng);
                    renderBits();
                },
            },
        });

        // Write: hold to replace the bit coming round with a 1 or a 0 on each step
        const writeButton = (bit) => {
            const button = el('button', {
                class: 'turing-write',
                type: 'button',
                'aria-label': `Hold to write ${bit}s into machine ${letter}`,
                text: String(bit),
            });
            const hold = (on) => {
                m().write = on ? bit : null;
                toggleData(button, 'on', on);
            };
            button.addEventListener('pointerdown', (event) => {
                event.preventDefault();
                button.setPointerCapture?.(event.pointerId);
                hold(true);
            });
            ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(e => button.addEventListener(e, () => hold(false)));
            button.addEventListener('keydown', (event) => {
                if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) hold(true);
            });
            button.addEventListener('keyup', (event) => {
                if (event.key === 'Enter' || event.key === ' ') hold(false);
            });
            button.addEventListener('blur', () => hold(false));
            return button;
        };
        const write = el('div', { class: 'field turing-machine__write' },
            el('span', { class: 'field__label', text: 'Write (hold while playing)' }),
            el('div', { class: 'turing-machine__write-buttons' }, writeButton(1), writeButton(0))
        );

        // B can be switched off, leaving A on its own
        const onSwitch = index > 0 && createSwitch({
            label: `Machine ${letter} on`,
            checked: m().on,
            onChange: on => update({ on }),
        });

        const panel = el('article', { class: 'panel panel--raised turing-machine', 'aria-label': `Machine ${letter}` },
            el('div', { class: 'turing-machine__head' },
                el('span', { class: 'turing-machine__id' },
                    el('span', { class: 'turing-machine__eyebrow', text: 'MACHINE' }),
                    el('span', { class: 'turing-machine__letter', text: letter })
                ),
                summary,
                led,
                onSwitch && onSwitch.el
            ),
            register,
            el('div', { class: 'turing-machine__controls' },
                knob.el,
                length.el,
                rate.el,
                range.el,
                randomise,
                write
            )
        );

        function update(changeSet) {
            Object.assign(state.machines[index], changeSet);
            sync();
        }

        function renderBits(current = m().bits) {
            bitButtons.forEach((b, i) => {
                b.hidden = i >= m().length;
                toggleData(b, 'on', current[i] === 1);
            });
        }

        function sync() {
            const machine = m();
            summary.textContent = machine.on === false ? 'Off' : machineSummary(machine);
            toggleData(panel, 'off', machine.on === false);
            if (onSwitch) onSwitch.set(machine.on !== false);
            length.set(String(machine.length));
            rate.set(RATES[machine.rate].label);
            range.set(String(machine.range));
            knob.set(machine.knob);
            renderBits();
        }

        let flashTimer = null;
        const flash = () => {
            clearTimeout(flashTimer);
            toggleData(led, 'on', true);
            flashTimer = setTimeout(() => toggleData(led, 'on', false), 90);
        };

        sync();
        return { el: panel, sync, renderBits, flash, led };
    }

    // ===== Voice =====

    // One melody (A and B summed) or two (each machine plays its own)
    const mode = createSegmented({
        label: 'Melodies',
        options: MODES,
        value: state.mode,
        onChange: (v) => {
            state.mode = v;
            engine.releaseAll();
            renderVoiceMode();
        },
    });
    const notesOn = createSegmented({ label: 'Notes on', options: NOTES_ON, value: state.notesOn, onChange: (v) => { state.notesOn = v; } });
    const octaveB = createStepper({
        label: 'B octave',
        hint: 'above A',
        onStep: (dir) => {
            const next = state.octaveB + dir;
            if (next >= OCTAVE_B.min && next <= OCTAVE_B.max) {
                state.octaveB = next;
                octaveB.set(next > 0 ? `+${next}` : String(next));
            }
        },
    });
    const notesOnField = el('div', { class: 'field' }, el('span', { class: 'field__label', text: 'Notes on' }), notesOn.el);

    // Notes on only applies to one melody; B's octave only to two
    function renderVoiceMode() {
        const two = state.mode === 'separate';
        notesOnField.hidden = two;
        octaveB.el.hidden = !two;
    }
    const wave = createSegmented({
        label: 'Waveform',
        options: WAVEFORMS,
        value: state.wave,
        onChange: (v) => {
            state.wave = v;
            engine.setWave(v);
        },
    });
    const gate = createSlider({
        label: 'Gate', min: 0.1, max: 1, step: 0.05, value: state.gate,
        format: v => `${Math.round(v * 100)}%`,
        onInput: (v) => { state.gate = v; },
    });
    const octave = createStepper({
        label: 'Octave',
        onStep: (dir) => {
            const next = state.octave + dir;
            if (next >= OCTAVES.min && next <= OCTAVES.max) {
                state.octave = next;
                octave.set(String(next));
            }
        },
    });

    const trigger = createSegmented({
        label: 'Triggers',
        options: TRIGGERS,
        value: state.trigger,
        onChange: (v) => {
            state.trigger = v;
            engine.releaseAll();
            renderTriggerHint();
        },
    });
    const triggerHint = el('p', { class: 'turing__hint' });
    const TRIGGER_HINTS = {
        pulse: 'Notes play only when the newest bit is 1, so the loop makes a rhythm too.',
        new: 'Every step, but the same note twice holds as one.',
        every: 'A note on every step.',
    };
    const renderTriggerHint = () => { triggerHint.textContent = TRIGGER_HINTS[state.trigger]; };

    r.voice.append(
        el('div', { class: 'panel__head panel__head--ruled' }, el('h2', { class: 'panel__title', text: 'Voice' })),
        el('div', { class: 'turing__voice-params' },
            el('div', { class: 'field' }, el('span', { class: 'field__label', text: 'Melodies' }), mode.el),
            notesOnField,
            octaveB.el,
            el('div', { class: 'field' }, el('span', { class: 'field__label', text: 'Waveform' }), wave.el),
            gate.el,
            octave.el,
            el('div', { class: 'field turing__triggers' },
                el('span', { class: 'field__label', text: 'Triggers' }),
                trigger.el,
                triggerHint
            )
        )
    );

    // ===== Lights =====

    function renderStep({ due, bits, midis }) {
        due.forEach((stepped, i) => {
            if (!stepped) return;
            machineViews[i].renderBits(bits[i]);
            machineViews[i].flash();
        });
        if (midis.length) r.lcdValue.textContent = midis.map(midiName).join(' · ');
    }

    function clearLights() {
        machineViews.forEach(v => toggleData(v.led, 'on', false));
    }

    // ===== Export / import =====

    r.patch.append(createPatchMenu({
        tool: PLAYER_ID,
        version: 1,
        getSettings: () => ({ ...state, machines: state.machines.map(({ write, ...m }) => m), bpm: clock.bpm }),
        applySettings: (settings) => {
            if (!Array.isArray(settings.machines) || settings.machines.length !== 2) throw new Error('Expected two machines');
            const machines = settings.machines.map((s, i) => {
                const was = state.machines[i];
                const bits = Array.isArray(s?.bits) && s.bits.length === MAX_BITS && s.bits.every(b => b === 0 || b === 1) ? [...s.bits] : was.bits;
                const intIn = (v, lo, hi, fallback) => (Number.isInteger(v) && v >= lo && v <= hi ? v : fallback);
                return {
                    on: i === 0 ? true : (typeof s?.on === 'boolean' ? s.on : was.on),
                    bits,
                    length: intIn(s?.length, 2, MAX_BITS, was.length),
                    rate: intIn(s?.rate, 0, RATES.length - 1, was.rate),
                    range: intIn(s?.range, 0, RANGE_MAX, was.range),
                    // Older patches stored `lock` (before the double lock)
                    knob: Number.isFinite(s?.knob) ? Math.min(1, Math.max(0, s.knob))
                        : Number.isFinite(s?.lock) ? knobFromOldLock(Math.min(1, Math.max(0, s.lock))) : was.knob,
                    write: null,
                };
            });
            state.machines = machines;
            if (PITCH_CLASSES.includes(settings.root)) state.root = settings.root;
            if (settings.scale in SCALES) state.scale = settings.scale;
            if (NOTES_ON.some(o => o.value === settings.notesOn)) state.notesOn = settings.notesOn;
            if (MODES.some(o => o.value === settings.mode)) state.mode = settings.mode;
            if (Number.isInteger(settings.octaveB)) state.octaveB = Math.min(OCTAVE_B.max, Math.max(OCTAVE_B.min, settings.octaveB));
            if (WAVEFORMS.some(w => w.value === settings.wave)) state.wave = settings.wave;
            if (TRIGGERS.some(o => o.value === settings.trigger)) state.trigger = settings.trigger;
            // Patches from before Triggers had a Retrigger switch
            else if (typeof settings.retrigger === 'boolean') state.trigger = settings.retrigger ? 'every' : 'new';
            if (Number.isFinite(settings.gate)) state.gate = Math.min(1, Math.max(0.1, settings.gate));
            if (Number.isInteger(settings.octave)) state.octave = Math.min(OCTAVES.max, Math.max(OCTAVES.min, settings.octave));
            if (BAR_OPTIONS.some(o => o.value === String(settings.bars))) state.bars = settings.bars;
            if (Number.isFinite(settings.bpm)) clock.bpm = settings.bpm;
            syncAll();
        },
    }));

    function syncAll() {
        machineViews.forEach(v => v.sync());
        rootSelect.set(state.root);
        scaleSelect.set(state.scale);
        barsSelect.set(String(state.bars));
        notesOn.set(state.notesOn);
        mode.set(state.mode);
        octaveB.set(state.octaveB > 0 ? `+${state.octaveB}` : String(state.octaveB));
        renderVoiceMode();
        wave.set(state.wave);
        engine.setWave(state.wave);
        gate.set(state.gate);
        octave.set(String(state.octave));
        trigger.set(state.trigger);
        renderTriggerHint();
        renderTransport();
    }

    renderTempo();
    syncAll();
}

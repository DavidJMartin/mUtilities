import { el, isTextEntry, refs, toggleData } from '../../core/dom.js';
import { WAVEFORMS, ensureAudioRunning } from '../../core/audio.js';
import { createKeyboard } from '../../components/keyboard.js';
import { createSegmented, createSlider, createStepper, createSwitch } from '../../components/controls.js';
import { clock } from '../../core/clock.js';
import { frequency, midiNumber, parseNote } from '../../music/theory.js';
import { createPatchMenu } from '../../components/patch-menu.js';
import { DEFAULT_PATCH, KeySynthEngine } from './engine.js';
import { ARP_DIRECTIONS, ARP_OCTAVES, ARP_RATES, DEFAULT_ARP, createArp, rateLabel } from './arp.js';
import { drawEnvelope } from './envelope-graph.js';

const PAGE_ID = 'key-synth';
// At octave 0; the octave switch shifts the whole range
const RANGE = { from: 'C4', to: 'D5' };
const OCTAVE_LIMIT = 2;

// Z / X step the octave down / up, as in most DAWs
const OCTAVE_KEYS = { z: -1, x: 1 };

// Laid out like a piano across the home row of a QWERTY keyboard (at octave 0)
const KEY_MAP = {
    a: 'C4', w: 'C#4', s: 'D4', e: 'D#4', d: 'E4', f: 'F4', t: 'F#4', g: 'G4',
    y: 'G#4', h: 'A4', u: 'A#4', j: 'B4', k: 'C5', o: 'C#5', l: 'D5',
};

const SLIDERS = {
    filter: [
        { key: 'cutoff', label: 'Cutoff', min: 20, max: 8000, step: 10, format: v => `${Math.round(v)} Hz` },
        { key: 'resonance', label: 'Resonance', min: 0.1, max: 20, step: 0.1, format: v => v.toFixed(1) },
    ],
    envelope: [
        { key: 'attack', label: 'Attack', min: 0.001, max: 2, step: 0.001, format: v => `${v.toFixed(2)} s` },
        { key: 'decay', label: 'Decay', min: 0.001, max: 2, step: 0.001, format: v => `${v.toFixed(2)} s` },
        { key: 'sustain', label: 'Sustain', min: 0, max: 1, step: 0.01, format: v => v.toFixed(2) },
        { key: 'release', label: 'Release', min: 0.001, max: 3, step: 0.001, format: v => `${v.toFixed(2)} s` },
    ],
};

// How long Enter / Space on a focused key plays its note
const TAP_LENGTH_MS = 300;

export function initKeySynth(root, router) {
    const r = refs(root);
    let patch = { ...DEFAULT_PATCH };
    const engine = new KeySynthEngine(patch);

    // A note can be held by several sources at once (a computer key and a
    // finger), and only stops when all of them let go.

    // note -> sources holding it
    const held = new Map();
    const sounding = new Set();
    // Notes handed to the arp (with the arp on, keys feed it instead of sounding)
    const arpHeld = new Set();
    let lastNote = null;

    const arp = createArp(engine, (note) => {
        r.lcdValue.textContent = note;
    }, () => {
        // Stopped from the playground strip: the keys no longer feed it
        arpHeld.clear();
        render();
    });

    async function press(note, source) {
        if (!held.has(note)) held.set(note, new Set());
        held.get(note).add(source);
        lastNote = note;
        render();

        await ensureAudioRunning();
        // The key may have been released while audio was starting up
        if (!held.has(note)) return;
        if (arp.isOn()) {
            if (!arpHeld.has(note)) {
                arpHeld.add(note);
                arp.noteDown(note);
                render();
            }
        } else if (!sounding.has(note)) {
            engine.noteOn(note);
            sounding.add(note);
        }
    }

    function release(note, source) {
        const sources = held.get(note);
        if (!sources) return;
        sources.delete(source);
        if (sources.size > 0) return;

        held.delete(note);
        if (sounding.delete(note)) engine.noteOff(note);
        if (arpHeld.delete(note)) arp.noteUp(note);
        render();
    }

    // Lets go of the keys; a latched arp keeps playing
    function releaseAll() {
        held.clear();
        sounding.clear();
        arpHeld.clear();
        engine.releaseAll();
        arp.releaseHeld();
        render();
    }

    // Octave shift: the on-screen keys and the QWERTY keys both move, so
    // what's shown is always what plays
    let octave = 0;
    const shifted = (note) => {
        const { pc, octave: o } = parseNote(note);
        return `${pc}${o + octave}`;
    };
    const keyFor = (key) => (KEY_MAP[key] ? shifted(KEY_MAP[key]) : null);

    // Listeners live on the container, so the keyboard can be rebuilt per octave
    const keyboard = r.keyboard;
    const buildKeyboard = () => {
        const caps = Object.fromEntries(Object.entries(KEY_MAP).map(([key, note]) => [shifted(note), key.toUpperCase()]));
        const from = shifted(RANGE.from);
        const to = shifted(RANGE.to);
        keyboard.replaceChildren(createKeyboard({ from, to, caps, playable: true, label: 'Synth keyboard' }));
        r.range.textContent = `${from} – ${to}`;
    };

    const octaveControl = createStepper({
        label: 'Octave',
        inline: true,
        onStep: dir => setOctave(octave + dir),
    });
    r.octave.append(octaveControl.el);

    function setOctave(next) {
        const clamped = Math.max(-OCTAVE_LIMIT, Math.min(OCTAVE_LIMIT, next));
        if (clamped === octave) return;
        // Held notes belong to the old octave; let them go rather than leave them hanging
        releaseAll();
        arp.clear();
        pointers.clear();
        octave = clamped;
        octaveControl.set(octave > 0 ? `+${octave}` : String(octave));
        buildKeyboard();
    }

    // pointer id -> note under it
    const pointers = new Map();

    keyboard.addEventListener('pointerdown', (event) => {
        const note = event.target.closest('.keyboard__key')?.dataset.note;
        if (!note) return;
        event.preventDefault();
        pointers.set(event.pointerId, note);
        press(note, `pointer:${event.pointerId}`);
    });

    // Sliding across keys plays each one (glissando)
    window.addEventListener('pointermove', (event) => {
        if (!pointers.has(event.pointerId)) return;
        const previous = pointers.get(event.pointerId);
        const key = document.elementFromPoint(event.clientX, event.clientY)?.closest('.keyboard__key');
        const current = key && keyboard.contains(key) ? key.dataset.note : null;
        if (current === previous) return;

        const source = `pointer:${event.pointerId}`;
        if (previous) release(previous, source);
        if (current) press(current, source);
        pointers.set(event.pointerId, current);
    });

    const endPointer = (event) => {
        if (!pointers.has(event.pointerId)) return;
        const note = pointers.get(event.pointerId);
        pointers.delete(event.pointerId);
        if (note) release(note, `pointer:${event.pointerId}`);
    };
    window.addEventListener('pointerup', endPointer);
    window.addEventListener('pointercancel', endPointer);

    // Enter / Space on a focused key (click with no pointer) plays a short note
    keyboard.addEventListener('click', (event) => {
        if (event.detail !== 0) return;
        const note = event.target.closest('.keyboard__key')?.dataset.note;
        if (!note) return;
        press(note, 'keyboard-activation');
        setTimeout(() => release(note, 'keyboard-activation'), TAP_LENGTH_MS);
    });

    // QWERTY playing, only while this page is showing
    document.addEventListener('keydown', (event) => {
        if (router.current() !== PAGE_ID || event.repeat || event.metaKey || event.ctrlKey || event.altKey || isTextEntry(event.target)) return;
        const key = event.key.toLowerCase();
        if (key in OCTAVE_KEYS) {
            event.preventDefault();
            setOctave(octave + OCTAVE_KEYS[key]);
            return;
        }
        const note = keyFor(key);
        if (!note) return;
        event.preventDefault();
        press(note, `key:${key}`);
    });

    document.addEventListener('keyup', (event) => {
        const key = event.key.toLowerCase();
        const note = keyFor(key);
        if (note) release(note, `key:${key}`);
    });

    // Never leave notes hanging
    window.addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) releaseAll();
    });
    router.onChange((page, previous) => {
        if (previous === PAGE_ID) releaseAll();
    });

    const setPatch = (change) => {
        patch = { ...patch, ...change };
        engine.set(change);
        drawEnvelope({ line: r.envLine, fill: r.envFill, labels: r.envLabels }, patch);
    };

    const shapeControl = createSegmented({
        label: 'Waveform',
        options: WAVEFORMS,
        value: patch.shape,
        onChange: (shape) => setPatch({ shape }),
    });
    r.shape.append(shapeControl.el);

    // Sliders kept by patch key so an imported patch can move them
    const sliders = {};
    const mountSliders = (container, specs, tone) => {
        container.append(...specs.map(({ key, ...spec }) => {
            sliders[key] = createSlider({
                ...spec,
                tone,
                value: patch[key],
                onInput: (v) => setPatch({ [key]: v }),
            });
            return sliders[key].el;
        }));
    };
    mountSliders(r.filter, SLIDERS.filter);
    mountSliders(r.envelope, SLIDERS.envelope, 'cool');

    // Export / import the sound and the octave
    const specs = [...SLIDERS.filter, ...SLIDERS.envelope];
    r.patch.append(createPatchMenu({
        tool: 'key-synth',
        version: 1,
        getSettings: () => ({ patch, octave, arp: arp.options }),
        applySettings: (settings) => {
            const next = {};
            if (WAVEFORMS.some(w => w.value === settings.patch?.shape)) next.shape = settings.patch.shape;
            for (const { key, min, max } of specs) {
                const v = settings.patch?.[key];
                if (Number.isFinite(v)) next[key] = Math.min(max, Math.max(min, v));
            }
            setPatch(next);
            shapeControl.set(patch.shape);
            Object.entries(sliders).forEach(([key, control]) => control.set(patch[key]));
            if (Number.isInteger(settings.octave)) setOctave(settings.octave);
            if (settings.arp && typeof settings.arp === 'object') {
                const a = settings.arp;
                setArp({
                    on: typeof a.on === 'boolean' ? a.on : arp.options.on,
                    latch: typeof a.latch === 'boolean' ? a.latch : arp.options.latch,
                    direction: ARP_DIRECTIONS.some(d => d.value === a.direction) ? a.direction : arp.options.direction,
                    rate: ARP_RATES.includes(a.rate) ? a.rate : arp.options.rate,
                    octaves: Number.isInteger(a.octaves) ? Math.min(ARP_OCTAVES.max, Math.max(ARP_OCTAVES.min, a.octaves)) : arp.options.octaves,
                    gate: Number.isFinite(a.gate) ? Math.min(1, Math.max(0.1, a.gate)) : arp.options.gate,
                });
            }
        },
    }));

    // ===== Arp panel =====

    const arpSwitch = createSwitch({ label: 'Arpeggiator on', checked: DEFAULT_ARP.on, onChange: on => setArp({ on }) });
    const latchSwitch = createSwitch({ label: 'Latch', checked: DEFAULT_ARP.latch, small: true, onChange: latch => setArp({ latch }) });
    const directionControl = createSegmented({
        label: 'Arp direction',
        options: ARP_DIRECTIONS,
        value: DEFAULT_ARP.direction,
        small: true,
        onChange: direction => setArp({ direction }),
    });
    const rateControl = createStepper({
        label: 'Rate',
        hint: 'of a beat',
        onStep: (dir) => {
            const i = ARP_RATES.indexOf(arp.options.rate) + dir;
            if (i >= 0 && i < ARP_RATES.length) setArp({ rate: ARP_RATES[i] });
        },
    });
    const octavesControl = createStepper({
        label: 'Octaves',
        onStep: (dir) => {
            const next = arp.options.octaves + dir;
            if (next >= ARP_OCTAVES.min && next <= ARP_OCTAVES.max) setArp({ octaves: next });
        },
    });
    const gateControl = createSlider({
        label: 'Gate',
        min: 0.1,
        max: 1,
        step: 0.05,
        value: DEFAULT_ARP.gate,
        format: v => `${Math.round(v * 100)}%`,
        tone: 'cool',
        onInput: gate => setArp({ gate }),
    });
    // Tempo is the shared clock's, so it's the same as Logical Drums'
    const tempoControl = createStepper({
        label: 'Tempo',
        hint: 'shared',
        repeat: true,
        onStep: (dir) => { clock.bpm += dir; },
    });
    tempoControl.el.classList.add('key-synth__arp-tempo');
    const renderTempo = () => tempoControl.set(`${clock.bpm} BPM`);
    clock.onBpmChange(renderTempo);

    r.arp.append(
        el('div', { class: 'panel__head panel__head--ruled' },
            el('h2', { class: 'panel__title', text: 'Arp' }),
            arpSwitch.el
        ),
        el('div', { class: 'key-synth__arp-params' },
            el('div', { class: 'field key-synth__arp-wide' },
                el('span', { class: 'field__label', text: 'Direction' }),
                directionControl.el
            ),
            rateControl.el,
            octavesControl.el,
            gateControl.el,
            tempoControl.el,
            el('label', { class: 'field field--inline key-synth__latch' },
                el('span', { class: 'field__label', text: 'Latch (keeps playing after you let go)' }),
                latchSwitch.el
            )
        )
    );

    function setArp(change) {
        const wasOn = arp.isOn();
        // Notes held as plain synth notes don't carry over into the arp, and vice versa
        if ('on' in change && change.on !== wasOn) {
            engine.releaseAll();
            sounding.clear();
            arpHeld.clear();
        }
        arp.set(change);
        renderArp();
        render();
    }

    function renderArp() {
        const o = arp.options;
        arpSwitch.set(o.on);
        latchSwitch.set(o.latch);
        directionControl.set(o.direction);
        rateControl.set(rateLabel(o.rate));
        octavesControl.set(String(o.octaves));
        gateControl.set(o.gate);
        toggleData(r.arp, 'off', !o.on);
    }

    function render() {
        // Held keys light up; with a latched arp, the notes it's still playing show too
        const latched = new Set(arp.isOn() ? arp.notes : []);
        keyboard.querySelectorAll('.keyboard__key').forEach(key => {
            if (held.has(key.dataset.note)) {
                key.dataset.state = 'active';
            } else if (latched.has(key.dataset.note)) {
                key.dataset.state = 'preview';
            } else {
                delete key.dataset.state;
            }
        });

        if (arp.isOn()) {
            const o = arp.options;
            const direction = ARP_DIRECTIONS.find(d => d.value === o.direction).label;
            r.lcdLabel.textContent = `Arp · ${direction} · ${rateLabel(o.rate)}${o.latch ? ' · latch' : ''}`;
            if (!arp.notes.length) r.lcdValue.textContent = '— hold some keys —';
            return;
        }

        if (held.size > 0) {
            const notes = [...held.keys()].sort((a, b) => pitchOrder(a) - pitchOrder(b));
            r.lcdLabel.textContent = 'Playing';
            r.lcdValue.textContent = notes.join(' · ');
        } else {
            r.lcdLabel.textContent = 'Last note';
            r.lcdValue.textContent = lastNote
                ? `${lastNote} · ${frequency(lastNote).toFixed(1)} Hz`
                : '— press a key —';
        }
    }

    drawEnvelope({ line: r.envLine, fill: r.envFill, labels: r.envLabels }, patch);
    octaveControl.set('0');
    buildKeyboard();
    renderArp();
    renderTempo();
    render();
}

function pitchOrder(noteId) {
    const { pc, octave } = parseNote(noteId);
    return midiNumber(pc, octave);
}

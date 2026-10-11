import { refs } from '../../core/dom.js';
import { WAVEFORMS, ensureAudioRunning } from '../../core/audio.js';
import { createKeyboard } from '../../components/keyboard.js';
import { createSegmented, createSlider } from '../../components/controls.js';
import { frequency, midiNumber, parseNote } from '../../music/theory.js';
import { DEFAULT_PATCH, KeySynthEngine } from './engine.js';
import { drawEnvelope } from './envelope-graph.js';

const PAGE_ID = 'key-synth';
const RANGE = { from: 'C4', to: 'D5' };

// Laid out like a piano across the home row of a QWERTY keyboard
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
    let lastNote = null;

    async function press(note, source) {
        if (!held.has(note)) held.set(note, new Set());
        held.get(note).add(source);
        lastNote = note;
        render();

        await ensureAudioRunning();
        // The key may have been released while audio was starting up
        if (held.has(note) && !sounding.has(note)) {
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
        render();
    }

    function releaseAll() {
        held.clear();
        sounding.clear();
        engine.releaseAll();
        render();
    }

    const caps = Object.fromEntries(Object.entries(KEY_MAP).map(([key, note]) => [note, key.toUpperCase()]));
    const keyboard = createKeyboard({ ...RANGE, caps, playable: true, label: 'Synth keyboard' });
    r.keyboard.append(keyboard);

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
    const isTyping = (target) => target.matches?.('input, select, textarea, [contenteditable]');

    document.addEventListener('keydown', (event) => {
        if (router.current() !== PAGE_ID || event.repeat || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
        const note = KEY_MAP[event.key.toLowerCase()];
        if (!note) return;
        event.preventDefault();
        press(note, `key:${event.key.toLowerCase()}`);
    });

    document.addEventListener('keyup', (event) => {
        const note = KEY_MAP[event.key.toLowerCase()];
        if (note) release(note, `key:${event.key.toLowerCase()}`);
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

    r.shape.append(createSegmented({
        label: 'Waveform',
        options: WAVEFORMS,
        value: patch.shape,
        onChange: (shape) => setPatch({ shape }),
    }).el);

    const mountSliders = (container, specs, tone) => {
        container.append(...specs.map(({ key, ...spec }) => createSlider({
            ...spec,
            tone,
            value: patch[key],
            onInput: (v) => setPatch({ [key]: v }),
        }).el));
    };
    mountSliders(r.filter, SLIDERS.filter);
    mountSliders(r.envelope, SLIDERS.envelope, 'cool');

    function render() {
        keyboard.querySelectorAll('.keyboard__key').forEach(key => {
            if (held.has(key.dataset.note)) {
                key.dataset.state = 'active';
            } else {
                delete key.dataset.state;
            }
        });

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
    render();
}

function pitchOrder(noteId) {
    const { pc, octave } = parseNote(noteId);
    return midiNumber(pc, octave);
}

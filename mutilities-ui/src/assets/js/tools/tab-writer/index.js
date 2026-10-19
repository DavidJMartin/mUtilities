// Tab Writer: tap a beat in the tab, then tap the fretboard to write notes.
// Built for touch first: no typing, everything is a tap.

import { el, isTextEntry, refs, toggleData } from '../../core/dom.js';
import { ensureAudioRunning } from '../../core/audio.js';
import { BPM_MAX, BPM_MIN, clock, playButtonState } from '../../core/clock.js';
import { downloadBlob, timestamp } from '../../core/files.js';
import { copyText } from '../../core/patch-io.js';
import { createSegmented, createStepper, createSwitch } from '../../components/controls.js';
import { createFretboard } from '../../components/fretboard.js';
import { createPatchMenu } from '../../components/patch-menu.js';
import { showToast } from '../../components/toast.js';
import { GUITAR_STRINGS, PITCH_CLASSES, scalePitchClasses } from '../../music/theory.js';
import {
    DURATIONS,
    FRETS,
    STRING_COUNT,
    asciiTab,
    defaultSong,
    emptyBeat,
    layout,
    matchingKeys,
    pitchOf,
    sanitizeSong,
} from './logic.js';
import { TabEngine } from './engine.js';
import { downloadMidi } from './midi.js';

const PLAYER_ID = 'tab-writer';
const STORAGE_KEY = 'mutilities-tab-writer';
const MAX_CAPO = 7;
const MAX_KEYS_SHOWN = 12;

const midiName = midi => `${PITCH_CLASSES[midi % 12]}${Math.floor(midi / 12) - 1}`;

function loadSaved() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? sanitizeSong(JSON.parse(saved)) : null;
    } catch {
        return null;
    }
}

export function initTabWriter(root, router) {
    const r = refs(root);

    // Remembered between visits on this device; export/import for anything more
    let song = loadSaved() ?? defaultSong();
    let selected = 0;
    let playing = null; // beat index under the playhead
    let previewKey = null; // { root, type } chosen from the key chips
    let autoAdvance = true;
    let hearNotes = false; // tapped notes are silent unless switched on

    const save = () => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(song));
        } catch {
            // Storage can be unavailable (private mode); the tab still works for this visit
        }
    };

    const engine = new TabEngine(() => song, (index) => {
        playing = index;
        renderStaff();
    });

    // ===== Transport and output =====

    const tempo = createStepper({
        label: 'Tempo',
        hint: `${BPM_MIN}–${BPM_MAX}`,
        repeat: true,
        onStep: (dir) => { clock.bpm += dir; },
    });
    r.tempo.append(tempo.el);
    const renderTempo = () => tempo.set(`${clock.bpm} BPM`);
    clock.onBpmChange(renderTempo);

    clock.register(PLAYER_ID, {
        name: 'Tab Writer',
        short: 'Tab',
        page: PLAYER_ID,
        sync: 'clock',
        start: startTicks => engine.start(startTicks),
        stop: () => engine.stop(),
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
    }

    r.copy.addEventListener('click', async () => {
        const ok = await copyText(asciiTab(song));
        showToast(ok ? 'Tab copied' : "Couldn't copy. Try Save .txt instead.", { error: !ok });
    });
    r.saveTab.addEventListener('click', () => {
        downloadBlob(new Blob([asciiTab(song)], { type: 'text/plain' }), `tab-writer-${timestamp()}.txt`);
    });
    r.midi.addEventListener('click', () => downloadMidi(song));
    r.new.addEventListener('click', () => {
        // The one confirmation on the site: this throws away the tab
        // eslint-disable-next-line no-alert
        if (!window.confirm('Start a new tab? The current one will be cleared (export it first to keep it).')) return;
        setSong(defaultSong());
        selected = 0;
        render();
    });

    // ===== Editing =====

    function setSong(next) {
        song = next;
        save();
    }

    const beat = () => song.beats[selected];

    function select(index) {
        selected = Math.max(0, Math.min(song.beats.length - 1, index));
        render();
    }

    /** Tap a fret: write that note on its string in the selected beat, or remove it if it's already there */
    function toggleNote(string, fret) {
        const notes = { ...beat().notes };
        const removing = notes[string] === fret;
        if (removing) {
            delete notes[string];
        } else {
            notes[string] = fret;
        }
        const beats = song.beats.slice();
        beats[selected] = { ...beat(), notes };
        setSong({ ...song, beats });

        // Riffs: move on after each note, adding a beat at the end if needed
        if (!removing && autoAdvance) {
            if (selected === song.beats.length - 1) {
                setSong({ ...song, beats: [...song.beats, emptyBeat(beat().dur)] });
            }
            selected += 1;
        }
        render();
        if (!removing && hearNotes) engine.audition(string, fret, song.capo);
    }

    function editBeats(fn) {
        const beats = song.beats.slice();
        fn(beats);
        setSong({ ...song, beats: beats.length ? beats : [emptyBeat()] });
        selected = Math.max(0, Math.min(selected, song.beats.length - 1));
        render();
    }

    // ===== Beat tools =====

    const duration = createSegmented({
        label: 'Beat length',
        options: DURATIONS.map(d => ({ value: d.id, label: d.label })),
        value: beat().dur,
        onChange: setLength,
    });

    function setLength(dur) {
        editBeats((beats) => { beats[selected] = { ...beats[selected], dur }; });
    }

    /** Longer (-1) or shorter (+1), along DURATIONS */
    function stepLength(dir) {
        const i = DURATIONS.findIndex(d => d.id === beat().dur) + dir;
        if (i >= 0 && i < DURATIONS.length) setLength(DURATIONS[i].id);
    }

    function nextBeat() {
        // Past the end: add a beat, so ▶ also extends the tab
        if (selected === song.beats.length - 1) editBeats(beats => beats.push(emptyBeat(beat().dur)));
        select(selected + 1);
    }

    /** Like backspace in text: step back a beat and clear what's there */
    function backspace() {
        if (selected > 0) selected -= 1;
        editBeats((beats) => { beats[selected] = { ...beats[selected], notes: {} }; });
    }

    const tool = (label, text, onClick, extra = {}) => el('button', {
        class: 'tab-tool',
        type: 'button',
        'aria-label': label,
        text,
        on: { click: onClick },
        ...extra,
    });

    r.tools.append(
        el('div', { class: 'field tab__length' }, el('span', { class: 'field__label', text: 'Beat length (of a bar)' }), duration.el),
        el('div', { class: 'tab__buttons' },
            tool('Previous beat', '◀', () => select(selected - 1)),
            tool('Next beat', '▶', nextBeat),
            tool('Add a beat after this one', '+ Beat', () => {
                editBeats(beats => beats.splice(selected + 1, 0, emptyBeat(beat().dur)));
                select(selected + 1);
            }),
            tool('Duplicate this beat', 'Duplicate', () => {
                editBeats(beats => beats.splice(selected + 1, 0, { ...beat(), notes: { ...beat().notes } }));
                select(selected + 1);
            }),
            tool('Clear the notes in this beat', 'Clear', () => editBeats((beats) => { beats[selected] = { ...beats[selected], notes: {} }; })),
            tool('Delete this beat', 'Delete', () => editBeats(beats => beats.splice(selected, 1)))
        ),
        el('p', { class: 'meta tab__key-hint', text: 'Keys: A D or ← → move · W S or ↑ ↓ length · Q E slide the neck · ⌫ back and clear' })
    );

    // ===== Keyboard (laptops): move, change length, backspace =====

    const KEYS = {
        a: () => select(selected - 1),
        arrowleft: () => select(selected - 1),
        d: nextBeat,
        arrowright: nextBeat,
        w: () => stepLength(-1),
        arrowup: () => stepLength(-1),
        s: () => stepLength(1),
        arrowdown: () => stepLength(1),
        backspace,
        q: () => slideNeck(-1),
        e: () => slideNeck(1),
    };
    document.addEventListener('keydown', (event) => {
        if (router.current() !== PLAYER_ID || event.metaKey || event.ctrlKey || event.altKey || isTextEntry(event.target)) return;
        const action = KEYS[event.key.toLowerCase()];
        if (!action) return;
        event.preventDefault();
        action();
    });

    // ===== Fretboard =====

    // The neck shows 13 frets at a time and slides up to fret 24 (e.g. riffs around the 12th)
    const SHOWN = 12;
    let fromFret = 0;
    let fretboard = createFretboard({ frets: SHOWN, from: fromFret });
    r.fretboard.append(fretboard);

    function slideNeck(dir) {
        const next = Math.max(0, Math.min(FRETS - SHOWN, fromFret + dir));
        if (next === fromFret) return;
        fromFret = next;
        const fresh = createFretboard({ frets: SHOWN, from: fromFret });
        fretboard.replaceWith(fresh);
        fretboard = fresh;
        renderNeck();
        renderFretboard();
    }

    const neck = createStepper({
        label: 'Frets',
        inline: true,
        repeat: true,
        onStep: slideNeck,
    });
    const renderNeck = () => neck.set(`${fromFret}–${fromFret + SHOWN}`);

    r.fretboard.addEventListener('click', (event) => {
        const cell = event.target.closest('.fretboard__cell');
        if (!cell) return;
        if (hearNotes) ensureAudioRunning();
        toggleNote(Number(cell.dataset.string), Number(cell.dataset.fret));
    });

    const capo = createStepper({
        label: 'Capo',
        inline: true,
        onStep: (dir) => {
            const next = song.capo + dir;
            if (next < 0 || next > MAX_CAPO) return;
            setSong({ ...song, capo: next });
            render();
        },
    });
    const advance = createSwitch({
        label: 'Move to the next beat after each note',
        checked: autoAdvance,
        small: true,
        onChange: (on) => { autoAdvance = on; },
    });
    const hear = createSwitch({
        label: 'Play notes as you tap them',
        checked: hearNotes,
        small: true,
        onChange: (on) => {
            hearNotes = on;
            if (on) ensureAudioRunning();
        },
    });
    r.fretOptions.append(
        neck.el,
        capo.el,
        el('label', { class: 'field field--inline tab__hear' }, el('span', { class: 'field__label', text: 'Hear notes' }), hear.el),
        el('label', { class: 'field field--inline tab__advance' }, el('span', { class: 'field__label', text: 'Auto-advance' }), advance.el)
    );

    // ===== Keys =====

    r.keys.addEventListener('click', (event) => {
        const chip = event.target.closest('[data-root]');
        if (!chip) return;
        const same = previewKey?.root === chip.dataset.root && previewKey?.type === chip.dataset.type;
        previewKey = same ? null : { root: chip.dataset.root, type: chip.dataset.type };
        render();
    });

    // ===== Rendering =====

    function render() {
        renderStaff();
        renderTools();
        renderFretboard();
        renderKeys();
        renderLcd();
    }

    const inKey = () => (previewKey ? new Set(scalePitchClasses(previewKey.root, previewKey.type)) : null);

    function renderStaff() {
        const placed = layout(song.beats);
        const keyPcs = inKey();
        const bars = [];
        song.beats.forEach((b, i) => {
            const cells = Array.from({ length: STRING_COUNT }, (_, s) => {
                const fret = b.notes[s];
                const out = fret !== undefined && keyPcs && !keyPcs.has(PITCH_CLASSES[pitchOf(s, fret, song.capo) % 12]);
                return el('span', { class: 'tab-cell', dataset: { out } }, fret ?? '');
            });
            const column = el('button', {
                class: 'tab-beat',
                type: 'button',
                'aria-label': `Beat ${i + 1}: ${beatDescription(b)}`,
                'aria-pressed': String(i === selected),
                dataset: { playing: i === playing, dur: b.dur },
                on: { click: () => select(i) },
            }, cells, el('span', { class: 'tab-beat__dur', 'aria-hidden': 'true', text: DURATIONS.find(d => d.id === b.dur).label }));
            (bars[placed[i].bar] ??= []).push(column);
        });

        const names = el('div', { class: 'tab-names', 'aria-hidden': 'true' },
            GUITAR_STRINGS.map(s => el('span', { class: 'tab-cell', text: s.name })));
        const scrollLeft = r.staff.scrollLeft;
        r.staff.replaceChildren(names, ...bars.map((columns = []) => el('div', { class: 'tab-bar' }, columns)));
        r.staff.scrollLeft = scrollLeft;
        // Keep the selected beat in view
        r.staff.querySelector('.tab-beat[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    function beatDescription(b) {
        const notes = Object.entries(b.notes).map(([s, f]) => midiName(pitchOf(Number(s), f, song.capo)));
        return notes.length ? notes.join(', ') : 'rest';
    }

    function renderTools() {
        duration.set(beat().dur);
        capo.set(song.capo ? String(song.capo) : 'none');
    }

    function renderFretboard() {
        const keyPcs = inKey();
        fretboard.querySelectorAll('.fretboard__cell').forEach((cell) => {
            const s = Number(cell.dataset.string);
            const fret = Number(cell.dataset.fret);
            if (beat().notes[s] === fret) {
                cell.dataset.state = 'selected';
            } else if (keyPcs?.has(PITCH_CLASSES[pitchOf(s, fret, song.capo) % 12])) {
                cell.dataset.state = 'preview';
            } else {
                delete cell.dataset.state;
            }
        });
    }

    function renderKeys() {
        const keys = matchingKeys(song);
        const hasNotes = song.beats.some(b => Object.keys(b.notes).length);
        if (previewKey && !keys.some(k => k.root === previewKey.root && k.type === previewKey.type)) previewKey = null;
        r.keyCount.textContent = hasNotes ? `${keys.length} match${keys.length === 1 ? '' : 'es'}` : '';
        if (!hasNotes) {
            r.keys.replaceChildren(el('p', { class: 'placeholder', text: 'Write some notes to see which keys they fit.' }));
            return;
        }
        if (!keys.length) {
            r.keys.replaceChildren(el('p', { class: 'placeholder', text: 'No single scale fits every note (chromatic notes are fine, this is just a hint).' }));
            return;
        }
        r.keys.replaceChildren(...keys.slice(0, MAX_KEYS_SHOWN).map(k => el('button', {
            class: 'chip',
            type: 'button',
            'aria-pressed': String(previewKey?.root === k.root && previewKey?.type === k.type),
            dataset: { root: k.root, type: k.type },
            text: k.name,
        })));
    }

    function renderLcd() {
        const placed = layout(song.beats);
        r.lcdLabel.textContent = `Beat ${selected + 1} of ${song.beats.length} · bar ${placed[selected].bar + 1}`;
        const desc = beatDescription(beat());
        r.lcdValue.textContent = desc === 'rest' ? 'Rest' : desc.replaceAll(', ', ' · ');
    }

    // ===== Export / import =====

    r.patch.append(createPatchMenu({
        tool: PLAYER_ID,
        version: 1,
        getSettings: () => ({ song, bpm: clock.bpm }),
        applySettings: (settings) => {
            const next = sanitizeSong(settings.song);
            setSong(next);
            if (Number.isFinite(settings.bpm)) clock.bpm = settings.bpm;
            selected = 0;
            previewKey = null;
            render();
        },
    }));

    renderTempo();
    renderNeck();
    renderTransport();
    render();
}

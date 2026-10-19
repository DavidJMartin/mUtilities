// Tab Writer: pure song logic, no audio or DOM. Playback, the tab display,
// ASCII export and MIDI export all use this.
//
// A song is a list of beats. Each beat has a duration and up to one note per
// string ({ string: fret }); a beat with no notes is a rest. Bars aren't
// stored: they're worked out from the durations, in 4/4. Notes store string
// and fret, and the pitch comes from the tuning, which is what makes key
// matching and MIDI export possible.

import { GUITAR_STRINGS, PITCH_CLASSES, findMatchingKeys, midiNumber } from '../../music/theory.js';

export const TICKS_PER_BEAT = 48;
export const TICKS_PER_BAR = TICKS_PER_BEAT * 4;
export const FRETS = 24; // the highest fret; the fretboard shows 13 at a time and slides
export const STRING_COUNT = GUITAR_STRINGS.length; // high e first, as tab is written

/** Durations as a fraction of a 4/4 bar */
export const DURATIONS = [
    { id: 'w', label: '1', ticks: 192 },
    { id: 'h', label: '1/2', ticks: 96 },
    { id: 'q', label: '1/4', ticks: 48 },
    { id: 'e', label: '1/8', ticks: 24 },
    { id: 's', label: '1/16', ticks: 12 },
];
const ticksOf = id => DURATIONS.find(d => d.id === id).ticks;

export const emptyBeat = (dur = 'q') => ({ dur, notes: {} });

export function defaultSong() {
    return { capo: 0, beats: Array.from({ length: 8 }, () => emptyBeat('e')) };
}

/** MIDI pitch of a fret on a string, in standard tuning with the capo */
export function pitchOf(string, fret, capo = 0) {
    const s = GUITAR_STRINGS[string];
    return midiNumber(s.pc, s.octave) + capo + fret;
}

/**
 * Where each beat starts (ticks from the top) and which bar it's in. A beat
 * that won't fit in what's left of a bar starts the next one.
 */
export function layout(beats) {
    let tick = 0;
    let bar = 0;
    let inBar = 0;
    return beats.map((beat) => {
        const length = ticksOf(beat.dur);
        if (inBar > 0 && inBar + length > TICKS_PER_BAR) {
            tick += TICKS_PER_BAR - inBar;
            bar += 1;
            inBar = 0;
        }
        const placed = { start: tick, length, bar };
        tick += length;
        inBar += length;
        if (inBar >= TICKS_PER_BAR) {
            bar += 1;
            inBar = 0;
        }
        return placed;
    });
}

/** The song's length in ticks, rounded up to whole bars (for looping) */
export function songTicks(beats) {
    if (!beats.length) return TICKS_PER_BAR;
    const placed = layout(beats);
    const last = placed[placed.length - 1];
    return Math.ceil((last.start + last.length) / TICKS_PER_BAR) * TICKS_PER_BAR;
}

/** Every note with its timing and pitch, in order */
export function songNotes(song) {
    const placed = layout(song.beats);
    return song.beats.flatMap((beat, i) => Object.entries(beat.notes).map(([string, fret]) => ({
        beat: i,
        start: placed[i].start,
        length: placed[i].length,
        string: Number(string),
        fret,
        midi: pitchOf(Number(string), fret, song.capo),
    })));
}

/**
 * Keys the riff fits (every note in the scale). A hint, never a rule. Riffs
 * usually sit on their first note, so keys rooted there come first, then
 * keys rooted on another note in the riff; within those, major/minor before
 * pentatonics and modes.
 */
const KEY_ORDER = ['major', 'minor', 'pentatonicMajor', 'pentatonicMinor', 'blues', 'dorian', 'mixolydian', 'lydian', 'phrygian', 'harmonicMinor', 'melodicMinor', 'locrian'];
export function matchingKeys(song) {
    const notes = songNotes(song);
    const pcs = new Set(notes.map(n => PITCH_CLASSES[n.midi % 12]));
    if (!notes.length) return [];
    // The lowest note of the first beat with notes (the bass of a chord)
    const firstBeat = notes.filter(n => n.beat === notes[0].beat);
    const first = PITCH_CLASSES[Math.min(...firstBeat.map(n => n.midi)) % 12];
    const rank = key => (key.root === first ? 0 : 1) * 100
        + (key.root !== first && !pcs.has(key.root) ? 50 : 0)
        + Math.max(0, KEY_ORDER.indexOf(key.type));
    return findMatchingKeys(pcs).sort((a, b) => rank(a) - rank(b));
}

/**
 * ASCII tab, the format people paste into forums: one line per string, a
 * column per beat (wide enough for two-digit frets), bars marked with |, and
 * wrapped so lines don't run off the page.
 */
export function asciiTab(song, { barsPerLine = 4 } = {}) {
    const placed = layout(song.beats);
    const bars = [];
    song.beats.forEach((beat, i) => {
        (bars[placed[i].bar] ??= []).push(beat);
    });

    const rows = [];
    for (let first = 0; first < bars.length; first += barsPerLine) {
        const lines = GUITAR_STRINGS.map(s => `${s.name}|`);
        bars.slice(first, first + barsPerLine).forEach((bar = []) => {
            bar.forEach((beat) => {
                const width = Math.max(1, ...Object.values(beat.notes).map(f => String(f).length));
                // Longer notes get more room, so the tab reads roughly in time
                const pad = Math.max(1, Math.round(ticksOf(beat.dur) / 24));
                GUITAR_STRINGS.forEach((_, s) => {
                    const fret = beat.notes[s];
                    lines[s] += `-${(fret === undefined ? '' : String(fret)).padEnd(width, '-')}${'-'.repeat(pad - 1)}`;
                });
            });
            lines.forEach((_, s) => { lines[s] += '-|'; });
        });
        rows.push(lines.join('\n'));
    }
    const capo = song.capo ? `Capo ${song.capo}\n\n` : '';
    return `${capo}${rows.join('\n\n')}\n`;
}

/** Check an imported song; throws on a wrong shape, drops anything invalid */
export function sanitizeSong(song) {
    if (!song || !Array.isArray(song.beats)) throw new Error('Expected a list of beats');
    const capo = Number.isInteger(song.capo) && song.capo >= 0 && song.capo <= 7 ? song.capo : 0;
    const beats = song.beats.slice(0, 512).map((beat) => {
        const dur = DURATIONS.some(d => d.id === beat?.dur) ? beat.dur : 'q';
        const notes = {};
        Object.entries(beat?.notes ?? {}).forEach(([string, fret]) => {
            const s = Number(string);
            if (Number.isInteger(s) && s >= 0 && s < STRING_COUNT && Number.isInteger(fret) && fret >= 0 && fret <= FRETS) {
                notes[s] = fret;
            }
        });
        return { dur, notes };
    });
    return { capo, beats: beats.length ? beats : [emptyBeat()] };
}

// Type-0 MIDI file on channel 10. There's deliberately no tempo event: notes
// are placed in beats, so the clip plays at whatever tempo the DAW is set to.
// Shuffle is baked into the note positions.

import { ACCENT_ROW, TICKS_PER_BAR, TICKS_PER_BEAT, rowAt, rowFires, swingTicks } from './logic.js';
import { GM_NOTES } from './voices.js';
import { downloadBlob, timestamp } from '../../core/files.js';

const PPQ = 96;
const SCALE = PPQ / TICKS_PER_BEAT;
const NOTE_LENGTH = PPQ / 8;
const BASE_VELOCITY = 90;

function vlq(n) {
    const out = [n & 0x7f];
    while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80);
    return out;
}

const u32 = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];

export function buildMidi({ gens, rows, accentAmount }, bars) {
    const events = [];

    for (let t = 0; t < bars * TICKS_PER_BAR; t++) {
        const accent = rowAt(gens, rows[ACCENT_ROW], t);
        for (let r = 0; r < ACCENT_ROW; r++) {
            if (!rowFires(gens, rows[r], t)) continue;
            const at = Math.round((t + swingTicks(t, rows[r])) * SCALE);
            const velocity = accent ? Math.round(BASE_VELOCITY + (127 - BASE_VELOCITY) * accentAmount) : BASE_VELOCITY;
            events.push([at, 0x99, GM_NOTES[r], velocity], [at + NOTE_LENGTH, 0x89, GM_NOTES[r], 0]);
        }
    }

    // Note-offs (0x89) sort before note-ons (0x99) at the same tick
    events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

    const track = [0, 0xff, 0x58, 4, 4, 2, 24, 8]; // 4/4 time signature
    let last = 0;
    for (const [at, status, note, velocity] of events) {
        track.push(...vlq(at - last), status, note, velocity);
        last = at;
    }
    track.push(0, 0xff, 0x2f, 0);

    const header = [0x4d, 0x54, 0x68, 0x64, ...u32(6), 0, 0, 0, 1, (PPQ >> 8) & 255, PPQ & 255];
    return new Uint8Array([...header, 0x4d, 0x54, 0x72, 0x6b, ...u32(track.length), ...track]);
}

export function downloadMidi(state, bars) {
    const blob = new Blob([buildMidi(state, bars)], { type: 'audio/midi' });
    downloadBlob(blob, `logical-drums-${bars}bar${bars > 1 ? 's' : ''}-${timestamp()}.mid`);
}

// Minimal type-0 MIDI file writer shared by the tools. There's deliberately no
// tempo event: notes are placed in beats, so a clip plays at whatever tempo
// the DAW is set to.

export const MIDI_PPQ = 96;

function vlq(n) {
    const out = [n & 0x7f];
    while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80);
    return out;
}

const u32 = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];

/**
 * notes: [{ at, length, note, velocity, channel? }] with at/length in MIDI_PPQ ticks.
 * channel: 0–15 (9 is General MIDI drums); a note's own channel overrides it.
 */
export function buildMidiFile(notes, { channel = 0 } = {}) {
    const events = notes.flatMap((n) => {
        const ch = n.channel ?? channel;
        return [
            [n.at, 0x90 | ch, n.note, n.velocity],
            [n.at + Math.max(1, n.length), 0x80 | ch, n.note, 0],
        ];
    });
    const isOff = status => (status & 0xf0) === 0x80;
    // Note-offs sort before note-ons at the same tick, so repeated notes retrigger cleanly
    events.sort((a, b) => a[0] - b[0] || (isOff(a[1]) ? -1 : 1) - (isOff(b[1]) ? -1 : 1));

    const track = [0, 0xff, 0x58, 4, 4, 2, 24, 8]; // 4/4 time signature
    let last = 0;
    for (const [at, status, note, velocity] of events) {
        track.push(...vlq(at - last), status, note, velocity);
        last = at;
    }
    track.push(0, 0xff, 0x2f, 0);

    const header = [0x4d, 0x54, 0x68, 0x64, ...u32(6), 0, 0, 0, 1, (MIDI_PPQ >> 8) & 255, MIDI_PPQ & 255];
    return new Uint8Array([...header, 0x4d, 0x54, 0x72, 0x6b, ...u32(track.length), ...track]);
}

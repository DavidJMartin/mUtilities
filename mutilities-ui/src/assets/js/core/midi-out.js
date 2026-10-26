// Live MIDI out (Web MIDI), shared by the melodic tools: notes go to a DAW or
// a hardware synth as they play. Chrome, Edge and Firefox have Web MIDI;
// Safari and iOS don't, so tools hide the option there (midiOut.supported).
//
// Notes are scheduled with the same audio-clock times as the synth, converted
// to the MIDI clock (performance.now), so MIDI and audio line up and the
// scheduler's lookahead keeps the timing tight. No MIDI clock or tempo is
// sent: the DAW plays the notes at whatever tempo it's at.

import * as Tone from 'tone';

const STORAGE_PREFIX = 'mutilities-midi-out-';
const ALL_NOTES_OFF = 123;

let access = null;
let accessRequest = null;
const listeners = new Set();
const notify = () => listeners.forEach(fn => fn());

export const midiOut = {
    supported: typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function',

    /** True once the browser has granted access */
    get enabled() {
        return access !== null;
    },

    /** Ask for MIDI access (shows the browser's permission prompt the first time) */
    async enable() {
        if (access) return true;
        if (!midiOut.supported) return false;
        accessRequest ??= navigator.requestMIDIAccess({ sysex: false })
            .then((granted) => {
                access = granted;
                // Devices plugged in or out
                access.addEventListener('statechange', notify);
                notify();
                return true;
            })
            .catch(() => {
                accessRequest = null;
                return false;
            });
        return accessRequest;
    },

    /** Connected outputs: [{ id, name }] */
    outputs() {
        if (!access) return [];
        return [...access.outputs.values()]
            .filter(port => port.state !== 'disconnected')
            .map(port => ({ id: port.id, name: port.name || 'MIDI output' }));
    },

    port(id) {
        return (id && access?.outputs.get(id)) || null;
    },

    onChange(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
    },
};

// Offset between the audio clock and the MIDI clock (ms). Each reading is a
// little noisy (a few ms), which made evenly spaced notes wobble, so readings
// are smoothed; a big jump (the audio context restarting) resets it.
let clockOffset = null;
const SMOOTHING = 0.05;
const RESET_MS = 50;

/** Audio-context time (as Tone schedules) → MIDI timestamp (performance.now ms) */
function toMidiTime(time) {
    const ctx = Tone.getContext().rawContext;
    const stamp = ctx.getOutputTimestamp?.();
    const reading = stamp?.performanceTime
        ? stamp.performanceTime - stamp.contextTime * 1000
        : performance.now() - ctx.currentTime * 1000;
    clockOffset = clockOffset === null || Math.abs(reading - clockOffset) > RESET_MS
        ? reading
        : clockOffset + (reading - clockOffset) * SMOOTHING;
    return clockOffset + time * 1000;
}

/**
 * One tool's MIDI out: which output, which channel, and whether the tool's own
 * synth keeps playing. Remembered on this device per tool (device ids don't
 * travel, so it isn't part of exported patches).
 *
 * voice: 0, 1… sends on channel + voice, so a second melody can be split off.
 */
export class MidiSender {
    constructor(tool) {
        this.key = STORAGE_PREFIX + tool;
        this.settings = { outputId: null, channel: 1, synth: false };
        try {
            Object.assign(this.settings, JSON.parse(localStorage.getItem(this.key)) ?? {});
        } catch {
            // Storage unavailable: defaults for this visit
        }
        // Every note started since the last panic (`${channel}:${note}`). Queued
        // note-offs can be dropped by a panic, so it releases all of these;
        // an extra note-off is harmless
        this.started = new Set();
        this.listeners = new Set();
    }

    /** Sending to an output that's connected right now */
    get active() {
        return midiOut.port(this.settings.outputId) !== null;
    }

    /** Whether the tool should still play its own synth */
    get synthOn() {
        return !this.active || this.settings.synth;
    }

    set(change) {
        if ('outputId' in change || 'channel' in change) this.panic();
        Object.assign(this.settings, change);
        try {
            localStorage.setItem(this.key, JSON.stringify(this.settings));
        } catch {
            // Not remembered; still works for this visit
        }
        this.listeners.forEach(fn => fn());
    }

    onChange(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    #channel(voice) {
        return ((this.settings.channel - 1 + voice) % 16);
    }

    #send(bytes, time) {
        const port = midiOut.port(this.settings.outputId);
        if (!port) return;
        try {
            port.send(bytes, time === undefined ? undefined : toMidiTime(time));
        } catch {
            // A port that vanished mid-send: drop the message
        }
    }

    /** velocity 0–1; time in audio-context seconds (Tone's scheduled time) */
    noteOn(voice, note, velocity, time) {
        if (!this.active) return;
        const ch = this.#channel(voice);
        this.started.add(`${ch}:${note}`);
        this.#send([0x90 | ch, note, Math.max(1, Math.min(127, Math.round(velocity * 127)))], time);
    }

    noteOff(voice, note, time) {
        if (!this.active) return;
        this.#send([0x80 | this.#channel(voice), note, 0], time);
    }

    /** Stop everything now: drop queued messages and release every note this tool started */
    panic() {
        const port = midiOut.port(this.settings.outputId);
        if (port) {
            port.clear?.();
            const channels = new Set();
            this.started.forEach((key) => {
                const [ch, note] = key.split(':').map(Number);
                channels.add(ch);
                this.#send([0x80 | ch, note, 0]);
            });
            channels.forEach(ch => this.#send([0xB0 | ch, ALL_NOTES_OFF, 0]));
        }
        this.started.clear();
    }
}

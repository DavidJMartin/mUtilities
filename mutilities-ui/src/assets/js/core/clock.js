// The playground's shared clock. It owns the tempo and Tone.Transport, so
// tools never start or stop the transport themselves (see
// .scratch/playground-sync.md).
//
// Sync types:
//   clock: rhythmic tools. Launching while something else is playing waits
//          for the next bar, or the next beat for things that should respond
//          quickly like the arp (the tool is "queued" until then), so it lands
//          in time. Stop and restart, never resume: tools work out their pattern
//          from the clock's position, so they're always in phase.
//   free:  makes sound with no rhythm (the drone). Starts and stops at once;
//          registered so the playground knows it's running.
//
// The transport runs while any clock tool is playing or queued, and stops
// (back to bar 1) when the last one stops.

import * as Tone from 'tone';

export const TICKS_PER_BEAT = 48;
export const BPM_MIN = 40;
export const BPM_MAX = 240;

const BEATS_PER_BAR = 4;
// Small head start so the first notes aren't scheduled in the past
const START_DELAY = 0.05;

const players = new Map(); // id -> { name, sync, state: 'stopped' | 'queued' | 'playing', start, stop, timer }
const changeListeners = new Set();
const bpmListeners = new Set();
let bpm = 120;

const notify = () => changeListeners.forEach(fn => fn());
const clockPlayers = () => [...players.values()].filter(p => p.sync === 'clock');
const transportRunning = () => clockPlayers().some(p => p.state !== 'stopped');

function setState(player, state) {
    if (player.state === state) return;
    player.state = state;
    notify();
}

export const clock = {
    get bpm() {
        return bpm;
    },

    set bpm(value) {
        const next = Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(value)));
        if (next === bpm) return;
        bpm = next;
        Tone.Transport.bpm.value = bpm;
        bpmListeners.forEach(fn => fn(bpm));
    },

    onBpmChange(fn) {
        bpmListeners.add(fn);
        return () => bpmListeners.delete(fn);
    },

    onChange(fn) {
        changeListeners.add(fn);
        return () => changeListeners.delete(fn);
    },

    /**
     * name / short / page: shown in the playground strip (short on phones; page = the tool's hash id)
     * start(startTicks): schedule your playback from that transport position
     *   (Tone ticks); it's always on a bar or beat line.
     * stop(): stop your own playback and reset your UI. It may be called from
     *   outside the tool (the playground strip). Don't touch the transport.
     */
    register(id, { name, short = name, page, sync, start = () => {}, stop = () => {} }) {
        players.set(id, { name, short, page, sync, state: 'stopped', start, stop, timer: null });
    },

    /** Everything playing or waiting to come in, for the playground strip */
    active() {
        return [...players.entries()]
            .filter(([, p]) => p.state !== 'stopped')
            .map(([id, { name, short, page, sync, state }]) => ({ id, name, short, page, sync, state }));
    },

    stopAll() {
        [...players.keys()].forEach(id => this.stop(id));
    },

    state(id) {
        return players.get(id)?.state ?? 'stopped';
    },

    isPlaying(id) {
        return this.state(id) !== 'stopped';
    },

    /** Is another clock tool already playing, so pressing Play would join it? */
    wouldJoin(id) {
        return clockPlayers().some(p => p !== players.get(id) && p.state !== 'stopped');
    },

    /**
     * Start a tool: at once (starting the transport), or, if the transport is
     * running, on the next bar ('bar') or beat ('beat')
     */
    launch(id, { quantise = 'bar' } = {}) {
        const player = players.get(id);
        if (!player || player.state !== 'stopped') return;

        if (player.sync === 'free') {
            player.start();
            setState(player, 'playing');
            return;
        }

        const transport = Tone.Transport;
        if (!transportRunning()) {
            transport.bpm.value = bpm;
            transport.position = 0;
            player.start(0);
            transport.start(`+${START_DELAY}`);
            setState(player, 'playing');
            return;
        }

        const { startTicks, waitSeconds } = this.next(quantise);
        player.start(startTicks);
        setState(player, 'queued');
        player.timer = setTimeout(() => setState(player, 'playing'), waitSeconds * 1000);
    },

    /**
     * The next bar or beat line (Tone ticks) with a little margin so it's never
     * in the past, and roughly how long until it. Also for tools that change
     * their own timing while playing (e.g. the arp's rate).
     */
    next(quantise = 'bar') {
        const transport = Tone.Transport;
        const unit = transport.PPQ * (quantise === 'beat' ? 1 : BEATS_PER_BAR);
        const nowTicks = transport.getTicksAtTime(Tone.now() + START_DELAY);
        const startTicks = Math.ceil(nowTicks / unit) * unit;
        const waitSeconds = ((startTicks - nowTicks) / transport.PPQ) * (60 / bpm) + START_DELAY;
        return { startTicks, waitSeconds };
    },

    stop(id) {
        const player = players.get(id);
        if (!player || player.state === 'stopped') return;
        clearTimeout(player.timer);
        // Marked stopped first, so a tool's stop() can call clock.stop(id) itself harmlessly
        player.state = 'stopped';
        player.stop();
        notify();
        if (player.sync === 'clock' && !transportRunning()) {
            Tone.Transport.stop();
            Tone.Draw.cancel(0);
        }
    },

    /** Clock position at an audio time, in our 48-per-beat ticks */
    tickAt(time) {
        const transport = Tone.Transport;
        return Math.round((transport.getTicksAtTime(time) * TICKS_PER_BEAT) / transport.PPQ);
    },
};

/** Play-button wording and look for a clock tool, so every tool shows "Join" the same way */
export function playButtonState(id) {
    const state = clock.state(id);
    if (state === 'playing') return { label: '■  Stop', look: 'stop', pressed: true };
    if (state === 'queued') return { label: '…  Joining', look: 'join', pressed: true };
    if (clock.wouldJoin(id)) return { label: '▶  Join', look: 'join', pressed: false };
    return { label: '▶  Play', look: 'play', pressed: false };
}

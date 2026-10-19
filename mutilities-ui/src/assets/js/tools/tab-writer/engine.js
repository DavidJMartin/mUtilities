// Plays the tab on the shared clock, looping, with a plucked-string voice per
// string (like a real guitar, a new note on a string cuts the last one off).
// The playhead goes through Tone.Draw so it lines up with what you hear.

import * as Tone from 'tone';
import { clock } from '../../core/clock.js';
import { STRING_COUNT, TICKS_PER_BEAT, layout, pitchOf, songTicks } from './logic.js';

// Under the drums, near the Key Synth (levels measured 16 Oct)
const VOLUME_DB = -6;
const STEP_TICKS = 12; // the shortest duration, a 1/16

export class TabEngine {
    /** getSong(): the live song. onBeat(index): the beat now sounding (for the playhead), or null */
    constructor(getSong, onBeat) {
        this.getSong = getSong;
        this.onBeat = onBeat;
        this.strings = null;
        this.repeatId = null;
        this.startTick = 0;
    }

    #build() {
        const out = new Tone.Volume(VOLUME_DB).connect(new Tone.Limiter(-1).toDestination());
        const voice = () => new Tone.PluckSynth({
            attackNoise: 1.2,
            dampening: 3800,
            resonance: 0.96,
        }).connect(out);
        this.strings = Array.from({ length: STRING_COUNT }, voice);
        // Tapped notes get their own voice, so they never clash with playback
        this.auditionVoice = voice();
        this.lastStart = new Map();
    }

    /** Tone throws if a voice is started twice at the same moment (fast taps), so keep start times moving forward */
    #pluck(voice, midi, time) {
        const at = Math.max(time, (this.lastStart.get(voice) ?? 0) + 0.005);
        this.lastStart.set(voice, at);
        voice.triggerAttack(Tone.Frequency(midi, 'midi'), at);
    }

    /** Play one note now, e.g. when a fret is tapped */
    audition(string, fret, capo) {
        if (!this.strings) this.#build();
        this.#pluck(this.auditionVoice, pitchOf(string, fret, capo), Tone.now() + 0.01);
    }

    /** Called by the clock with a bar line (Tone ticks) to start from */
    start(startTicks) {
        if (this.repeatId !== null) return;
        if (!this.strings) this.#build();
        this.startTick = (startTicks * TICKS_PER_BEAT) / Tone.Transport.PPQ;
        const interval = (STEP_TICKS * Tone.Transport.PPQ) / TICKS_PER_BEAT;
        this.repeatId = Tone.Transport.scheduleRepeat(time => this.#step(time), `${interval}i`, `${startTicks}i`);
    }

    stop() {
        if (this.repeatId === null) return;
        Tone.Transport.clear(this.repeatId);
        this.repeatId = null;
        this.onBeat(null);
    }

    #step(time) {
        const song = this.getSong();
        const loop = songTicks(song.beats);
        // Position in the tab, from where playback started, looping round
        const elapsed = Math.round((clock.tickAt(time) - this.startTick) / STEP_TICKS) * STEP_TICKS;
        const position = ((elapsed % loop) + loop) % loop;
        const placed = layout(song.beats);
        const index = placed.findIndex(p => p.start === position);
        if (index < 0) return;

        Object.entries(song.beats[index].notes).forEach(([string, fret]) => {
            this.#pluck(this.strings[string], pitchOf(Number(string), fret, song.capo), time);
        });
        // Skip lights still queued when playback stops
        Tone.Draw.schedule(() => { if (this.repeatId !== null) this.onBeat(index); }, time);
    }
}

// Plays Twin Turing on the shared clock. A repeat on the finest grid steps
// whichever machines are due and plays the note, if any. Lights go through
// Tone.Draw so they line up with what you hear.

import * as Tone from 'tone';
import { clock } from '../../core/clock.js';
import { GRID_TICKS, TICKS_PER_BEAT, createRng, peekNextNote, stepsAt, tick } from './logic.js';

// Level balanced against the other tools: under the drums, near the Key Synth
const VOICE_VOLUME_DB = -14;

export class TuringEngine {
    /**
     * getState(): the live state (machines are stepped in place)
     * onDraw(info): { due, bits, midi } for the lights, in step with the audio
     * midi: a MidiSender (core/midi-out.js); A sends on its channel, B on the next
     */
    constructor(getState, onDraw, midi) {
        this.getState = getState;
        this.onDraw = onDraw;
        this.midi = midi;
        this.midiHeld = [null, null]; // per voice: a MIDI note left on (a tie), still to be ended
        // Seeded so MIDI export can replay exactly what will play next
        this.rng = createRng(Math.floor(Math.random() * 2 ** 32));
        this.voices = null; // [A or summed melody, B in separate mode]
        this.repeatId = null;
        this.holding = [null, null]; // per voice: pitch being held into a repeat (New note triggers)
    }

    #buildVoices() {
        const limiter = new Tone.Limiter(-1).toDestination();
        // Two identical monophonic voices; the second only plays in separate mode
        this.voices = [0, 1].map(() => new Tone.MonoSynth({
            oscillator: { type: this.getState().wave },
            filter: { type: 'lowpass', rolloff: -24, Q: 2 },
            envelope: { attack: 0.005, decay: 0.2, sustain: 0.5, release: 0.25 },
            filterEnvelope: { attack: 0.005, decay: 0.25, sustain: 0.35, release: 0.3, baseFrequency: 300, octaves: 3.2 },
            volume: VOICE_VOLUME_DB,
        }).connect(limiter));
    }

    setWave(wave) {
        this.voices?.forEach((v) => { v.oscillator.type = wave; });
    }

    /** Let go of anything sounding, e.g. when switching between one and two melodies */
    releaseAll() {
        this.holding = [null, null];
        this.midiHeld = [null, null];
        this.voices?.forEach(v => v.triggerRelease());
        this.midi?.panic();
    }

    /** Called by the clock with a bar line (Tone ticks) to start from */
    start(startTicks) {
        if (this.repeatId !== null) return;
        if (!this.voices) this.#buildVoices();
        const gridToneTicks = (GRID_TICKS * Tone.Transport.PPQ) / TICKS_PER_BEAT;
        this.repeatId = Tone.Transport.scheduleRepeat(time => this.#step(time), `${gridToneTicks}i`, `${startTicks}i`);
    }

    stop() {
        if (this.repeatId === null) return;
        Tone.Transport.clear(this.repeatId);
        this.repeatId = null;
        this.releaseAll();
    }

    /**
     * Pulse / Every step: every note plays. New note: a note repeating the
     * pitch already being held doesn't play again, and a note only ends once
     * the next note (peeked on a copy) is a different pitch.
     */
    #play(note, state, t, time) {
        const v = note.voice;
        const synth = this.voices[v];
        const ties = state.trigger === 'new';
        const tiedIn = ties && this.holding[v] === note.midi;
        if (!tiedIn) {
            // With MIDI out on, the built-in synth only plays if "Synth too" is on
            if (this.midi?.synthOn ?? true) synth.triggerAttack(Tone.Frequency(note.midi, 'midi'), time, 0.85);
            // Monophonic like the synth: end a held MIDI note before the next starts
            if (this.midiHeld[v] !== null) this.midi?.noteOff(v, this.midiHeld[v], time - 0.001);
            this.midi?.noteOn(v, note.midi, 0.85, time);
        }

        const next = ties ? peekNextNote(state, this.rng.state(), t, v) : null;
        if (next && next.midi === note.midi) {
            this.holding[v] = note.midi;
            this.midiHeld[v] = note.midi;
            return;
        }
        this.holding[v] = null;
        this.midiHeld[v] = null;
        const seconds = (note.length / TICKS_PER_BEAT) * (60 / clock.bpm);
        synth.triggerRelease(time + seconds);
        // A hair early, so a note-off never lands after the next note-on at the same moment
        this.midi?.noteOff(v, note.midi, time + seconds - 0.001);
    }

    #step(time) {
        const state = this.getState();
        // Absolute clock position: every rate divides a bar, so machines stay on the grid
        const t = Math.round(clock.tickAt(time) / GRID_TICKS) * GRID_TICKS;
        const due = stepsAt(state.machines, t);
        if (!due.some(Boolean)) return;
        const notes = tick(state, this.rng, t);
        notes.forEach(note => this.#play(note, state, t, time));
        const bits = state.machines.map(m => m.bits.slice(0, m.length));
        const midis = notes.map(n => n.midi);
        Tone.Draw.schedule(() => this.onDraw({ due, bits, midis }), time);
    }
}

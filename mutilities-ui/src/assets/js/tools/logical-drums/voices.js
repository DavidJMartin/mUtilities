// Synthesised 909-ish kit. Each voice is just trigger(time, velocity), so a
// Tone.Players kit of recorded samples can replace any of them later.
//
// Snare, clap, hats and the rim's click share one running noise source, each
// through its own filter and envelope. The closed hat chokes the open hat, as
// on a 909.

import * as Tone from 'tone';

// Order matches the drum rows (see DRUM in logic.js)
export const VOICE_NAMES = ['Kick', 'Snare', 'Clap', 'Low tom', 'High tom', 'Closed hat', 'Open hat', 'Rim'];

/** General MIDI drum notes, in VOICE_NAMES order (rim = side stick) */
export const GM_NOTES = [36, 38, 39, 45, 50, 42, 46, 37];

// Clap: a few quick bursts (the "hands") then a short tail, 909 style
const CLAP_BURSTS = [0, 0.011, 0.023];
const CLAP_TAIL_AT = 0.03;

const LIMITER_THRESHOLD_DB = -1;

export class DrumKit {
    constructor() {
        this.limiter = new Tone.Limiter(LIMITER_THRESHOLD_DB).toDestination();
        // The loudest tool in the playground (levels measured 16 Oct); the limiter
        // and the master bus catch stacked hits
        this.bus = new Tone.Volume(-1).connect(this.limiter);
        this.noise = new Tone.Noise('white');

        const kick = new Tone.MembraneSynth({
            pitchDecay: 0.04,
            octaves: 5,
            envelope: { attack: 0.001, decay: 0.45, sustain: 0, release: 0.05 },
        }).connect(this.bus);

        const snareBody = new Tone.MembraneSynth({
            pitchDecay: 0.02,
            octaves: 1.5,
            envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 },
            volume: -8,
        }).connect(this.bus);
        const snareNoise = this.#noiseVoice({ type: 'bandpass', frequency: 1900, Q: 0.8 }, { decay: 0.18 }, -4);

        const clapFilter = { type: 'bandpass', frequency: 1150, Q: 1.4 };
        const clapBurst = this.#noiseVoice(clapFilter, { decay: 0.009 }, 4);
        const clapTail = this.#noiseVoice(clapFilter, { decay: 0.17 }, 2);

        const tom = (decay) => new Tone.MembraneSynth({
            pitchDecay: 0.08,
            octaves: 2,
            envelope: { attack: 0.001, decay, sustain: 0, release: 0.05 },
            volume: -3,
        }).connect(this.bus);
        const lowTom = tom(0.45);
        const highTom = tom(0.32);

        const closedHat = this.#noiseVoice({ type: 'highpass', frequency: 7000 }, { decay: 0.05 }, -10);
        const openHat = this.#noiseVoice({ type: 'highpass', frequency: 6500 }, { decay: 0.4, release: 0.03 }, -12);

        // Rim: a hollow knock. Two short sine resonances at a woody,
        // inharmonic ratio (about 1 : 2.7, like a struck block) plus a tiny
        // filtered click for the stick. Pitched low enough to sound hollow
        // rather than like a cowbell.
        const rimMode = (decay, volume) => new Tone.Synth({
            oscillator: { type: 'sine' },
            envelope: { attack: 0.0005, decay, sustain: 0, release: 0.01 },
            volume,
        }).connect(this.bus);
        const rimLow = rimMode(0.07, -9);
        const rimHigh = rimMode(0.035, -15);
        const rimClick = this.#noiseVoice({ type: 'bandpass', frequency: 3500, Q: 1 }, { decay: 0.004 }, -12);

        this.voices = [
            (time, vel) => kick.triggerAttack(50, time, vel),
            (time, vel) => {
                snareNoise.triggerAttack(time, vel);
                snareBody.triggerAttack(190, time, vel);
            },
            (time, vel) => {
                CLAP_BURSTS.forEach(at => clapBurst.triggerAttack(time + at, vel));
                clapTail.triggerAttack(time + CLAP_TAIL_AT, vel);
            },
            (time, vel) => lowTom.triggerAttack(85, time, vel),
            (time, vel) => highTom.triggerAttack(150, time, vel),
            (time, vel) => {
                openHat.triggerRelease(time);
                closedHat.triggerAttack(time, vel);
            },
            (time, vel) => openHat.triggerAttack(time, vel),
            (time, vel) => {
                rimLow.triggerAttack(420, time, vel);
                rimHigh.triggerAttack(1150, time, vel);
                rimClick.triggerAttack(time, vel);
            },
        ];
    }

    #noiseVoice(filter, envelope, volumeDb) {
        const env = new Tone.AmplitudeEnvelope({ attack: 0.001, sustain: 0, release: 0.05, ...envelope });
        const level = new Tone.Volume(volumeDb).connect(this.bus);
        this.noise.chain(new Tone.Filter(filter), env, level);
        return env;
    }

    start() {
        if (this.noise.state !== 'started') this.noise.start();
    }

    stop() {
        if (this.noise.state === 'started') this.noise.stop();
    }

    trigger(index, time, velocity) {
        this.voices[index](time, velocity);
    }
}

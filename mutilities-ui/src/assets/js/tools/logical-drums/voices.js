// Synthesised 909-ish kit. Each voice is just trigger(time, velocity), so a
// Tone.Players kit of recorded samples can replace any of them later.
//
// Snare and hats share one running noise source, each through its own filter
// and envelope. The closed hat chokes the open hat, as on a 909.

import * as Tone from 'tone';

export const VOICE_NAMES = ['Kick', 'Snare', 'Tom', 'Closed hat', 'Open hat', 'Woodblock'];

/** General MIDI drum notes, in VOICE_NAMES order */
export const GM_NOTES = [36, 38, 45, 42, 46, 76];

const LIMITER_THRESHOLD_DB = -1;

export class DrumKit {
    constructor() {
        this.limiter = new Tone.Limiter(LIMITER_THRESHOLD_DB).toDestination();
        this.bus = new Tone.Volume(-6).connect(this.limiter);
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

        const tom = new Tone.MembraneSynth({
            pitchDecay: 0.08,
            octaves: 2,
            envelope: { attack: 0.001, decay: 0.38, sustain: 0, release: 0.05 },
            volume: -3,
        }).connect(this.bus);

        const closedHat = this.#noiseVoice({ type: 'highpass', frequency: 7000 }, { decay: 0.05 }, -10);
        const openHat = this.#noiseVoice({ type: 'highpass', frequency: 6500 }, { decay: 0.4, release: 0.03 }, -12);

        const block = new Tone.Synth({
            oscillator: { type: 'triangle' },
            envelope: { attack: 0.001, decay: 0.07, sustain: 0, release: 0.02 },
            volume: -6,
        }).connect(this.bus);

        this.voices = [
            (time, vel) => kick.triggerAttack(50, time, vel),
            (time, vel) => {
                snareNoise.triggerAttack(time, vel);
                snareBody.triggerAttack(190, time, vel);
            },
            (time, vel) => tom.triggerAttack(110, time, vel),
            (time, vel) => {
                openHat.triggerRelease(time);
                closedHat.triggerAttack(time, vel);
            },
            (time, vel) => openHat.triggerAttack(time, vel),
            (time, vel) => block.triggerAttack(1050, time, vel),
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

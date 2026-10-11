import * as Tone from 'tone';

export const DEFAULT_PATCH = {
    shape: 'sawtooth',
    cutoff: 2000,
    resonance: 1,
    attack: 0.01,
    decay: 0.2,
    sustain: 0.5,
    release: 0.8,
};

// Each voice can peak near full scale, so chords clip without headroom. The
// synth is turned down and a limiter catches peaks from stacked notes or
// high resonance.
const SYNTH_VOLUME_DB = -12;
const LIMITER_THRESHOLD_DB = -1;

export class KeySynthEngine {
    constructor(patch) {
        this.limiter = new Tone.Limiter(LIMITER_THRESHOLD_DB).toDestination();
        this.filter = new Tone.Filter({
            type: 'lowpass',
            frequency: patch.cutoff,
            Q: patch.resonance,
        }).connect(this.limiter);

        this.synth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: patch.shape },
            envelope: {
                attack: patch.attack,
                decay: patch.decay,
                sustain: patch.sustain,
                release: patch.release,
            },
        }).connect(this.filter);
        this.synth.volume.value = SYNTH_VOLUME_DB;
    }

    noteOn(note) {
        this.synth.triggerAttack(note);
    }

    noteOff(note) {
        this.synth.triggerRelease(note);
    }

    releaseAll() {
        this.synth.releaseAll();
    }

    set(patch) {
        if ('shape' in patch) this.synth.set({ oscillator: { type: patch.shape } });
        if ('cutoff' in patch) this.filter.frequency.value = patch.cutoff;
        if ('resonance' in patch) this.filter.Q.value = patch.resonance;

        const envelope = {};
        for (const stage of ['attack', 'decay', 'sustain', 'release']) {
            if (stage in patch) envelope[stage] = patch[stage];
        }
        if (Object.keys(envelope).length) this.synth.set({ envelope });
    }
}

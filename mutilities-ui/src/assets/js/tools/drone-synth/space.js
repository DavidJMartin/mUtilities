// Reverb with a glitch-free decay control and a modulated tail.
//
// Changing a Tone.Reverb's decay renders a new impulse response and swaps it
// into the live convolver, which resets the tail; dragging the slider did that
// dozens of times a second. Here there are two reverbs: a decay change waits
// until the slider settles, rebuilds only the silent one, then crossfades to
// it, so the old tail rings out underneath.
//
// Modulation runs the wet signal through a slow, wide chorus, so long tails
// gently drift and shimmer in pitch instead of sitting static.
//
//   input ─┬─ dry ──────────────────────────────────┬─ output
//          └─ reverb A/B ─ crossfade ─ chorus ─ wet ─┘

import * as Tone from 'tone';

const SETTLE_MS = 300;
const SWAP_SECONDS = 2.5;
const PRE_DELAY = 0.02;

export class Space {
    constructor({ decay, mix, modulation, on }) {
        this.input = new Tone.Gain(1);
        this.output = new Tone.Gain(1);

        this.dry = new Tone.Gain(1).connect(this.output);
        this.wet = new Tone.Gain(0).connect(this.output);
        this.chorus = new Tone.Chorus({ frequency: 0.2, delayTime: 9, depth: 0.5, spread: 180, wet: 0 })
            .connect(this.wet)
            .start();
        this.swap = new Tone.CrossFade(0).connect(this.chorus);

        this.reverbs = [0, 1].map(() => new Tone.Reverb({ decay, preDelay: PRE_DELAY, wet: 1 }));
        this.reverbs[0].connect(this.swap.a);
        this.reverbs[1].connect(this.swap.b);
        this.input.fan(this.dry, ...this.reverbs);

        this.active = 0;
        this.decay = decay;
        this.settleTimer = null;
        this.version = 0;
        this.swapEndsAt = 0;

        this.set({ decay, mix, modulation, on });
    }

    set({ decay, mix, modulation, on }) {
        // Equal-power dry/wet, like Tone's own wet control
        const m = on ? mix : 0;
        this.dry.gain.rampTo(Math.cos((m * Math.PI) / 2), 0.05);
        this.wet.gain.rampTo(Math.sin((m * Math.PI) / 2), 0.05);

        this.chorus.wet.rampTo(modulation, 0.1);
        this.chorus.depth = 0.3 + 0.5 * modulation;
        this.chorus.frequency.rampTo(0.12 + 0.25 * modulation, 0.5);

        if (decay !== this.decay) {
            this.decay = decay;
            clearTimeout(this.settleTimer);
            this.settleTimer = setTimeout(() => this.#rebuild(decay), SETTLE_MS);
        }
    }

    async #rebuild(decay) {
        const version = ++this.version;
        // Never rebuild a reverb that's still fading out and partly audible
        const wait = this.swapEndsAt - Tone.now();
        if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait * 1000));
        if (version !== this.version) return;

        const next = 1 - this.active;
        this.reverbs[next].decay = decay;
        await this.reverbs[next].ready;
        // A newer change arrived while rendering; it will do its own swap
        if (version !== this.version) return;
        this.active = next;
        this.swap.fade.rampTo(next, SWAP_SECONDS);
        this.swapEndsAt = Tone.now() + SWAP_SECONDS;
    }
}

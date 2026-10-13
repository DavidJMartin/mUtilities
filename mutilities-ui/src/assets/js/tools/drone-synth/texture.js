// Background texture: a noise bed (wind, air, surface rumble) plus vinyl-style
// crackle. Four controls (level, tone, crackle, motion) scale a lot of hidden
// movement:
//
// - The bed moves by random walks rather than LFOs: every few seconds a value
//   (gust level, filter centre, resonance) heads for a new random target over
//   a random time. Nothing repeats, so it reads as weather, not a wobble.
// - Crackle is made of real transients. A pool of short clicks (under 3 ms)
//   and pops (up to 20 ms, with a low thump) is rendered once, then played as
//   individual one-shots at random (Poisson) times with a heavy-tailed level
//   spread: lots of tiny ticks, the odd loud pop. Its density also wanders,
//   like dusty patches on a record.
//
// The bed feeds the drone's reverb so it sits in the same space; the crackle
// goes in after the reverb, so it stays dry and close.

import * as Tone from 'tone';

const randomIn = (min, max) => min + Math.random() * (max - min);
const logScale = (v, min, max) => min * (max / min) ** v;
const lerp = (a, b, v) => a + (b - a) * v;

const FADE_IN = 2.5;
const FADE_OUT = 1.5;
const LOOKAHEAD = 0.15;
const SCHEDULE_MS = 50;

const TICK_VARIANTS = 24;
const POP_VARIANTS = 8;
const MAX_TICKS_PER_SEC = 30;
const MAX_POPS_PER_SEC = 0.7;

/** Moves a Tone signal to a fresh random target over a random time, forever */
class Wander {
    constructor(param, range) {
        this.param = param;
        this.range = range;
        this.timer = null;
    }

    start() {
        this.stop();
        this.#next();
    }

    stop() {
        clearTimeout(this.timer);
        this.timer = null;
    }

    #next() {
        const { min, max, minTime, maxTime } = this.range();
        const time = randomIn(minTime, maxTime);
        this.param.rampTo(randomIn(min, max), time);
        // Pick the next target before this one is reached, so it never settles
        this.timer = setTimeout(() => this.#next(), time * 1000 * randomIn(0.6, 1));
    }
}

function clickBuffer(sampleRate) {
    const length = Math.max(8, Math.round(sampleRate * randomIn(0.0004, 0.003)));
    const data = new Float32Array(length);
    const decay = length * randomIn(0.12, 0.3);
    const sign = Math.random() < 0.5 ? -1 : 1;
    data[0] = sign;
    for (let i = 1; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / decay);
    }
    return Tone.ToneAudioBuffer.fromArray(data);
}

function popBuffer(sampleRate) {
    const length = Math.round(sampleRate * randomIn(0.006, 0.02));
    const data = new Float32Array(length);
    const thumpHz = randomIn(90, 260);
    const sign = Math.random() < 0.5 ? -1 : 1;
    let peak = 0;
    for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const noise = (Math.random() * 2 - 1) * Math.exp(-i / (length * 0.08));
        const thump = Math.sin(2 * Math.PI * thumpHz * t) * Math.exp(-i / (length * 0.3)) * 0.6;
        data[i] = sign * (i === 0 ? 1 : noise + thump);
        peak = Math.max(peak, Math.abs(data[i]));
    }
    for (let i = 0; i < length; i++) data[i] /= peak;
    return Tone.ToneAudioBuffer.fromArray(data);
}

export class TextureEngine {
    /** wet: input to the reverb; dry: after the reverb */
    constructor(params, { wet, dry }) {
        this.params = params;
        this.on = false;
        this.running = false;
        this.stopTimer = null;
        this.scheduler = null;

        // ===== Bed =====
        this.bedOut = new Tone.Gain(0).connect(wet);
        this.bedLevel = new Tone.Volume(-30).connect(this.bedOut);
        this.bedTone = new Tone.Filter({ type: 'lowpass', rolloff: -12 }).connect(this.bedLevel);

        this.brown = new Tone.Noise('brown');
        this.pink = new Tone.Noise('pink');

        // Wind: brown noise through a wandering band, with gusts
        this.windGust = new Tone.Gain(1).connect(this.bedTone);
        this.windBand = new Tone.Filter({ type: 'bandpass', Q: 1 }).connect(this.windGust);
        this.brown.connect(this.windBand);

        // Air: soft high hiss with a slow wobble whose own speed drifts
        this.airLevel = new Tone.Gain(0.25).connect(this.bedTone);
        this.airHigh = new Tone.Filter({ type: 'highpass', frequency: 2500 }).connect(this.airLevel);
        this.pink.connect(this.airHigh);
        this.airWobble = new Tone.LFO({ frequency: 0.07, min: 0.12, max: 0.3 }).connect(this.airLevel.gain);
        this.airWobbleRate = new Tone.LFO({ frequency: 0.011, min: 0.03, max: 0.15 }).connect(this.airWobble.frequency);

        // Surface rumble, which comes with the crackle
        this.rumble = new Tone.Gain(0).connect(this.bedTone);
        this.rumbleLow = new Tone.Filter({ type: 'lowpass', frequency: 90 }).connect(this.rumble);
        this.brown.connect(this.rumbleLow);

        this.wanders = [
            new Wander(this.windGust.gain, () => {
                const m = this.params.motion;
                return { min: 1 - 0.85 * m, max: 1, minTime: lerp(8, 0.8, m), maxTime: lerp(16, 4, m) };
            }),
            new Wander(this.windBand.frequency, () => {
                const centre = logScale(this.params.tone, 180, 1600);
                const spread = 1 + 2.5 * this.params.motion;
                return { min: centre / spread, max: centre * spread, minTime: 3, maxTime: 12 };
            }),
            new Wander(this.windBand.Q, () => ({
                min: 0.7, max: 0.7 + 3 * this.params.motion, minTime: 4, maxTime: 14,
            })),
        ];

        // ===== Crackle =====
        this.crackleOut = new Tone.Gain(0).connect(dry);
        this.crackleLevel = new Tone.Volume(-24).connect(this.crackleOut);
        this.crackleTone = new Tone.Filter({ type: 'lowpass', rolloff: -12 }).connect(this.crackleLevel);
        this.crackleBus = new Tone.Filter({ type: 'highpass', frequency: 40 }).connect(this.crackleTone);

        this.ticks = [];
        this.pops = [];
        this.density = 1;
        this.densityTarget = 1;
        this.densityChangeAt = 0;

        this.set(params);
    }

    set(params) {
        this.params = params;
        this.bedTone.frequency.rampTo(logScale(params.tone, 500, 12000), 0.2);
        this.crackleTone.frequency.rampTo(logScale(params.tone, 2500, 16000), 0.2);
        // Level 0–1 maps to a quiet background range
        this.bedLevel.volume.rampTo(lerp(-30, 0, params.level), 0.2);
        this.crackleLevel.volume.rampTo(lerp(-27, 0, params.level), 0.2);
        this.rumble.gain.rampTo(params.crackle * 0.5, 0.5);
        this.airWobble.min = lerp(0.2, 0.08, params.motion);
        this.airWobble.max = lerp(0.24, 0.35, params.motion);
    }

    /** Sound only while the drone plays and the texture is switched on */
    setActive(active) {
        if (active === this.running) return;
        this.running = active;
        const now = Tone.now();

        if (active) {
            clearTimeout(this.stopTimer);
            if (!this.ticks.length) this.#renderClicks();
            if (this.brown.state !== 'started') {
                this.brown.start();
                this.pink.start();
                this.airWobble.start();
                this.airWobbleRate.start();
            }
            this.wanders.forEach(w => w.start());
            this.nextTick = now;
            this.nextPop = now;
            this.scheduler = setInterval(() => this.#scheduleCrackle(), SCHEDULE_MS);
            this.bedOut.gain.rampTo(1, FADE_IN);
            this.crackleOut.gain.rampTo(1, FADE_IN);
        } else {
            this.bedOut.gain.rampTo(0, FADE_OUT);
            this.crackleOut.gain.rampTo(0, FADE_OUT);
            clearInterval(this.scheduler);
            this.wanders.forEach(w => w.stop());
            this.stopTimer = setTimeout(() => {
                this.brown.stop();
                this.pink.stop();
                this.airWobble.stop();
                this.airWobbleRate.stop();
            }, (FADE_OUT + 0.2) * 1000);
        }
    }

    #renderClicks() {
        const rate = Tone.getContext().sampleRate;
        this.ticks = Array.from({ length: TICK_VARIANTS }, () => clickBuffer(rate));
        this.pops = Array.from({ length: POP_VARIANTS }, () => popBuffer(rate));
    }

    #scheduleCrackle() {
        const { crackle, motion } = this.params;
        const now = Tone.now();
        const until = now + LOOKAHEAD;

        // Dusty patches: density drifts towards a new random target now and then
        if (now >= this.densityChangeAt) {
            this.densityTarget = randomIn(1 - 0.9 * motion, 1 + 0.8 * motion);
            this.densityChangeAt = now + randomIn(lerp(12, 3, motion), lerp(25, 10, motion));
        }
        this.density += (this.densityTarget - this.density) * 0.02;

        const tickRate = MAX_TICKS_PER_SEC * crackle ** 1.6 * this.density;
        const popRate = MAX_POPS_PER_SEC * crackle * this.density;

        // Don't pile up a backlog after the tab was in the background
        this.nextTick = Math.max(this.nextTick, now);
        this.nextPop = Math.max(this.nextPop, now);

        this.nextTick = this.#fire(this.ticks, this.nextTick, until, tickRate, () => 0.04 + 0.96 * Math.random() ** 5);
        this.nextPop = this.#fire(this.pops, this.nextPop, until, popRate, () => randomIn(0.35, 1));
    }

    /** Schedule Poisson-timed one-shots up to `until`; returns the next event time */
    #fire(pool, next, until, rate, level) {
        if (rate < 0.01) return until;
        const ctx = Tone.getContext().rawContext;
        while (next < until) {
            const source = ctx.createBufferSource();
            source.buffer = pool[Math.floor(Math.random() * pool.length)].get();
            source.playbackRate.value = randomIn(0.75, 1.3);
            const gain = ctx.createGain();
            gain.gain.value = level();
            source.connect(gain);
            Tone.connect(gain, this.crackleBus);
            source.onended = () => gain.disconnect();
            source.start(next);
            next += -Math.log(1 - Math.random()) / rate;
        }
        return next;
    }
}

// Runs the pattern on Tone's Transport. One callback per 16th works out every
// tick inside it (up to four hits at ×16) and schedules each at its exact
// time, plus the drum's shuffle. Lights go through Tone.Draw so they line up
// with what you hear.
//
// The engine reads state through getState() on every tick, so edits apply
// straight away without restarting.

import * as Tone from 'tone';
import { TICKS_PER_BEAT, TICKS_PER_STEP, rowAt, rowFires, signalAt, swingTicks } from './logic.js';
import { DrumKit } from './voices.js';

const ACCENT_ROW = 6;
const BASE_VELOCITY = 0.7;

export class DrumEngine {
    /**
     * getState: () => { gens, rows, accentAmount }
     * onDraw: { step(tick), generator(index, on), drum(index, accented), accent(on) }
     */
    constructor(getState, onDraw) {
        this.getState = getState;
        this.onDraw = onDraw;
        this.kit = null;
        this.tick = 0;
        this.repeatId = null;
    }

    get playing() {
        return this.repeatId !== null;
    }

    setBpm(bpm) {
        Tone.Transport.bpm.value = bpm;
    }

    start(bpm) {
        if (this.playing) return;
        // Created on first play so Tone only builds nodes once audio is allowed
        this.kit ??= new DrumKit();
        this.kit.start();

        this.tick = 0;
        this.setBpm(bpm);
        this.repeatId = Tone.Transport.scheduleRepeat(time => this.#step(time), '16n', 0);
        Tone.Transport.start('+0.05');
    }

    stop() {
        if (!this.playing) return;
        Tone.Transport.clear(this.repeatId);
        Tone.Transport.stop();
        Tone.Draw.cancel(0);
        this.repeatId = null;
        this.kit.stop();
    }

    #step(time) {
        const { gens, rows, accentAmount } = this.getState();
        const tickSeconds = 60 / Tone.Transport.bpm.value / TICKS_PER_BEAT;
        const accentRow = rows[ACCENT_ROW];
        const first = this.tick;

        Tone.Draw.schedule(() => this.onDraw.step(first), time);

        for (let j = 0; j < TICKS_PER_STEP; j++) {
            const t = first + j;
            const at = time + j * tickSeconds;

            gens.forEach((g, i) => {
                const now = signalAt(g, t);
                if (now !== signalAt(g, t - 1)) {
                    Tone.Draw.schedule(() => this.onDraw.generator(i, now, g.mode === 'gate'), at);
                }
            });

            const accentOn = rowAt(gens, accentRow, t);
            if (accentOn !== rowAt(gens, accentRow, t - 1)) {
                Tone.Draw.schedule(() => this.onDraw.accent(accentOn), at);
            }

            for (let r = 0; r < ACCENT_ROW; r++) {
                if (!rowFires(gens, rows[r], t)) continue;
                const hitAt = at + swingTicks(t, rows[r]) * tickSeconds;
                const velocity = accentOn ? BASE_VELOCITY + (1 - BASE_VELOCITY) * accentAmount : BASE_VELOCITY;
                this.kit.trigger(r, hitAt, velocity);
                Tone.Draw.schedule(() => this.onDraw.drum(r, accentOn), hitAt);
            }
        }

        this.tick += TICKS_PER_STEP;
    }
}

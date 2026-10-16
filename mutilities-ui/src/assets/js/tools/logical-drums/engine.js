// Runs the pattern on the shared clock (core/clock.js). One callback per
// 16th works out every tick inside it (up to four hits at ×16) and schedules
// each at its exact time, plus the drum's shuffle. Lights go through
// Tone.Draw so they line up with what you hear.
//
// The position comes from the clock, not a counter of our own, so the drums
// are always in phase with anything else on the clock, however they were
// started. The clock starts and stops the transport; the engine only adds and
// removes its own repeat.
//
// The engine reads state through getState() on every tick, so edits apply
// straight away without restarting.

import * as Tone from 'tone';
import { clock } from '../../core/clock.js';
import { ACCENT_ROW, TICKS_PER_BEAT, TICKS_PER_STEP, rowAt, rowFires, signalAt, swingTicks } from './logic.js';
import { DrumKit } from './voices.js';

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
        this.repeatId = null;
    }

    /** Called by the clock with a bar-line position (Tone ticks) to start from */
    start(startTicks) {
        if (this.repeatId !== null) return;
        // Created on first play so Tone only builds nodes once audio is allowed
        this.kit ??= new DrumKit();
        this.kit.start();
        this.repeatId = Tone.Transport.scheduleRepeat(time => this.#step(time), '16n', `${startTicks}i`);
    }

    /** Play one drum now, e.g. when its name is tapped. Works whether or not the pattern is running */
    audition(index, velocity = 0.85) {
        this.kit ??= new DrumKit();
        this.kit.start();
        this.kit.trigger(index, Tone.now() + 0.01, velocity);
    }

    stop() {
        if (this.repeatId === null) return;
        Tone.Transport.clear(this.repeatId);
        this.repeatId = null;
        this.kit.stop();
    }

    #step(time) {
        const { gens, rows, accentAmount } = this.getState();
        const tickSeconds = 60 / Tone.Transport.bpm.value / TICKS_PER_BEAT;
        const accentRow = rows[ACCENT_ROW];
        // Snap to the 16th grid; the repeat runs on it, this just absorbs rounding
        const first = Math.round(clock.tickAt(time) / TICKS_PER_STEP) * TICKS_PER_STEP;

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
    }
}

// Drift keeps a drone from sitting still. One amount (0–1) controls it:
//
// - Any amount above 0: each voice's pitch wanders by random walk (never a
//   sine), so voices beat slowly against each other. It grows across the whole
//   range: ±15 cents at 50%, ±40 cents at 100%, where it's clearly audible
//   (like a slightly warped tape) without being seasick. Higher amounts also
//   wander a bit faster.
// - Above 50%: as well as that, now and then one voice glides to a nearby note
//   in the key. At 50% that's roughly every two and a half minutes; at 100%
//   roughly every 20 seconds. Glides take several seconds, so the chord morphs
//   rather than jumps.

const randomIn = (min, max) => min + Math.random() * (max - min);
const logScale = (v, min, max) => min * (max / min) ** v;

const NOTE_CHANGE_FROM = 0.5;
const NOTE_INTERVAL_AT_HALF = 150;
const NOTE_INTERVAL_AT_FULL = 20;
const MAX_STEP = 4;

const centsFor = amount => (amount <= 0.5 ? amount * 30 : 15 + (amount - 0.5) * 50);
const lerp = (a, b, v) => a + (b - a) * v;

/**
 * engine: setDetune(index, cents, seconds)
 * getVoices / getNoteOptions: current state
 * changeNote(index, note, glideSeconds): updates state, UI and engine
 */
export function createDrift({ engine, getVoices, getNoteOptions, changeNote }) {
    let amount = 0;
    let running = false;
    const detuneTimers = [];
    let noteTimer = null;

    const wanderPitch = (index) => {
        const cents = centsFor(amount);
        const time = randomIn(lerp(6, 3, amount), lerp(16, 9, amount));
        engine.setDetune(index, randomIn(-cents, cents), time);
        detuneTimers[index] = setTimeout(() => wanderPitch(index), time * 1000 * randomIn(0.7, 1));
    };

    const scheduleNoteChange = () => {
        clearTimeout(noteTimer);
        if (amount <= NOTE_CHANGE_FROM) return;
        const v = (amount - NOTE_CHANGE_FROM) / (1 - NOTE_CHANGE_FROM);
        const mean = logScale(v, NOTE_INTERVAL_AT_HALF, NOTE_INTERVAL_AT_FULL);
        noteTimer = setTimeout(() => {
            moveOneVoice();
            scheduleNoteChange();
        }, mean * randomIn(0.5, 1.5) * 1000);
    };

    // A nearby scale note: small steps are more likely than big ones
    const moveOneVoice = () => {
        const options = getNoteOptions();
        const voices = getVoices().map((v, i) => ({ ...v, index: i })).filter(v => v.on);
        if (!voices.length) return;

        const voice = voices[Math.floor(Math.random() * voices.length)];
        const from = Math.max(0, options.indexOf(voice.note));
        const steps = [];
        for (let d = -MAX_STEP; d <= MAX_STEP; d++) {
            const to = from + d;
            if (d !== 0 && to >= 0 && to < options.length) {
                for (let w = 0; w < MAX_STEP + 1 - Math.abs(d); w++) steps.push(to);
            }
        }
        if (!steps.length) return;
        const note = options[steps[Math.floor(Math.random() * steps.length)]];
        changeNote(voice.index, note, randomIn(3, 8));
    };

    const stopAll = () => {
        detuneTimers.forEach(clearTimeout);
        clearTimeout(noteTimer);
    };

    const sync = () => {
        stopAll();
        const voiceCount = getVoices().length;
        if (!running || amount <= 0) {
            for (let i = 0; i < voiceCount; i++) engine.setDetune(i, 0, 2);
            return;
        }
        for (let i = 0; i < voiceCount; i++) wanderPitch(i);
        scheduleNoteChange();
    };

    return {
        setAmount(next) {
            const wasOff = amount <= 0;
            const crossed = (amount > NOTE_CHANGE_FROM) !== (next > NOTE_CHANGE_FROM);
            amount = next;
            // Slider drags shouldn't restart every wander, only on/off and the 50% line
            if (wasOff || next <= 0 || crossed) sync();
        },
        setRunning(next) {
            running = next;
            sync();
        },
    };
}

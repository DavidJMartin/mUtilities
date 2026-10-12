// Saturation curves for a WaveShaper. Drive, level correction and the
// dry/wet mix are all baked into the curve:
//   - drive inside the curve keeps the input within the shaper's -1..1 range
//   - mixing inside the curve keeps dry and saturated perfectly in time; a
//     separate dry path cancels against the oversampler's small delay

const CURVE_SIZE = 4096;
const MAX_DRIVE_DB = 30;
const TUBE_BIAS = 0.3;

// The level correction is measured on a four-note test chord at roughly the
// level of the summed drone voices going into the saturator.
const REFERENCE_TONE_LEVEL = 0.1;
const REFERENCE_CYCLES = [8, 12, 18, 27]; // per test window, roughly a chord

// Saturated signal sits slightly above the dry level so switching it on is
// noticeable without a big jump.
const LIFT_DB = 5;

export const SATURATION_MODES = [
    { value: 'soft', label: 'SOFT' },
    { value: 'tube', label: 'TUBE' },
    { value: 'fold', label: 'FOLD' },
    { value: 'crush', label: 'CRUSH' },
];

function shaperFor(mode, drive) {
    const gain = Math.pow(10, (drive * MAX_DRIVE_DB) / 20);

    switch (mode) {
        case 'soft':
            return x => Math.tanh(gain * x);
        case 'tube': {
            // Biasing the curve clips the two halves of the wave unevenly,
            // which adds the even harmonics that make valves sound warm
            const offset = Math.tanh(TUBE_BIAS);
            return x => Math.tanh(gain * x + TUBE_BIAS) - offset;
        }
        case 'fold':
            // Past the peak the wave folds back down instead of flattening
            return x => Math.sin(gain * x);
        case 'crush': {
            // Drive lowers the bit depth from 8 bits to 2
            const levels = 2 ** (7 - Math.round(drive * 6));
            return x => Math.round(x * levels) / levels;
        }
        default:
            throw new Error(`Unknown saturation mode: ${mode}`);
    }
}

export function saturationCurve(mode, drive, mix) {
    const shape = shaperFor(mode, drive);
    const makeup = makeupGain(shape);
    const curve = new Float32Array(CURVE_SIZE);
    for (let i = 0; i < CURVE_SIZE; i++) {
        const x = (i / (CURVE_SIZE - 1)) * 2 - 1;
        curve[i] = (1 - mix) * x + mix * makeup * shape(x);
    }
    return curve;
}

// The gain that brings the test chord's RMS level after shaping back to its
// dry level, plus the small lift.
function makeupGain(shape) {
    const samples = 4096;
    let dry = 0;
    let wet = 0;
    for (let i = 0; i < samples; i++) {
        const t = (2 * Math.PI * i) / samples;
        const x = REFERENCE_CYCLES.reduce((sum, c) => sum + REFERENCE_TONE_LEVEL * Math.sin(c * t), 0);
        const y = shape(x);
        dry += x * x;
        wet += y * y;
    }
    if (wet < 1e-9) return 1;
    return Math.sqrt(dry / wet) * Math.pow(10, LIFT_DB / 20);
}

// The Tone slider runs 0..1; map it exponentially so it feels even across
// the range (500 Hz to 12 kHz).
export function toneFrequency(value) {
    return 500 * Math.pow(24, value);
}
